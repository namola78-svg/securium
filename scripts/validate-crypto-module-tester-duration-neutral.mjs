import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const reportRoot = path.join(root, 'reports', 'content-audit');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const normalize = (value) => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const fail = (condition, message, failures) => { if (!condition) failures.push(message); };
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const validate = (course, theory, objectives, assessment, mock, sourceKnowledge, options = {}) => {
  const failures = [];
  fail(course.course_id === 'course-crypto-module-tester', 'duration-neutral stable course ID missing', failures);
  fail(course.lifecycle === 'DRAFT', 'course lifecycle must be DRAFT', failures);
  fail(course.duration_status === 'UNESTABLISHED' && course.duration_minutes === null, 'unsupported duration is active', failures);
  fail(course.official_curriculum_binding === 'WAIT_FOR_EXACT_12_FIELD_AUTHORITY', 'official curriculum boundary missing', failures);
  fail(course.source_rights === 'REFERENCE_ONLY / UNKNOWN_RIGHTS / FAIL_CLOSED', 'source rights not fail-closed', failures);
  fail(theory.authority_count === 1, 'theory authority count is not one', failures);
  fail(objectives.authority_count === 1, 'objective authority count is not one', failures);
  fail(assessment.authority_count === 1, 'assessment authority count is not one', failures);
  fail(theory.units.length === 12, `expected 12 Securium pedagogical units, got ${theory.units.length}`, failures);
  fail(new Set(theory.units.map((u) => u.id)).size === theory.units.length, 'duplicate learning unit ID', failures);
  const requiredUnitFields = ['purpose', 'core_concepts', 'key_terms', 'principles', 'tester_perspective', 'evidence_to_check', 'common_misconceptions', 'judgment_points', 'practical_example', 'learning_checkpoints'];
  for (const u of theory.units) {
    for (const field of requiredUnitFields) fail(Array.isArray(u[field]) ? u[field].length > 0 : typeof u[field] === 'string' && u[field].length > 8, `${u.id}: missing theory field ${field}`, failures);
    fail(u.structure_authority === 'SECURIUM_PEDAGOGICAL', `${u.id}: unsafe structure authority`, failures);
  }
  fail(objectives.objectives.length === 48, `expected 48 objectives, got ${objectives.objectives.length}`, failures);
  fail(new Set(objectives.objectives.map((o) => o.id)).size === objectives.objectives.length, 'duplicate objective ID', failures);
  const unitIds = new Set(theory.units.map((u) => u.id));
  const objectiveIds = new Set(objectives.objectives.map((o) => o.id));
  for (const o of objectives.objectives) {
    fail(unitIds.has(o.learning_unit), `${o.id}: unknown learning unit`, failures);
    fail(o.measurable === true && typeof o.text === 'string' && o.text.length > 8, `${o.id}: non-measurable objective`, failures);
  }
  fail(assessment.questions.length >= 100, 'assessment bank below defensible 100-question target', failures);
  fail(new Set(assessment.questions.map((q) => q.id)).size === assessment.questions.length, 'duplicate question ID', failures);
  const normalizedPrompts = assessment.questions.map((q) => normalize(q.prompt));
  fail(new Set(normalizedPrompts).size === normalizedPrompts.length, 'normalized duplicate prompt', failures);
  const counts = { MULTIPLE_CHOICE: 0, SHORT_ANSWER: 0, DESCRIPTIVE: 0 };
  for (const q of assessment.questions) {
    counts[q.type] = (counts[q.type] ?? 0) + 1;
    fail(q.course === course.course_id, `${q.id}: wrong course binding`, failures);
    fail(unitIds.has(q.learning_unit), `${q.id}: unknown learning unit`, failures);
    fail(objectiveIds.has(q.objective), `${q.id}: unknown objective`, failures);
    fail(typeof q.topic === 'string' && q.topic.length > 1, `${q.id}: missing topic`, failures);
    fail(typeof q.prompt === 'string' && q.prompt.length > 20, `${q.id}: missing prompt`, failures);
    fail(typeof q.explanation === 'string' && q.explanation.length > 20, `${q.id}: missing explanation`, failures);
    fail(q.authoring?.independent === true && q.authoring?.source_question_mapping === 'NONE', `${q.id}: independence boundary missing`, failures);
    fail(!('source_prompt' in q) && !('source_choices' in q) && !('source_answer' in q) && !('ocr_text' in q), `${q.id}: prohibited source reconstruction field`, failures);
    if (q.type === 'MULTIPLE_CHOICE') {
      fail(Array.isArray(q.choices) && q.choices.length === 4, `${q.id}: MCQ must have four choices`, failures);
      fail(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, `${q.id}: invalid MCQ answer`, failures);
      fail(q.answer_label === q.choices[q.answer], `${q.id}: answer label mismatch`, failures);
    } else if (q.type === 'SHORT_ANSWER') {
      fail(typeof q.canonical_answer === 'string' && q.canonical_answer.length > 1, `${q.id}: missing canonical short answer`, failures);
      fail(Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0, `${q.id}: missing accepted answers`, failures);
      fail(typeof q.normalization === 'string', `${q.id}: missing normalization rules`, failures);
    } else if (q.type === 'DESCRIPTIVE') {
      fail(Array.isArray(q.rubric) && q.rubric.length > 0 && q.rubric.every((item) => /\(\d+점\)/.test(item)), `${q.id}: missing descriptive rubric`, failures);
    } else fail(false, `${q.id}: unsupported question type`, failures);
  }
  fail(counts.MULTIPLE_CHOICE === 60 && counts.SHORT_ANSWER === 36 && counts.DESCRIPTIVE === 24, `unexpected question type counts ${JSON.stringify(counts)}`, failures);
  fail(mock.authority === 'EXAMINEE_OBSERVATION' && mock.official_status === 'NOT_OFFICIAL_VERIFIED', 'mock profile authority label is unsafe', failures);
  fail(mock.observed_profile.question_count === 25 && mock.observed_profile.duration_minutes === 150, 'mock observed profile mismatch', failures);
  fail(mock.scoring.model === 'SECURIUM_PRACTICE_SCORING' && mock.scoring.pass_threshold === 70, 'practice scoring boundary missing', failures);
  fail(mock.selection.question_ids.length === 25 && mock.selection.question_ids.every((id) => assessment.questions.some((q) => q.id === id)), 'mock selection invalid', failures);
  fail(sourceKnowledge.inventory.file_count === 493 && sourceKnowledge.inventory.hash_matches === 493, 'source inventory/hash coverage is not 493/493', failures);
  fail(sourceKnowledge.inventory.source_mutation === 0, 'source mutation is nonzero', failures);
  fail(sourceKnowledge.source_items?.length === 493, 'source item coverage map is incomplete', failures);
  fail(options.sourceQuestionIngestion === 0, 'source question ingestion is nonzero', failures);
  fail(options.ocrCanonicalization === 0, 'OCR canonicalization is nonzero', failures);
  fail(options.sourceImageExposure === 0, 'source image product exposure is nonzero', failures);
  const prohibited = ['course-crypto-module-tester-8h', 'duration_minutes": 480', '480 minutes', '5 × 8', '5/5/5/5/5/5/5/5'];
  const activeText = [JSON.stringify(course), JSON.stringify(theory), JSON.stringify(objectives), JSON.stringify(assessment), JSON.stringify(mock)].join('\n');
  for (const token of prohibited) fail(!activeText.includes(token), `unsupported active assumption present: ${token}`, failures);
  const semanticHash = sha(assessment.questions);
  return { status: failures.length === 0 ? 'PASS' : 'FAIL', failures, counts, question_count: assessment.questions.length, explanation_coverage: `${assessment.questions.filter((q) => q.explanation).length}/${assessment.questions.length}`, semantic_hash: semanticHash, mutation_tests: options.mutationTests ?? null };
};

const course = readJson('content-drafts/crypto-module-tester-duration-neutral/course.json');
const theory = readJson('content-drafts/crypto-module-tester-duration-neutral/theory-authority.json');
const objectives = readJson('content-drafts/crypto-module-tester-duration-neutral/objective-authority.json');
const assessment = readJson('content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json');
const mock = readJson('content-drafts/crypto-module-tester-duration-neutral/mock-exam-profile.json');
const sourceKnowledge = readJson('reports/content-audit/securium-crypto-module-tester-source-knowledge-coverage-2026-09-08.json');

const mutations = {};
if (process.argv.includes('--mutation-tests')) {
  const cases = {
    missing_unit: () => { const x = structuredClone(theory); x.units.pop(); return validate(course, x, objectives, assessment, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
    duplicate_question_id: () => { const x = structuredClone(assessment); x.questions[1].id = x.questions[0].id; return validate(course, theory, objectives, x, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
    missing_explanation: () => { const x = structuredClone(assessment); delete x.questions[0].explanation; return validate(course, theory, objectives, x, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
    wrong_binding: () => { const x = structuredClone(assessment); x.questions[0].learning_unit = 'U99'; return validate(course, theory, objectives, x, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
    unsupported_duration: () => { const x = structuredClone(course); x.duration_minutes = 480; x.duration_status = 'VERIFIED'; return validate(x, theory, objectives, assessment, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
    prohibited_source_field: () => { const x = structuredClone(assessment); x.questions[0].source_prompt = 'blocked'; return validate(course, theory, objectives, x, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0 }); },
  };
  for (const [name, run] of Object.entries(cases)) { const result = run(); mutations[name] = result.status === 'FAIL' ? 'PASS_REJECTED' : 'FAIL_ACCEPTED'; }
}
const result = validate(course, theory, objectives, assessment, mock, sourceKnowledge, { sourceQuestionIngestion: 0, ocrCanonicalization: 0, sourceImageExposure: 0, mutationTests: mutations });
const output = { schema: 'securium.crypto_module_tester.duration_neutral_validator.v1', ...result, authority_paths: { theory: 'content-drafts/crypto-module-tester-duration-neutral/theory-authority.json', objectives: 'content-drafts/crypto-module-tester-duration-neutral/objective-authority.json', assessment: 'content-drafts/crypto-module-tester-duration-neutral/assessment-authority.json' }, source_boundary: { direct_question_ingestion: 0, ocr_canonicalization: 0, source_image_exposure: 0 }, no_canonical_writes: 0 };
fs.mkdirSync(reportRoot, { recursive: true });
fs.writeFileSync(path.join(reportRoot, 'securium-crypto-module-tester-duration-neutral-validator-result-2026-09-08.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (result.status !== 'PASS' || Object.values(mutations).some((value) => value !== 'PASS_REJECTED')) process.exitCode = 1;
