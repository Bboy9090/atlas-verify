'use client'

import { useEffect, useState, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  UserRound,
  Phone,
  Mail,
  MapPin,
  Users,
  Building2,
  ShieldCheck,
  TriangleAlert,
  Clock3,
  AtSign,
  GitBranch,
  History,
  Flag,
  BellRing,
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ProfileItem {
  category: string
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

interface EvidenceTimelineEvent {
  id: string
  timestamp: string
  timestampType: 'observed' | 'retrieved'
  field: string
  value: unknown
  sourceName: string
  sourceType: string | null
  sourceUrl: string | null
  confidenceScore: number
  corroborationCount: number
  conflictCount: number
}

interface RelationshipGraphNode {
  id: string
  label: string
  type: 'subject' | 'relative' | 'associate' | 'business'
  sourceCount: number
  averageConfidence: number
  corroborated: boolean
  conflicted: boolean
  stale: boolean
}

interface RelationshipGraphEdge {
  id: string
  from: string
  to: string
  type: 'relative' | 'associate' | 'business'
  label: string
}

interface ResolutionValue {
  field: string
  canonicalValue: string
  sourceCount: number
  factCount: number
  sources: string[]
  averageConfidence: number
}

interface EntityResolutionSummary {
  strength: 'none' | 'weak' | 'moderate' | 'strong'
  score: number
  corroboratedIdentifiers: number
  conflictedIdentifiers: number
  totalIdentifiers: number
  strongestSignals: ResolutionValue[]
  conflicts: Array<{
    field: string
    values: ResolutionValue[]
  }>
  identityConfirmed: false
}

interface FreshnessItem {
  id?: string
  field: string
  sourceName: string
  status: 'current' | 'stale' | 'historical' | 'unknown'
  basis: 'observed' | 'retrieved' | 'unknown'
  timestamp: string | null
  observedAt: string | null
  retrievedAt: string | null
  ageDays: number | null
}

interface FreshnessLedger {
  generatedAt: string
  currentThroughDays: number
  staleThroughDays: number
  currentCount: number
  staleCount: number
  historicalCount: number
  unknownCount: number
  lastSeenAt: string | null
  lastRetrievedAt: string | null
  items: FreshnessItem[]
}

interface ProfileResponse {
  subject: {
    id: string
    fullName: string
    phoneE164: string | null
    email: string | null
    username: string | null
    address: string | null
    city: string | null
    state: string | null
    notes: string | null
  }
  case: {
    id: string
    title: string
    status: string
  }
  profile: {
    generatedAt: string
    aliases: ProfileItem[]
    phones: ProfileItem[]
    emails: ProfileItem[]
    addresses: ProfileItem[]
    relatives: ProfileItem[]
    associates: ProfileItem[]
    businesses: ProfileItem[]
    other: ProfileItem[]
  }
  timeline: EvidenceTimelineEvent[]
  relationshipGraph: {
    nodes: RelationshipGraphNode[]
    edges: RelationshipGraphEdge[]
  }
  resolution: EntityResolutionSummary
  freshness: FreshnessLedger
  evidenceFactCount: number
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function ProfileSection({
  title,
  description,
  items,
  icon: Icon,
}: {
  title: string
  description: string
  items: ProfileItem[]
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Icon className="h-5 w-5 text-blue-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-500">
            No source-backed {title.toLowerCase()} have been collected yet.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.field}-${index}-${displayValue(item.value)}`}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="break-words font-medium text-white">
                      {displayValue(item.value)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.field}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.corroborated && (
                      <Badge variant="outline" className="border-green-500/40 text-green-300">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Corroborated
                      </Badge>
                    )}
                    {item.conflicted && (
                      <Badge variant="outline" className="border-red-500/40 text-red-300">
                        <TriangleAlert className="mr-1 h-3 w-3" />
                        Conflicting evidence
                      </Badge>
                    )}
                    {item.stale && (
                      <Badge variant="outline" className="border-yellow-500/40 text-yellow-300">
                        <Clock3 className="mr-1 h-3 w-3" />
                        Stale
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span>{item.sourceCount} source{item.sourceCount === 1 ? '' : 's'}</span>
                  <span>{item.factCount} evidence fact{item.factCount === 1 ? '' : 's'}</span>
                  <span>{Math.round(item.averageConfidence * 100)}% avg. confidence</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    Retrieved {new Date(item.latestRetrievedAt).toLocaleDateString()}
                  </span>
                  {item.observedAt && (
                    <span>Observed {new Date(item.observedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Sources: {item.sources.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SubjectProfilePage({
  params,
}: {
  params: Promise<{ id: string; subjectId: string }>
}) {
  const resolved = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    const load = async () => {
      try {
        const response = await fetch(
          `/api/cases/${resolved.id}/subjects/${resolved.subjectId}/profile`
        )
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load profile')
        setData(body)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status, resolved.id, resolved.subjectId])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!data) return null

  const subject = data.subject
  const graphNodes = new Map(data.relationshipGraph.nodes.map(node => [node.id, node]))
  const subjectNode = data.relationshipGraph.nodes.find(node => node.type === 'subject')

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <Link href={`/cases/${data.case.id}`}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <UserRound className="h-7 w-7 text-blue-400" />
              <h1 className="truncate text-3xl font-bold text-white">{subject.fullName}</h1>
            </div>
            <p className="mt-1 text-slate-400">
              Evidence-backed profile in {data.case.title}
            </p>
          </div>
          <Link href={`/monitoring?caseId=${data.case.id}&subjectId=${subject.id}`}>
            <Button variant="outline" className="border-blue-500/30 text-blue-300">
              <BellRing className="mr-2 h-4 w-4" />
              Monitoring
            </Button>
          </Link>
          <Link href={`/cases/${data.case.id}/subjects/${subject.id}/evidence-review`}>
            <Button variant="outline" className="border-yellow-500/30 text-yellow-300">
              <Flag className="mr-2 h-4 w-4" />
              Evidence Review
            </Button>
          </Link>
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {data.evidenceFactCount} evidence facts
          </Badge>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">Case-entered identifiers</CardTitle>
            <CardDescription className="text-slate-400">
              Values entered by the case owner. These are not treated as independently verified evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            {subject.phoneE164 && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-500" />
                {subject.phoneE164}
              </div>
            )}
            {subject.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                {subject.email}
              </div>
            )}
            {subject.username && (
              <div className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-slate-500" />
                {subject.username}
              </div>
            )}
            {(subject.address || subject.city || subject.state) && (
              <div className="flex items-center gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                {[subject.address, subject.city, subject.state].filter(Boolean).join(', ')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5 text-blue-400" />
                  Cross-source resolution
                </CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  Conservative evidence correlation across exact canonical values and distinct sources. This is not automatic identity confirmation.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  data.resolution.strength === 'strong'
                    ? 'border-green-500/40 text-green-300'
                    : data.resolution.strength === 'moderate'
                      ? 'border-blue-500/40 text-blue-300'
                      : data.resolution.strength === 'weak'
                        ? 'border-yellow-500/40 text-yellow-300'
                        : 'border-slate-600 text-slate-400'
                }
              >
                {data.resolution.strength} · {Math.round(data.resolution.score * 100)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                <div className="text-2xl font-bold text-green-300">{data.resolution.corroboratedIdentifiers}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Corroborated identifiers</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                <div className="text-2xl font-bold text-red-300">{data.resolution.conflictedIdentifiers}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Conflicted identifiers</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                <div className="text-2xl font-bold text-white">{data.resolution.totalIdentifiers}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Total identifiers</div>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100">
              Identity confirmed: <strong>no</strong>. Resolution strength summarizes source agreement only; it must not be treated as proof that records belong to the same person.
            </div>

            {data.resolution.strongestSignals.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Strongest signals</div>
                <div className="space-y-2">
                  {data.resolution.strongestSignals.map(signal => (
                    <div key={`${signal.field}:${signal.canonicalValue}`} className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="break-words text-sm font-medium text-white">{signal.canonicalValue}</div>
                          <div className="mt-1 text-xs text-slate-500">{signal.field}</div>
                        </div>
                        <Badge variant="outline" className="border-green-500/30 text-green-300">
                          {signal.sourceCount} sources
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {signal.factCount} facts · {Math.round(signal.averageConfidence * 100)}% avg. confidence · {signal.sources.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.resolution.conflicts.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-red-300">
                  <TriangleAlert className="h-3 w-3" />
                  Conflicts requiring review
                </div>
                <div className="space-y-2">
                  {data.resolution.conflicts.map(conflict => (
                    <div key={conflict.field} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <div className="text-xs font-medium text-red-200">{conflict.field}</div>
                      <div className="mt-2 space-y-1">
                        {conflict.values.map(value => (
                          <div key={value.canonicalValue} className="text-sm text-slate-300">
                            {value.canonicalValue} <span className="text-xs text-slate-500">({value.sourceCount} sources)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock3 className="h-5 w-5 text-blue-400" />
                  Evidence freshness ledger
                </CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  Freshness uses source observation time when available, otherwise retrieval time. Current means up to {data.freshness.currentThroughDays} days; stale means up to {data.freshness.staleThroughDays} days; older evidence is historical.
                </CardDescription>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Last seen: {data.freshness.lastSeenAt ? new Date(data.freshness.lastSeenAt).toLocaleString() : 'unknown'}</div>
                <div>Last retrieved: {data.freshness.lastRetrievedAt ? new Date(data.freshness.lastRetrievedAt).toLocaleString() : 'unknown'}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <div className="text-2xl font-bold text-green-300">{data.freshness.currentCount}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Current</div>
              </div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <div className="text-2xl font-bold text-yellow-300">{data.freshness.staleCount}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Stale</div>
              </div>
              <div className="rounded-lg border border-slate-600 bg-slate-900/70 p-3">
                <div className="text-2xl font-bold text-slate-200">{data.freshness.historicalCount}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Historical</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                <div className="text-2xl font-bold text-slate-400">{data.freshness.unknownCount}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Unknown age</div>
              </div>
            </div>

            {data.freshness.items.length > 0 && (
              <div className="space-y-2">
                {data.freshness.items.map((item, index) => (
                  <div key={item.id || `${item.field}:${item.sourceName}:${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                    <div>
                      <div className="text-sm font-medium text-white">{item.field}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.sourceName} · {item.basis} timestamp</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'current'
                            ? 'border-green-500/40 text-green-300'
                            : item.status === 'stale'
                              ? 'border-yellow-500/40 text-yellow-300'
                              : item.status === 'historical'
                                ? 'border-slate-500/40 text-slate-300'
                                : 'border-slate-700 text-slate-500'
                        }
                      >
                        {item.status}
                      </Badge>
                      <span className="text-slate-500">
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'timestamp unavailable'}
                        {item.ageDays !== null ? ` · ${item.ageDays}d` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <GitBranch className="h-5 w-5 text-blue-400" />
                Relationship graph
              </CardTitle>
              <CardDescription className="text-slate-400">
                Connections shown here come only from evidence that explicitly reports a relative, associate, or business relationship.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.relationshipGraph.edges.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-500">
                  No source-backed relationship edges have been collected yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.relationshipGraph.edges.map(edge => {
                    const node = graphNodes.get(edge.to)
                    if (!node) return null
                    return (
                      <div
                        key={edge.id}
                        className="grid items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3 md:grid-cols-[1fr_auto_1fr]"
                      >
                        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm font-medium text-blue-200">
                          {subjectNode?.label || subject.fullName}
                        </div>
                        <div className="text-center text-xs text-slate-500">
                          → {edge.label} →
                        </div>
                        <div className="rounded-md border border-slate-600 px-3 py-2">
                          <div className="break-words text-sm font-medium text-white">{node.label}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {node.type}
                            </Badge>
                            {node.corroborated && (
                              <Badge variant="outline" className="border-green-500/30 text-green-300">
                                corroborated
                              </Badge>
                            )}
                            {node.conflicted && (
                              <Badge variant="outline" className="border-red-500/30 text-red-300">
                                conflict
                              </Badge>
                            )}
                            {node.stale && (
                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">
                                stale
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {node.sourceCount} source{node.sourceCount === 1 ? '' : 's'} • {Math.round(node.averageConfidence * 100)}% confidence
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <History className="h-5 w-5 text-blue-400" />
                Evidence timeline
              </CardTitle>
              <CardDescription className="text-slate-400">
                Chronological evidence using source observation time when supplied, otherwise retrieval time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-500">
                  No evidence events have been collected yet.
                </div>
              ) : (
                <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
                  {data.timeline.map(event => (
                    <div key={event.id} className="relative border-l border-slate-700 pl-4">
                      <div className="absolute -left-1 top-2 h-2 w-2 rounded-full bg-blue-400" />
                      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-white">{displayValue(event.value)}</div>
                            <div className="mt-1 text-xs text-slate-500">{event.field}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>{new Date(event.timestamp).toLocaleString()}</div>
                            <div>{event.timestampType}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {event.sourceName}
                          </Badge>
                          <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                            {Math.round(event.confidenceScore * 100)}% confidence
                          </Badge>
                          {event.corroborationCount > 0 && (
                            <Badge variant="outline" className="border-green-500/30 text-green-300">
                              corroboration {event.corroborationCount}
                            </Badge>
                          )}
                          {event.conflictCount > 0 && (
                            <Badge variant="outline" className="border-red-500/30 text-red-300">
                              conflicts {event.conflictCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileSection title="Aliases" description="Alternate names found in source-backed evidence." items={data.profile.aliases} icon={UserRound} />
          <ProfileSection title="Phone history" description="Phone numbers explicitly reported by evidence providers." items={data.profile.phones} icon={Phone} />
          <ProfileSection title="Email history" description="Email addresses explicitly reported by evidence providers." items={data.profile.emails} icon={Mail} />
          <ProfileSection title="Address history" description="Current or historical addresses explicitly reported by evidence providers." items={data.profile.addresses} icon={MapPin} />
          <ProfileSection title="Relatives" description="Potential relatives only when a source explicitly describes that relationship." items={data.profile.relatives} icon={Users} />
          <ProfileSection title="Associates" description="Potential associates only when a source explicitly supports that connection." items={data.profile.associates} icon={Users} />
          <ProfileSection title="Businesses" description="Business relationships explicitly reported by source evidence." items={data.profile.businesses} icon={Building2} />
        </div>
      </div>
    </DashboardLayout>
  )
}
