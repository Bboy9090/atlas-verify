'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface RequestItem {
  id: string
  identifierType: string
  contactEmail: string
  status: 'pending' | 'approved' | 'rejected'
  verificationNote: string | null
  resolutionNote: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function PrivacyRequestsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [notes, setNotes] = useState<Record<string, { verification: string; resolution: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    try {
      const response = await fetch('/api/privacy/suppression/review', { cache: 'no-store' })
      const body = await response.json()
      if (response.status === 403) {
        setForbidden(true)
        return
      }
      if (!response.ok) throw new Error(body.error || 'Failed to load privacy requests')
      setRequests(body.requests)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load privacy requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status])

  const review = async (item: RequestItem, nextStatus: 'approved' | 'rejected') => {
    const note = notes[item.id] || { verification: '', resolution: '' }
    if (note.verification.trim().length < 3 || note.resolution.trim().length < 3) {
      toast.error('Verification and resolution notes are required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/privacy/suppression/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: nextStatus,
          verificationNote: note.verification.trim(),
          resolutionNote: note.resolution.trim(),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Review failed')
      toast.success(nextStatus === 'approved' ? 'Suppression approved' : 'Suppression rejected')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Review failed')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (forbidden) {
    return (
      <DashboardLayout>
        <Card className="mx-auto max-w-xl border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-200">
              <ShieldAlert className="h-5 w-5" />
              Privacy reviewer access required
            </CardTitle>
            <CardDescription className="text-slate-400">
              This queue is fail-closed. Your account email must be explicitly listed in the server-side PRIVACY_REVIEWER_EMAILS configuration.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Privacy Requests</h1>
          <p className="mt-1 text-slate-400">
            Review suppression requests using data-minimizing verification. Approval activates an exact-match live-enrichment block.
          </p>
        </div>

        {requests.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-10 text-center text-slate-400">
              No suppression requests are currently recorded.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map(item => {
              const note = notes[item.id] || { verification: '', resolution: '' }
              return (
                <Card key={item.id} className="border-slate-700 bg-slate-800/50">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-white">{item.identifierType} suppression request</CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          Contact: {item.contactEmail || 'contact removed after resolution'} • Submitted {new Date(item.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'pending'
                            ? 'border-yellow-500/30 text-yellow-300'
                            : item.status === 'approved'
                              ? 'border-green-500/30 text-green-300'
                              : 'border-red-500/30 text-red-300'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.status === 'pending' ? (
                      <div className="space-y-3">
                        <Input
                          value={note.verification}
                          onChange={event => setNotes(current => ({
                            ...current,
                            [item.id]: { ...note, verification: event.target.value },
                          }))}
                          maxLength={2000}
                          className="border-slate-600 bg-slate-900 text-white"
                          placeholder="Verification note — document the minimum verification performed"
                        />
                        <Input
                          value={note.resolution}
                          onChange={event => setNotes(current => ({
                            ...current,
                            [item.id]: { ...note, resolution: event.target.value },
                          }))}
                          maxLength={2000}
                          className="border-slate-600 bg-slate-900 text-white"
                          placeholder="Resolution note — why this request is approved or rejected"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => review(item, 'approved')}
                            disabled={saving}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Approve suppression
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => review(item, 'rejected')}
                            disabled={saving}
                            className="border-red-500/40 text-red-300"
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm text-slate-400">
                        <div>Verification: {item.verificationNote || '—'}</div>
                        <div>Resolution: {item.resolutionNote || '—'}</div>
                        {item.reviewedAt && <div>Reviewed {new Date(item.reviewedAt).toLocaleString()}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
