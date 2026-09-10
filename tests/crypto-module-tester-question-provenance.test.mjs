import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const assessmentPath = path.join(root, 'content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json');
const provenancePath = path.join(root, 'content-drafts/crypto-module-tester-duration-neutral/question-provenance.json');
const generatorPath = path.join(root, 'scripts/author-crypto-module-tester-duration-neutral.mjs');
const assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashValue = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('crypto module tester provenance authority binds unchanged current question set', () => {
  assert.equal(assessment.questions.length, 120);
  assert.deepEqual(provenance.question_ids, assessment.questions.map(q => q.id));
  assert.equal(provenance.question_set_hash, hashValue(assessment.questions));
  assert.equal(provenance.expression_origin, 'SECURIUM_ORIGINAL_SUPPORTED');
  assert.equal(provenance.rights_status, 'RIGHTS_SUPPORTED_WITH_PROVENANCE_LIMITATION');
  assert.equal(provenance.evidence_grade, 'B');
});

test('crypto module tester provenance authority pins safe source boundaries', () => {
  assert.equal(provenance.source_boundary.question_authority, 0);
  assert.equal(provenance.historical_boundary.role, 'EXCLUDED_FROM_PRODUCT_AUTHORITY');
  assert.equal(provenance.canonical_product_dependency_on_source_question_expression, 0);
  assert.equal(provenance.no_question_payload_copy, true);
  assert.equal(provenance.no_source_image_inspection, true);
});

test('crypto module tester provenance authority pins generator', () => {
  assert.equal(provenance.generator_authority_count, 1);
  assert.equal(hash(path.join(root, provenance.generator_path)), provenance.generator_sha256);
  assert.match(provenance.authoring_commit, /^[0-9a-f]{40}$/);
});
