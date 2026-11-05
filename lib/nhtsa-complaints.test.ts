import { describe, expect, it } from 'vitest'
import { normalizeNhtsaComplaint } from './nhtsa-complaints'

describe('NHTSA complaint normalization', () => {
  it('normalizes complaint metadata without upgrading allegations to findings', () => {
    expect(normalizeNhtsaComplaint({
      odiNumber: '12345678',
      manufacturer: 'Example Motors',
      components: 'STEERING',
      summary: 'Consumer reported a steering issue.',
      dateOfIncident: '10/01/2026',
      crash: 'Y',
      fire: 'N',
      numberOfInjuries: '1',
      numberOfDeaths: 0,
    })).toEqual({
      odiNumber: '12345678',
      manufacturer: 'Example Motors',
      components: 'STEERING',
      summary: 'Consumer reported a steering issue.',
      dateOfIncident: '10/01/2026',
      crash: true,
      fire: false,
      injuries: 1,
      deaths: 0,
    })
  })

  it('leaves absent values unknown', () => {
    expect(normalizeNhtsaComplaint({})).toEqual({
      odiNumber: null,
      manufacturer: null,
      components: null,
      summary: null,
      dateOfIncident: null,
      crash: null,
      fire: null,
      injuries: null,
      deaths: null,
    })
  })
})
