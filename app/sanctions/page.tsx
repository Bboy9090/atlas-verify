'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Database, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Match {
  entNum: string
  primaryName: string
  listType: 'SDN' | 'Non-SDN'
  entityType: string | null
  program: string | null
  remarks: string | null
  matchScore: number
  matchedOn: string
  matchedAlias: string | null
  aliases: Array<{ aliasType: string | null; name: string; remarks: string | null }>
  addresses: Array<{ address: string | null; cityStatePostal: string | null; country: string | null; remarks: string | null }>
}

interface ResponseData {
  available: boolean
  provider?: { name: string; licenseName: string | null; termsUrl: string | null }
  data?: { results: Match[]; resultCount: number; retrievedAt: string; limitation: string }
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  policy?: { description: string }
  error?: string
}

export default function SanctionsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResponseData | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 3) return toast.error('Enter at least 3 characters.')

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/sanctions/ofac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ q }),
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok) toast.error(data.error || 'OFAC search failed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OFAC search failed')
    } finally {
      setLoading(false)
    }
  }

  const matches = result?.data?.results ?? []

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <ShieldAlert className="h-8 w-8 text-blue-400" />
            Sanctions Screening
          </h1>
          <p className="mt-1 text-slate-400">
            Conservative name/alias screening against official U.S. Treasury OFAC SDN and consolidated non-SDN data.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">OFAC potential-match search</CardTitle>
            <CardDescription className="text-slate-400">
              A name match is never treated as proof. Confirm identifiers and the live OFAC record before drawing conclusions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={search} className="flex gap-3">
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Person or entity name" className="bg-slate-900 text-white" />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Screening...' : 'Screen OFAC'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result?.error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-red-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{result.error}</span>
            </CardContent>
          </Card>
        )}

        {result?.available && !result.error && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-green-300"><ShieldCheck className="h-4 w-4" />Official source</CardTitle>
                  <CardDescription className="text-slate-400">{result.provider?.licenseName || 'U.S. Treasury OFAC'}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-blue-300"><Database className="h-4 w-4" />Potential matches</CardTitle>
                  <CardDescription className="text-slate-400">{matches.length} candidate{matches.length === 1 ? '' : 's'} • {result.evidenceFacts?.length ?? 0} evidence facts</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {matches.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50"><CardContent className="py-8 text-center text-slate-400">No conservative name/alias candidates met the AtlasVerify threshold.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {matches.map(match => (
                  <Card key={`${match.listType}-${match.entNum}`} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-white">{match.primaryName}</CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            {match.listType} • ENT_NUM {match.entNum}{match.program ? ` • ${match.program}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">{Math.round(match.matchScore * 100)}% name similarity — verify</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {match.matchedAlias && <div className="text-sm text-slate-300">Matched alias: <span className="font-medium">{match.matchedAlias}</span></div>}
                      {match.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {match.aliases.slice(0, 8).map((alias, index) => <Badge key={index} variant="outline" className="border-slate-600 text-slate-300">{alias.name}</Badge>)}
                        </div>
                      )}
                      {match.addresses.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><MapPin className="h-3 w-3" />OFAC-listed addresses</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {match.addresses.slice(0, 6).map((address, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
                                {[address.address, address.cityStatePostal, address.country].filter(Boolean).join(', ') || 'Address details unavailable'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {match.remarks && <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">{match.remarks}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="pt-6 text-sm text-yellow-100/80">{result.policy?.description || result.data?.limitation}</CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
