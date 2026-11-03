'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BellRing,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Trash2,
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ChangeEntry {
  key: string
  field: string
  sourceName: string
  valueLabel: string
}

interface ChangeSummary {
  added: ChangeEntry[]
  removed: ChangeEntry[]
  addedCount: number
  removedCount: number
  kind?: string
}

interface MonitorCheck {
  id: string
  snapshotHash: string
  factCount: number
  sourceCount: number
  changed: boolean
  changeSummary: ChangeSummary | null
  checkedAt: string
}

interface Monitor {
  id: string
  enabled: boolean
  baselineHash: string
  baselineFactCount: number
  baselineSourceCount: number
  lastCheckedAt: string | null
  lastChangedAt: string | null
  lastChangeSummary: ChangeSummary | null
  createdAt: string
  updatedAt: string
  subject: {
    id: string
    fullName: string
    caseId: string
    case: {
      id: string
      title: string
      status: string
    }
  }
  checks: MonitorCheck[]
}

interface MonitorListResponse {
  monitors: Monitor[]
  automaticProviderMonitoring: boolean
  description: string
}

interface SubjectMonitorResponse {
  subject: {
    id: string
    fullName: string
    case: {
      id: string
      title: string
    }
  }
  monitor: Monitor | null
  currentSnapshot: {
    hash: string
    factCount: number
    sourceCount: number
  }
  automaticProviderMonitoring: boolean
}

export default function MonitoringPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<MonitorListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [focus, setFocus] = useState<SubjectMonitorResponse | null>(null)
  const [focusCaseId, setFocusCaseId] = useState('')
  const [focusSubjectId, setFocusSubjectId] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadMonitors = async () => {
    try {
      const response = await fetch('/api/monitoring', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load monitoring')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load monitoring')
    } finally {
      setLoading(false)
    }
  }

  const loadFocusedSubject = async (caseId: string, subjectId: string) => {
    if (!caseId || !subjectId) return
    try {
      const response = await fetch(
        `/api/cases/${caseId}/subjects/${subjectId}/monitor`,
        { cache: 'no-store' }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load subject monitor')
      setFocus(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load subject monitor')
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return

    const params = new URLSearchParams(window.location.search)
    const caseId = params.get('caseId') || ''
    const subjectId = params.get('subjectId') || ''
    setFocusCaseId(caseId)
    setFocusSubjectId(subjectId)

    loadMonitors()
    if (caseId && subjectId) loadFocusedSubject(caseId, subjectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const changedCount = useMemo(
    () => data?.monitors.filter(monitor => Boolean(monitor.lastChangedAt)).length ?? 0,
    [data]
  )

  const startOrReset = async () => {
    if (!focusCaseId || !focusSubjectId) return
    setWorkingId(focusSubjectId)
    try {
      const response = await fetch(
        `/api/cases/${focusCaseId}/subjects/${focusSubjectId}/monitor`,
        { method: 'POST' }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to start monitoring')
      toast.success(body.message || 'Monitoring updated')
      await Promise.all([
        loadMonitors(),
        loadFocusedSubject(focusCaseId, focusSubjectId),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start monitoring')
    } finally {
      setWorkingId(null)
    }
  }

  const checkMonitor = async (monitorId: string) => {
    setWorkingId(monitorId)
    try {
      const response = await fetch(`/api/monitoring/${monitorId}/check`, {
        method: 'POST',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Monitor check failed')
      toast.success(body.message || 'Monitor checked')
      await loadMonitors()
      if (focusCaseId && focusSubjectId) {
        await loadFocusedSubject(focusCaseId, focusSubjectId)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Monitor check failed')
    } finally {
      setWorkingId(null)
    }
  }

  const deleteMonitor = async (monitor: Monitor) => {
    setWorkingId(monitor.id)
    try {
      const response = await fetch(
        `/api/cases/${monitor.subject.case.id}/subjects/${monitor.subject.id}/monitor`,
        { method: 'DELETE' }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to delete monitor')
      toast.success('Monitoring removed')
      await loadMonitors()
      if (focusSubjectId === monitor.subject.id) {
        await loadFocusedSubject(monitor.subject.case.id, monitor.subject.id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete monitor')
    } finally {
      setWorkingId(null)
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

  const monitors = data?.monitors ?? []

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <BellRing className="h-7 w-7 text-blue-400" />
            Monitoring
          </h1>
          <p className="mt-1 text-slate-400">
            Detect changes in evidence already stored in AtlasVerify using deterministic checkpoints.
          </p>
        </div>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-200">
              <ShieldCheck className="h-5 w-5" />
              Verified monitoring boundary
            </CardTitle>
            <CardDescription className="text-slate-400">
              This version does not claim automatic provider monitoring. A check compares the current stored evidence
              against the previous checkpoint and then advances the checkpoint. Provider polling will require configured
              provider credentials and a scheduler.
            </CardDescription>
          </CardHeader>
        </Card>

        {focus && (
          <Card className="border-blue-500/30 bg-slate-800/60">
            <CardHeader>
              <CardTitle className="text-white">Monitor {focus.subject.fullName}</CardTitle>
              <CardDescription className="text-slate-400">
                {focus.subject.case.title} • current stored evidence: {focus.currentSnapshot.factCount} facts from {focus.currentSnapshot.sourceCount} sources
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                onClick={startOrReset}
                disabled={workingId === focusSubjectId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <BellRing className="mr-2 h-4 w-4" />
                {focus.monitor ? 'Reset checkpoint to current evidence' : 'Start monitoring'}
              </Button>
              {focus.monitor && (
                <Button
                  variant="outline"
                  onClick={() => checkMonitor(focus.monitor!.id)}
                  disabled={workingId === focus.monitor.id}
                  className="border-slate-600 text-slate-300"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check now
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">{monitors.length}</div>
              <div className="mt-1 text-sm text-slate-400">saved monitors</div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">{changedCount}</div>
              <div className="mt-1 text-sm text-slate-400">monitors with recorded change events</div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">
                {monitors.reduce((sum, monitor) => sum + monitor.checks.length, 0)}
              </div>
              <div className="mt-1 text-sm text-slate-400">recent checkpoint records shown</div>
            </CardContent>
          </Card>
        </div>

        {monitors.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-10 text-center text-slate-400">
              No subjects are monitored yet. Open a subject profile and choose Monitoring to create a checkpoint.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {monitors.map(monitor => {
              const latest = monitor.checks[0] ?? null
              const summary = monitor.lastChangeSummary

              return (
                <Card key={monitor.id} className="border-slate-700 bg-slate-800/50">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-white">{monitor.subject.fullName}</CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          Case: {monitor.subject.case.title}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                          {monitor.baselineFactCount} facts
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {monitor.baselineSourceCount} sources
                        </Badge>
                        {latest?.changed ? (
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">
                            <TriangleAlert className="mr-1 h-3 w-3" />
                            changed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500/30 text-green-300">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            checkpointed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-4 w-4" />
                        Last checked {monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleString() : 'never'}
                      </span>
                      {monitor.lastChangedAt && (
                        <span>Last change {new Date(monitor.lastChangedAt).toLocaleString()}</span>
                      )}
                    </div>

                    {summary && (summary.addedCount > 0 || summary.removedCount > 0) && (
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <div className="font-medium text-yellow-200">
                          Last detected change: +{summary.addedCount} / -{summary.removedCount}
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {summary.added.slice(0, 5).map(entry => (
                            <div key={`added-${entry.key}`} className="text-xs text-green-300">
                              + {entry.field}: {entry.valueLabel} ({entry.sourceName})
                            </div>
                          ))}
                          {summary.removed.slice(0, 5).map(entry => (
                            <div key={`removed-${entry.key}`} className="text-xs text-red-300">
                              − {entry.field}: {entry.valueLabel} ({entry.sourceName})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => checkMonitor(monitor.id)}
                        disabled={workingId === monitor.id}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        Check stored evidence now
                      </Button>
                      <Link href={`/cases/${monitor.subject.case.id}/subjects/${monitor.subject.id}`}>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                          Open profile
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMonitor(monitor)}
                        disabled={workingId === monitor.id}
                        className="border-red-500/30 text-red-300"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove monitor
                      </Button>
                    </div>

                    {monitor.checks.length > 0 && (
                      <div className="border-t border-slate-700 pt-3">
                        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Recent checks
                        </div>
                        <div className="space-y-1 text-xs text-slate-400">
                          {monitor.checks.slice(0, 5).map(check => (
                            <div key={check.id} className="flex flex-wrap justify-between gap-2">
                              <span>
                                {check.changed ? 'Change detected' : 'No change'} • {check.factCount} facts • {check.sourceCount} sources
                              </span>
                              <span>{new Date(check.checkedAt).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
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
