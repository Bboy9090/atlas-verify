import { createHash } from 'node:crypto'
import type { EvidenceFactLike } from '@/lib/evidence'
import { summarizeEvidence } from '@/lib/evidence'
import { buildProfileIntelligence } from '@/lib/profile-intelligence'
import { buildEvidenceTimeline, buildRelationshipGraph } from '@/lib/evidence-views'

export interface CaseReportSubjectInput {
  id: string
  fullName: string
  phoneE164: string | null
  email: string | null
  username: string | null
  address: string | null
  city: string | null
  state: string | null
  notes: string | null
  createdAt: Date | string
  evidenceFacts: EvidenceFactLike[]
}

export interface CaseReportInput {
  id: string
  title: string
  description: string | null
  status: string
  createdAt: Date | string
  updatedAt: Date | string
  subjects: CaseReportSubjectInput[]
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function buildCaseReport(input: CaseReportInput, generatedAt = new Date()) {
  const subjects = input.subjects.map(subject => {
    const profile = buildProfileIntelligence(subject.evidenceFacts, generatedAt)
    const evidenceSummary = summarizeEvidence(subject.evidenceFacts, { now: generatedAt })
    const timeline = buildEvidenceTimeline(subject.evidenceFacts)
    const relationshipGraph = buildRelationshipGraph(subject.id, subject.fullName, profile)

    return {
      id: subject.id,
      fullName: subject.fullName,
      enteredIdentifiers: {
        phoneE164: subject.phoneE164,
        email: subject.email,
        username: subject.username,
        address: subject.address,
        city: subject.city,
        state: subject.state,
      },
      notes: subject.notes,
      createdAt: iso(subject.createdAt),
      evidenceSummary,
      profile,
      timeline,
      relationshipGraph,
    }
  })

  const allFacts = input.subjects.flatMap(subject => subject.evidenceFacts)
  const sourceMap = new Map<string, {
    name: string
    factCount: number
    latestRetrievedAt: string | null
    sourceTypes: Set<string>
    legalBases: Set<string>
  }>()

  for (const fact of allFacts) {
    const existing = sourceMap.get(fact.sourceName) ?? {
      name: fact.sourceName,
      factCount: 0,
      latestRetrievedAt: null,
      sourceTypes: new Set<string>(),
      legalBases: new Set<string>(),
    }

    existing.factCount += 1
    if (fact.sourceType) existing.sourceTypes.add(fact.sourceType)
    if (fact.legalBasis) existing.legalBases.add(fact.legalBasis)

    const retrieved = new Date(fact.retrievedAt)
    if (Number.isFinite(retrieved.getTime())) {
      const value = retrieved.toISOString()
      if (!existing.latestRetrievedAt || value > existing.latestRetrievedAt) {
        existing.latestRetrievedAt = value
      }
    }

    sourceMap.set(fact.sourceName, existing)
  }

  const sourceRegister = Array.from(sourceMap.values())
    .map(source => ({
      name: source.name,
      factCount: source.factCount,
      latestRetrievedAt: source.latestRetrievedAt,
      sourceTypes: Array.from(source.sourceTypes).sort(),
      legalBases: Array.from(source.legalBases).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const reportBody = {
    schemaVersion: 'atlasverify.case-report.v1',
    generatedAt: generatedAt.toISOString(),
    case: {
      id: input.id,
      title: input.title,
      description: input.description,
      status: input.status,
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.updatedAt),
    },
    summary: {
      subjectCount: subjects.length,
      evidenceFactCount: allFacts.length,
      sourceCount: sourceRegister.length,
      staleFactCount: subjects.reduce((sum, subject) => sum + subject.evidenceSummary.staleFactCount, 0),
      conflictedFieldCount: subjects.reduce((sum, subject) => sum + subject.evidenceSummary.conflictedFieldCount, 0),
      corroboratedFieldCount: subjects.reduce((sum, subject) => sum + subject.evidenceSummary.corroboratedFieldCount, 0),
    },
    subjects,
    sourceRegister,
    limitations: [
      'This report contains research leads and evidence summaries, not identity proof.',
      'Case-entered identifiers are user-supplied and are not independently verified unless supported by evidence facts.',
      'Public-record and licensed-source data can be incomplete, stale, or associated with the wrong person.',
      "Bobby's Case File is not a consumer reporting agency and this report is not for FCRA eligibility decisions.",
    ],
  }

  const canonical = JSON.stringify(reportBody)
  const sha256 = createHash('sha256').update(canonical).digest('hex')

  return {
    ...reportBody,
    receipt: {
      algorithm: 'SHA-256',
      hash: sha256,
      scope: 'JSON serialization of this report excluding the receipt object',
    },
  }
}
