import { describe, expect, it } from 'vitest'
import { normalizeNhtsaRecall } from './nhtsa-recalls'

describe('NHTSA recall normalization', () => {
  it('normalizes official recall fields and safety flags', () => {
    expect(normalizeNhtsaRecall({
      NHTSACampaignNumber: '26V001',
      Manufacturer: 'Example Motors',
      Component: 'AIR BAGS',
      Summary: 'Example summary',
      Consequence: 'Example consequence',
      Remedy: 'Example remedy',
      ReportReceivedDate: '01/02/2026',
      parkIt: true,
      parkOutSide: 'false',
      overTheAirUpdate: 'Yes',
    })).toEqual({
      campaignNumber: '26V001',
      manufacturer: 'Example Motors',
      component: 'AIR BAGS',
      summary: 'Example summary',
      consequence: 'Example consequence',
      remedy: 'Example remedy',
      reportReceivedDate: '01/02/2026',
      parkIt: true,
      parkOutside: false,
      overTheAirUpdate: true,
    })
  })

  it('does not invent missing recall fields', () => {
    expect(normalizeNhtsaRecall({})).toEqual({
      campaignNumber: null,
      manufacturer: null,
      component: null,
      summary: null,
      consequence: null,
      remedy: null,
      reportReceivedDate: null,
      parkIt: null,
      parkOutside: null,
      overTheAirUpdate: null,
    })
  })
})
