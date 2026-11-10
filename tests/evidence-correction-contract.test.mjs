import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const helper = fs.readFileSync('lib/evidence-corrections.ts', 'utf8')
const reportRoute = fs.readFileSync('app/api/cases/[id]/report/route.ts', 'utf8')
const reportLoader = fs.readFileSync('lib/case-report-server.ts', 'utf8')
const evidenceRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/evidence/route.ts',
  'utf8',
)
const resolveRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/evidence/disputes/[disputeId]/route.ts',
  'utf8',
)
const reportBuilder = fs.readFileSync('lib/case-report.ts', 'utf8')
const profileRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/profile/route.ts',
  'utf8',
)
const reportPage = fs.readFileSync('app/cases/[id]/report/page.tsx', 'utf8')
const reviewPage = fs.readFileSync(
  'app/cases/[id]/subjects/[subjectId]/evidence-review/page.tsx',
  'utf8',
)

test('resolved correction overlay requires an accepted requested value', () => {
  assert.match(helper, /dispute\.status === 'resolved'/)
  assert.match(helper, /dispute\.requestedValue !== null/)
  assert.match(helper, /dispute\.requestedValue !== undefined/)
  assert.match(helper, /originalValue: fact\.value/)
  assert.match(helper, /effectiveValue: accepted\.requestedValue/)
  assert.match(helper, /normalizedValue: normalizeEffectiveValue\(correction\.effectiveValue\)/)
})

test('case reports derive corrected facts through the shared report loader and bind a correction ledger into the receipt body', () => {
  assert.match(reportRoute, /loadCaseReport\(id, userId\)/)
  assert.match(reportLoader, /where: \{ userId: ownerId, status: 'resolved' \}/)
  assert.match(reportLoader, /applyResolvedEvidenceCorrections\(rawFacts\)/)
  assert.match(reportLoader, /evidenceCorrections: corrected\.corrections/)
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


test('subject profile intelligence uses the same accepted correction overlay', () => {
  assert.match(profileRoute, /applyResolvedEvidenceCorrections\(rawFacts\)/)
  assert.match(profileRoute, /const facts = correctedPrimary\.facts/)
  assert.match(profileRoute, /applyResolvedEvidenceCorrections\(candidateRawFacts\)\.facts/)
  assert.match(profileRoute, /appliedCorrectionCount: correctedPrimary\.corrections\.length/)
})

test('human-readable reports disclose every accepted correction bound into the receipt', () => {
  assert.match(reportPage, /Accepted correction ledger/)
  assert.match(reportPage, /Original source value:/)
  assert.match(reportPage, /Effective corrected value:/)
  assert.match(reportPage, /Applied corrections/)
})

test('evidence review explains that resolved requested values affect only derived views', () => {
  assert.match(reviewPage, /becomes the effective value in derived Atlas profiles and reports/)
  assert.match(reviewPage, /Resolve & apply correction/)
  assert.match(reviewPage, /underlying evidence fact remains unchanged/)
})
