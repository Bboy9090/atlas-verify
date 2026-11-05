import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const searchRoute = fs.readFileSync('app/api/search/route.ts', 'utf8');
const monitorSubjectRoute = fs.readFileSync(
  'app/api/cases/[id]/subjects/[subjectId]/monitor/route.ts',
  'utf8',
);
const monitorCheckRoute = fs.readFileSync(
  'app/api/monitoring/[monitorId]/check/route.ts',
  'utf8',
);
const monitoringRoute = fs.readFileSync('app/api/monitoring/route.ts', 'utf8');
const helper = fs.readFileSync('lib/subject-suppression.ts', 'utf8');

test('approved suppression matching is centralized and one-way hashed', () => {
  assert.match(helper, /hashSuppressionIdentifier/);
  assert.match(helper, /status:\s*'approved'/);
  assert.match(helper, /identifierHash:\s*\{\s*in:\s*hashes\s*\}/);
  for (const identifier of ["'name'", "'phone'", "'email'", "'address'", "'username'"]) {
    assert.ok(helper.includes(identifier), identifier);
  }
  assert.doesNotMatch(helper, /identifierHint/);
  assert.doesNotMatch(helper, /contactEmail/);
});

test('workspace search filters suppressed subjects before ranking', () => {
  assert.match(searchRoute, /loadApprovedSuppressionHashes\(subjects\)/);
  assert.match(
    searchRoute,
    /const visibleSubjects = subjects\.filter\([\s\S]*!isSubjectSuppressed/,
  );
  assert.match(searchRoute, /const candidates = visibleSubjects/);
  assert.match(searchRoute, /suppressedSubjectCount/);
});

test('monitor creation and snapshots stop for suppressed subjects', () => {
  assert.match(monitorSubjectRoute, /loadApprovedSuppressionHashes\(\[subject\]\)/);
  assert.match(monitorSubjectRoute, /currentSnapshot: suppressed \? null/);
  assert.match(monitorSubjectRoute, /Subject is suppressed and cannot be monitored/);
});

test('manual monitor checks disable suppressed subjects before diffing evidence', () => {
  const suppressionPos = monitorCheckRoute.indexOf('blockedBySuppression: true');
  const snapshotPos = monitorCheckRoute.indexOf('const snapshot = buildEvidenceSnapshot');
  assert.ok(suppressionPos > 0);
  assert.ok(snapshotPos > suppressionPos);
  assert.match(monitorCheckRoute, /data: \{ enabled: false \}/);
  assert.match(monitorCheckRoute, /Monitor disabled because the subject matches an approved suppression request/);
});

test('monitoring index omits suppressed subjects without deleting case evidence', () => {
  assert.match(monitoringRoute, /loadApprovedSuppressionHashes/);
  assert.match(monitoringRoute, /const visibleMonitors = monitors\.filter/);
  assert.match(monitoringRoute, /monitors: visibleMonitors/);
  assert.match(monitoringRoute, /suppressedMonitorCount/);
  assert.doesNotMatch(monitoringRoute, /subjectMonitor\.delete/);
});
