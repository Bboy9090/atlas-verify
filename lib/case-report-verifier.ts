export interface CaseReportReceipt {
  algorithm: string
  hash: string
  scope?: string
}

export interface VerifiableCaseReport {
  receipt?: CaseReportReceipt
  [key: string]: unknown
}

export function canonicalCaseReportBody(report: VerifiableCaseReport): string {
  const { receipt: _receipt, ...body } = report
  return JSON.stringify(body)
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function computeCaseReportHash(report: VerifiableCaseReport): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 verification is unavailable in this browser.')
  }
  const encoded = new TextEncoder().encode(canonicalCaseReportBody(report))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return hex(new Uint8Array(digest))
}

export async function verifyCaseReportReceipt(report: VerifiableCaseReport): Promise<{
  valid: boolean
  expected: string | null
  actual: string
  algorithm: string | null
}> {
  const expected = typeof report.receipt?.hash === 'string' ? report.receipt.hash.toLowerCase() : null
  const algorithm = typeof report.receipt?.algorithm === 'string' ? report.receipt.algorithm : null
  const actual = await computeCaseReportHash(report)

  return {
    valid: algorithm === 'SHA-256' && Boolean(expected) && expected === actual,
    expected,
    actual,
    algorithm,
  }
}
