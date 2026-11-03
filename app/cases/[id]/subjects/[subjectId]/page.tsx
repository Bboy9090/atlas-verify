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
