'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Car, Database, ShieldCheck, TriangleAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface VinResponse {
  available: boolean
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
  data?: {
    vehicle?: Record<string, string | null>
    limitation?: string
  }
  confidenceScore?: number
  evidenceFacts?: Array<{
    field: string
    value: unknown
    sourceName: string
    sourceType?: string
    sourceUrl?: string
    retrievedAt: string
    confidenceScore: number
  }>
  policy?: {
    mayPersist?: boolean
    historyReport?: boolean
    description?: string
  }
  error?: string
}

const LABELS: Record<string, string> = {
  vin: 'VIN',
  make: 'Make',
  model: 'Model',
  modelYear: 'Model year',
  trim: 'Trim',
  series: 'Series',
  vehicleType: 'Vehicle type',
  bodyClass: 'Body class',
  manufacturer: 'Manufacturer',
  plantCity: 'Plant city',
  plantState: 'Plant state',
  plantCountry: 'Plant country',
  fuelTypePrimary: 'Primary fuel',
  driveType: 'Drive type',
  engineCylinders: 'Engine cylinders',
  displacementL: 'Displacement (L)',
}

export default function VehiclePage() {
  const { status } = useSession()
  const router = useRouter()
  const [vin, setVin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VinResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const decodeVin = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = vin.trim().toUpperCase()

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
      toast.error('Enter a valid 17-character VIN. I, O, and Q are not valid VIN characters.')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/vehicle/vin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ vin: normalized }),
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok) {
        toast.error(data.error || 'VIN decode failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'VIN decode failed')
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

  const vehicle = result?.data?.vehicle ?? {}
  const vehicleEntries = Object.entries(vehicle).filter(([, value]) => Boolean(value))

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Car className="h-8 w-8 text-blue-400" />
            Vehicle VIN
          </h1>
          <p className="mt-1 text-slate-400">
            Decode a full VIN against official U.S. DOT/NHTSA manufacturer-reported vehicle data.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">Official VIN decode</CardTitle>
            <CardDescription className="text-slate-400">
              This identifies the vehicle and factory specifications. It does not claim ownership, title, lien, accident, registration, or vehicle-history coverage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={decodeVin} className="flex flex-col gap-3 md:flex-row">
              <Input
                value={vin}
                onChange={event => setVin(event.target.value.toUpperCase())}
                maxLength={17}
                placeholder="17-character VIN"
                className="bg-slate-900 font-mono tracking-wider text-white"
              />
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Decoding...' : 'Decode VIN'}
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

        {vehicleEntries.length > 0 && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-green-300">
                    <ShieldCheck className="h-4 w-4" />
                    Official source
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {result?.provider?.licenseName || 'U.S. DOT / NHTSA vPIC'}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-blue-300">
                    <Database className="h-4 w-4" />
                    Evidence quality
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {Math.round((result?.confidenceScore ?? 0) * 100)}% decode confidence • {result?.evidenceFacts?.length ?? 0} source-backed facts
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-white">Decoded vehicle</CardTitle>
                    <CardDescription className="text-slate-400">
                      Manufacturer-reported identity and specification fields returned by NHTSA vPIC.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-green-500/30 text-green-300">
                    Public record source
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {vehicleEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {LABELS[key] || key}
                      </div>
                      <div className="mt-1 break-words text-sm font-medium text-slate-200">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="pt-6 text-sm text-yellow-100/80">
                {result?.policy?.description || result?.data?.limitation}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
