import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildEvidenceFreshnessLedger } from '../lib/evidence-freshness.ts'

const now = new Date('2026-11-27T12:00:00Z')
const daysAgo = days => new Date(now.getTime()-days*86400000).toISOString()
const fact = (observedAt, retrievedAt=daysAgo(0)) => ({
  field:'fixture.status', value:'synthetic', sourceName:'test fixture', confidenceScore:0.5, observedAt, retrievedAt
})
test('recent retrieval is not proof of recent observation', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(undefined)], now)
  assert.equal(ledger.currentCount,0)
  assert.equal(ledger.unknownCount,1)
  assert.equal(ledger.lastSeenAt,null)
  assert.equal(ledger.lastRetrievedAt,now.toISOString())
  assert.equal(ledger.items[0].basis,'retrieved')
  assert.equal(ledger.items[0].ageDays,null)
})
test('old observation stays historical despite recent acquisition', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(daysAgo(800))],now)
  assert.equal(ledger.historicalCount,1)
  assert.equal(ledger.items[0].ageDays,800)
  assert.equal(ledger.lastSeenAt,daysAgo(800))
})
test('age band boundaries are deterministic', () => {
  const ledger=buildEvidenceFreshnessLedger([0,90,91,365,366].map(d=>fact(daysAgo(d))),now)
  assert.equal(ledger.currentCount,2)
  assert.equal(ledger.staleCount,2)
  assert.equal(ledger.historicalCount,1)
})
test('future observation does not become current', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(daysAgo(-1))],now)
  assert.equal(ledger.currentCount,0)
  assert.equal(ledger.unknownCount,1)
  assert.equal(ledger.lastSeenAt,null)
})
test('future retrieval is excluded from latest acquisition', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(undefined,daysAgo(-1))],now)
  assert.equal(ledger.lastRetrievedAt,null)
  assert.equal(ledger.items[0].timestamp,null)
  assert.equal(ledger.unknownCount,1)
})
test('observation after recorded retrieval is not treated as valid', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(daysAgo(1),daysAgo(10))],now)
  assert.equal(ledger.unknownCount,1)
  assert.equal(ledger.lastSeenAt,null)
})
test('invalid timestamps remain unknown', () => {
  const ledger=buildEvidenceFreshnessLedger([fact('invalid','invalid')],now)
  assert.equal(ledger.unknownCount,1)
  assert.equal(ledger.items[0].basis,'unknown')
  assert.equal(ledger.lastSeenAt,null)
  assert.equal(ledger.lastRetrievedAt,null)
})
test('latest observation is separate from newest retrieval and counts cover all records', () => {
  const ledger=buildEvidenceFreshnessLedger([fact(daysAgo(100)), ...Array.from({length:14},()=>fact(undefined))],now)
  assert.equal(ledger.lastSeenAt,daysAgo(100))
  assert.equal(ledger.lastRetrievedAt,now.toISOString())
  assert.equal(ledger.unknownCount,14)
  assert.equal(ledger.staleCount,1)
  assert.equal(ledger.items.length,12)
})
test('invalid reference clock rejected', () => {
  assert.throws(()=>buildEvidenceFreshnessLedger([],new Date('invalid')),RangeError)
})
test('profile route source wiring excludes suppressed primary and sibling records', () => {
  const src=readFileSync('app/api/cases/[id]/subjects/[subjectId]/profile/route.ts','utf8')
  const primary=src.indexOf('if (isSubjectSuppressed(subject, primarySuppression))')
  assert.ok(primary>src.indexOf('await loadApprovedSuppressionHashes([subject])'))
  assert.ok(primary>0 && primary<src.indexOf('const rawFacts'))
  const siblings=src.indexOf('const visibleSiblings = siblingSubjects.filter(candidate => !isSubjectSuppressed(candidate, siblingSuppression))')
  assert.ok(siblings>src.indexOf('await loadApprovedSuppressionHashes(siblingSubjects)'))
  assert.ok(siblings>0 && siblings<src.indexOf('const duplicateReview = rankDuplicateSubjects('))
  assert.match(src,/visibleSiblings\.map\(candidate/)
  assert.doesNotMatch(src,/siblingSubjects\.map\(candidate/)
  assert.match(src,/'Cache-Control': 'no-store, private'/)
})
