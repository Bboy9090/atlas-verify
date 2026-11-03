'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Database,
  Globe2,
  ShieldCheck,
  TriangleAlert,
  FlaskConical,
  ExternalLink,
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ProviderPolicy {
  sourceKind: 'synthetic' | 'licensed_api' | 'public_web' | 'public_record' | 'user_supplied'
  production: boolean
  termsUrl?: string
  licenseName?: string
  freshnessSeconds?: number
  allowedPurposes: string[]
  mayPersist: boolean
  notes?: string
}

interface ProviderItem {
  name: string
  type: 'phone_lookup' | 'web_search' | 'person_search'
  sourcePolicy: ProviderPolicy
}

function title(value: string) {
  return value.replace(/_/g, ' ').replace(/w/g, match => match.toUpperCase())
}

export default function SourcesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/providers', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load providers')
        setProviders(body.providers || [])
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load providers'))
      .finally(() => setLoading(false))
  }, [status])

  const productionProviders = useMemo(
    () => providers.filter(provider => provider.sourcePolicy.production),
    [providers]
  )
  const syntheticProviders = useMemo(
    () => providers.filter(provider => provider.sourcePolicy.sourceKind === 'synthetic'),
    [providers]
  )

  const coverage = useMemo(() => {
    const has = (type: ProviderItem['type'], kind?: ProviderPolicy['sourceKind']) =>
      productionProviders.some(provider =>
        provider.type === type && (!kind || provider.sourcePolicy.sourceKind === kind)
      )

    return [
      {
        label: 'Licensed people search',
        ready: has('person_search', 'licensed_api'),
        detail: 'Name / phone / email / address candidate search from a licensed provider.',
      },
      {
        label: 'Phone intelligence',
        ready: has('phone_lookup', 'licensed_api'),
        detail: 'Phone validation, carrier, and line-type intelligence.',
      },
      {
        label: 'Public-web discovery',
        ready: has('web_search', 'public_web'),
        detail: 'Public-web results used as leads with source URLs and confidence.',
      },
      {
        label: 'Public-record feeds',
        ready: providers.some(provider =>
          provider.sourcePolicy.production && provider.sourcePolicy.sourceKind === 'public_record'
        ),
        detail: 'Dedicated court/property/license/public-record provider coverage.',
      },
    ]
  }, [providers, productionProviders])

  if (status === 'loading' || loading) {
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Sources & Coverage</h1>
          <p className="mt-1 text-slate-400">
            Provider provenance, production status, permitted use, persistence policy, and current coverage gaps.
          </p>
        </div>

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="py-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {coverage.map(item => (
            <Card
              key={item.label}
              className={item.ready
                ? 'border-green-500/20 bg-green-500/5'
                : 'border-yellow-500/20 bg-yellow-500/5'}
            >
              <CardHeader className="pb-3">
                <CardTitle className={`flex items-center gap-2 text-base ${item.ready ? 'text-green-300' : 'text-yellow-300'}`}>
                  {item.ready
                    ? <ShieldCheck className="h-4 w-4" />
                    : <TriangleAlert className="h-4 w-4" />}
                  {item.label}
                </CardTitle>
                <CardDescription className="text-slate-400">{item.detail}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  variant="outline"
                  className={item.ready
                    ? 'border-green-500/30 text-green-300'
                    : 'border-yellow-500/30 text-yellow-300'}
                >
                  {item.ready ? 'Configured' : 'Not configured'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-200">
              <ShieldCheck className="h-5 w-5" />
              What “configured” means
            </CardTitle>
            <CardDescription className="text-slate-400">
              A provider appears as production coverage only when its adapter is registered in the running server.
              Missing credentials therefore show as a coverage gap rather than a simulated success.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {providers.map(provider => {
            const policy = provider.sourcePolicy
            const synthetic = policy.sourceKind === 'synthetic'

            return (
              <Card key={provider.name} className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        {synthetic
                          ? <FlaskConical className="h-5 w-5 text-purple-400" />
                          : policy.sourceKind === 'public_web'
                            ? <Globe2 className="h-5 w-5 text-blue-400" />
                            : <Database className="h-5 w-5 text-blue-400" />}
                        {policy.licenseName || title(provider.name)}
                      </CardTitle>
                      <CardDescription className="mt-1 text-slate-400">
                        {title(provider.type)} • {title(policy.sourceKind)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={policy.production
                        ? 'border-green-500/30 text-green-300'
                        : 'border-purple-500/30 text-purple-300'}
                    >
                      {policy.production ? 'Production' : 'Synthetic / test only'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Persistence</div>
                      <div className="mt-1 text-slate-200">
                        {policy.mayPersist ? 'Provider policy allows persistence' : 'Ephemeral — do not persist provider payload'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Freshness</div>
                      <div className="mt-1 text-slate-200">
                        {policy.freshnessSeconds === 0
                          ? 'Fetched live'
                          : policy.freshnessSeconds
                            ? `Policy TTL: ${policy.freshnessSeconds}s`
                            : 'Provider-defined / not specified'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Permitted purposes</div>
                    <div className="flex flex-wrap gap-2">
                      {policy.allowedPurposes.map(purpose => (
                        <Badge key={purpose} variant="outline" className="border-slate-600 text-slate-300">
                          {title(purpose)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {policy.notes && (
                    <p className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-slate-400">
                      {policy.notes}
                    </p>
                  )}

                  {policy.termsUrl && (
                    <a
                      href={policy.termsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      Provider terms
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {syntheticProviders.length > 0 && (
          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-200">
                <FlaskConical className="h-5 w-5" />
                Synthetic provider guardrail
              </CardTitle>
              <CardDescription className="text-slate-400">
                Synthetic providers remain visible for development transparency but must never be represented as real-world coverage or evidence.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
