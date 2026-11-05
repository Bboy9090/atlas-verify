import { canonicalCaseReportBody } from './case-report-verifier'

describe('canonicalCaseReportBody', () => {
  it('removes only the top-level receipt from the canonical body', () => {
    const report = {
      schemaVersion: 'atlasverify.case-report.v1',
      generatedAt: '2026-11-05T00:00:00.000Z',
      case: { id: 'case-1', title: 'Example' },
      nested: { receipt: { keep: true } },
      receipt: { algorithm: 'SHA-256', hash: 'abc' },
    }

    expect(canonicalCaseReportBody(report)).toBe(JSON.stringify({
      schemaVersion: 'atlasverify.case-report.v1',
      generatedAt: '2026-11-05T00:00:00.000Z',
      case: { id: 'case-1', title: 'Example' },
      nested: { receipt: { keep: true } },
    }))
  })

  it('does not mutate the supplied report', () => {
    const report = {
      schemaVersion: 'atlasverify.case-report.v1',
      receipt: { algorithm: 'SHA-256', hash: 'abc' },
    }
    canonicalCaseReportBody(report)
    expect(report.receipt.hash).toBe('abc')
  })
})
