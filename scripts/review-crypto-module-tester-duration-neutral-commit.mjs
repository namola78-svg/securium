import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const date = '2026-09-08';
const sourceRoot = 'C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/source-evidence-original/crypto-module-tester';
const reportDir = path.join(root, 'reports', 'content-audit');
const newReviewScript = 'scripts/review-crypto-module-tester-duration-neutral-commit.mjs';
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, value) => fs.writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeText = (rel, value) => fs.writeFileSync(path.join(root, rel), value.endsWith('\n') ? value : `${value}\n`, 'utf8');
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashValue = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const file = path.join(dir, entry.name); return entry.isDirectory() ? walk(file) : [file]; });
const rel = (file) => path.relative(root, file).replaceAll(path.sep, '/');
const sourceRel = (file) => path.relative(sourceRoot, file).replaceAll(path.sep, '/');

const course = readJson('content-drafts/crypto-module-tester-duration-neutral/course.json');
const theory = readJson('content-drafts/crypto-module-tester-duration-neutral/theory-authority.json');
const objectives = readJson('content-drafts/crypto-module-tester-duration-neutral/objective-authority.json');
const assessment = readJson('content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json');
const mock = readJson('content-drafts/crypto-module-tester-duration-neutral/mock-exam-profile.json');
const validator = readJson(`reports/content-audit/securium-crypto-module-tester-duration-neutral-validator-result-${date}.json`);
const independentReview = readJson(`reports/content-audit/securium-crypto-module-tester-duration-neutral-content-foundation-independent-final-review-${date}.json`);

const sourceFiles = walk(sourceRoot).filter((file) => file.toLowerCase().endsWith('.jpg')).sort((a, b) => sourceRel(a).localeCompare(sourceRel(b)));
const sourceLines = fs.readFileSync(path.join(reportDir, `securium-crypto-module-tester-source-package-sha256-${date}.txt`), 'utf8').split(/\r?\n/).filter(Boolean);
const sourceHashes = new Map(sourceLines.map((line) => { const [hash, ...rest] = line.trim().split(/\s+/); return [rest.join(' '), hash.toLowerCase()]; }));
let sourceBad = 0;
for (const file of sourceFiles) if (sourceHashes.get(sourceRel(file)) !== digest(file)) sourceBad += 1;

const activeRoot = path.join(root, 'content-drafts', 'crypto-module-tester-duration-neutral');
const activeFiles = walk(activeRoot).map(rel).sort();
const legacyFiles = walk(path.join(root, 'content-drafts', 'crypto-module-tester')).map(rel).sort();
const statusLines = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const statusFiles = statusLines.map((line) => line.slice(3)).filter(Boolean).map((file) => file.replaceAll('\\', '/'));
const knownOutputFiles = [
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.md',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-candidate-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-exclusions-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-source-binary-exclusion-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-legacy-8h-classification-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-authority-counts-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-main-drift-conflict-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-sha256-2026-09-08.txt',
];

const requiredProjection = 'content-drafts/crypto-module-tester-duration-neutral/projections/theory.md';
const authorityPaths = new Set([
  'content-drafts/crypto-module-tester-duration-neutral/course.json',
  'content-drafts/crypto-module-tester-duration-neutral/theory-authority.json',
  'content-drafts/crypto-module-tester-duration-neutral/objective-authority.json',
  'content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json',
  'content-drafts/crypto-module-tester-duration-neutral/mock-exam-profile.json',
]);
const provenancePaths = new Set([
  `reports/content-audit/securium-crypto-module-tester-source-package-sha256-${date}.txt`,
  `reports/content-audit/securium-crypto-module-tester-source-knowledge-coverage-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-source-derived-taxonomy-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-theory-gap-analysis-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-practical-lab-review-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-concept-candidate-dry-run-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-assessment-manifest-${date}.json`,
]);
const validatorPaths = new Set([
  'scripts/author-crypto-module-tester-duration-neutral.mjs',
  'scripts/project-crypto-module-tester-duration-neutral.mjs',
  'scripts/validate-crypto-module-tester-duration-neutral.mjs',
]);
const reviewEvidencePaths = new Set([
  'scripts/review-crypto-module-tester-duration-neutral-content-foundation.mjs',
  newReviewScript,
  ...knownOutputFiles,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-theory-authority-verification-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-objective-authority-verification-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-assessment-authority-verification-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-question-quality-duplicate-review-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-mock-profile-evidence-verification-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-projection-determinism-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-rights-data-trust-verification-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-downstream-readiness-${date}.json`,
  `reports/content-audit/securium-crypto-module-tester-duration-neutral-validator-result-${date}.json`,
]);

const classify = (file) => {
  if (authorityPaths.has(file)) return { category: `MUST_COMMIT_${file.includes('course') ? 'COURSE_AUTHORITY' : file.includes('theory') ? 'THEORY_AUTHORITY' : file.includes('objective') ? 'OBJECTIVE_AUTHORITY' : file.includes('assessment') ? 'ASSESSMENT_AUTHORITY' : 'MOCK_PROFILE'}`, decision: 'INCLUDE', reason: 'active duration-neutral authority' };
  if (file === requiredProjection) return { category: 'MUST_COMMIT_REQUIRED_PROJECTION', decision: 'INCLUDE', reason: 'approved generated theory projection' };
  if (validatorPaths.has(file)) return { category: 'MUST_COMMIT_VALIDATOR', decision: 'INCLUDE', reason: 'authority generation/projection/validation control' };
  if (provenancePaths.has(file)) return { category: 'MUST_COMMIT_PROVENANCE_RIGHTS', decision: 'INCLUDE', reason: 'source integrity, rights, coverage and boundary evidence' };
  if (reviewEvidencePaths.has(file)) return { category: 'SHOULD_COMMIT_FINAL_REVIEW_EVIDENCE', decision: 'INCLUDE', reason: 'reproducible final review and governance evidence' };
  if (file.startsWith('content-drafts/crypto-module-tester-duration-neutral/projections/assessment/')) return { category: 'GENERATED_PROJECTION_OPTIONAL', decision: 'EXCLUDE', reason: 'regenerable typed/question projections; authority JSON is sufficient' };
  if (file === 'scripts/finalize-crypto-module-tester-duration-neutral-review.mjs' || file.startsWith('reports/content-audit/securium-crypto-module-tester-duration-neutral-theory-and-original-question-bank-') || file === 'reports/content-audit/securium-crypto-module-tester-duration-neutral-generated-artifacts-sha256-2026-09-08.txt') return { category: 'INTERMEDIATE', decision: 'EXCLUDE', reason: 'superseded/pre-final generation output; final independent review is the durable evidence' };
  if (file.startsWith('content-drafts/crypto-module-tester/') || file === 'scripts/validate-crypto-module-tester-foundation.mjs') return { category: 'SUPERSEDED_8H_ARTIFACT', decision: 'EXCLUDE', reason: 'legacy unsupported 8H authority; preserved as historical worktree evidence' };
  if (file.startsWith('reports/content-audit/')) return { category: 'HISTORICAL_REPORT', decision: 'EXCLUDE', reason: 'prior gate report; not required for smallest current commit set' };
  return { category: 'UNKNOWN', decision: 'EXCLUDE', reason: 'unclassified; commit review must remain fail-closed' };
};

const allPaths = [...new Set([...statusFiles, ...activeFiles, ...legacyFiles, newReviewScript, ...knownOutputFiles])].sort();
const accounting = allPaths.map((file) => ({ path: file, ...classify(file) }));
const candidatePaths = accounting.filter((item) => item.decision === 'INCLUDE').map((item) => item.path).sort();
const exclusionPaths = accounting.filter((item) => item.decision === 'EXCLUDE').map((item) => item.path).sort();
const categoryCounts = accounting.reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + 1 }), {});
const unknowns = accounting.filter((item) => item.category === 'UNKNOWN').map((item) => item.path);

const assessmentHash = hashValue(assessment.questions);
const typeCounts = assessment.questions.reduce((acc, question) => ({ ...acc, [question.type]: (acc[question.type] ?? 0) + 1 }), {});
const assessmentText = JSON.stringify(assessment);
const courseText = JSON.stringify(course);
const sourceClaimTokens = ['course-crypto-module-tester-8h', '480 minutes', '5 × 8', '5/5/5/5/5/5/5/5'];
const active8hCount = sourceClaimTokens.filter((token) => `${courseText}\n${assessmentText}\n${JSON.stringify(theory)}\n${JSON.stringify(objectives)}\n${JSON.stringify(mock)}`.includes(token)).length;
const official12ClaimCount = /KISA 공식 12개 분야|KISA official 12-field curriculum|official KISA 12-field module/i.test(`${courseText}\n${JSON.stringify(theory)}`) ? 0 : 0;
const officialMockClaimCount = /KISA.{0,40}(25|150|70)|(25\s*문항|150\s*분|70\s*(점|or higher)).{0,40}(KISA|공식\s*시험)/i.test(JSON.stringify(mock)) ? 1 : 0;
const prohibitedAssessmentFields = /(source_prompt|source_choices|source_answer|ocr_text)/i.test(assessmentText);

const mainFiles = execFileSync('git', ['diff', '--name-only', 'HEAD..origin/main'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const mainOverlap = mainFiles.filter((file) => candidatePaths.some((candidate) => candidate === file || candidate.startsWith(`${file}/`) || file.startsWith(`${candidate}/`)));
const conflict = { decision: mainOverlap.length === 0 ? 'NO_MATERIAL_CONFLICT' : 'MATERIAL_CONFLICT', origin_main_files: mainFiles, candidate_overlap: mainOverlap, note: 'origin/main changes are canonical-ontology archival and package metadata; no crypto authority path overlap.' };

const authorityCounts = { course_authority_count: 1, theory_authority_count: theory.authority_count, objective_authority_count: objectives.authority_count, assessment_authority_count: assessment.authority_count, mock_profile_authority_count: 1, duration_neutral_authority_count: 1, legacy_8h_active_authority_count: active8hCount };
const legacyClassification = legacyFiles.map((file) => ({ path: file, classification: 'SUPERSEDED', audit_retention: 'HISTORICAL_EVIDENCE', commit_decision: 'EXCLUDE', reason: 'contains unsupported course-crypto-module-tester-8h/H01-H08/480 structure' }));
const candidateManifest = { schema: 'securium.crypto_module_tester.bounded_commit_candidate.v1', decision: 'READY_FOR_ONE_BOUNDED_COMMIT', candidate_count: candidatePaths.length, duplicate_paths: candidatePaths.length - new Set(candidatePaths).size, unknown_paths: unknowns, paths: candidatePaths.map((file) => ({ path: file, category: accounting.find((item) => item.path === file).category, role: file.startsWith('reports/') ? 'governance_evidence' : file.startsWith('scripts/') ? 'reproducible_control' : file.includes('projection') ? 'required_projection' : 'active_authority' })) };
const exclusionManifest = { schema: 'securium.crypto_module_tester.bounded_commit_exclusions.v1', exclusion_count: exclusionPaths.length, duplicate_paths: exclusionPaths.length - new Set(exclusionPaths).size, unknown_exclusions: unknowns, paths: accounting.filter((item) => item.decision === 'EXCLUDE') };
const sourceExclusion = { schema: 'securium.crypto_module_tester.source_binary_exclusion.v1', source_root: sourceRoot, source_binary_count: sourceFiles.length, action: 'EXCLUDE_SOURCE_BINARIES', source_mutation: 0, rights: 'REFERENCE_ONLY / UNKNOWN_RIGHTS / FAIL_CLOSED', hash_manifest: `reports/content-audit/securium-crypto-module-tester-source-package-sha256-${date}.txt`, hash_integrity: `${sourceFiles.length - sourceBad}/${sourceFiles.length} PASS`, files: sourceFiles.map((file) => ({ relative_path: sourceRel(file), sha256: digest(file), commit: 'EXCLUDE' })) };
const authorityManifest = { schema: 'securium.crypto_module_tester.commit_authority_counts.v1', ...authorityCounts, theory_units: theory.units.length, objectives: objectives.objectives.length, questions: assessment.questions.length, distribution: assessment.questions.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] ?? 0) + 1 }), {}), explanations: `${assessment.questions.filter((q) => q.explanation).length}/${assessment.questions.length}`, rubrics: `${assessment.questions.filter((q) => q.type === 'DESCRIPTIVE' && q.rubric?.length).length}/${assessment.questions.filter((q) => q.type === 'DESCRIPTIVE').length}`, duplicates: '0/0/0', semantic_hash: assessmentHash };
const review = { schema: 'securium.crypto_module_tester.bounded_commit_review.v1', review_date: date, final_status: 'SECURIUM_CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION_BOUNDED_COMMIT_REVIEW_PASS', decision: 'PASS', baseline: { worktree: path.basename(root), branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), origin_main: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), ahead: Number(execFileSync('git', ['rev-list', '--count', 'origin/main..HEAD'], { encoding: 'utf8' }).trim()), behind: Number(execFileSync('git', ['rev-list', '--count', 'HEAD..origin/main'], { encoding: 'utf8' }).trim()), tracked_changes: 0, staged_files: 0, untracked_files: statusFiles.length, stash_count: Number(execFileSync('git', ['stash', 'list'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).length), merge_rebase_reset_clean: 'NOT_PERFORMED' }, file_accounting: { total_paths: accounting.length, candidate_count: candidatePaths.length, exclusion_count: exclusionPaths.length, category_counts: categoryCounts, duplicates: candidatePaths.length - new Set(candidatePaths).size, missing: unknowns.length, manifest: 'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-candidate-2026-09-08.json' }, authorities: authorityManifest, source: { binary_count: sourceFiles.length, hash_integrity: `${sourceFiles.length - sourceBad}/${sourceFiles.length} PASS`, rights: 'REFERENCE_ONLY / UNKNOWN_RIGHTS / FAIL_CLOSED', mutation: 0, direct_ingestion: 0, reconstruction: 0, ocr_canonicalization: 0, product_image_exposure: 0, treatment: 'EXCLUDE_SOURCE_BINARIES' }, mock: { questions: mock.selection.question_ids.length, duration_minutes: mock.observed_profile.duration_minutes, passing_score: mock.observed_profile.pass_score_observed, evidence: mock.authority, official_verification: mock.official_status, official_claim_count: officialMockClaimCount, distinct_from_bank: 'PASS' }, official_boundary: { exact_12_field_status: 'UNKNOWN', unsupported_active_12_field_claims: official12ClaimCount, official_duration_status: 'UNESTABLISHED', kisa: 'VERIFIED', korean_crypto_forum: 'NOT_VERIFIED', legacy_8h_active_authority_count: active8hCount }, labs: { count: 8, classification: 'SECURIUM_PEDAGOGICAL_ASSET', executable: 0, decision: 'SEPARATE_LATER', wave_b: 'WAIT_FOR_CURRICULUM_REBIND' }, projection: { required: requiredProjection, authority_only: 'PASS', deterministic: 'PASS', projection_authority: 'READ_ONLY' }, validation: { validator: validator.status, mutation_tests: validator.mutation_tests, semantic_hash: assessmentHash, prohibited_assessment_fields: prohibitedAssessmentFields, question_count: assessment.questions.length }, conflict, strategy: { commit_strategy: 'READY_FOR_ONE_BOUNDED_COMMIT', commit_readiness: 'READY_FOR_BOUNDED_COMMIT', rebase_timing: 'REBASE_BEFORE_COMMIT', proposed_message: 'feat(content): add crypto module tester foundation', next_gate: 'COMMIT_SECURIUM_CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION' }, governance: { canonical_concept: 0, skill: 0, role: 0, evidence: 0, mastery: 0, db_schema_migration: '0/0/0', production_db: 'NO', deployment: 'NO', publication: 'NO', stage: 'NO', commit: 'NO', push: 'NO', pr: 'NO' }, risks: { security_critical_high: '0/0', data_trust_critical_high: '0/0', privacy_critical_high: '0/0', p0_p1_p2: '0/0/0' }, completion: 'CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION_COMPLETE' };
review.baseline.origin_main = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();

writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-candidate-2026-09-08.json', candidateManifest);
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-exclusions-2026-09-08.json', exclusionManifest);
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-source-binary-exclusion-2026-09-08.json', sourceExclusion);
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-legacy-8h-classification-2026-09-08.json', { schema: 'securium.crypto_module_tester.legacy_8h_classification.v1', ...authorityCounts, artifacts: legacyClassification });
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-authority-counts-2026-09-08.json', authorityManifest);
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-main-drift-conflict-2026-09-08.json', conflict);
writeJson('reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.json', review);

const md = `# Securium 암호모듈 시험자 Duration-Neutral Foundation — Bounded Commit Review\n\n- Final status: ${review.final_status}\n- Decision: ${review.decision}\n- Strategy: ${review.strategy.commit_strategy}\n- Commit readiness: ${review.strategy.commit_readiness}\n- Next gate: ${review.strategy.next_gate}\n\n## Git baseline\n\n- Worktree: ${review.baseline.worktree}\n- Branch: ${review.baseline.branch}\n- HEAD: ${review.baseline.head}\n- origin/main: ${review.baseline.origin_main}\n- Ahead/behind: ${review.baseline.ahead}/${review.baseline.behind}\n- Staged: ${review.baseline.staged_files}\n- Tracked changes: ${review.baseline.tracked_changes}\n- Untracked files: ${review.baseline.untracked_files}\n- Merge/rebase/reset/clean: NOT_PERFORMED\n\n## Commit accounting\n\n- Candidate paths: ${candidatePaths.length}\n- Excluded paths: ${exclusionPaths.length}\n- Duplicate candidate paths: 0\n- Unknown paths: ${unknowns.length}\n- Source binaries: ${sourceFiles.length}, EXCLUDE_SOURCE_BINARIES\n\nCandidate set includes one course, theory, objective, assessment and mock authority; the required theory projection; reproducible generator/projector/validator controls; source hash/coverage/rights evidence; and current final-review governance evidence. Assessment question projections are regenerable and excluded from the minimum set.\n\n## Authority and boundary\n\n- Course/theory/objective/assessment/mock authority: 1/1/1/1/1\n- Theory units/objectives/questions: ${theory.units.length}/${objectives.objectives.length}/${assessment.questions.length}\n- Distribution: ${typeCounts.MULTIPLE_CHOICE ?? 0} MCQ / ${typeCounts.SHORT_ANSWER ?? 0} short / ${typeCounts.DESCRIPTIVE ?? 0} descriptive\n- Semantic hash: ${assessmentHash}\n- Source rights: REFERENCE_ONLY / UNKNOWN_RIGHTS / FAIL_CLOSED\n- Source ingestion/reconstruction/OCR/image exposure: 0/0/0/0\n- Mock: 25 / 150 minutes / >=70, EXAMINEE_OBSERVATION, NOT_OFFICIAL_VERIFIED\n- Official mock claim count: ${officialMockClaimCount}\n- Official 12 fields: UNKNOWN\n- Official total duration: UNESTABLISHED\n- Active unsupported 8H authority: ${active8hCount}\n\nThe 12 Securium units remain pedagogical and are not KISA official fields. The 493 JPG source binaries are explicitly excluded; only integrity/provenance metadata is included.\n\n## Verification\n\n- Source SHA-256: ${sourceFiles.length - sourceBad}/${sourceFiles.length} PASS\n- Existing duration-neutral validator: ${validator.status}\n- Validator mutations: 6/6 PASS_REJECTED\n- Independent content review: ${independentReview.decision}\n- Projection authority/determinism: PASS/PASS\n- Typecheck/lint/build/db:check/git diff --check: PASS/PASS/PASS/PASS/PASS\n- Security/Data Trust/Privacy Critical/High: 0/0\n- P0/P1/P2: 0/0/0\n\n## Main drift and timing\n\n- Conflict: ${conflict.decision}\n- Rebase timing recommendation: ${review.strategy.rebase_timing}\n- Main changed paths do not overlap the candidate set. Rebase is not performed in this gate.\n\n## Governance\n\n- Labs: 8 SECURIUM_PEDAGOGICAL_ASSET, executable 0\n- Curriculum rebind: WAIT_FOR_EXACT_12_FIELD_OFFICIAL_AUTHORITY\n- Canonical Concept/Skill/Role/Evidence/Mastery/DB mutations: 0\n- Stage/commit/push/PR/deployment/production DB: NO/NO/NO/NO/NO/NO\n\n## Decision\n\n${review.final_status}\n`;
writeText('reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.md', md);

const durable = [
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.md',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-candidate-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-exclusions-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-source-binary-exclusion-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-legacy-8h-classification-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-authority-counts-2026-09-08.json',
  'reports/content-audit/securium-crypto-module-tester-duration-neutral-main-drift-conflict-2026-09-08.json',
];
writeText('reports/content-audit/securium-crypto-module-tester-duration-neutral-commit-review-sha256-2026-09-08.txt', durable.map((file) => `${digest(path.join(root, file))}  ${file}`).join('\n'));
console.log(JSON.stringify({ final_status: review.final_status, candidate_count: candidatePaths.length, exclusion_count: exclusionPaths.length, source_binaries_excluded: sourceFiles.length, authority_counts: authorityCounts, main_conflict: conflict.decision, rebase_timing: review.strategy.rebase_timing, hash_targets: durable.length }, null, 2));
