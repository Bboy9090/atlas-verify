import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const ownerRoute = fs.readFileSync('app/api/cases/[id]/shares/route.ts', 'utf8')
const revokeRoute = fs.readFileSync('app/api/cases/[id]/shares/[shareId]/route.ts', 'utf8')
const publicRoute = fs.readFileSync('app/api/share/case/[token]/route.ts', 'utf8')
const helper = fs.readFileSync('lib/case-share.ts', 'utf8')
const reportLoader = fs.readFileSync('lib/case-report-server.ts', 'utf8')

test('case shares store only token hashes with expiry and revocation', () => {
  assert.match(schema, /model CaseShare/)
  assert.match(schema, /tokenHash\s+String\s+@unique/)
  assert.match(schema, /expiresAt\s+DateTime/)
  assert.match(schema, /revokedAt\s+DateTime\?/)
  assert.match(helper, /randomBytes\(32\)/)
  assert.match(helper, /createHash\('sha256'\)/)
})

test('owner share creation is bounded and token is returned only at creation', () => {
  assert.match(ownerRoute, /expiresHours must be between 1 and 168/)
  assert.match(ownerRoute, /hashCaseShareToken\(token\)/)
  assert.match(ownerRoute, /warning: 'The token is returned once/)
  assert.doesNotMatch(ownerRoute, /select:\s*\{[^}]*tokenHash:\s*true/)
})

test('public reads fail closed on revocation or expiration and remain non-indexable', () => {
  assert.match(publicRoute, /share\.revokedAt \|\| share\.expiresAt <= now/)
  assert.match(publicRoute, /X-Robots-Tag/)
  assert.match(publicRoute, /noindex, nofollow, noarchive/)
  assert.match(publicRoute, /loadCaseReport\(share\.caseId, share\.ownerId\)/)
})

test('shared reports use the same suppression-aware loader as owner exports', () => {
  assert.match(reportLoader, /loadApprovedSuppressionHashes/)
  assert.match(reportLoader, /!isSubjectSuppressed/)
  assert.match(revokeRoute, /REVOKE_CASE_SHARE/)
})
