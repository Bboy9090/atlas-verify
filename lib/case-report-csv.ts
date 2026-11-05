export interface CsvReportItem {
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

export interface CsvReportSubject {
  id: string
  fullName: string
  profile: Record<string, CsvReportItem[]>
}

export interface CsvCaseReport {
  case: { id: string; title: string }
  subjects: CsvReportSubject[]
  receipt: { algorithm: string; hash: string }
}

function scalar(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function csvCell(value: unknown): string {
  const text = scalar(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function caseReportToCsv(report: CsvCaseReport): string {
  const header = [
    'case_id',
    'case_title',
    'subject_id',
    'subject_name',
    'category',
    'field',
    'value',
    'sources',
    'source_count',
    'fact_count',
    'average_confidence',
    'latest_retrieved_at',
    'observed_at',
    'corroborated',
    'conflicted',
    'stale',
    'receipt_algorithm',
    'report_hash',
  ]

  const rows: unknown[][] = [header]

  for (const subject of report.subjects) {
    for (const [category, items] of Object.entries(subject.profile)) {
      for (const item of items) {
        rows.push([
          report.case.id,
          report.case.title,
          subject.id,
          subject.fullName,
          category,
          item.field,
          item.value,
          item.sources.join(' | '),
          item.sourceCount,
          item.factCount,
          item.averageConfidence,
          item.latestRetrievedAt,
          item.observedAt ?? '',
          item.corroborated,
          item.conflicted,
          item.stale,
          report.receipt.algorithm,
          report.receipt.hash,
        ])
      }
    }
  }

  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
