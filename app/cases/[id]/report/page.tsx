'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Printer,
  ShieldCheck,
  TriangleAlert,
  Clock3,
  Database,
  Users,
  Fingerprint,
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ReportItem {
  field: string
  value: unknown
  sources: string[]
  sourceCount: number
  factCount: number
  averageConfidence: number
  latestRetrievedAt: string
  observedAt: string | null
  corroborated: boolean
  conflicted: boolean
  stale: boolean
}

interface ReportSubject {
  id: string
  fullName: string
  enteredIdentifiers: {
    phoneE164: string | null
    email: string | null
    username: string | null
    address: string | null
    city: string | null
    state: string | null
  }
  notes: string | null
  evidenceSummary: {
    totalFacts: number
    uniqueSources: number
    staleFactCount: number
    corroboratedFieldCount: number
    conflictedFieldCount: number
    averageConfidence: number
  }
  profile: {
    aliases: ReportItem[]
    phones: ReportItem[]
    emails: ReportItem[]
    addresses: ReportItem[]
    relatives: ReportItem[]
    associates: ReportItem[]
    businesses: ReportItem[]
  }
  timeline: Array<{
    id: string
    timestamp: string
    timestampType: 'observed' | 'retrieved'
    field: string
    value: unknown
    sourceName: string
    confidenceScore: number
    corroborationCount: number
    conflictCount: number
  }>
}

interface CaseReport {
  schemaVersion: string
  generatedAt: string
  case: {
    id: string
    title: string
    description: string | null
    status: string
    createdAt: string
    updatedAt: string
  }
  summary: {
    subjectCount: number
    evidenceFactCount: number
    sourceCount: number
    staleFactCount: number
    conflictedFieldCount: number
    corroboratedFieldCount: number
  }
  subjects: ReportSubject[]
  sourceRegister: Array<{
    name: string
    factCount: number
    latestRetrievedAt: string | null
    sourceTypes: string[]
    legalBases: string[]
  }>
  limitations: string[]
  receipt: {
    algorithm: string
    hash: string
    scope: string
  }
}

function display(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function EvidenceList({ title, items }: { title: string; items: ReportItem[] }) {
  if (!items.length) return null

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.field}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium text-white">{display(item.value)}</div>
                <div className="mt-1 text-xs text-slate-500">{item.field}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.corroborated && (
                  <Badge variant="outline" className="border-green-500/30 text-green-300">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Corroborated
                  </Badge>
                )}
                {item.conflicted && (
                  <Badge variant="outline" className="border-red-500/30 text-red-300">
                    <TriangleAlert className="mr-1 h-3 w-3" /> Conflict
                  </Badge>
                )}
                {item.stale && (
                  <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">
                    <Clock3 className="mr-1 h-3 w-3" /> Stale
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {Math.round(item.averageConfidence * 100)}% confidence • {item.sourceCount} source{item.sourceCount === 1 ? '' : 's'} • {item.sources.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CaseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [report, setReport] = useState<CaseReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${resolved.id}/report`, { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to generate report')
        setReport(body)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to generate report')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status, resolved.id])

  const downloadJson = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `atlasverify-case-${report.case.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!report) return null

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:bg-white print:text-black">
        <div className="flex flex-wrap items-start gap-4 print:hidden">
          <Link href={`/cases/${report.case.id}`}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-white">Auditable Case Report</h1>
            <p className="mt-1 text-slate-400">Source-backed findings with a deterministic report receipt.</p>
          </div>
          <Button variant="outline" onClick={downloadJson} className="border-slate-600 text-slate-300">
            <Download className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 print:border-slate-300 print:bg-white">
          <CardHeader>
            <CardTitle className="text-2xl text-white print:text-black">{report.case.title}</CardTitle>
            <CardDescription className="text-slate-400 print:text-slate-700">
              {report.case.description || 'No case description'} • Status: {report.case.status} • Generated {new Date(report.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ['Subjects', report.summary.subjectCount],
              ['Evidence facts', report.summary.evidenceFactCount],
              ['Sources', report.summary.sourceCount],
              ['Corroborated fields', report.summary.corroboratedFieldCount],
              ['Conflicted fields', report.summary.conflictedFieldCount],
              ['Stale facts', report.summary.staleFactCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-slate-700 p-3 print:border-slate-300">
                <div className="text-xl font-bold text-white print:text-black">{value}</div>
                <div className="text-xs text-slate-500 print:text-slate-600">{label}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {report.subjects.map(subject => (
          <Card key={subject.id} className="break-inside-avoid border-slate-700 bg-slate-800/50 print:border-slate-300 print:bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white print:text-black">
                <Users className="h-5 w-5" /> {subject.fullName}
              </CardTitle>
              <CardDescription className="text-slate-400 print:text-slate-700">
                {subject.evidenceSummary.totalFacts} evidence facts • {subject.evidenceSummary.uniqueSources} sources • {Math.round(subject.evidenceSummary.averageConfidence * 100)}% average confidence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400 print:text-slate-700">Case-entered identifiers</h4>
                <div className="grid gap-2 text-sm text-slate-300 print:text-black md:grid-cols-2">
                  {Object.entries(subject.enteredIdentifiers).filter(([, value]) => Boolean(value)).map(([key, value]) => (
                    <div key={key}><span className="text-slate-500">{key}:</span> {value}</div>
                  ))}
                </div>
              </div>

              <EvidenceList title="Aliases" items={subject.profile.aliases} />
              <EvidenceList title="Phone history" items={subject.profile.phones} />
              <EvidenceList title="Email history" items={subject.profile.emails} />
              <EvidenceList title="Address history" items={subject.profile.addresses} />
              <EvidenceList title="Relatives" items={subject.profile.relatives} />
              <EvidenceList title="Associates" items={subject.profile.associates} />
              <EvidenceList title="Businesses" items={subject.profile.businesses} />

              {subject.timeline.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400 print:text-slate-700">Evidence timeline</h4>
                  <div className="space-y-2">
                    {subject.timeline.slice(0, 25).map(event => (
                      <div key={event.id} className="rounded-lg border border-slate-700 p-3 print:border-slate-300">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-white print:text-black">{display(event.value)}</div>
                            <div className="text-xs text-slate-500">{event.field} • {event.sourceName}</div>
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(event.timestamp).toLocaleString()} ({event.timestampType})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Card className="break-inside-avoid border-slate-700 bg-slate-800/50 print:border-slate-300 print:bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white print:text-black">
              <Database className="h-5 w-5" /> Source Register
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.sourceRegister.length === 0 ? (
              <div className="text-sm text-slate-500">No evidence sources have been stored for this case.</div>
            ) : report.sourceRegister.map(source => (
              <div key={source.name} className="rounded-lg border border-slate-700 p-3 print:border-slate-300">
                <div className="font-medium text-white print:text-black">{source.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {source.factCount} fact{source.factCount === 1 ? '' : 's'}
                  {source.latestRetrievedAt ? ` • latest ${new Date(source.latestRetrievedAt).toLocaleString()}` : ''}
                  {source.sourceTypes.length ? ` • ${source.sourceTypes.join(', ')}` : ''}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="break-inside-avoid border-blue-500/30 bg-blue-500/5 print:border-slate-300 print:bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white print:text-black">
              <Fingerprint className="h-5 w-5" /> Report Receipt
            </CardTitle>
            <CardDescription className="text-slate-400 print:text-slate-700">
              This receipt detects changes to the generated report representation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="break-all rounded-lg border border-slate-700 bg-slate-950/40 p-3 font-mono text-xs text-blue-300 print:border-slate-300 print:bg-white print:text-black">
              {report.receipt.algorithm}: {report.receipt.hash}
            </div>
            <div className="mt-2 text-xs text-slate-500">{report.receipt.scope}</div>
          </CardContent>
        </Card>

        <Card className="break-inside-avoid border-yellow-500/20 bg-yellow-500/5 print:border-slate-300 print:bg-white">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200 print:text-black">Limitations and permitted use</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400 print:text-black">
              {report.limitations.map(item => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
