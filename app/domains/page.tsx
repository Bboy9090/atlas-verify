'use client'

import { FormEvent, useState } from 'react'
import { Globe2, Search, ExternalLink, ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Entity {
  roles: string[]
  name: string | null
  handle: string | null
  publicIds: Array<{ type: string | null; identifier: string | null }>
}

interface DomainData {
  domain: string
  registered: boolean
  registryHandle?: string | null
  statuses?: string[]
  createdAt?: string | null
  updatedAt?: string | null
  expiresAt?: string | null
  nameservers?: string[]
  dnssecSigned?: boolean | null
  registrar?: Entity | null
  registrant?: Entity | null
  authoritativeUrl?: string
  publicOnly: boolean
  identityConfirmed?: false
  limitation?: string
}

interface ResponseData {
  available: boolean
  error?: string
  data?: DomainData
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
  }
}

export default function DomainsPage() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResponseData | null>(null)

  const lookup = async (event: FormEvent) => {
    event.preventDefault()
    const value = domain.trim()
    if (value.length < 3) {
      toast.error('Enter a domain name')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(`/api/domains?domain=${encodeURIComponent(value)}`, { cache: 'no-store' })
      const data = await response.json()
      setResult(data)
      if (!response.ok) toast.error(data.error || 'Domain lookup failed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Domain lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const data = result?.data

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Domain Intelligence</h1>
          <p className="mt-1 text-slate-400">
            Query authoritative RDAP registration data using IANA service discovery. Only public registration data is returned.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-6">
            <form onSubmit={lookup} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={domain}
                  onChange={event => setDomain(event.target.value)}
                  placeholder="example.com"
                  className="bg-slate-900 pl-10 text-white"
                  maxLength={253}
                />
              </div>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Looking up...' : 'Lookup RDAP'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-300">
              <ShieldCheck className="h-4 w-4" />
              Public-data boundary
            </CardTitle>
            <CardDescription className="text-slate-400">
              AtlasVerify does not attempt to recover, infer, or bypass redacted or nonpublic registrant information.
            </CardDescription>
          </CardHeader>
        </Card>

        {result?.error && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6 text-sm text-red-300">{result.error}</CardContent>
          </Card>
        )}

        {data && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">{data.domain}</CardTitle>
              <CardDescription className="text-slate-400">
                {data.registered ? 'Registration data returned by the authoritative RDAP service.' : 'No current registration object was returned.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={data.registered ? 'border-green-500/30 text-green-300' : 'border-yellow-500/30 text-yellow-300'}>
                  {data.registered ? 'Registered' : 'Not found'}
                </Badge>
                {data.dnssecSigned !== null && data.dnssecSigned !== undefined && (
                  <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                    DNSSEC {data.dnssecSigned ? 'signed' : 'not signed'}
                  </Badge>
                )}
              </div>

              {data.registered && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Registry handle" value={data.registryHandle} />
                  <Info label="Created" value={data.createdAt} />
                  <Info label="Last changed" value={data.updatedAt} />
                  <Info label="Expiration" value={data.expiresAt} />
                  <Info label="Statuses" value={data.statuses?.join(', ')} />
                  <Info label="Nameservers" value={data.nameservers?.join(', ')} />
                  <Info label="Registrar" value={data.registrar?.name || data.registrar?.handle} />
                  <Info label="Public registrant" value={data.registrant?.name || data.registrant?.handle} />
                </div>
              )}

              {data.limitation && <p className="text-sm leading-6 text-slate-400">{data.limitation}</p>}

              {data.authoritativeUrl && (
                <a
                  href={data.authoritativeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  Open authoritative RDAP source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-200">{value}</div>
    </div>
  )
}
