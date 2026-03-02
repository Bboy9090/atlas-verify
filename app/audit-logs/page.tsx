'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { History, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/dashboard-layout'

interface AuditLog {
  id: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
  subject: { fullName: string } | null
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
  LOGOUT: 'bg-gray-500',
}

export default function AuditLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState('all')
  const limit = 20

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchLogs()
    }
  }, [session, offset, actionFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (actionFilter !== 'all') {
        params.set('action', actionFilter)
      }

      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (error) {
      toast.error('Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  if (status === 'loading') {
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
            <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
            <p className="text-slate-400">Track all actions and changes</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setOffset(0); }}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE_CASE">Create Case</SelectItem>
                <SelectItem value="UPDATE_CASE">Update Case</SelectItem>
                <SelectItem value="DELETE_CASE">Delete Case</SelectItem>
                <SelectItem value="CREATE_SUBJECT">Create Subject</SelectItem>
                <SelectItem value="UPDATE_SUBJECT">Update Subject</SelectItem>
                <SelectItem value="DELETE_SUBJECT">Delete Subject</SelectItem>
                <SelectItem value="RUN_ENRICHMENT">Run Enrichment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <History className="h-16 w-16 text-slate-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No audit logs yet</h3>
              <p className="text-slate-400 text-center max-w-md">
                Actions you take will be logged here for compliance tracking.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${actionColors[log.action] || 'bg-gray-500'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                        {log.subject && (
                          <span className="text-slate-400 text-sm">• {log.subject.fullName}</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm mt-1">
                        {JSON.stringify(log.metadata).slice(0, 100)}
                        {JSON.stringify(log.metadata).length > 100 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-400 text-sm">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="border-slate-700 text-slate-300"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
              className="border-slate-700 text-slate-300"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
