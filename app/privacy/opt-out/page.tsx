'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Shield, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type IdentifierType = 'name' | 'phone' | 'email' | 'address' | 'username'

interface SubmissionResult {
  status: 'pending' | 'approved'
  requestToken?: string
  message: string
}

export default function OptOutPage() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('name')
  const [identifier, setIdentifier] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [requestToken, setRequestToken] = useState('')
  const [statusResult, setStatusResult] = useState<Record<string, unknown> | null>(null)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/privacy/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifierType, identifier, contactEmail }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Request failed')
      setResult(body)
      if (body.requestToken) setRequestToken(body.requestToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async () => {
    const token = requestToken.trim()
    if (!token) return
    setLoading(true)
    setError('')
    setStatusResult(null)
    try {
      const response = await fetch(`/api/privacy/suppression?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Status lookup failed')
      setStatusResult(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/docs/legal">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Legal
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-white">
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="font-semibold">Bobby's Case File</span>
          </div>
        </div>

        <Card className="border-slate-700 bg-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserX className="h-5 w-5 text-blue-400" />
              Suppression / Opt-Out Request
            </CardTitle>
            <CardDescription className="text-slate-400">
              Request suppression of a specific identifier from future Bobby's Case File-controlled live enrichment queries.
              Bobby's Case File stores a one-way hash of the identifier for enforcement rather than retaining the submitted identifier in plaintext.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Identifier type</label>
                <Select value={identifierType} onValueChange={value => setIdentifierType(value as IdentifierType)}>
                  <SelectTrigger className="border-slate-600 bg-slate-900 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="address">Address</SelectItem>
                    <SelectItem value="username">Username</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Identifier to suppress</label>
                <Input
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  required
                  maxLength={300}
                  className="border-slate-600 bg-slate-900 text-white"
                  placeholder="Enter the exact identifier shown in Bobby's Case File"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Contact email</label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={event => setContactEmail(event.target.value)}
                  required
                  maxLength={320}
                  className="border-slate-600 bg-slate-900 text-white"
                  placeholder="Used only to verify and resolve this privacy request"
                />
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
                Do not submit government ID unless Bobby's Case File specifically requests additional verification.
                Approval blocks future Bobby's Case File-controlled live enrichment for the exact identifier; it does not rewrite historical case evidence or remove data from upstream public or licensed sources.
              </div>

              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Submitting…' : 'Submit request'}
              </Button>
            </form>

            {result && (
              <div className="mt-5 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                <div className="flex items-center gap-2 font-medium text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.message}
                </div>
                {result.requestToken && (
                  <div className="mt-3">
                    <div className="text-xs text-slate-400">Save this token. It is shown only when a new request is created.</div>
                    <div className="mt-1 break-all rounded bg-slate-950 p-3 font-mono text-xs text-blue-300">
                      {result.requestToken}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/60">
          <CardHeader>
            <CardTitle className="text-white">Check request status</CardTitle>
            <CardDescription className="text-slate-400">
              Use the request token issued when the request was created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={requestToken}
              onChange={event => setRequestToken(event.target.value)}
              className="border-slate-600 bg-slate-900 font-mono text-white"
              placeholder="Request token"
            />
            <Button type="button" variant="outline" onClick={checkStatus} disabled={loading || !requestToken.trim()}>
              Check status
            </Button>
            {statusResult && (
              <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                {JSON.stringify(statusResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
