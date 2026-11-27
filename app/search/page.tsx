'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ShieldCheck, ArrowRight, Clock3 } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createSearchSession } from '@/lib/workspace-search-session'
import type { SearchKind } from '@/lib/search'

interface Candidate {
  subject: { id: string; fullName: string }
  case: { id: string; title: string; status: string }
  matchedFields: string[]
  evidence: { factCount: number; sourceCount: number; sources: string[]; latestEvidenceAt: string | null }
}
interface SearchResponse {
  query: string
  requestedKind: SearchKind
  detectedKind: Exclude<SearchKind, 'auto'>
  candidates: Candidate[]
  coverage: {
    workspace: { enabled: boolean; description: string; scannedSubjectCount?: number; scanLimit?: number; resultLimit?: number }
    externalProviders: { enabled: boolean; description: string }
  }
}

export default function SearchPage() {
  const { status, data: session } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<SearchKind>('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const requestSession = useRef(createSearchSession())
  const sessionUser = (session?.user as { id?: string } | undefined)?.id

  function clearResults() {
    requestSession.current.cancel()
    setResult(null)
    setLoading(false)
    setError('')
  }
  function clearSession() {
    clearResults()
    setQuery('')
    input.current?.focus()
  }

  useEffect(() => {
    clearSession()
    if (status === 'unauthenticated') router.push('/login')
    return () => requestSession.current.cancel()
  }, [status, sessionUser, router])

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (!typing && event.key === '/')) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    clearResults()
    const trimmed = query.trim()
    if (status !== 'authenticated') return
    if (trimmed.length < 2 || trimmed.length > 200) {
      setError('Enter between 2 and 200 characters.')
      return
    }
    const controller = requestSession.current.begin()
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: trimmed, type: kind })
      const response = await fetch(`/api/search?${params.toString()}`, {
        cache: 'no-store', signal: controller.signal, credentials: 'same-origin',
      })
      const data = await response.json()
      if (!requestSession.current.isCurrent(controller)) return
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Workspace search failed')
      if (!Array.isArray(data.candidates) || data.query !== trimmed || data.requestedKind !== kind || data.coverage?.workspace?.enabled !== true) {
        throw new Error('Invalid workspace search response')
      }
      setResult(data)
    } catch (err) {
      if (requestSession.current.isCurrent(controller)) {
        setError(err instanceof Error ? err.message : 'Workspace search failed')
      }
    } finally {
      if (requestSession.current.isCurrent(controller)) setLoading(false)
    }
  }

  if (status !== 'authenticated') return <DashboardLayout><p role="status" className="p-6 text-slate-300">Checking access…</p></DashboardLayout>

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-300" /> Authorized workspace research · Non-FCRA</span>
          <Link href="/privacy/opt-out" className="text-blue-300 underline">Privacy and opt-out</Link>
        </div>
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Connect the evidence.</CardTitle>
            <CardDescription className="text-slate-400">Search records already saved in your own cases. Review source context before drawing conclusions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input ref={input} aria-label="Search saved case records" autoComplete="off" maxLength={200} value={query}
                  onChange={event => { clearResults(); setQuery(event.target.value) }}
                  placeholder="Search your saved case records" className="bg-slate-900 pl-10 text-white" />
              </div>
              <Select value={kind} onValueChange={value => { clearResults(); setKind(value as SearchKind) }}>
                <SelectTrigger aria-label="Search mode" className="w-full border-slate-600 bg-slate-900 text-white md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  <SelectItem value="auto">Auto-detect</SelectItem><SelectItem value="name">Name</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem><SelectItem value="email">Email</SelectItem>
                  <SelectItem value="address">Address</SelectItem><SelectItem value="username">Username</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">{loading ? 'Searching…' : 'Search workspace'}</Button>
              <Button type="button" variant="outline" onClick={clearSession}>Clear session</Button>
            </form>
            <p className="text-xs text-slate-400">Press / or Ctrl/Cmd+K to focus search. Clearing the session cancels the request and removes visible results; it does not delete saved cases or audit logs.</p>
            <p className="rounded-lg border border-slate-600 p-3 text-sm text-slate-300">No query is automatically sent to an external provider from this workspace. External search requires separate qualification. Not for regulated eligibility decisions.</p>
          </CardContent>
        </Card>
        <div role="status" aria-live="polite" className="text-sm text-slate-300">{loading ? 'Searching saved workspace…' : error ? 'Search failed: ' + error : result ? result.candidates.length + ' returned workspace matches' : 'Ready to search saved records.'}</div>
        {result && <>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Search coverage</CardTitle>
              <CardDescription className="text-slate-300">{result.coverage.workspace.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-400">
              <p>Detected mode: {result.detectedKind}. Records examined: {result.coverage.workspace.scannedSubjectCount ?? 'Not reported'}. Return limit: {result.coverage.workspace.resultLimit ?? 'Not reported'}.</p>
              <p className="mt-2">External sources were not queried. Results are leads from existing records, not identity confirmation or a complete public-record search.</p>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Saved workspace matches</CardTitle>
              <CardDescription className="text-slate-400">Matched fields are search signals, not verified identity probabilities. Contact details remain in the existing case workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.candidates.length === 0 && <p className="py-6 text-center text-slate-400">No match was returned within the examined records. This does not establish absence elsewhere.</p>}
              {result.candidates.map(candidate => <article key={candidate.subject.id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-semibold text-white">{candidate.subject.fullName}</h2><p className="text-sm text-slate-400">Case: {candidate.case.title}</p></div>
                  <Badge variant="outline" className="text-slate-300">Identity unconfirmed</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{candidate.matchedFields.map(field => <Badge key={field} variant="outline" className="text-blue-300">Matched {field}</Badge>)}</div>
                <p className="mt-3 text-sm text-slate-300">{candidate.evidence.factCount} recorded evidence facts · {candidate.evidence.sourceCount} recorded sources</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3 w-3" /> Latest recorded retrieval: {candidate.evidence.latestEvidenceAt ? new Date(candidate.evidence.latestEvidenceAt).toLocaleDateString() : 'Unknown'}</p>
                <Link href={`/cases/${candidate.case.id}`} className="mt-3 inline-flex items-center gap-1 text-sm text-blue-300">Review authorized case <ArrowRight className="h-3 w-3" /></Link>
              </article>)}
            </CardContent>
          </Card>
        </>}
      </main>
    </DashboardLayout>
  )
}
