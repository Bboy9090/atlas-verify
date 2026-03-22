'use client'

import { useEffect, useState, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, UserCircle, Search, Phone, Mail, MapPin, Trash2, Edit, Play, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/dashboard-layout'

interface EnrichmentResult {
  id: string
  provider: string
  providerType: string
  payload: {
    success: boolean
    data: Record<string, unknown>
    confidenceScore: number
    error?: string
  }
  confidenceScore: number
  timestamp: string
}

interface Subject {
  id: string
  fullName: string
  phoneE164: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  notes: string | null
  createdAt: string
  enrichmentResults: EnrichmentResult[]
}

interface Case {
  id: string
  title: string
  description: string | null
  status: string
  createdAt: string
  subjects: Subject[]
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  'in-progress': { label: 'In Progress', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  closed: { label: 'Closed', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [loading, setLoading] = useState(true)
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [newSubject, setNewSubject] = useState({
    fullName: '', phoneE164: '', email: '', address: '', city: '', state: '', notes: ''
  })
  const [creating, setCreating] = useState(false)
  const [enrichingSubjects, setEnrichingSubjects] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('subjects')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchCase()
    }
  }, [session, resolvedParams.id])

  const fetchCase = async () => {
    try {
      const res = await fetch(`/api/cases/${resolvedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setCaseData(data)
      } else if (res.status === 404) {
        toast.error('Case not found')
        router.push('/cases')
      }
    } catch {
      toast.error('Failed to fetch case')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!caseData || updatingStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/cases/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setCaseData(prev => prev ? { ...prev, status: newStatus } : prev)
        toast.success('Case status updated')
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleExportSubjects = async () => {
    try {
      const res = await fetch(`/api/export?type=subjects&caseId=${resolvedParams.id}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `subjects-${resolvedParams.id}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Subjects exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const handleCreateOrUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubject.fullName.trim()) {
      toast.error('Full name is required')
      return
    }

    setCreating(true)
    try {
      const url = editSubject
        ? `/api/cases/${resolvedParams.id}/subjects/${editSubject.id}`
        : `/api/cases/${resolvedParams.id}/subjects`
      
      const res = await fetch(url, {
        method: editSubject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubject)
      })

      if (res.ok) {
        toast.success(editSubject ? 'Subject updated' : 'Subject created')
        setSubjectDialogOpen(false)
        setEditSubject(null)
        setNewSubject({ fullName: '', phoneE164: '', email: '', address: '', city: '', state: '', notes: '' })
        fetchCase()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Operation failed')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return

    try {
      const res = await fetch(`/api/cases/${resolvedParams.id}/subjects/${subjectId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Subject deleted')
        fetchCase()
      } else {
        toast.error('Failed to delete subject')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  const handleRunEnrichment = async (subject: Subject) => {
    setEnrichingSubjects(prev => new Set(prev).add(subject.id))

    try {
      const res = await fetch(`/api/cases/${resolvedParams.id}/subjects/${subject.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Enrichment complete: ${data.results.length} provider(s) processed`)
        fetchCase()
        setActiveTab('results')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Enrichment failed')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setEnrichingSubjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(subject.id)
        return newSet
      })
    }
  }

  const openEditDialog = (subject: Subject) => {
    setEditSubject(subject)
    setNewSubject({
      fullName: subject.fullName,
      phoneE164: subject.phoneE164 || '',
      email: subject.email || '',
      address: subject.address || '',
      city: subject.city || '',
      state: subject.state || '',
      notes: subject.notes || ''
    })
    setSubjectDialogOpen(true)
  }

  const closeDialog = () => {
    setSubjectDialogOpen(false)
    setEditSubject(null)
    setNewSubject({ fullName: '', phoneE164: '', email: '', address: '', city: '', state: '', notes: '' })
  }

  const allResults = caseData?.subjects.flatMap(s => 
    s.enrichmentResults.map(r => ({ ...r, subjectName: s.fullName, subjectId: s.id }))
  ) || []

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!caseData) return null

  const sc = statusConfig[caseData.status] ?? statusConfig.open

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/cases">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{caseData.title}</h1>
              <Badge variant="outline" className={`text-xs ${sc.className}`}>{sc.label}</Badge>
            </div>
            {caseData.description && (
              <p className="text-slate-400 mt-1">{caseData.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status selector */}
            <Select value={caseData.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-white text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="open" className="text-slate-200">Open</SelectItem>
                <SelectItem value="in-progress" className="text-slate-200">In Progress</SelectItem>
                <SelectItem value="closed" className="text-slate-200">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSubjects}
              className="border-slate-600 text-slate-300 hover:text-white h-9"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Dialog open={subjectDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 h-9">
                  <Plus className="h-4 w-4 mr-2" /> Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editSubject ? 'Edit Subject' : 'Add New Subject'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateOrUpdateSubject} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="text-slate-300">Full Name *</Label>
                      <Input
                        value={newSubject.fullName}
                        onChange={(e) => setNewSubject({ ...newSubject, fullName: e.target.value })}
                        placeholder="John Doe"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Phone (E.164)</Label>
                      <Input
                        value={newSubject.phoneE164}
                        onChange={(e) => setNewSubject({ ...newSubject, phoneE164: e.target.value })}
                        placeholder="+14155551234"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Email</Label>
                      <Input
                        type="email"
                        value={newSubject.email}
                        onChange={(e) => setNewSubject({ ...newSubject, email: e.target.value })}
                        placeholder="john@example.com"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-slate-300">Address</Label>
                      <Input
                        value={newSubject.address}
                        onChange={(e) => setNewSubject({ ...newSubject, address: e.target.value })}
                        placeholder="123 Main St"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">City</Label>
                      <Input
                        value={newSubject.city}
                        onChange={(e) => setNewSubject({ ...newSubject, city: e.target.value })}
                        placeholder="San Francisco"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">State</Label>
                      <Input
                        value={newSubject.state}
                        onChange={(e) => setNewSubject({ ...newSubject, state: e.target.value })}
                        placeholder="CA"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-slate-300">Notes</Label>
                      <Textarea
                        value={newSubject.notes}
                        onChange={(e) => setNewSubject({ ...newSubject, notes: e.target.value })}
                        placeholder="Additional notes..."
                        className="bg-slate-900 border-slate-600 text-white"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeDialog} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={creating}>
                      {creating ? 'Saving...' : editSubject ? 'Update' : 'Add Subject'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="subjects" className="data-[state=active]:bg-blue-600">
              Subjects ({caseData.subjects.length})
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-blue-600">
              Results ({allResults.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="mt-6">
            {caseData.subjects.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <UserCircle className="h-16 w-16 text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No subjects yet</h3>
                  <p className="text-slate-400 text-center max-w-md mb-4">
                    Add subjects to this case to begin your investigation.
                  </p>
                  <Button onClick={() => setSubjectDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" /> Add First Subject
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {caseData.subjects.map((subject) => (
                  <Card key={subject.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          <UserCircle className="h-5 w-5 text-blue-500" />
                          {subject.fullName}
                        </CardTitle>
                        <CardDescription className="text-slate-400 mt-1">
                          Added {new Date(subject.createdAt).toLocaleDateString()}
                          {subject.enrichmentResults.length > 0 && (
                            <span className="ml-2">• {subject.enrichmentResults.length} enrichment result(s)</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRunEnrichment(subject)}
                          disabled={enrichingSubjects.has(subject.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {enrichingSubjects.has(subject.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                          {enrichingSubjects.has(subject.id) ? 'Running...' : 'Run Enrichment'}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(subject)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        {subject.phoneE164 && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="h-4 w-4 text-slate-500" />
                            {subject.phoneE164}
                          </div>
                        )}
                        {subject.email && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Mail className="h-4 w-4 text-slate-500" />
                            {subject.email}
                          </div>
                        )}
                        {(subject.city || subject.state) && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            {[subject.city, subject.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      {subject.notes && (
                        <p className="text-slate-400 mt-3 text-sm">{subject.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="mt-6">
            {allResults.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-16 w-16 text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No enrichment results yet</h3>
                  <p className="text-slate-400 text-center max-w-md">
                    Run enrichment on subjects to see results here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((result) => (
                  <Card key={result.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-white text-lg flex items-center gap-2">
                            {result.subjectName}
                            <Badge variant="outline" className="border-blue-500 text-blue-400">
                              {result.providerType === 'phone_lookup' ? 'Phone Lookup' : 'Web Search'}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            Provider: {result.provider} • {new Date(result.timestamp).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            result.confidenceScore >= 0.8 ? 'text-green-400' :
                            result.confidenceScore >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {Math.round(result.confidenceScore * 100)}%
                          </div>
                          <div className="text-xs text-slate-400">Confidence</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {result.payload.success ? (
                        <pre className="bg-slate-900 rounded-lg p-4 overflow-auto text-sm text-slate-300">
                          {JSON.stringify(result.payload.data, null, 2)}
                        </pre>
                      ) : (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                          Error: {result.payload.error || 'Unknown error'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
