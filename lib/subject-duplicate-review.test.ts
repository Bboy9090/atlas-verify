import { describe, expect, it } from 'vitest'
import { compareDuplicateSubjects, rankDuplicateSubjects } from '@/lib/subject-duplicate-review'

const facts = (field: string, value: string, sourceName = 'provider') => [{
  field, value, normalizedValue: value, sourceName, retrievedAt: new Date('2026-01-01'), confidenceScore: 0.9,
}]

describe('duplicate subject review', () => {
  it('scores exact bounded identifier overlap without confirming identity', () => {
    const review = compareDuplicateSubjects(
      { id: 'a', fullName: 'Alex One', phoneE164: '+15551234567', facts: [] },
      { id: 'b', fullName: 'Alex Two', phoneE164: '+15551234567', facts: [] },
    )
    expect(review.score).toBeGreaterThan(0)
    expect(review.overlaps[0]?.field).toBe('phone')
    expect(review.identityConfirmed).toBe(false)
    expect(review.mergeRecommended).toBe(false)
  })

  it('penalizes conflicting bounded identifiers', () => {
    const review = compareDuplicateSubjects(
      { id: 'a', fullName: 'A', email: 'same@example.com', phoneE164: '+15550000001', facts: [] },
      { id: 'b', fullName: 'B', email: 'same@example.com', phoneE164: '+15550000002', facts: [] },
    )
    expect(review.overlaps.some(item => item.field === 'email')).toBe(true)
    expect(review.conflicts.some(item => item.field === 'phone')).toBe(true)
    expect(review.identityConfirmed).toBe(false)
  })

  it('uses bounded evidence field families and ignores arbitrary names', () => {
    const ranked = rankDuplicateSubjects(
      { id: 'a', fullName: 'Same Name', facts: facts('contact.email', 'x@example.com') },
      [
        { id: 'b', fullName: 'Same Name', facts: facts('email.address', 'x@example.com', 'second') },
        { id: 'c', fullName: 'Same Name', facts: facts('person.name', 'same name') },
      ],
    )
    expect(ranked.map(item => item.subjectId)).toEqual(['b'])
  })
})
