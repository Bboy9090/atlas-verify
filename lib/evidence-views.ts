import type { EvidenceFactLike } from '@/lib/evidence'
import type { ProfileIntelligence, ProfileIntelligenceItem } from '@/lib/profile-intelligence'

export interface EvidenceTimelineEvent {
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

export interface RelationshipGraphNode {
  id: string
  label: string
  type: 'subject' | 'relative' | 'associate' | 'business'
  sourceCount: number
  averageConfidence: number
  corroborated: boolean
  conflicted: boolean
  stale: boolean
}

export interface RelationshipGraphEdge {
  id: string
  from: string
  to: string
  type: 'relative' | 'associate' | 'business'
  label: string
}

export interface RelationshipGraph {
  nodes: RelationshipGraphNode[]
  edges: RelationshipGraphEdge[]
}

function safeIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function buildEvidenceTimeline(
  facts: EvidenceFactLike[],
  limit = 100
): EvidenceTimelineEvent[] {
  return facts
    .map((fact, index) => {
      const observedAt = safeIso(fact.observedAt)
      const retrievedAt = safeIso(fact.retrievedAt)
      const timestamp = observedAt ?? retrievedAt
      if (!timestamp) return null

      return {
        id: fact.id ?? `fact-${index}`,
        timestamp,
        timestampType: observedAt ? 'observed' as const : 'retrieved' as const,
        field: fact.field,
        value: fact.value,
        sourceName: fact.sourceName,
        sourceType: fact.sourceType ?? null,
        sourceUrl: fact.sourceUrl ?? null,
        confidenceScore: fact.confidenceScore,
        corroborationCount: fact.corroborationCount ?? 0,
        conflictCount: fact.conflictCount ?? 0,
      }
    })
    .filter((event): event is EvidenceTimelineEvent => Boolean(event))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, Math.max(1, limit))
}

function relationshipNode(
  item: ProfileIntelligenceItem,
  type: 'relative' | 'associate' | 'business',
  index: number
): RelationshipGraphNode {
  return {
    id: `${type}-${index}`,
    label: displayValue(item.value),
    type,
    sourceCount: item.sourceCount,
    averageConfidence: item.averageConfidence,
    corroborated: item.corroborated,
    conflicted: item.conflicted,
    stale: item.stale,
  }
}

export function buildRelationshipGraph(
  subjectId: string,
  subjectName: string,
  profile: ProfileIntelligence
): RelationshipGraph {
  const nodes: RelationshipGraphNode[] = [{
    id: `subject-${subjectId}`,
    label: subjectName,
    type: 'subject',
    sourceCount: 0,
    averageConfidence: 1,
    corroborated: false,
    conflicted: false,
    stale: false,
  }]
  const edges: RelationshipGraphEdge[] = []
  const subjectNodeId = nodes[0].id

  const append = (
    items: ProfileIntelligenceItem[],
    type: 'relative' | 'associate' | 'business',
    label: string
  ) => {
    items.slice(0, 30).forEach((item, index) => {
      const node = relationshipNode(item, type, index)
      nodes.push(node)
      edges.push({
        id: `${subjectNodeId}-${node.id}`,
        from: subjectNodeId,
        to: node.id,
        type,
        label,
      })
    })
  }

  append(profile.relatives, 'relative', 'reported relative')
  append(profile.associates, 'associate', 'reported associate')
  append(profile.businesses, 'business', 'reported business relationship')

  return { nodes, edges }
}
