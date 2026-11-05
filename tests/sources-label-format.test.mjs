import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('app/sources/page.tsx', 'utf8');

test('Sources & Coverage title formatter capitalizes every word boundary', () => {
  assert.ok(source.includes(".replace(/\\b\\w/g, match => match.toUpperCase())"));
  assert.equal(source.includes(".replace(/\\bw/g, match => match.toUpperCase())"), false);
});
