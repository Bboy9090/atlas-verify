import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const helper = fs.readFileSync('lib/evidence-corrections.ts', 'utf8')
const reportRoute = fs.readFileSync('app/api/cases/[id]/report/route.ts', 'utf8')
const evidenceRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/evidence/route.ts',
  'utf8',
)
const resolveRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/evidence/disputes/[disputeId]/route.ts',
  'utf8',
)
const reportBuilder = fs.readFileSync('lib/case-report.ts', 'utf8')

test('resolved correction overlay requires an accepted requested value', () => {
  assert.match(helper, /dispute\.status === 'resolved'/)
  assert.match(helper, /dispute\.requestedValue !== null/)
  assert.match(helper, /dispute\.requestedValue !== undefined/)
  assert.match(helper, /originalValue: fact\.value/)
  assert.match(helper, /effectiveValue: accepted\.requestedValue/)
})

test('case reports derive corrected facts and bind a correction ledger into the receipt body', () => {
  assert.match(reportRoute, /where: \{ userId, status: 'resolved' \}/)
  assert.match(reportRoute, /applyResolvedEvidenceCorrections\(rawFacts\)/)
  assert.match(reportRoute, /evidenceCorrections: corrected\.corrections/)
  assert.match(reportBuilder, /evidenceCorrections: subject\.evidenceCorrections \?\? \[\]/)
  assert.match(reportBuilder, /appliedCorrectionCount/)
  assert.match(reportBuilder, /original source evidence remains immutable/)
})

test('evidence API exposes effective and original values side by side', () => {
  assert.match(evidenceRoute, /summary: summarizeEvidence\(corrected\.facts\)/)
  assert.match(evidenceRoute, /originalValue: correction \? original\?\.value : undefined/)
  assert.match(evidenceRoute, /correction: correction \?\? null/)
  assert.match(evidenceRoute, /appliedCorrectionCount: corrected\.corrections\.length/)
})

test('resolving a challenge never overwrites the source evidence fact', () => {
  assert.match(resolveRoute, /prisma\.evidenceDispute\.update/)
  assert.doesNotMatch(resolveRoute, /prisma\.evidenceFact\.update/)
  assert.doesNotMatch(resolveRoute, /prisma\.evidenceFact\.delete/)
})
