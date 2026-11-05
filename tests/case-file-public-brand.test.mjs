import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const publicFiles = [
  'app/account/page.tsx',
  'app/docs/legal/page.tsx',
  'app/privacy/opt-out/page.tsx',
  'public/offline.html',
];

test("public Bobby's Case File surfaces no longer expose AtlasVerify branding", () => {
  for (const file of publicFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /Bobby's Case File/, file);
    assert.doesNotMatch(source, /AtlasVerify/, file);
  }
});

test('case report keeps compatibility schema but uses public product name in disclaimer', () => {
  const source = fs.readFileSync('lib/case-report.ts', 'utf8');
  assert.match(source, /schemaVersion: 'atlasverify\.case-report\.v1'/);
  assert.match(source, /Bobby's Case File is not a consumer reporting agency/);
});
