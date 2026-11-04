'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Scale, TriangleAlert, ExternalLink, ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface CourtResult {
  index: number
  caseName: string | null
  docketNumber: string | null
  court: string | null
  courtId: string | null
  dateFiled: string | null
  suitNature: string | null
  status: string | null
  citation: string[]
  url: string
}

interface ResponseBody {
  available: boolean
  results?: CourtResult[]
  totalResults?: number
  limitation?: string
  error?: string
  coverage?: { description?: string }
}

export default function CourtsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResponseBody | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 2) return toast.error('Enter at least 2 characters')

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/courts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ q }),
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok && response.status !== 503) toast.error(data.error || 'Court search failed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Court search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Scale className="h-8 w-8 text-blue-400" /> Court Records
          </h1>
          <p className="mt-1 text-slate-400">
            Search CourtListener/RECAP references. Results are leads only and require independent identity matching.
          </p>
        </div>

        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="flex gap-3 pt-6 text-sm text-yellow-100/80">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            A name match is not proof that a person is the same individual in a case, and it does not establish criminal history, guilt, liability, or disposition.
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-6">
            <form onSubmit={search} className="flex flex-col gap-3 md:flex-row">
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, company, docket terms, or case keywords" className="bg-slate-900 text-white" />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Searching...' : 'Search court records'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && !result.available && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="pt-6 text-sm text-yellow-100/80">
              {result.coverage?.description || 'Court-record provider is not configured.'}
            </CardContent>
          </Card>
        )}

        {result?.available && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-green-400" />
                Public court references
              </CardTitle>
              <CardDescription className="text-slate-400">
                Showing up to 20 results from {result.totalResults ?? 0} matching records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(result.results ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No matching records returned.</div>
              ) : (
                result.results?.map(item => (
                  <div key={item.index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.caseName || 'Unnamed case'}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {[item.court, item.docketNumber && `Docket ${item.docketNumber}`, item.dateFiled].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">Verify identity</Badge>
                    </div>
                    {item.citation.length > 0 && <div className="mt-2 text-sm text-slate-300">{item.citation.join(' • ')}</div>}
                    <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
                      Open source record <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))
              )}
              <div className="border-t border-slate-700 pt-3 text-xs text-slate-500">{result.limitation}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
