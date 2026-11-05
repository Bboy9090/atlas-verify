'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Landmark, Database, FileText, MapPin, ShieldCheck, Users, TriangleAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Party {
  name: string | null
  partyType: string | null
  partyRole: string
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
}

interface Property {
  boroughCode: string | null
  borough: string | null
  block: string | null
  lot: string | null
  streetNumber: string | null
  streetName: string | null
  unit: string | null
  propertyType: string | null
}

interface AcrisRecord {
  documentId: string
  crfn: string | null
  documentType: string | null
  documentDate: string | null
  recordedDate: string | null
  documentAmount: string | null
  percentTransferred: string | null
  recordedBorough: string | null
  goodThroughDate: string | null
  parties: Party[]
  properties: Property[]
  filingUrl: string
}

interface AttomRecord {
  attomId: string | null
  address: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  owners: string[]
  propertyType: string | null
  yearBuilt: number | null
  beds: number | null
  baths: number | null
  livingArea: number | null
  lotSize: number | null
  assessedValue: number | null
  taxAmount: number | null
  taxYear: string | null
  lastSaleAmount: number | null
  lastSaleDate: string | null
  sourceUrl: string
}

interface AttomResponse {
  available: boolean
  provider?: { name: string; sourceKind: string; licenseName: string | null; termsUrl: string | null }
  data?: { records: AttomRecord[]; resultCount: number; coverage: string; limitation: string }
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  coverage?: { provider: string; description: string }
  policy?: { geographicCoverage: string; currentOwnershipClaimed: boolean; description?: string }
  error?: string
}

interface PropertyResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    records: AcrisRecord[]
    resultCount: number
    coverage: string
    limitation: string
  }
  evidenceFacts?: Array<{ field: string; value: unknown; sourceName: string }>
  policy?: {
    geographicCoverage: string
    currentOwnershipClaimed: boolean
    description: string
  }
  error?: string
}

function propertyAddress(property: Property) {
  return [
    property.streetNumber,
    property.streetName,
    property.unit ? `Unit ${property.unit}` : null,
    property.borough,
  ].filter(Boolean).join(' ')
}

function partyAddress(party: Party) {
  return [party.address1, party.address2, party.city, party.state, party.zip, party.country]
    .filter(Boolean).join(', ')
}

export default function PropertiesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'name' | 'address'>('address')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PropertyResponse | null>(null)
  const [attomResult, setAttomResult] = useState<AttomResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 2) {
      toast.error('Enter a NYC property address or recorded party name.')
      return
    }

    setLoading(true)
    setResult(null)
    setAttomResult(null)
    try {
      const acrisPromise = fetch('/api/properties/nyc-acris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ q, mode }),
      })
      const attomPromise = mode === 'address'
        ? fetch('/api/properties/attom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ q }),
          })
        : null

      const response = await acrisPromise
      const data = await response.json()
      setResult(data)
      if (!response.ok) toast.error(data.error || 'NYC ACRIS search failed')

      if (attomPromise) {
        const attomResponse = await attomPromise
        const attomData = await attomResponse.json()
        setAttomResult(attomData)
        if (!attomResponse.ok && attomResponse.status !== 503) {
          toast.error(attomData.error || 'Nationwide property search failed')
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'NYC ACRIS search failed')
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

  const records = result?.data?.records ?? []

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Landmark className="h-8 w-8 text-blue-400" />
            Property Records
          </h1>
          <p className="mt-1 text-slate-400">
            Search NYC recorded instruments and, when configured, broader U.S. licensed property data by address.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">NYC ACRIS search</CardTitle>
            <CardDescription className="text-slate-400">
              New York City only. Search recorded property addresses or names appearing as parties on deeds, mortgages, and other instruments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={search} className="flex flex-col gap-3 md:flex-row">
              <Select value={mode} onValueChange={value => setMode(value as 'name' | 'address')}>
                <SelectTrigger className="w-full border-slate-600 bg-slate-900 text-white md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  <SelectItem value="address">Property address</SelectItem>
                  <SelectItem value="name">Recorded party name</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={mode === 'address' ? 'e.g. 123 Grand Concourse' : 'Recorded party name'}
                className="bg-slate-900 text-white"
              />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Searching...' : 'Search ACRIS'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {mode === 'address' && attomResult && !attomResult.available && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-yellow-100/80">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{attomResult.coverage?.description || 'Nationwide property integration is not configured in this environment.'}</span>
            </CardContent>
          </Card>
        )}

        {mode === 'address' && attomResult?.error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 pt-6 text-red-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{attomResult.error}</span>
            </CardContent>
          </Card>
        )}

        {mode === 'address' && attomResult?.available && !attomResult.error && (
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-blue-200">U.S. property candidates</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {attomResult.data?.resultCount ?? 0} record{(attomResult.data?.resultCount ?? 0) === 1 ? '' : 's'} · {attomResult.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-300">Current ownership claimed: no</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(attomResult.data?.records || []).length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">No matching nationwide property record returned.</div>
              ) : (
                (attomResult.data?.records || []).map((record, index) => (
                  <div key={record.attomId || index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{record.address || 'Address unavailable'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[record.city, record.state, record.postalCode].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      {record.propertyType && <Badge variant="outline" className="border-slate-600 text-slate-300">{record.propertyType}</Badge>}
                    </div>
                    {record.owners.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Recorded owner lead{record.owners.length === 1 ? '' : 's'}</div>
                        <div className="mt-1 text-sm text-slate-300">{record.owners.join(' · ')}</div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      {record.yearBuilt && <span>Built {record.yearBuilt}</span>}
                      {record.beds !== null && <span>{record.beds} beds</span>}
                      {record.baths !== null && <span>{record.baths} baths</span>}
                      {record.livingArea !== null && <span>{record.livingArea.toLocaleString()} sq ft</span>}
                      {record.assessedValue !== null && <span>Assessed {'
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
                    Official NYC source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.provider?.licenseName || 'NYC DOF ACRIS / NYC Open Data'}
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
                    {records.length} recorded document{records.length === 1 ? '' : 's'} • {result.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {records.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-8 text-center text-slate-400">
                  ACRIS returned no matching recorded-property documents.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {records.map(record => (
                  <Card key={record.documentId} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <FileText className="h-5 w-5 text-blue-400" />
                            {record.documentType || 'Recorded instrument'}
                          </CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            Document {record.documentId}
                            {record.recordedDate ? ` • Recorded ${record.recordedDate}` : ''}
                            {record.recordedBorough ? ` • ${record.recordedBorough}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          ACRIS
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {record.properties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <MapPin className="h-3 w-3" /> Property
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.properties.map((property, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{propertyAddress(property) || 'Address unavailable'}</div>
                                {(property.block || property.lot) && (
                                  <div className="mt-1 text-slate-500">
                                    Block {property.block || '?'} • Lot {property.lot || '?'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.parties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <Users className="h-3 w-3" /> Recorded parties
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.parties.slice(0, 12).map((party, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{party.name || 'Unnamed party'}</div>
                                <div className="mt-1 text-slate-400">{party.partyRole}</div>
                                {partyAddress(party) && <div className="mt-1 text-xs text-slate-500">{partyAddress(party)}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-700 pt-3 text-xs text-slate-500">
                        {record.documentDate && <span>Document date {record.documentDate}</span>}
                        {record.documentAmount && <span>Recorded amount {record.documentAmount}</span>}
                        {record.percentTransferred && <span>{record.percentTransferred}% transferred</span>}
                        <a href={record.filingUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                          Open ACRIS filing
                        </a>
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
}{record.assessedValue.toLocaleString()}</span>}
                      {record.lastSaleAmount !== null && <span>Last sale {'
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
                    Official NYC source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.provider?.licenseName || 'NYC DOF ACRIS / NYC Open Data'}
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
                    {records.length} recorded document{records.length === 1 ? '' : 's'} • {result.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {records.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-8 text-center text-slate-400">
                  ACRIS returned no matching recorded-property documents.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {records.map(record => (
                  <Card key={record.documentId} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <FileText className="h-5 w-5 text-blue-400" />
                            {record.documentType || 'Recorded instrument'}
                          </CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            Document {record.documentId}
                            {record.recordedDate ? ` • Recorded ${record.recordedDate}` : ''}
                            {record.recordedBorough ? ` • ${record.recordedBorough}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          ACRIS
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {record.properties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <MapPin className="h-3 w-3" /> Property
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.properties.map((property, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{propertyAddress(property) || 'Address unavailable'}</div>
                                {(property.block || property.lot) && (
                                  <div className="mt-1 text-slate-500">
                                    Block {property.block || '?'} • Lot {property.lot || '?'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.parties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <Users className="h-3 w-3" /> Recorded parties
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.parties.slice(0, 12).map((party, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{party.name || 'Unnamed party'}</div>
                                <div className="mt-1 text-slate-400">{party.partyRole}</div>
                                {partyAddress(party) && <div className="mt-1 text-xs text-slate-500">{partyAddress(party)}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-700 pt-3 text-xs text-slate-500">
                        {record.documentDate && <span>Document date {record.documentDate}</span>}
                        {record.documentAmount && <span>Recorded amount {record.documentAmount}</span>}
                        {record.percentTransferred && <span>{record.percentTransferred}% transferred</span>}
                        <a href={record.filingUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                          Open ACRIS filing
                        </a>
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
}{record.lastSaleAmount.toLocaleString()}</span>}
                      {record.lastSaleDate && <span>{record.lastSaleDate}</span>}
                    </div>
                  </div>
                ))
              )}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100/80">
                {attomResult.policy?.description || attomResult.data?.limitation}
              </div>
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
                    Official NYC source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result.provider?.licenseName || 'NYC DOF ACRIS / NYC Open Data'}
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
                    {records.length} recorded document{records.length === 1 ? '' : 's'} • {result.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {records.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="py-8 text-center text-slate-400">
                  ACRIS returned no matching recorded-property documents.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {records.map(record => (
                  <Card key={record.documentId} className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <FileText className="h-5 w-5 text-blue-400" />
                            {record.documentType || 'Recorded instrument'}
                          </CardTitle>
                          <CardDescription className="mt-1 text-slate-400">
                            Document {record.documentId}
                            {record.recordedDate ? ` • Recorded ${record.recordedDate}` : ''}
                            {record.recordedBorough ? ` • ${record.recordedBorough}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          ACRIS
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {record.properties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <MapPin className="h-3 w-3" /> Property
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.properties.map((property, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{propertyAddress(property) || 'Address unavailable'}</div>
                                {(property.block || property.lot) && (
                                  <div className="mt-1 text-slate-500">
                                    Block {property.block || '?'} • Lot {property.lot || '?'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.parties.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <Users className="h-3 w-3" /> Recorded parties
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {record.parties.slice(0, 12).map((party, index) => (
                              <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                                <div className="font-medium text-slate-200">{party.name || 'Unnamed party'}</div>
                                <div className="mt-1 text-slate-400">{party.partyRole}</div>
                                {partyAddress(party) && <div className="mt-1 text-xs text-slate-500">{partyAddress(party)}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-700 pt-3 text-xs text-slate-500">
                        {record.documentDate && <span>Document date {record.documentDate}</span>}
                        {record.documentAmount && <span>Recorded amount {record.documentAmount}</span>}
                        {record.percentTransferred && <span>{record.percentTransferred}% transferred</span>}
                        <a href={record.filingUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                          Open ACRIS filing
                        </a>
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
