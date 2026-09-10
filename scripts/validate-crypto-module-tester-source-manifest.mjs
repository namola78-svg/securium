import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifestPath = 'source-evidence-original/crypto-module-tester/manifest.json';
const readManifest = () => JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function validateManifest(manifest, sourceRoot = manifest.resolvedExternalPath) {
  const failures = [];
  const fail = (ok, message) => { if (!ok) failures.push(message); };
  fail(manifest.schema === 'crypto-module-tester-source-manifest.v1', 'manifest schema mismatch');
  fail(manifest.manifestType === 'SOURCE_EVIDENCE_AUTHORITY', 'manifest authority type mismatch');
  fail(manifest.memberCount === 493 && manifest.files?.length === 493, 'member count must be 493');
  fail(manifest.mediaType === 'image/jpeg' && manifest.unexpectedExtensions === 0, 'media type/extension boundary mismatch');
  fail(manifest.orderingClassification === 'FILENAME_SEQUENCE_ONLY', 'ordering overclaim');
  fail(manifest.authoritativeQuestionOrder === 'NOT_PROVEN', 'authoritative question order overclaim');
  fail(manifest.groupingClassification === 'UNPROVEN', 'grouping overclaim');
  fail(manifest.questionAuthority === 0 && manifest.sourceQuestionAuthority === 0, 'source question authority must be zero');
  fail(manifest.authorizedQuestionReuse === 0 && manifest.productDependencyOnSourceQuestionWording === 0, 'question reuse/dependency must be zero');
  fail(manifest.officialExamStatus === 'NOT_INFERRED', 'official-exam status overclaim');
  fail(manifest.sourceExpressionReuse === 'DIRECT_REUSE_NOT_AUTHORIZED', 'source expression reuse boundary weakened');
  fail(manifest.hashModel === 'BYTE_HASH_CANONICAL', 'hash model mismatch');
  fail(manifest.productAuthoritySeparation === true && manifest.runtimeAuthoritySeparation === true && manifest.ontologyAuthoritySeparation === true && manifest.evidenceAuthoritySeparation === true, 'authority separation missing');
  const ids = new Set(); const paths = new Set(); const hashes = new Set();
  for (const [index, entry] of (manifest.files ?? []).entries()) {
    fail(entry.mediaType === 'image/jpeg', `entry ${index}: media type`);
    fail(/\.jpg$/i.test(entry.filename), `entry ${index}: extension`);
    fail(entry.path === `${manifest.sourceRoot}/${entry.filename}`, `entry ${index}: path mismatch`);
    fail(!entry.filename.includes('/') && !entry.filename.includes('\\') && entry.filename !== '.' && entry.filename !== '..', `entry ${index}: unsafe filename`);
    fail(entry.sourceId === `CMT-SRC-SHA256-${entry.sha256.slice(0, 24)}`, `entry ${index}: source ID`);
    fail(!ids.has(entry.sourceId), `entry ${index}: duplicate source ID`); ids.add(entry.sourceId);
    fail(!paths.has(entry.path), `entry ${index}: duplicate path`); paths.add(entry.path);
    fail(!hashes.has(entry.sha256), `entry ${index}: duplicate file hash`); hashes.add(entry.sha256);
    fail(entry.provenance === 'UNKNOWN_FILE_LEVEL_PROVENANCE', `entry ${index}: provenance overclaim`);
    fail(entry.license === 'NOT_PROVEN', `entry ${index}: license overclaim`);
    fail(entry.currentness === 'CRYPTO_MODULE_TESTER_SOURCE_CURRENTNESS_READY_WITH_LIMITATIONS', `entry ${index}: currentness`);
    fail(entry.allowedUse === 'REFERENCE_ONLY' && entry.productUse === 'INDEPENDENT_REAUTHORING_ONLY', `entry ${index}: allowed use`);
    fail(entry.questionAuthority === 0 && entry.reuseAuthorization === 0 && entry.productDependencyOnSourceQuestionWording === 0, `entry ${index}: question boundary`);
    fail(entry.ocr === 0 && entry.contentInspection === 0, `entry ${index}: inspection boundary`);
    const actual = path.join(sourceRoot, entry.filename);
    fail(fs.existsSync(actual), `entry ${index}: path does not resolve`);
    if (fs.existsSync(actual)) fail(sha256(actual) === entry.sha256, `entry ${index}: hash mismatch`);
  }
  return { status: failures.length === 0 ? 'PASS' : 'FAIL', failures, memberCount: manifest.files?.length ?? 0, duplicateIds: (manifest.files?.length ?? 0) - ids.size, duplicatePaths: (manifest.files?.length ?? 0) - paths.size, duplicateHashes: (manifest.files?.length ?? 0) - hashes.size };
}

const manifest = readManifest();
const result = validateManifest(manifest);
const output = { schema: 'securium.crypto_module_tester.source_manifest_validator.v1', ...result, manifestPath, sourceRoot: manifest.resolvedExternalPath, noImageContentInspection: 0, noRuntimeDbAccess: 0 };
console.log(JSON.stringify(output, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
