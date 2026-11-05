'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Database, FileText, MapPin, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { correlateBusinessCandidates } from '@/lib/business-resolution'

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

interface OpenCorporatesEntity {
  name: string | null
  companyNumber: string | null
  jurisdictionCode: string | null
  currentStatus: string | null
  incorporationDate: string | null
  dissolutionDate: string | null
  companyType: string | null
  branchStatus: string | null
  inactive: boolean
  registeredAddress: string | null
  registryUrl: string | null
  sourceUrl: string | null
  sourcePublisher: string | null
  sourceRetrievedAt: string | null
  previousNames: Array<{ name: string | null; startDate: string | null; endDate: string | null }>
}

interface OpenCorporatesResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    entities: OpenCorporatesEntity[]
    resultCount: number
    reportedTotalCount: number | null
    limitation: string
  }
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  coverage?: { provider: string; description: string }
  policy?: {
    broadRegistryCoverage: boolean
    identityProof: boolean
    description?: string
  }
  error?: string
}

interface OfficerResult {
  officerId: number | null
  name: string | null
  position: string | null
  startDate: string | null
  endDate: string | null
  currentStatus: string | null
  inactive: boolean
  occupation: string | null
  sourceUrl: string | null
  sourcePublisher: string | null
  company: {
    name: string | null
    companyNumber: string | null
    jurisdictionCode: string | null
    sourceUrl: string | null
  }
}

interface OfficerResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    officers: OfficerResult[]
    resultCount: number
    reportedTotalCount: number | null
    limitation: string
  }
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  coverage?: { provider: string; description: string }
  policy?: {
    identityProof: boolean
    personalAddressExposed: boolean
    dateOfBirthExposed: boolean
    description?: string
  }
  error?: string
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

type SourceResult<T> =
  | { response: Response; data: T }
  | { error: string }

async function fetchBusinessSource<T>(url: string, q: string, label: string): Promise<SourceResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ q }),
    })

    let data: T
    try {
      data = await response.json() as T
    } catch {
      return { error: `${label} returned an invalid response.` }
    }

    return { response, data }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : `${label} request failed.`,
    }
  }
}

export default function BusinessesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [officerQuery, setOfficerQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [officerLoading, setOfficerLoading] = useState(false)
  const [result, setResult] = useState<BusinessResponse | null>(null)
  const [openCorporatesResult, setOpenCorporatesResult] = useState<OpenCorporatesResponse | null>(null)
  const [officerResult, setOfficerResult] = useState<OfficerResponse | null>(null)

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
    setOpenCorporatesResult(null)
    try {
      const [sec, openCorporates] = await Promise.all([
        fetchBusinessSource<BusinessResponse>('/api/businesses/sec', q, 'SEC EDGAR'),
        fetchBusinessSource<OpenCorporatesResponse>('/api/businesses/opencorporates', q, 'OpenCorporates'),
      ])

      if ('data' in sec) {
        setResult(sec.data)
        if (!sec.response.ok && sec.response.status !== 503) {
          toast.error(sec.data.error || 'SEC EDGAR search failed')
        }
      } else {
        toast.error(sec.error)
      }

      if ('data' in openCorporates) {
        setOpenCorporatesResult(openCorporates.data)
        if (!openCorporates.response.ok && openCorporates.response.status !== 503) {
          toast.error(openCorporates.data.error || 'OpenCorporates search failed')
        }
      } else {
        toast.error(openCorporates.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const searchOfficer = async (event: FormEvent) => {
    event.preventDefault()
    const q = officerQuery.trim()
    if (q.length < 2) {
      toast.error('Enter an officer or director name.')
      return
    }

    setOfficerLoading(true)
    setOfficerResult(null)
    try {
      const response = await fetchBusinessSource<OfficerResponse>(
        '/api/businesses/officers',
        q,
        'OpenCorporates officers',
      )
      if ('data' in response) {
        setOfficerResult(response.data)
        if (!response.response.ok && response.response.status !== 503) {
          toast.error(response.data.error || 'Officer search failed')
        }
      } else {
        toast.error(response.error)
      }
    } finally {
      setOfficerLoading(false)
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
  const registryEntities = openCorporatesResult?.data?.entities ?? []
  const businessCorrelations = useMemo(
    () => correlateBusinessCandidates(
      entities.map(entity => ({
        cik: entity.cik,
        name: entity.name,
        ticker: entity.ticker,
        stateOfIncorporation: entity.stateOfIncorporation,
        sourceUrl: entity.sourceUrl,
      })),
      registryEntities.map(entity => ({
        name: entity.name,
        companyNumber: entity.companyNumber,
        jurisdictionCode: entity.jurisdictionCode,
        currentStatus: entity.currentStatus,
        sourceUrl: entity.sourceUrl,
      })),
    ),
    [entities, registryEntities],
  )

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Building2 className="h-8 w-8 text-blue-400" />
            Businesses
          </h1>
          <p className="mt-1 text-slate-400">
            Search SEC filer records and broader company-registry candidates with source-level provenance.
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

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-blue-400" />
              Officer / director search
            </CardTitle>
            <CardDescription className="text-slate-400">
              Search public company-registry officer associations. Atlas does not expose date of birth or personal-address fields here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchOfficer} className="flex flex-col gap-3 md:flex-row">
              <Input
                value={officerQuery}
                onChange={event => setOfficerQuery(event.target.value)}
                placeholder="Officer or director name"
                className="bg-slate-900 text-white"
              />
              <Button type="submit" disabled={officerLoading} variant="outline">
                {officerLoading ? 'Searching...' : 'Search officers'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {officerResult && !officerResult.available && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-yellow-100/80">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{officerResult.coverage?.description || 'OpenCorporates officer integration is not configured.'}</span>
            </CardContent>
          </Card>
        )}

        {officerResult?.error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-red-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{officerResult.error}</span>
            </CardContent>
          </Card>
        )}

        {officerResult?.available && !officerResult.error && (
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-violet-200">Officer/company association candidates</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {officerResult.data?.resultCount ?? 0} returned
                    {officerResult.data?.reportedTotalCount !== null && officerResult.data?.reportedTotalCount !== undefined
                      ? ` · ${officerResult.data.reportedTotalCount} reported matches`
                      : ''}
                    {' · '}{officerResult.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-violet-500/30 text-violet-300">Identity proof: no</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(officerResult.data?.officers || []).length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">No matching officer association returned.</div>
              ) : (
                (officerResult.data?.officers || []).map((officer, index) => (
                  <div key={officer.officerId ?? index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{officer.name || 'Unnamed officer'}</div>
                        <div className="mt-1 text-sm text-slate-300">
                          {officer.position || officer.occupation || 'Role unavailable'}
                        </div>
                      </div>
                      {officer.inactive && <Badge variant="outline" className="border-slate-600 text-slate-400">Inactive</Badge>}
                    </div>
                    <div className="mt-3 rounded border border-slate-700 bg-slate-950/50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Associated company</div>
                      <div className="mt-1 text-sm font-medium text-slate-200">{officer.company.name || 'Company name unavailable'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[officer.company.jurisdictionCode, officer.company.companyNumber].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      {officer.startDate && <span>Started {officer.startDate}</span>}
                      {officer.endDate && <span>Ended {officer.endDate}</span>}
                      {officer.sourcePublisher && <span>Source: {officer.sourcePublisher}</span>}
                    </div>
                    {officer.sourceUrl && (
                      <a href={officer.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300">
                        Open officer record
                      </a>
                    )}
                  </div>
                ))
              )}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100/80">
                {officerResult.policy?.description || officerResult.data?.limitation}
              </div>
            </CardContent>
          </Card>
        )}

        {openCorporatesResult && !openCorporatesResult.available && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-yellow-100/80">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{openCorporatesResult.coverage?.description || 'OpenCorporates integration is not configured in this environment.'}</span>
            </CardContent>
          </Card>
        )}

        {openCorporatesResult?.error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-red-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{openCorporatesResult.error}</span>
            </CardContent>
          </Card>
        )}

        {openCorporatesResult?.available && !openCorporatesResult.error && (
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-blue-200">OpenCorporates registry candidates</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {openCorporatesResult.data?.resultCount ?? 0} returned
                    {openCorporatesResult.data?.reportedTotalCount !== null && openCorporatesResult.data?.reportedTotalCount !== undefined
                      ? ` · ${openCorporatesResult.data.reportedTotalCount} reported matches`
                      : ''}
                    {' · '}{openCorporatesResult.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-300">Identity proof: no</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(openCorporatesResult.data?.entities || []).length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">No matching company record returned.</div>
              ) : (
                (openCorporatesResult.data?.entities || []).map((entity, index) => (
                  <div key={`${entity.jurisdictionCode || 'unknown'}:${entity.companyNumber || index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{entity.name || 'Unnamed company'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[entity.jurisdictionCode, entity.companyNumber, entity.currentStatus].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {entity.companyType && <Badge variant="outline" className="border-slate-600 text-slate-300">{entity.companyType}</Badge>}
                    </div>
                    {entity.registeredAddress && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <span>{entity.registeredAddress}</span>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      {entity.incorporationDate && <span>Incorporated {entity.incorporationDate}</span>}
                      {entity.dissolutionDate && <span>Dissolved {entity.dissolutionDate}</span>}
                      {entity.sourcePublisher && <span>Source: {entity.sourcePublisher}</span>}
                    </div>
                    {entity.previousNames.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entity.previousNames.slice(0, 6).map((previous, previousIndex) => (
                          <Badge key={previousIndex} variant="outline" className="border-slate-600 text-slate-400">
                            Former: {previous.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100/80">
                {openCorporatesResult.policy?.description || openCorporatesResult.data?.limitation}
              </div>
            </CardContent>
          </Card>
        )}

        {businessCorrelations.length > 0 && (
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-cyan-200">Cross-source business candidates</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    Exact normalized company-name overlaps between SEC EDGAR and OpenCorporates.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                  Identity confirmed: no
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {businessCorrelations.map(correlation => (
                <div key={`${correlation.secCik}:${correlation.registryCompanyNumber || correlation.registryJurisdiction || correlation.name}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{correlation.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        SEC CIK {correlation.secCik}
                        {correlation.registryCompanyNumber ? ` · Registry # ${correlation.registryCompanyNumber}` : ''}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        correlation.jurisdictionAgreement === true
                          ? 'border-green-500/30 text-green-300'
                          : correlation.jurisdictionAgreement === false
                            ? 'border-amber-500/30 text-amber-300'
                            : 'border-slate-600 text-slate-300'
                      }
                    >
                      {Math.round(correlation.confidence * 100)}% correlation
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                    <div>SEC jurisdiction: {correlation.secJurisdiction || 'not available'}</div>
                    <div>Registry jurisdiction: {correlation.registryJurisdiction || 'not available'}</div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    {correlation.rationale.map((reason, index) => (
                      <div key={index}>• {reason}</div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100/80">
                These are corroboration candidates only. Exact normalized company-name agreement is required; jurisdiction agreement strengthens confidence, while conflicts are preserved for manual review.
              </div>
            </CardContent>
          </Card>
        )}

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
