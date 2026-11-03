'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flag,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Dispute {
  id: string
  status: 'open' | 'resolved' | 'rejected'
  reason: string
  requestedValue: unknown
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface EvidenceFact {
  id: string
  field: string
  value: unknown
  sourceName: string
  sourceType: string | null
  sourceUrl: string | null
  retrievedAt: string
  observedAt: string | null
  confidenceScore: number
  corroborationCount: number
  conflictCount: number
  disputes: Dispute[]
}

interface EvidenceReviewResponse {
  subject: {
    id: string
    fullName: string
  }
  facts: EvidenceFact[]
  openDisputeCount: number
}

function display(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export default function EvidenceReviewPage({
  params,
}: {
  params: Promise<{ id: string; subjectId: string }>
}) {
  const resolved = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<EvidenceReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFactId, setActiveFactId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [requestedValue, setRequestedValue] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    try {
      const response = await fetch(
        `/api/cases/${resolved.id}/subjects/${resolved.subjectId}/evidence/disputes`,
        { cache: 'no-store' }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load evidence review')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load evidence review')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, resolved.id, resolved.subjectId])

  const disputedFacts = useMemo(
    () => data?.facts.filter(fact => fact.disputes.length > 0).length ?? 0,
    [data]
  )

  const submitDispute = async (fact: EvidenceFact) => {
    if (reason.trim().length < 5) {
      toast.error('Add a clear reason for the challenge')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/cases/${resolved.id}/subjects/${resolved.subjectId}/evidence/disputes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evidenceFactId: fact.id,
            reason: reason.trim(),
            requestedValue: requestedValue.trim() || undefined,
          }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to submit dispute')

      toast.success('Evidence challenge recorded')
      setActiveFactId(null)
      setReason('')
      setRequestedValue('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit dispute')
    } finally {
      setSubmitting(false)
    }
  }

  const resolveDispute = async (
    dispute: Dispute,
    nextStatus: 'resolved' | 'rejected'
  ) => {
    const note = (resolutionNotes[dispute.id] || '').trim()
    if (note.length < 3) {
      toast.error('Add a resolution note')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/cases/${resolved.id}/subjects/${resolved.subjectId}/evidence/disputes/${dispute.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            resolutionNote: note,
          }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to resolve dispute')

      toast.success(nextStatus === 'resolved' ? 'Challenge resolved' : 'Challenge rejected')
      setResolutionNotes(current => {
        const next = { ...current }
        delete next[dispute.id]
        return next
      })
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute')
    } finally {
      setSubmitting(false)
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

  if (!data) return null

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <Link href={`/cases/${resolved.id}/subjects/${resolved.subjectId}`}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-white">Evidence Review</h1>
            <p className="mt-1 text-slate-400">
              Challenge findings without overwriting the original source record for {data.subject.fullName}.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">
              {data.openDisputeCount} open
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {disputedFacts} disputed fact{disputedFacts === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-blue-200">
              <ShieldCheck className="h-4 w-4" />
              Immutable correction workflow
            </CardTitle>
            <CardDescription className="text-slate-400">
              A dispute records your challenge, requested correction, and final resolution. The underlying evidence fact remains unchanged so provenance and auditability are preserved.
            </CardDescription>
          </CardHeader>
        </Card>

        {data.facts.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-10 text-center text-slate-400">
              No stored evidence facts are available for review.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.facts.map(fact => {
              const openDispute = fact.disputes.find(dispute => dispute.status === 'open')

              return (
                <Card key={fact.id} className="border-slate-700 bg-slate-800/50">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="break-words text-base text-white">
                          {display(fact.value)}
                        </CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          {fact.field} • {fact.sourceName}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                          {Math.round(fact.confidenceScore * 100)}% confidence
                        </Badge>
                        {fact.corroborationCount > 0 && (
                          <Badge variant="outline" className="border-green-500/30 text-green-300">
                            corroboration {fact.corroborationCount}
                          </Badge>
                        )}
                        {fact.conflictCount > 0 && (
                          <Badge variant="outline" className="border-red-500/30 text-red-300">
                            conflict {fact.conflictCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        Retrieved {new Date(fact.retrievedAt).toLocaleString()}
                      </span>
                      {!openDispute && activeFactId !== fact.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-500/30 text-yellow-300"
                          onClick={() => {
                            setActiveFactId(fact.id)
                            setReason('')
                            setRequestedValue('')
                          }}
                        >
                          <Flag className="mr-1 h-4 w-4" />
                          Challenge fact
                        </Button>
                      )}
                    </div>

                    {activeFactId === fact.id && !openDispute && (
                      <div className="space-y-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-200">
                            Why is this fact inaccurate, stale, or misattributed?
                          </label>
                          <textarea
                            value={reason}
                            onChange={event => setReason(event.target.value)}
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                            placeholder="Explain the problem with this evidence fact."
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-200">
                            Requested corrected value (optional)
                          </label>
                          <Input
                            value={requestedValue}
                            onChange={event => setRequestedValue(event.target.value)}
                            className="border-slate-600 bg-slate-900 text-white"
                            placeholder="Enter the corrected value, if known"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => submitDispute(fact)}
                            disabled={submitting}
                            className="bg-yellow-600 hover:bg-yellow-700"
                          >
                            Record challenge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setActiveFactId(null)}
                            disabled={submitting}
                            className="text-slate-400"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {fact.disputes.map(dispute => (
                      <div
                        key={dispute.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {dispute.status === 'open' ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                              ) : dispute.status === 'resolved' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="font-medium capitalize text-white">
                                {dispute.status} challenge
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">{dispute.reason}</p>
                            {dispute.requestedValue !== null && dispute.requestedValue !== undefined && (
                              <p className="mt-2 text-sm text-slate-400">
                                Requested correction: <span className="text-slate-200">{display(dispute.requestedValue)}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(dispute.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {dispute.status === 'open' ? (
                          <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                            <Input
                              value={resolutionNotes[dispute.id] || ''}
                              onChange={event => setResolutionNotes(current => ({
                                ...current,
                                [dispute.id]: event.target.value,
                              }))}
                              maxLength={2000}
                              className="border-slate-600 bg-slate-950 text-white"
                              placeholder="Resolution note: what was verified and why?"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => resolveDispute(dispute, 'resolved')}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveDispute(dispute, 'rejected')}
                                disabled={submitting}
                                className="border-red-500/40 text-red-300"
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Reject challenge
                              </Button>
                            </div>
                          </div>
                        ) : (
                          dispute.resolutionNote && (
                            <div className="mt-3 border-t border-slate-700 pt-3 text-sm text-slate-400">
                              Resolution: {dispute.resolutionNote}
                            </div>
                          )
                        )}
                      </div>
                    ))}
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
