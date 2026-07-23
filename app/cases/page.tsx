'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, Users, Calendar, Search, ArrowRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/dashboard-layout'

interface Case {
  id: string
  title: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    subjects: number
  }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  'in-progress': { label: 'In Progress', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  closed: { label: 'Closed', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

export default function CasesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCase, setNewCase] = useState({ title: '', description: '', status: 'open' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchCases()
    }
  }, [session])

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases')
      if (res.ok) {
        const data = await res.json()
        setCases(data)
      }
    } catch {
      toast.error('Failed to fetch cases')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCase.title.trim()) {
      toast.error('Title is required')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCase)
      })

      if (res.ok) {
        toast.success('Case created successfully')
        setDialogOpen(false)
        setNewCase({ title: '', description: '', status: 'open' })
        fetchCases()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create case')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCreating(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export?type=cases')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cases.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Cases exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Case Files</h1>
            <p className="text-slate-400">Manage your investigation cases</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-slate-600 text-slate-300 hover:text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> New Case
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Case</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCase} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-300">Title</Label>
                    <Input
                      id="title"
                      value={newCase.title}
                      onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                      placeholder="e.g., Background Check - John Doe"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-slate-300">Description</Label>
                    <Textarea
                      id="description"
                      value={newCase.description}
                      onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                      placeholder="Brief description of the case..."
                      className="bg-slate-900 border-slate-600 text-white"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-slate-300">Status</Label>
                    <Select
                      value={newCase.status}
                      onValueChange={(value) => setNewCase({ ...newCase, status: value })}
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="open" className="text-slate-200">Open</SelectItem>
                        <SelectItem value="in-progress" className="text-slate-200">In Progress</SelectItem>
                        <SelectItem value="closed" className="text-slate-200">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={creating}>
                      {creating ? 'Creating...' : 'Create Case'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-slate-200">All Statuses</SelectItem>
              <SelectItem value="open" className="text-slate-200">Open</SelectItem>
              <SelectItem value="in-progress" className="text-slate-200">In Progress</SelectItem>
              <SelectItem value="closed" className="text-slate-200">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cases Grid */}
        {filteredCases.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-slate-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {cases.length === 0 ? 'No cases yet' : 'No matching cases'}
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-4">
                {cases.length === 0
                  ? 'Create your first case to start managing subjects and running enrichment.'
                  : 'Try adjusting your search or filter.'}
              </p>
              {cases.length === 0 && (
                <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> Create First Case
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCases.map((caseItem) => {
              const sc = statusConfig[caseItem.status] ?? statusConfig.open
              return (
                <Link key={caseItem.id} href={`/cases/${caseItem.id}`}>
                  <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center justify-between gap-2">
                        <span className="truncate">{caseItem.title}</span>
                        <ArrowRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${sc.className}`}>{sc.label}</Badge>
                      </div>
                      {caseItem.description && (
                        <CardDescription className="text-slate-400 line-clamp-2 mt-1">
                          {caseItem.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{caseItem._count.subjects} subjects</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(caseItem.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
