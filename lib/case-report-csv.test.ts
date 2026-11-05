import { caseReportToCsv } from './case-report-csv'

describe('caseReportToCsv', () => {
  it('preserves provenance, confidence, and receipt data', () => {
    const csv = caseReportToCsv({
      case: { id: 'case-1', title: 'Test Case' },
      receipt: { algorithm: 'SHA-256', hash: 'abc123' },
      subjects: [{
        id: 'subject-1',
        fullName: 'Jane Doe',
        profile: {
          emails: [{
            field: 'email.address',
            value: 'jane@example.com',
            sources: ['Provider A', 'Provider B'],
            sourceCount: 2,
            factCount: 2,
            averageConfidence: 0.91,
            latestRetrievedAt: '2026-11-05T00:00:00.000Z',
            observedAt: null,
            corroborated: true,
            conflicted: false,
            stale: false,
          }],
        },
      }],
    })

    expect(csv).toContain('case_id,case_title,subject_id')
    expect(csv).toContain('Jane Doe')
    expect(csv).toContain('Provider A | Provider B')
    expect(csv).toContain('0.91')
    expect(csv).toContain('SHA-256')
    expect(csv).toContain('abc123')
  })

  it('quotes commas, quotes, and line breaks safely', () => {
    const csv = caseReportToCsv({
      case: { id: 'case-1', title: 'A, B' },
      receipt: { algorithm: 'SHA-256', hash: 'hash' },
      subjects: [{
        id: 's1',
        fullName: 'Doe, "Jane"',
        profile: {
          aliases: [{
            field: 'alias',
            value: 'Line 1\nLine 2',
            sources: ['Source'],
            sourceCount: 1,
            factCount: 1,
            averageConfidence: 0.5,
            latestRetrievedAt: '2026-11-05T00:00:00.000Z',
            observedAt: null,
            corroborated: false,
            conflicted: false,
            stale: false,
          }],
        },
      }],
    })

    expect(csv).toContain('"A, B"')
    expect(csv).toContain('"Doe, ""Jane"""')
    expect(csv).toContain('"Line 1\nLine 2"')
  })
})
