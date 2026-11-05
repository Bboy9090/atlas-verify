import { describe, expect, it } from 'vitest'
import {
  correlateBusinessCandidates,
  normalizeBusinessName,
  normalizeJurisdiction,
} from './business-resolution'

describe('business cross-source resolution', () => {
  it('normalizes case, punctuation, and ampersands without fuzzy matching', () => {
    expect(normalizeBusinessName('ACME & Sons, Inc.')).toBe('acme and sons inc')
    expect(normalizeBusinessName('Acme Sons Inc')).not.toBe(normalizeBusinessName('ACME & Sons, Inc.'))
  })

  it('normalizes US OpenCorporates jurisdiction codes to SEC-style state codes', () => {
    expect(normalizeJurisdiction('us_de')).toBe('DE')
    expect(normalizeJurisdiction('DE')).toBe('DE')
  })

  it('correlates only exact normalized names and strengthens matching jurisdiction', () => {
    const results = correlateBusinessCandidates(
      [{ cik: '0001', name: 'Example Holdings, Inc.', stateOfIncorporation: 'DE' }],
      [{
        name: 'Example Holdings, Inc.',
        companyNumber: '12345',
        jurisdictionCode: 'us_de',
      }],
    )
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      jurisdictionAgreement: true,
      identityConfirmed: false,
      sourceCount: 2,
      confidence: 0.9,
    })
  })

  it('does not correlate similar-but-not-exact names', () => {
    const results = correlateBusinessCandidates(
      [{ cik: '0001', name: 'Example Holdings Inc', stateOfIncorporation: 'DE' }],
      [{
        name: 'Example Holding Inc',
        companyNumber: '12345',
        jurisdictionCode: 'us_de',
      }],
    )
    expect(results).toHaveLength(0)
  })

  it('keeps conflicting jurisdictions as a lower-confidence review candidate', () => {
    const [result] = correlateBusinessCandidates(
      [{ cik: '0001', name: 'Example Holdings Inc', stateOfIncorporation: 'DE' }],
      [{
        name: 'Example Holdings Inc',
        companyNumber: '12345',
        jurisdictionCode: 'us_ny',
      }],
    )
    expect(result).toMatchObject({
      jurisdictionAgreement: false,
      confidence: 0.58,
      identityConfirmed: false,
    })
  })
})
