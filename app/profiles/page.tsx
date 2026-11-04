'use client'

import { FormEvent, useState } from 'react'
import { AtSign, ExternalLink, Search, ShieldAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ProfileResult {
  platform: string
  title: string
  url: string
  snippet: string
  rank: number
  exactHandleSignal: boolean
  confidence: number
}

interface ProfileResponse {
  available: boolean
  handle?: string
  results: ProfileResult[]
  totalResults?: number
  identityConfirmed: false
  limitation?: string
  coverage?: string
  error?: string
  provider?: {
    name: string
    sourceKind: string
    licenseName: string | null
    termsUrl: string | null
    mayPersist: boolean
  }
  policy?: {
    leadOnly: boolean
    corroborationRequired: boolean
    persisted: boolean
    identityConfirmed: boolean
  }
}

export default function ProfilesPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProfileResponse | null>(null)

  const searchProfiles = async (event: FormEvent) => {
    event.preventDefault()
    const handle = username.trim().replace(/^@+/, '')
    if (handle.length < 2) {
      toast.error('Enter a username with at least 2 characters')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(`/api/profiles?username=${encodeURIComponent(handle)}`, {
        cache: 'no-store',
      })
      const data = await response.json()
      setResult(data)
      if (!response.ok && response.status !== 503) {
        toast.error(data.error || 'Profile search failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Public Profiles</h1>
          <p className="mt-1 text-slate-400">
            Correlate public profile leads by username across major public platforms. Handle matches are leads, not confirmed identity.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-6">
            <form onSubmit={searchProfiles} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  placeholder="username or @handle"
                  className="bg-slate-900 pl-10 text-white"
                  maxLength={80}
                />
              </div>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Searching...' : 'Find public profiles'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-yellow-300">
              <ShieldAlert className="h-4 w-4" />
              Identity safeguard
            </CardTitle>
            <CardDescription className="text-slate-400">
              A matching username can belong to different people. AtlasVerify does not convert a handle match into confirmed identity without independent corroborating evidence.
            </CardDescription>
          </CardHeader>
        </Card>

        {result && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">
                {result.handle ? `Public profile leads for @${result.handle}` : 'Public profile coverage'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {result.limitation || result.coverage || 'Public-web profile discovery.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result.available ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                  {result.coverage || 'Public profile provider is not configured.'}
                </div>
              ) : result.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                  {result.error}
                </div>
              ) : result.results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                  No supported public profile leads were returned for this handle.
                </div>
              ) : (
                result.results.map(profile => (
                  <div key={profile.url} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{profile.title}</span>
                          <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                            {profile.platform}
                          </Badge>
                          {profile.exactHandleSignal && (
                            <Badge variant="outline" className="border-green-500/30 text-green-300">
                              exact handle signal
                            </Badge>
                          )}
                        </div>
                        {profile.snippet && <p className="mt-2 text-sm leading-6 text-slate-400">{profile.snippet}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-300">{Math.round(profile.confidence * 100)}%</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">lead confidence</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
                      <span className="text-xs text-slate-500">Rank {profile.rank} • lead only • verify independently</span>
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                      >
                        Open public source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
