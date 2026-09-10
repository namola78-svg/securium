import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateManifest } from '../scripts/validate-crypto-module-tester-source-manifest.mjs';

const manifestPath = path.join(process.cwd(), 'source-evidence-original/crypto-module-tester/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('source manifest validates all 493 reference members', () => {
  const result = validateManifest(manifest);
  assert.equal(result.status, 'PASS');
  assert.equal(result.memberCount, 493);
  assert.equal(result.duplicateIds, 0);
  assert.equal(result.duplicatePaths, 0);
  assert.equal(result.duplicateHashes, 0);
});

test('source manifest rejects unsafe authority mutations', () => {
  for (const mutate of [
    (x) => { x.files[0].sha256 = '0'.repeat(64); },
    (x) => { x.files[0].path = `${x.sourceRoot}/missing.jpg`; },
    (x) => { x.files[1].sourceId = x.files[0].sourceId; },
    (x) => { x.files[1].path = x.files[0].path; },
    (x) => { x.questionAuthority = 1; },
    (x) => { x.files[0].ocr = 1; },
    (x) => { x.officialExamStatus = 'OFFICIAL_EXAM'; },
    (x) => { x.files[0].license = 'PERMISSIVE_LICENSE'; },
    (x) => { x.orderingClassification = 'AUTHORITATIVE_QUESTION_ORDER'; },
  ]) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    assert.equal(validateManifest(candidate).status, 'FAIL');
  }
});
