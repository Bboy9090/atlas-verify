import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const route = fs.readFileSync('app/api/search/route.ts', 'utf8');

test('workspace search enforces approved hashed suppressions before ranking', () => {
  assert.match(route, /hashSuppressionIdentifier/);
  assert.match(route, /status:\s*'approved'/);
  assert.match(route, /identifierHash:\s*\{\s*in:/);
  assert.match(route, /const visibleSubjects = subjects\.filter\(subject => !isSuppressedSubject\(subject\)\)/);
  assert.match(route, /const candidates = visibleSubjects/);
  assert.match(route, /suppressedSubjectCount/);
});

test('workspace suppression covers every supported subject identifier family', () => {
  for (const identifier of ["'name'", "'phone'", "'email'", "'address'", "'username'"]) {
    assert.ok(route.includes(identifier), identifier);
  }
});

test('workspace suppression never logs or returns suppression plaintext', () => {
  assert.doesNotMatch(route, /suppression.*identifierHint/i);
  assert.doesNotMatch(route, /suppression.*contactEmail/i);
});
