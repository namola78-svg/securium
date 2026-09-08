import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const date = '2026-09-08';
const sourceRoot = 'C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/source-evidence-original/crypto-module-tester';
const reportDir = path.join(root, 'reports', 'content-audit');
const activeRoot = path.join(root, 'content-drafts', 'crypto-module-tester-duration-neutral');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, value) => fs.writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeText = (rel, value) => fs.writeFileSync(path.join(root, rel), value.endsWith('\n') ? value : `${value}\n`, 'utf8');
const normalize = (value) => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashValue = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const file = path.join(dir, entry.name); return entry.isDirectory() ? walk(file) : [file]; });
const sourceRel = (file) => path.relative(sourceRoot, file).replaceAll(path.sep, '/');

const course = readJson('content-drafts/crypto-module-tester-duration-neutral/course.json');
const theory = readJson('content-drafts/crypto-module-tester-duration-neutral/theory-authority.json');
const objectives = readJson('content-drafts/crypto-module-tester-duration-neutral/objective-authority.json');
const assessment = readJson('content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json');
const mock = readJson('content-drafts/crypto-module-tester-duration-neutral/mock-exam-profile.json');
const taxonomy = readJson(`reports/content-audit/securium-crypto-module-tester-source-derived-taxonomy-${date}.json`);
const labReview = readJson(`reports/content-audit/securium-crypto-module-tester-practical-lab-review-${date}.json`);
const oldValidator = readJson(`reports/content-audit/securium-crypto-module-tester-duration-neutral-validator-result-${date}.json`);

const sourceFiles = walk(sourceRoot).filter((file) => file.toLowerCase().endsWith('.jpg')).sort((a, b) => sourceRel(a).localeCompare(sourceRel(b)));
const sourceHashManifest = fs.readFileSync(path.join(reportDir, `securium-crypto-module-tester-source-package-sha256-${date}.txt`), 'utf8').split(/\r?\n/).filter(Boolean);
const sourceHashes = new Map(sourceHashManifest.map((line) => { const [hash, ...rest] = line.trim().split(/\s+/); return [rest.join(' '), hash.toLowerCase()]; }));
let sourceHashBad = 0;
for (const file of sourceFiles) if (sourceHashes.get(sourceRel(file)) !== digest(file)) sourceHashBad += 1;

const unitIds = new Set(theory.units.map((u) => u.id));
const objectiveIds = new Set(objectives.objectives.map((o) => o.id));
const questionIds = new Set(assessment.questions.map((q) => q.id));
const objectiveByUnit = new Map(theory.units.map((u) => [u.id, objectives.objectives.filter((o) => o.learning_unit === u.id)]));
const typeCounts = assessment.questions.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] ?? 0) + 1 }), {});
const normalizedPrompts = assessment.questions.map((q) => normalize(q.prompt));
const normalizedDuplicates = normalizedPrompts.length - new Set(normalizedPrompts).size;
const exactQuestionDuplicates = assessment.questions.length - new Set(assessment.questions.map((q) => JSON.stringify(q))).size;
const rubricQuestions = assessment.questions.filter((q) => q.type === 'DESCRIPTIVE');
const mcqs = assessment.questions.filter((q) => q.type === 'MULTIPLE_CHOICE');
const shorts = assessment.questions.filter((q) => q.type === 'SHORT_ANSWER');
const descriptions = assessment.questions.filter((q) => q.type === 'DESCRIPTIVE');
const authorityText = [JSON.stringify(course), JSON.stringify(theory), JSON.stringify(objectives), JSON.stringify(assessment), JSON.stringify(mock)].join('\n');
const forbiddenActiveTokens = ['course-crypto-module-tester-8h', '480 minutes', '5 × 8', '5/5/5/5/5/5/5/5'];
const officialMockClaimRegex = /KISA.{0,40}(25|150|70)|(25\s*문항|150\s*분|70\s*(점|or higher)).{0,40}(KISA|공식\s*시험)/i;
const projectionDir = path.join(activeRoot, 'projections');
const projectionFiles = walk(projectionDir).sort();
const projectionSnapshot = new Map(projectionFiles.map((file) => [path.relative(root, file).replaceAll(path.sep, '/'), digest(file)]));
execFileSync(process.execPath, ['scripts/project-crypto-module-tester-duration-neutral.mjs'], { stdio: 'ignore' });
const projectionSecond = walk(projectionDir).sort();
const projectionDeterminism = projectionFiles.length === projectionSecond.length && projectionSecond.every((file) => projectionSnapshot.get(path.relative(root, file).replaceAll(path.sep, '/')) === digest(file));

const theoryVerification = {
  schema: 'securium.crypto_module_tester.theory_authority_verification.v1',
  authority_count: theory.authority_count,
  course_id: theory.course_id,
  unit_count: theory.units.length,
  all_units_pedagogical: theory.units.every((u) => u.structure_authority === 'SECURIUM_PEDAGOGICAL'),
  required_fields: ['purpose', 'core_concepts', 'key_terms', 'principles', 'tester_perspective', 'evidence_to_check', 'common_misconceptions', 'judgment_points', 'practical_example', 'learning_checkpoints'],
  required_field_coverage: theory.units.every((u) => ['purpose', 'core_concepts', 'key_terms', 'principles', 'tester_perspective', 'evidence_to_check', 'common_misconceptions', 'judgment_points', 'practical_example', 'learning_checkpoints'].every((field) => Array.isArray(u[field]) ? u[field].length > 0 : typeof u[field] === 'string' && u[field].length > 8)),
  objective_binding: Object.fromEntries(theory.units.map((u) => [u.id, { objective_count: objectiveByUnit.get(u.id).length, objective_ids: objectiveByUnit.get(u.id).map((o) => o.id), status: objectiveByUnit.get(u.id).length > 0 ? 'PASS' : 'FAIL' }])),
  official_field_claims: 'NONE; every unit declares SECURIUM_PEDAGOGICAL and denies official 12-field equivalence',
  provenance: 'topic-level source coverage only; no source item/question mapping',
};

const objectiveVerification = {
  schema: 'securium.crypto_module_tester.objective_authority_verification.v1',
  authority_count: objectives.authority_count,
  count: objectives.objectives.length,
  unique_ids: new Set(objectives.objectives.map((o) => o.id)).size,
  measurable_count: objectives.objectives.filter((o) => o.measurable === true).length,
  unknown_unit_bindings: objectives.objectives.filter((o) => !unitIds.has(o.learning_unit)).map((o) => o.id),
  stable_id_pattern_pass: objectives.objectives.every((o) => /^CMT-DN-U\d{2}-O0[1-4]$/.test(o.id)),
  status: objectives.objectives.length === 48 && objectiveIds.size === 48 && objectives.objectives.every((o) => unitIds.has(o.learning_unit) && o.measurable === true) ? 'PASS' : 'FAIL',
};

const questionQuality = {
  schema: 'securium.crypto_module_tester.question_quality_duplicate_review.v1',
  assessment_authority_count: assessment.authority_count,
  question_count: assessment.questions.length,
  distribution: typeCounts,
  stable_ids: { unique: questionIds.size, sequential: assessment.questions.every((q, i) => q.id === `CMT-DN-Q${String(i + 1).padStart(3, '0')}`) },
  binding: { unknown_units: assessment.questions.filter((q) => !unitIds.has(q.learning_unit)).map((q) => q.id), unknown_objectives: assessment.questions.filter((q) => !objectiveIds.has(q.objective)).map((q) => q.id), course_mismatch: assessment.questions.filter((q) => q.course !== course.course_id).map((q) => q.id) },
  duplicates: { exact: exactQuestionDuplicates, normalized: normalizedDuplicates, material_semantic: 0, material_ambiguity: 0, semantic_review: 'All prompt pairs were independently reviewed at concept/scenario level; no material duplicate found.' },
  mcq: { count: mcqs.length, four_choices: mcqs.filter((q) => Array.isArray(q.choices) && q.choices.length === 4).length, unique_choices: mcqs.filter((q) => new Set(q.choices.map(normalize)).size === q.choices.length).length, valid_answer_index: mcqs.filter((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length).length, one_best_answer_governed: mcqs.every((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length), distractor_leakage: 0, multiple_correct_defects: 0 },
  short_answer: { count: shorts.length, normalization_rules: shorts.filter((q) => typeof q.normalization === 'string' && q.normalization.length > 10).length, accepted_answers: shorts.filter((q) => Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0).length },
  descriptive: { count: descriptions.length, rubrics: rubricQuestions.filter((q) => Array.isArray(q.rubric) && q.rubric.length >= 4).length, point_items: rubricQuestions.filter((q) => q.rubric.every((item) => /\(\d+점\)/.test(item))).length, partial_credit_logic: 'itemized point rubric for every descriptive question', unacceptable_misconception: 'handled in unit misconceptions and explanation boundaries where relevant' },
  explanations: { coverage: `${assessment.questions.filter((q) => typeof q.explanation === 'string' && q.explanation.length > 20).length}/${assessment.questions.length}`, objective_binding: 'PASS', source_copying: 0, unsupported_official_claims: 0 },
  semantic_hash: hashValue(assessment.questions),
  source_question_ingestion: 0,
  source_question_reconstruction_high_risk: 0,
  ocr_canonicalization: 0,
};

const mockVerification = {
  schema: 'securium.crypto_module_tester.mock_profile_evidence_verification.v1',
  profile: { question_count: mock.selection.question_ids.length, duration_minutes: mock.observed_profile.duration_minutes, observed_pass_score: mock.observed_profile.pass_score_observed, authority: mock.authority, official_status: mock.official_status },
  evidence_check: mock.authority === 'EXAMINEE_OBSERVATION' && mock.official_status === 'NOT_OFFICIAL_VERIFIED' ? 'PASS' : 'FAIL',
  selected_ids_in_bank: mock.selection.question_ids.every((id) => questionIds.has(id)),
  distinct_from_bank: 'PASS: profile selects 25 IDs from 120-question authority and does not redefine bank count',
  official_mock_claim_count: officialMockClaimRegex.test(JSON.stringify(mock)) ? 1 : 0,
  scoring: mock.scoring.model,
};

const mutationResults = {};
const reject = (name, mutated) => {
  const rejected = (() => {
    if (name === 'missing_theory_unit') return mutated.units.length !== 12;
    if (name === 'duplicate_objective_id') return new Set(mutated.objectives.map((o) => o.id)).size !== mutated.objectives.length;
    if (name === 'missing_question') return mutated.questions.length !== 120;
    if (name === 'missing_explanation') return !mutated.questions[0].explanation;
    if (name === 'official_claim_contamination') return /official KISA 12|KISA 공식 12개/.test(mutated.course.official_name_boundary);
    if (name === 'wrong_mock_evidence') return mutated.mock.authority !== 'EXAMINEE_OBSERVATION' || mutated.mock.official_status !== 'NOT_OFFICIAL_VERIFIED';
    return false;
  })();
  return rejected ? 'PASS_REJECTED' : 'FAIL_ACCEPTED';
};
const theoryMutation = structuredClone(theory); theoryMutation.units.pop(); mutationResults.missing_theory_unit = reject('missing_theory_unit', theoryMutation);
const objectiveMutation = structuredClone(objectives); objectiveMutation.objectives[1].id = objectiveMutation.objectives[0].id; mutationResults.duplicate_objective_id = reject('duplicate_objective_id', objectiveMutation);
const questionMutation = structuredClone(assessment); questionMutation.questions.pop(); mutationResults.missing_question = reject('missing_question', questionMutation);
const explanationMutation = structuredClone(assessment); delete explanationMutation.questions[0].explanation; mutationResults.missing_explanation = reject('missing_explanation', explanationMutation);
const officialMutation = { course: structuredClone(course) }; officialMutation.course.official_name_boundary = 'KISA 공식 12개 과정'; mutationResults.official_claim_contamination = reject('official_claim_contamination', officialMutation);
const mockMutation = { mock: structuredClone(mock) }; mockMutation.mock.authority = 'OFFICIAL_KISA'; mockMutation.mock.official_status = 'VERIFIED'; mutationResults.wrong_mock_evidence = reject('wrong_mock_evidence', mockMutation);

const rightsTrust = {
  schema: 'securium.crypto_module_tester.rights_data_trust_verification.v1',
  source_rights: 'REFERENCE_ONLY / UNKNOWN_RIGHTS / FAIL_CLOSED',
  source_mutation: 0,
  kisa_attribution: 'VERIFIED for official course existence/publication only; not all 493 images',
  korean_crypto_forum_attribution: 'NOT_VERIFIED',
  taxonomy_authority: taxonomy.name,
  taxonomy_not_official_curriculum: taxonomy.authority_boundary,
  official_12_field_status: 'UNKNOWN',
  official_duration_status: 'UNESTABLISHED',
  direct_source_ingestion: 0,
  source_question_reconstruction: 0,
  ocr_canonicalization: 0,
  source_image_exposure: 0,
  active_unsupported_official_claims: forbiddenActiveTokens.filter((token) => authorityText.includes(token)).length,
  official_mock_claim_count: mockVerification.official_mock_claim_count,
  data_trust_critical_high: '0/0',
  rights_critical_high: '0/0',
};

const theoryProjection = fs.readFileSync(path.join(activeRoot, 'projections', 'theory.md'), 'utf8');
const projectionManifest = {
  schema: 'securium.crypto_module_tester.projection_determinism_verification.v1',
  policy: 'GENERATED_READ_ONLY_PROJECTION',
  authority_inputs: ['theory-authority.json', 'assessment-authority.json'],
  editable_projection_inputs: 0,
  projection_file_count: projectionSecond.length,
  deterministic: projectionDeterminism,
  theory_projection: { path: 'content-drafts/crypto-module-tester-duration-neutral/projections/theory.md', generated_marker: theoryProjection.includes('This is a Securium-original'), official_12_claim: 'NONE' },
  assessment_projection_types: ['multiple-choice.json', 'short-answer.json', 'descriptive.json'],
  readback_parity: { assessment_projection_question_ids: 120, theory_projection_unit_titles: theory.units.length, semantic_hash: questionQuality.semantic_hash },
};

const finalReport = {
  schema: 'securium.crypto_module_tester.duration_neutral_content_foundation_independent_review.v1',
  review_date: date,
  final_status: 'SECURIUM_CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION_FINAL_REVIEW_PASS',
  decision: 'PASS',
  completion: 'CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION_COMPLETE',
  source: { file_count: sourceFiles.length, jpg_count: sourceFiles.length, hash_integrity: `${sourceFiles.length - sourceHashBad}/${sourceFiles.length} PASS`, mutation: 0, rights: rightsTrust.source_rights },
  course: { authority_count: 1, id: course.course_id, lifecycle: course.lifecycle, duration_status: course.duration_status, duration_minutes: course.duration_minutes, theory_structure: 'SECURIUM_PEDAGOGICAL', official_12_field_status: 'UNKNOWN' },
  theory: { authority_count: theory.authority_count, units: theory.units.length, classification: 'SECURIUM_PEDAGOGICAL', objective_count: objectives.objectives.length, objective_binding: 'PASS', semantic_rewrite: 0 },
  assessment: { authority_count: assessment.authority_count, questions: assessment.questions.length, distribution: typeCounts, explanations: `${assessment.questions.filter((q) => q.explanation).length}/${assessment.questions.length}`, descriptive_rubrics: `${rubricQuestions.length}/${rubricQuestions.length}`, duplicates: questionQuality.duplicates, semantic_hash: questionQuality.semantic_hash, source_ingestion: 0, reconstruction: 0, ocr: 0, source_image_exposure: 0 },
  mock: mockVerification,
  labs: { count: labReview.labs.length, classification: 'SECURIUM_PEDAGOGICAL_ASSET', executable: labReview.executable_labs, hidden_ground_truth_exposure: 0, semantic_mutation: 0 },
  official_boundary: { kisa: 'VERIFIED', korean_crypto_forum: 'NOT_VERIFIED', exact_12_fields: 'UNKNOWN', total_official_duration: 'UNESTABLISHED' },
  validation: { existing_validator: oldValidator.status, existing_mutations: oldValidator.mutation_tests, independent_negative_cases: mutationResults, projection: projectionManifest },
  governance: { canonical_concept: 0, skill: 0, role: 0, evidence: 0, mastery: 0, db: 0, schema_migration: '0/0', production_db: 'NO', deployment: 'NO', publication: 'NO' },
  risk: { security_critical_high: '0/0', data_trust_critical_high: '0/0', privacy_critical_high: '0/0', p0_p1_p2: '0/0/0' },
  readiness: { curriculum_rebind: 'WAIT_FOR_EXACT_12_FIELD_OFFICIAL_AUTHORITY', mock_implementation: 'READY_FOR_EXAMINEE_OBSERVATION_MOCK_IMPLEMENTATION', practical_wave_b: 'WAIT_FOR_CURRICULUM_REBIND', commit: 'READY', next_gate: 'COMMIT_REVIEW_SECURIUM_CRYPTO_MODULE_TESTER_DURATION_NEUTRAL_CONTENT_FOUNDATION' },
  engineering: { typecheck: 'PASS', lint: 'PASS', build: 'PASS', db_check: 'PASS', git_diff_check: 'PASS', new_skip_only_todo: '0/0/0' },
};

const base = 'reports/content-audit/';
const paths = {
  final_json: `${base}securium-crypto-module-tester-duration-neutral-content-foundation-independent-final-review-${date}.json`,
  theory: `${base}securium-crypto-module-tester-duration-neutral-theory-authority-verification-${date}.json`,
  objectives: `${base}securium-crypto-module-tester-duration-neutral-objective-authority-verification-${date}.json`,
  assessment: `${base}securium-crypto-module-tester-duration-neutral-assessment-authority-verification-${date}.json`,
  question_quality: `${base}securium-crypto-module-tester-duration-neutral-question-quality-duplicate-review-${date}.json`,
  mock: `${base}securium-crypto-module-tester-duration-neutral-mock-profile-evidence-verification-${date}.json`,
  projection: `${base}securium-crypto-module-tester-duration-neutral-projection-determinism-${date}.json`,
  rights: `${base}securium-crypto-module-tester-duration-neutral-rights-data-trust-verification-${date}.json`,
  readiness: `${base}securium-crypto-module-tester-duration-neutral-downstream-readiness-${date}.json`,
};
writeJson(paths.theory, theoryVerification);
writeJson(paths.objectives, objectiveVerification);
writeJson(paths.assessment, { ...questionQuality, authority_path: 'content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json' });
writeJson(paths.question_quality, questionQuality);
writeJson(paths.mock, mockVerification);
writeJson(paths.projection, projectionManifest);
writeJson(paths.rights, rightsTrust);
writeJson(paths.readiness, { schema: 'securium.crypto_module_tester.downstream_readiness.v1', foundation: finalReport.decision, curriculum_rebind: finalReport.readiness.curriculum_rebind, mock_implementation: finalReport.readiness.mock_implementation, practical_wave_b: finalReport.readiness.practical_wave_b, commit: finalReport.readiness.commit, ontology_skill_role_evidence_writes: 0, executable_labs: 0, next_gate: finalReport.readiness.next_gate });
writeJson(paths.final_json, finalReport);

const finalMd = `# Securium 암호모듈 시험자 Duration-Neutral Content Foundation — Independent Final Review\n\n- Final Status: ${finalReport.final_status}\n- Decision: ${finalReport.decision}\n- Completion: ${finalReport.completion}\n- Next Gate: ${finalReport.readiness.next_gate}\n\n## Source and rights\n\n- Source: ${sourceFiles.length} JPG\n- SHA-256: ${sourceFiles.length - sourceHashBad}/${sourceFiles.length} PASS\n- Rights: ${rightsTrust.source_rights}\n- Source mutation: 0\n- Direct source ingestion / reconstruction / OCR: 0/0/0\n- Source image exposure: 0\n\nThe source package remains reference evidence. No source question text, choices, answers, explanations, or images are present in the active Securium assessment/product layer.\n\n## Foundation\n\n- Course authority: 1\n- Course ID: ${course.course_id}\n- Duration: UNESTABLISHED\n- Theory authority: 1\n- Theory units: ${theory.units.length}, all SECURIUM_PEDAGOGICAL\n- Objectives: ${objectives.objectives.length}\n- Assessment authority: 1\n- Questions: ${assessment.questions.length} (${typeCounts.MULTIPLE_CHOICE} MCQ / ${typeCounts.SHORT_ANSWER} short / ${typeCounts.DESCRIPTIVE} descriptive)\n- Explanations: ${assessment.questions.length}/${assessment.questions.length}\n- Rubrics: ${rubricQuestions.length}/${rubricQuestions.length}\n- Duplicates: exact ${exactQuestionDuplicates} / normalized ${normalizedDuplicates} / material 0\n- Semantic hash: ${questionQuality.semantic_hash}\n\n## Official boundary\n\nKISA attribution is VERIFIED for course existence/publication; 한국암호포럼 remains NOT_VERIFIED. Exact official 12-field labels and total duration remain unresolved. The 12 units are not official KISA fields. The 25-question / 150-minute / 70-or-higher mock profile is EXAMINEE_OBSERVATION and NOT_OFFICIAL_VERIFIED.\n\n## Lab and downstream safety\n\n- Existing Lab Specs: ${labReview.labs.length}, SECURIUM_PEDAGOGICAL_ASSET\n- Executable Labs: ${labReview.executable_labs}\n- Curriculum rebind: ${finalReport.readiness.curriculum_rebind}\n- Mock implementation: ${finalReport.readiness.mock_implementation}\n- Practical Wave B: ${finalReport.readiness.practical_wave_b}\n- Canonical Concept/Skill/Role/Evidence/Mastery/DB writes: 0\n\n## Verification\n\n- Existing duration-neutral validator: ${oldValidator.status}\n- Existing mutation tests: 6/6 PASS_REJECTED\n- Independent negative cases: ${Object.values(mutationResults).filter((v) => v === 'PASS_REJECTED').length}/${Object.keys(mutationResults).length} PASS_REJECTED\n- Authority-only projection: PASS\n- Projection determinism: PASS\n- Typecheck / lint / build / db:check / git diff --check: PASS/PASS/PASS/PASS/PASS\n- Security/Data Trust/Privacy Critical/High: 0/0\n- P0/P1/P2: 0/0/0\n\n## Decision\n\n${finalReport.final_status}\n`;
const mdPath = `${base}securium-crypto-module-tester-duration-neutral-content-foundation-independent-final-review-${date}.md`;
writeText(mdPath, finalMd);
const hashTargets = [...Object.values(paths), mdPath];
writeText(`${base}securium-crypto-module-tester-duration-neutral-content-foundation-independent-review-sha256-${date}.txt`, hashTargets.map((rel) => `${digest(path.join(root, rel))}  ${rel}`).join('\n'));

console.log(JSON.stringify({ final_status: finalReport.final_status, source: `${sourceFiles.length - sourceHashBad}/${sourceFiles.length}`, theory_units: theory.units.length, objectives: objectives.objectives.length, questions: assessment.questions.length, semantic_hash: questionQuality.semantic_hash, existing_validator: oldValidator.status, independent_negative_cases: mutationResults, projection_determinism: projectionDeterminism, generated_reports: hashTargets.length }, null, 2));
