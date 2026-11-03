'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Database, FileText, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface EntityResult {
  cik: string
  name: string | null
  ticker: string | null
  tickers: string[]
  exchanges: string[]
  entityType: string | null
  sic: string | null
  sicDescription: string | null
  stateOfIncorporation: string | null
  stateOfIncorporationDescription: string | null
  fiscalYearEnd: string | null
  ein: string | null
  phone: string | null
  website: string | null
  investorWebsite: string | null
  category: string | null
  businessAddress: Record<string, string | null> | null
  mailingAddress: Record<string, string | null> | null
  formerNames: Array<{ name: string | null; from: string | null; to: string | null }>
  recentFilings: Array<{
    accessionNumber: string
    filingDate: string | null
    reportDate: string | null
    form: string | null
    primaryDocument: string | null
    primaryDocDescription: string | null
  }>
  matchScore: number
  sourceUrl: string
}

interface BusinessResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    entities: EntityResult[]
    resultCount: number
    limitation: string
  }
  confidenceScore?: number
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  coverage?: { provider: string; description: string }
  policy?: {
    publicCompanyOrFilerCoverage: boolean
    universalPrivateCompanyCoverage: boolean
    description?: string
  }
  error?: string
}

function formatAddress(value: Record<string, string | null> | null) {
  if (!value) return ''
  return [
    value.street1,
    value.street2,
    value.city,
    value.stateOrCountry,
    value.zipCode,
  ].filter(Boolean).join(', ')
}

export default function BusinessesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BusinessResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 2) {
      toast.error('Enter a company name, ticker, or CIK.')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/businesses/sec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ q }),
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok && response.status !== 503) {
        toast.error(data.error || 'SEC EDGAR search failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'SEC EDGAR search failed')
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

  const entities = result?.data?.entities ?? []

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Building2 className="h-8 w-8 text-blue-400" />
            Businesses
          </h1>
          <p className="mt-1 text-slate-400">
            Search official SEC EDGAR filer records by company name, ticker, or CIK.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">SEC entity search</CardTitle>
            <CardDescription className="text-slate-400">
              SEC filers and public-company records only. This does not represent universal U.S. private-company coverage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={search} className="flex flex-col gap-3 md:flex-row">
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Company name, ticker, or CIK"
                className="bg-slate-900 text-white"
              />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Searching...' : 'Search SEC'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && !result.available && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-yellow-100/80">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{result.coverage?.description || 'SEC integration is not configured in this environment.'}</span>
            </CardContent>
          </Card>
        )}

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
                  <CardTitle className="flex items-center gap-2 text-base text-green-300">
                    <ShieldCheck className="h-4 w-4" />
                    Official source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.provider?.licenseName || 'U.S. SEC EDGAR'}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-blue-300">
                    <Database className="h-4 w-4" />
                    Evidence
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {entities.length} entity match{entities.length === 1 ? '' : 'es'} • {result.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {entities.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-8 text-center text-slate-400">
                  SEC EDGAR returned no matching filer.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {entities.map(entity => (
                  <Card key={entity.cik} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-white">{entity.name || 'Unnamed SEC filer'}</CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            CIK {entity.cik}
                            {entity.ticker ? ` • ${entity.ticker}` : ''}
                            {entity.exchanges.length ? ` • ${entity.exchanges.join(', ')}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          {Math.round(entity.matchScore * 100)}% query match
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {entity.sicDescription && (
                          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                            <div className="text-xs uppercase tracking-wide text-slate-500">Industry</div>
                            <div className="mt-1 text-sm text-slate-200">{entity.sicDescription}</div>
                            {entity.sic && <div className="mt-1 text-xs text-slate-500">SIC {entity.sic}</div>}
                          </div>
                        )}
                        {(entity.stateOfIncorporationDescription || entity.stateOfIncorporation) && (
                          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                            <div className="text-xs uppercase tracking-wide text-slate-500">Incorporation</div>
                            <div className="mt-1 text-sm text-slate-200">
                              {entity.stateOfIncorporationDescription || entity.stateOfIncorporation}
                            </div>
                          </div>
                        )}
                      </div>

                      {entity.businessAddress && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <MapPin className="h-3 w-3" /> Business address
                          </div>
                          <div className="text-sm text-slate-300">{formatAddress(entity.businessAddress)}</div>
                        </div>
                      )}

                      {entity.formerNames.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Former names</div>
                          <div className="flex flex-wrap gap-2">
                            {entity.formerNames.map((former, index) => (
                              <Badge key={index} variant="outline" className="border-slate-600 text-slate-300">
                                {former.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {entity.recentFilings.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <FileText className="h-3 w-3" /> Recent filings
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {entity.recentFilings.slice(0, 8).map(filing => (
                              <div key={filing.accessionNumber} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{filing.form || 'Filing'}</div>
                                <div className="mt-1 text-slate-500">{filing.filingDate || 'Date unavailable'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="pt-6 text-sm text-yellow-100/80">
                {result.policy?.description || result.data?.limitation}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
