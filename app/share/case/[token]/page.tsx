'use client'

import { use, useEffect, useState } from 'react'

interface SharedReport {
  readOnly: boolean
  expiresAt: string
  report: {
    generatedAt: string
    case: { title: string; description: string | null; status: string }
    summary: {
      subjectCount: number
      evidenceFactCount: number
      sourceCount: number
      staleFactCount: number
      conflictedFieldCount: number
      corroboratedFieldCount: number
    }
    subjects: Array<{
      id: string
      fullName: string
      evidenceSummary: {
        totalFacts: number
        uniqueSources: number
        averageConfidence: number
      }
      profile: {
        aliases: Array<{ value: unknown }>
        phones: Array<{ value: unknown }>
        emails: Array<{ value: unknown }>
        addresses: Array<{ value: unknown }>
        businesses: Array<{ value: unknown }>
      }
    }>
    limitations: string[]
    receipt: { algorithm: string; hash: string; scope: string }
  }
}

function valueText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export default function SharedCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<SharedReport | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch(`/api/share/case/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Share link is unavailable')
        if (active) setData(body)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Share link is unavailable')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-200"><div className="mx-auto max-w-4xl">Loading read-only case report…</div></main>
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <div className="mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold">Case share unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">{error || 'This link may have expired or been revoked.'}</p>
        </div>
      </main>
    )
  }

  const { report } = data
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-200 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Bobby&apos;s Case File · Read-only share</div>
          <h1 className="mt-2 text-3xl font-bold text-white">{report.case.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{report.case.description || 'No case description'}</p>
          <div className="mt-3 text-xs text-slate-500">
            Status: {report.case.status} · Generated {new Date(report.generatedAt).toLocaleString()} · Link expires {new Date(data.expiresAt).toLocaleString()}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Subjects', report.summary.subjectCount],
            ['Facts', report.summary.evidenceFactCount],
            ['Sources', report.summary.sourceCount],
            ['Corroborated', report.summary.corroboratedFieldCount],
            ['Conflicts', report.summary.conflictedFieldCount],
            ['Stale', report.summary.staleFactCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </section>

        {report.subjects.map(subject => (
          <section key={subject.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold text-white">{subject.fullName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {subject.evidenceSummary.totalFacts} evidence facts · {subject.evidenceSummary.uniqueSources} sources · {Math.round(subject.evidenceSummary.averageConfidence * 100)}% average confidence
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ['Aliases', subject.profile.aliases],
                ['Phones', subject.profile.phones],
                ['Emails', subject.profile.emails],
                ['Addresses', subject.profile.addresses],
                ['Businesses', subject.profile.businesses],
              ].map(([label, items]) => {
                const values = items as Array<{ value: unknown }>
                if (!values.length) return null
                return (
                  <div key={String(label)} className="rounded-lg border border-slate-800 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      {values.slice(0, 10).map((item, index) => <div key={index}>{valueText(item.value)}</div>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <h2 className="font-semibold text-yellow-100">Limitations</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {report.limitations.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit receipt</div>
          <div className="mt-2 break-all font-mono text-xs text-cyan-300">{report.receipt.algorithm}: {report.receipt.hash}</div>
          <div className="mt-2 text-xs text-slate-500">{report.receipt.scope}</div>
        </section>
      </div>
    </main>
  )
}
