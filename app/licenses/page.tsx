'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Database, MapPin, ShieldCheck, Stethoscope, TriangleAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface LicenseResult {
  index: number
  npi: string | null
  name: string | null
  enumerationType: string | null
  registryStatus: string | null
  credential: string | null
  enumerationDate: string | null
  lastUpdated: string | null
  addresses: Array<{
    purpose: string | null
    type: string | null
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    telephone: string | null
  }>
  taxonomies: Array<{
    code: string | null
    description: string | null
    primary: boolean | null
    state: string | null
    license: string | null
  }>
}

interface LicenseResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    results: LicenseResult[]
    resultCount: number
    limitation: string
  }
  confidenceScore?: number
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  policy?: {
    healthcareOnly: boolean
    activeLicenseStatusVerified: boolean
    description: string
  }
  error?: string
}

export default function LicensesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [npi, setNpi] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LicenseResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (!npi.trim() && name.trim().length < 2) {
      toast.error('Enter a 10-digit NPI or provider name.')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/licenses/nppes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          npi: npi.trim(),
          name: name.trim(),
          state: state.trim().toUpperCase(),
        }),
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok) toast.error(data.error || 'NPPES search failed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'NPPES search failed')
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

  const results = result?.data?.results ?? []

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <BadgeCheck className="h-8 w-8 text-blue-400" />
            Professional Licenses
          </h1>
          <p className="mt-1 text-slate-400">
            Search official CMS/NPPES healthcare-provider records by NPI or provider name.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">NPPES provider search</CardTitle>
            <CardDescription className="text-slate-400">
              Healthcare coverage only. NPPES-reported license numbers are evidence leads, not proof that a state license is currently active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={search} className="grid gap-3 md:grid-cols-[1fr_2fr_120px_auto]">
              <Input
                value={npi}
                onChange={event => setNpi(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="NPI (optional)"
                className="bg-slate-900 text-white"
              />
              <Input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Provider or organization name"
                className="bg-slate-900 text-white"
              />
              <Input
                value={state}
                onChange={event => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                placeholder="State"
                className="bg-slate-900 text-white"
              />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Searching...' : 'Search'}
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

        {result && !result.error && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-green-300">
                    <ShieldCheck className="h-4 w-4" />
                    Official source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.provider?.licenseName || 'CMS NPPES NPI Registry'}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-blue-300">
                    <Database className="h-4 w-4" />
                    Coverage
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {results.length} result{results.length === 1 ? '' : 's'} • {result.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {results.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-8 text-center text-slate-400">
                  NPPES returned no matching healthcare providers.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {results.map(item => (
                  <Card key={item.npi || item.index} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <Stethoscope className="h-5 w-5 text-blue-400" />
                            {item.name || 'Unnamed NPPES record'}
                          </CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            NPI {item.npi || 'not supplied'}
                            {item.credential ? ` • ${item.credential}` : ''}
                            {item.registryStatus ? ` • Registry status: ${item.registryStatus}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          CMS/NPPES
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {item.taxonomies.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            Taxonomy / reported license identifiers
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {item.taxonomies.map((taxonomy, index) => (
                              <div key={`${taxonomy.code}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">
                                  {taxonomy.description || taxonomy.code || 'Taxonomy'}
                                </div>
                                <div className="mt-1 text-slate-400">
                                  {taxonomy.code ? `Code ${taxonomy.code}` : ''}
                                  {taxonomy.primary ? ' • Primary' : ''}
                                </div>
                                {taxonomy.license && (
                                  <div className="mt-2 text-yellow-200/90">
                                    Reported license: {taxonomy.license}
                                    {taxonomy.state ? ` (${taxonomy.state})` : ''}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.addresses.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <MapPin className="h-3 w-3" /> Registry addresses
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {item.addresses.slice(0, 4).map((address, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
                                <div>{[address.line1, address.line2].filter(Boolean).join(' ')}</div>
                                <div>{[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}</div>
                                {address.telephone && <div className="mt-1 text-slate-400">{address.telephone}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-700 pt-3 text-xs text-slate-500">
                        {item.enumerationDate && <span>Enumerated {item.enumerationDate}</span>}
                        {item.lastUpdated && <span>Updated {item.lastUpdated}</span>}
                        <span>Active state-license status not verified here</span>
                      </div>
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
