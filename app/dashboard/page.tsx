'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Users, Zap, TrendingUp, Clock, AlertCircle,
  FolderOpen, CheckCircle, Activity, Download,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/dashboard-layout'

interface Stats {
  cases: {
    total: number
    open: number
    inProgress: number
    closed: number
  }
  subjects: { total: number }
  enrichments: {
    total: number
    byProvider: Array<{ provider: string; count: number; avgConfidence: number }>
  }
  recentActivity: Array<{
    id: string
    action: string
    createdAt: string
    metadata: Record<string, unknown>
    subject: { fullName: string } | null
  }>
}

const actionLabel: Record<string, string> = {
  CREATE_CASE: 'Created case',
  UPDATE_CASE: 'Updated case',
  DELETE_CASE: 'Deleted case',
  CREATE_SUBJECT: 'Added subject',
  UPDATE_SUBJECT: 'Updated subject',
  DELETE_SUBJECT: 'Removed subject',
  RUN_ENRICHMENT: 'Ran enrichment',
  LOGIN: 'Logged in',
  LOGOUT: 'Logged out',
}

const actionColors: Record<string, string> = {
  CREATE_CASE: 'bg-green-500',
  UPDATE_CASE: 'bg-blue-500',
  DELETE_CASE: 'bg-red-500',
  CREATE_SUBJECT: 'bg-green-500',
  UPDATE_SUBJECT: 'bg-blue-500',
  DELETE_SUBJECT: 'bg-red-500',
  RUN_ENRICHMENT: 'bg-purple-500',
  LOGIN: 'bg-yellow-500',
  LOGOUT: 'bg-slate-500',
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        toast.error('Failed to load dashboard stats')
      }
    } catch {
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (type: 'cases' | 'subjects') => {
    try {
      const res = await fetch(`/api/export?type=${type}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${type === 'cases' ? 'Cases' : 'Subjects'} exported`)
    } catch {
      toast.error('Export failed')
    }
  }

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
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">
              Welcome back, {session?.user?.name || session?.user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('cases')}
              className="border-slate-600 text-slate-300 hover:text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Cases
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('subjects')}
              className="border-slate-600 text-slate-300 hover:text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Subjects
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.cases.total ?? 0}</p>
                  <p className="text-xs text-slate-400">Total Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.subjects.total ?? 0}</p>
                  <p className="text-xs text-slate-400">Subjects</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.enrichments.total ?? 0}</p>
                  <p className="text-xs text-slate-400">Enrichments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats?.enrichments.byProvider.length
                      ? Math.round(
                          (stats.enrichments.byProvider.reduce((s, p) => s + p.avgConfidence, 0) /
                            stats.enrichments.byProvider.length) *
                            100
                        )
                      : 0}%
                  </p>
                  <p className="text-xs text-slate-400">Avg. Confidence</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Case Status Breakdown + Enrichment Providers */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Case Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Case Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Open', value: stats?.cases.open ?? 0, color: 'bg-green-500', icon: FolderOpen },
                { label: 'In Progress', value: stats?.cases.inProgress ?? 0, color: 'bg-yellow-500', icon: AlertCircle },
                { label: 'Closed', value: stats?.cases.closed ?? 0, color: 'bg-slate-500', icon: CheckCircle },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">{label}</span>
                  </div>
                  <span className="text-white font-semibold">{value}</span>
                </div>
              ))}
              {stats?.cases.total === 0 && (
                <p className="text-slate-500 text-sm text-center py-2">No cases yet</p>
              )}
            </CardContent>
          </Card>

          {/* Enrichment Providers */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                Enrichment Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.enrichments.byProvider.length ? (
                stats.enrichments.byProvider.map(p => (
                  <div key={p.provider} className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-300 text-sm capitalize">
                        {p.provider.replace(/_/g, ' ')}
                      </p>
                      <p className="text-slate-500 text-xs">{p.count} runs</p>
                    </div>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      {Math.round(p.avgConfidence * 100)}% conf.
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-2">
                  No enrichments run yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity + Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.recentActivity.length ? (
                stats.recentActivity.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${actionColors[log.action] ?? 'bg-slate-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm">
                        {actionLabel[log.action] ?? log.action}
                        {log.subject && (
                          <span className="text-slate-400"> – {log.subject.fullName}</span>
                        )}
                        {!log.subject && log.metadata?.title && (
                          <span className="text-slate-400"> – {String(log.metadata.title)}</span>
                        )}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-2">No activity yet</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Quick Actions</CardTitle>
              <CardDescription className="text-slate-400">
                Jump to key sections of the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/cases" className="block">
                <Button className="w-full justify-start bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30">
                  <FileText className="h-4 w-4 mr-2" />
                  View All Cases
                </Button>
              </Link>
              <Link href="/audit-logs" className="block">
                <Button className="w-full justify-start bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600">
                  <Activity className="h-4 w-4 mr-2" />
                  View Audit Logs
                </Button>
              </Link>
              <Button
                className="w-full justify-start bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600"
                onClick={() => handleExport('cases')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All Cases (CSV)
              </Button>
              <Button
                className="w-full justify-start bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600"
                onClick={() => handleExport('subjects')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All Subjects (CSV)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
