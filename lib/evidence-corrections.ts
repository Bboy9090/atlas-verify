import type { EvidenceFactLike } from '@/lib/evidence'

export interface ResolvedEvidenceDisputeLike {
  id: string
  status: string
  requestedValue: unknown
  resolutionNote?: string | null
  resolvedAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface CorrectableEvidenceFact extends EvidenceFactLike {
  id: string
  disputes?: ResolvedEvidenceDisputeLike[]
}

export interface AppliedEvidenceCorrection {
  evidenceFactId: string
  disputeId: string
  field: string
  sourceName: string
  originalValue: unknown
  effectiveValue: unknown
  resolutionNote: string | null
  resolvedAt: string | null
}

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function resolvedCorrectionForFact(
  fact: CorrectableEvidenceFact
): AppliedEvidenceCorrection | null {
  const accepted = (fact.disputes ?? [])
    .filter(dispute =>
      dispute.status === 'resolved' &&
      dispute.requestedValue !== null &&
      dispute.requestedValue !== undefined
    )
    .sort((a, b) =>
      Math.max(timestamp(b.resolvedAt), timestamp(b.updatedAt)) -
      Math.max(timestamp(a.resolvedAt), timestamp(a.updatedAt))
    )[0]

  if (!accepted) return null

  return {
    evidenceFactId: fact.id,
    disputeId: accepted.id,
    field: fact.field,
    sourceName: fact.sourceName,
    originalValue: fact.value,
    effectiveValue: accepted.requestedValue,
    resolutionNote: accepted.resolutionNote ?? null,
    resolvedAt: isoOrNull(accepted.resolvedAt),
  }
}

export function applyResolvedEvidenceCorrections(
  facts: CorrectableEvidenceFact[]
): {
  facts: EvidenceFactLike[]
  corrections: AppliedEvidenceCorrection[]
} {
  const corrections: AppliedEvidenceCorrection[] = []
  const correctedFacts = facts.map(fact => {
    const correction = resolvedCorrectionForFact(fact)
    if (!correction) return fact

    corrections.push(correction)
    return {
      ...fact,
      value: correction.effectiveValue,
    }
  })

  return { facts: correctedFacts, corrections }
}
