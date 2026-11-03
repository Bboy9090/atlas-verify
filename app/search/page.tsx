'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Phone, Mail, MapPin, UserRound, ShieldCheck, Database, ArrowRight, AtSign } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type SearchKind = 'auto' | 'name' | 'phone' | 'email' | 'address' | 'username'

interface Candidate {
  subject: {
    id: string
    fullName: string
    phoneE164: string | null
    email: string | null
    username: string | null
    address: string | null
    city: string | null
    state: string | null
  }
  case: {
    id: string
    title: string
    status: string
  }
  score: number
  baseMatchScore: number
  matchedFields: string[]
  evidence: {
    factCount: number
    sourceCount: number
    sources: string[]
    latestEvidenceAt: string | null
  }
}

interface SearchResponse {
  query: string
  requestedKind: SearchKind
  detectedKind: Exclude<SearchKind, 'auto'>
  candidates: Candidate[]
  coverage: {
    workspace: { enabled: boolean; description: string }
    externalProviders: { enabled: boolean; description: string }
  }
}

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<SearchKind>('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      toast.error('Enter at least 2 characters')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ q: trimmed, type: kind })
      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Search</h1>
          <p className="mt-1 text-slate-400">
            Search people already stored in your case workspace by name, phone, email, address, or username.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Name, phone, email, address, or @username"
                  className="bg-slate-900 pl-10 text-white"
                />
              </div>
              <Select value={kind} onValueChange={value => setKind(value as SearchKind)}>
                <SelectTrigger className="w-full border-slate-600 bg-slate-900 text-white md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="address">Address</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-green-300">
                    <ShieldCheck className="h-4 w-4" />
                    Workspace coverage
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.coverage.workspace.description}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-300">
                    <Database className="h-4 w-4" />
                    External coverage
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.coverage.externalProviders.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-400">
                Detected as <span className="font-medium text-slate-200">{result.detectedKind}</span>
                {' '}• {result.candidates.length} candidate{result.candidates.length === 1 ? '' : 's'}
              </div>
            </div>

            {result.candidates.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-10 text-center text-slate-400">
                  No matching subject is stored in your workspace yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {result.candidates.map(candidate => (
                  <Card key={candidate.subject.id} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <UserRound className="h-5 w-5 text-blue-400" />
                            {candidate.subject.fullName}
                          </CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            Case: {candidate.case.title}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-300">
                            {Math.round(candidate.score * 100)}%
                          </div>
                          <div className="text-xs text-slate-500">match score</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {candidate.matchedFields.map(field => (
                          <Badge key={field} variant="outline" className="border-blue-500/30 text-blue-300">
                            matched {field}
                          </Badge>
                        ))}
                        {candidate.evidence.sourceCount > 0 && (
                          <Badge variant="outline" className="border-green-500/30 text-green-300">
                            {candidate.evidence.sourceCount} evidence source{candidate.evidence.sourceCount === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>

                      <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                        {candidate.subject.phoneE164 && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                            {candidate.subject.phoneE164}
                          </div>
                        )}
                        {candidate.subject.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            {candidate.subject.email}
                          </div>
                        )}
                        {candidate.subject.username && (
                          <div className="flex items-center gap-2">
                            <AtSign className="h-4 w-4 text-slate-500" />
                            {candidate.subject.username}
                          </div>
                        )}
                        {(candidate.subject.address || candidate.subject.city || candidate.subject.state) && (
                          <div className="flex items-center gap-2 md:col-span-2">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            {[candidate.subject.address, candidate.subject.city, candidate.subject.state]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3 text-xs text-slate-500">
                        <span>
                          {candidate.evidence.factCount} evidence fact{candidate.evidence.factCount === 1 ? '' : 's'}
                          {candidate.evidence.latestEvidenceAt
                            ? ` • latest ${new Date(candidate.evidence.latestEvidenceAt).toLocaleDateString()}`
                            : ''}
                        </span>
                        <Link
                          href={`/cases/${candidate.case.id}`}
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          Open case
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
