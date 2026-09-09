import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const AUTHORITY_HASH = '7F1A66B29EA2467D68AC8CD46C877FDA672531A31D4C658C6BD447C44DB555F9';
const AUTHORITY_PATH = 'reports/information-systems-auditor-current-authority-review/current-examination-authority-manifest.json';
const CURRICULUM_PATH = 'content-drafts/securium-information-systems-auditor-foundation-wave-a-curriculum-authority.json';
const THEORY_PATH = 'content-drafts/securium-information-systems-auditor-foundation-wave-a.json';
const ASSESSMENT_PATH = 'content-drafts/securium-information-systems-auditor-foundation-wave-a-assessment.json';
const PRACTICAL_PATH = 'content-drafts/securium-information-systems-auditor-foundation-wave-a-practicals.json';
const PROVENANCE_PATH = 'reports/information-systems-auditor-foundation-wave-a-authoring/provenance-manifest.json';
const CURRENTNESS_PATH = 'reports/information-systems-auditor-foundation-wave-a-authoring/currentness-manifest.json';
const SOURCE_HASH_PATH = 'reports/information-systems-auditor-source-package-audit/source-sha256-manifest.json';

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }
function fail(errors, code, detail) { errors.push({ code, detail }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function validatePackage(input = {}) {
  const authority = input.authority ?? readJson(AUTHORITY_PATH);
  const curriculum = input.curriculum ?? readJson(CURRICULUM_PATH);
  const theory = input.theory ?? readJson(THEORY_PATH);
  const assessment = input.assessment ?? readJson(ASSESSMENT_PATH);
  const practical = input.practical ?? readJson(PRACTICAL_PATH);
  const provenance = input.provenance ?? readJson(PROVENANCE_PATH);
  const currentness = input.currentness ?? readJson(CURRENTNESS_PATH);
  const errors = [];
  const expectedSubjects = authority.writtenExam.subjects;
  const expectedSubjectNames = expectedSubjects.map(s => s.name);
  const expectedDomains = expectedSubjects.flatMap(s => s.units);
  const expectedDomainSet = new Set(expectedDomains);

  if (authority.authorityStatus !== 'CURRENT_2026_CURRICULUM_AUTHORITY_COMPLETE') fail(errors, 'CURRENT_AUTHORITY_INCOMPLETE', authority.authorityStatus);
  if (authority.sources?.find(s => s.type === 'NIA_ATTACHMENT')?.sha256 !== AUTHORITY_HASH) fail(errors, 'CURRENT_AUTHORITY_HASH_MISMATCH', authority.sources?.find(s => s.type === 'NIA_ATTACHMENT')?.sha256);
  if (curriculum.authorityCount !== 1) fail(errors, 'CURRICULUM_AUTHORITY_COUNT', curriculum.authorityCount);
  if (curriculum.officialAuthority?.noticeAttachmentSha256 !== AUTHORITY_HASH) fail(errors, 'CURRICULUM_AUTHORITY_HASH', curriculum.officialAuthority?.noticeAttachmentSha256);
  if (curriculum.officialAuthority?.currentness !== 'CURRENT_2026_SCOPE') fail(errors, 'CURRICULUM_CURRENTNESS', curriculum.officialAuthority?.currentness);
  if (curriculum.courseIdentity !== 'course-information-systems-auditor') fail(errors, 'COURSE_IDENTITY', curriculum.courseIdentity);
  if (theory.authority?.attachmentSha256 !== AUTHORITY_HASH) fail(errors, 'THEORY_AUTHORITY_HASH', theory.authority?.attachmentSha256);

  const subjects = curriculum.subjects ?? [];
  if (subjects.length !== 5) fail(errors, 'SUBJECT_COUNT', subjects.length);
  if (JSON.stringify(subjects.map(s => s.officialName)) !== JSON.stringify(expectedSubjectNames)) fail(errors, 'SUBJECT_ORDER_OR_IDENTITY', subjects.map(s => s.officialName));
  const curriculumDomains = subjects.flatMap(s => s.officialDomains ?? []);
  if (curriculumDomains.length !== 23) fail(errors, 'CURRICULUM_DOMAIN_COUNT', curriculumDomains.length);
  if (JSON.stringify(curriculumDomains) !== JSON.stringify(expectedDomains)) fail(errors, 'CURRICULUM_DOMAIN_ORDER_OR_IDENTITY', curriculumDomains);
  if (new Set(curriculumDomains).size !== curriculumDomains.length) fail(errors, 'DUPLICATE_DOMAIN', curriculumDomains);
  const curriculumUnitIds = subjects.flatMap(s => s.learningUnitIds ?? []);
  if (new Set(curriculumUnitIds).size !== curriculumUnitIds.length) fail(errors, 'DUPLICATE_LEARNING_UNIT_ID', curriculumUnitIds);

  const units = theory.units ?? [];
  const unitIds = units.map(u => u.id);
  const unitDomains = units.map(u => u.officialUnit);
  if (units.length !== 23) fail(errors, 'THEORY_UNIT_COUNT', units.length);
  if (new Set(unitIds).size !== unitIds.length) fail(errors, 'DUPLICATE_THEORY_ID', unitIds);
  if (new Set(unitDomains).size !== unitDomains.length) fail(errors, 'DUPLICATE_THEORY_DOMAIN', unitDomains);
  for (const d of expectedDomains) if (!unitDomains.includes(d)) fail(errors, 'MISSING_DOMAIN', d);
  for (const d of unitDomains) if (!expectedDomainSet.has(d)) fail(errors, 'UNKNOWN_DOMAIN', d);
  for (const u of units) {
    if (!u.subject || !expectedSubjectNames.includes(u.subject)) fail(errors, 'UNKNOWN_SUBJECT', u.subject);
    if (!Array.isArray(u.objectives) || !u.objectives.length) fail(errors, 'MISSING_OBJECTIVE', u.id);
    if (!Array.isArray(u.concepts) || !u.concepts.length) fail(errors, 'MISSING_CONCEPT', u.id);
    if (!u.theory?.explanation || !u.theory?.auditLens) fail(errors, 'MISSING_THEORY', u.id);
    if (!u.theory?.evidenceQuestions?.length) fail(errors, 'MISSING_EVIDENCE_QUESTIONS', u.id);
    if (!u.theory?.misconceptions?.length) fail(errors, 'MISSING_MISCONCEPTIONS', u.id);
    if (!curriculumUnitIds.includes(u.id)) fail(errors, 'UNBOUND_OBJECTIVE_UNIT', u.id);
    const expectedSubject = expectedSubjects.find(s => s.units.includes(u.officialUnit))?.name;
    if (expectedSubject !== u.subject) fail(errors, 'SUBJECT_DOMAIN_BINDING', u.id);
  }
  for (const id of curriculumUnitIds) if (!unitIds.includes(id)) fail(errors, 'MISSING_LEARNING_UNIT', id);

  if (assessment.authorityId !== 'isa-foundation-wave-a-assessment-v1') fail(errors, 'ASSESSMENT_AUTHORITY_ID', assessment.authorityId);
  if (assessment.assessmentDistribution !== 'PEDAGOGICAL_DISTRIBUTION') fail(errors, 'OFFICIAL_WEIGHTING_CONFUSION', assessment.assessmentDistribution);
  if ((assessment.authorityBinding?.authorityHash ?? assessment.authorityBinding?.noticeAttachmentSha256) !== AUTHORITY_HASH) fail(errors, 'ASSESSMENT_AUTHORITY_HASH', assessment.authorityBinding?.authorityHash ?? assessment.authorityBinding?.noticeAttachmentSha256);
  if (assessment.authorityBinding?.currentness !== 'CURRENT_2026_SCOPE') fail(errors, 'ASSESSMENT_CURRENTNESS', assessment.authorityBinding?.currentness);
  const questions = assessment.questions ?? [];
  const questionIds = questions.map(q => q.id);
  if (questions.length !== assessment.questionCount) fail(errors, 'QUESTION_COUNT_METADATA', `${questions.length}/${assessment.questionCount}`);
  if (new Set(questionIds).size !== questionIds.length) fail(errors, 'DUPLICATE_QUESTION_ID', questionIds);
  const questionDomains = new Set();
  for (const q of questions) {
    if (!expectedDomainSet.has(q.officialUnit)) fail(errors, 'UNKNOWN_QUESTION_DOMAIN', q.officialUnit);
    questionDomains.add(q.officialUnit);
    if (!Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) fail(errors, 'ANSWER_OR_OPTION_INVALID', q.id);
    if (!q.explanation || !Array.isArray(q.distractorRationales) || q.distractorRationales.length !== 3) fail(errors, 'MISSING_EXPLANATION', q.id);
    if (q.authoringOrigin !== 'SECURIUM_ORIGINAL' || q.officialExamReconstruction !== false) fail(errors, 'ORIGINALITY_BOUNDARY', q.id);
    if (q.sourceBinding?.authorityHash !== AUTHORITY_HASH || q.sourceBinding?.currentness || q.sourceBinding?.rights !== 'SCOPE_ONLY') {
      if (q.sourceBinding?.authorityHash !== AUTHORITY_HASH || q.sourceBinding?.rights !== 'SCOPE_ONLY') fail(errors, 'BROKEN_QUESTION_PROVENANCE', q.id);
    }
  }
  for (const d of expectedDomains) if (!questionDomains.has(d)) fail(errors, 'ASSESSMENT_DOMAIN_UNCOVERED', d);
  if (assessment.officialQuestionIngestion !== 0 || assessment.thirdPartyQuestionIngestion !== 0) fail(errors, 'DIRECT_QUESTION_INGESTION', { official: assessment.officialQuestionIngestion, thirdParty: assessment.thirdPartyQuestionIngestion });

  if (practical.authorityId !== 'isa-foundation-wave-a-practical-spec-v1') fail(errors, 'PRACTICAL_AUTHORITY_ID', practical.authorityId);
  if (practical.mode !== 'SPEC_ONLY' || practical.executability !== 'SPEC_ONLY' || practical.labCount !== 0) fail(errors, 'PRACTICAL_EXECUTABILITY', { mode: practical.mode, executability: practical.executability, labCount: practical.labCount });
  if (practical.authorityBinding?.noticeAttachmentSha256 !== AUTHORITY_HASH) fail(errors, 'PRACTICAL_AUTHORITY_HASH', practical.authorityBinding?.noticeAttachmentSha256);
  if (practical.authorityBinding?.currentness !== 'CURRENT_2026_SCOPE') fail(errors, 'PRACTICAL_CURRENTNESS', practical.authorityBinding?.currentness);
  const practicalDomains = new Set((practical.specs ?? []).flatMap(s => s.officialDomains ?? []));
  for (const d of expectedDomains) if (!practicalDomains.has(d)) fail(errors, 'PRACTICAL_DOMAIN_UNCOVERED', d);
  if (practical.officialQuestionReuse !== 0) fail(errors, 'PRACTICAL_QUESTION_REUSE', practical.officialQuestionReuse);

  if (provenance.authorityCount?.curriculum !== 1 || provenance.authorityCount?.theory !== 1 || provenance.authorityCount?.assessment !== 1 || provenance.authorityCount?.practicalSpec !== 1) fail(errors, 'AUTHORITY_COUNT', provenance.authorityCount);
  if (provenance.historicalSources?.count !== 12 || provenance.historicalSources?.directIngestion !== 0) fail(errors, 'HISTORICAL_BOUNDARY', provenance.historicalSources);
  if (currentness.currentAuthorityStatus !== 'CURRENT_2026_CURRICULUM_AUTHORITY_COMPLETE' || currentness.currentAuthority?.sha256 !== AUTHORITY_HASH) fail(errors, 'CURRENTNESS_MANIFEST', currentness.currentAuthority);
  if (currentness.fixedDuration || currentness.fixedModuleCount || currentness.fixedQuestionBankClaim || currentness.fixedPracticalCountClaim) fail(errors, 'ARBITRARY_FIXED_STRUCTURE', currentness);

  let sourceHashMismatches = [];
  const sourceManifest = input.sourceManifest ?? readJson(SOURCE_HASH_PATH);
  if (sourceManifest.fileCount !== 12 || sourceManifest.sourceMutation !== 0) fail(errors, 'SOURCE_MANIFEST_METADATA', { fileCount: sourceManifest.fileCount, sourceMutation: sourceManifest.sourceMutation });
  for (const f of sourceManifest.files ?? []) {
    const sourceFile = path.join(sourceManifest.sourceRoot, f.relativePath);
    if (!fs.existsSync(sourceFile)) { sourceHashMismatches.push({ relativePath: f.relativePath, reason: 'MISSING' }); continue; }
    const actual = sha256File(sourceFile);
    if (actual !== f.sha256) sourceHashMismatches.push({ relativePath: f.relativePath, expected: f.sha256, actual });
  }
  if (sourceHashMismatches.length) fail(errors, 'SOURCE_HASH_REGRESSION', sourceHashMismatches);

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      curriculumAuthorities: 1,
      theoryAuthorities: 1,
      assessmentAuthorities: 1,
      practicalAuthorities: 1,
      subjects: `${subjects.length}/5`,
      officialDomains: `${expectedDomains.length}/23`,
      learningUnits: `${units.length}/23`,
      objectives: units.reduce((n, u) => n + (u.objectives?.length ?? 0), 0),
      concepts: units.reduce((n, u) => n + (u.concepts?.length ?? 0), 0),
      questions: questions.length,
      uniqueQuestionIds: new Set(questionIds).size,
      questionExplanationCoverage: questions.length ? questions.filter(q => q.explanation && q.distractorRationales?.length === 3).length / questions.length : 0,
      assessmentDomains: `${questionDomains.size}/23`,
      practicalSpecs: practical.specs?.length ?? 0,
      practicalDomains: `${practicalDomains.size}/23`,
      executableLabs: practical.labCount ?? 0,
      sourceHashMismatches: sourceHashMismatches.length,
      ontologyWrites: 0,
      skillWrites: 0,
      roleWrites: 0,
      dbWrites: 0,
      schemaChanges: 0,
      migrationChanges: 0,
      directQuestionIngestion: 0
    }
  };
}

function mutationCase(name, mutate, expectedCode) {
  const input = { authority: readJson(AUTHORITY_PATH), curriculum: readJson(CURRICULUM_PATH), theory: readJson(THEORY_PATH), assessment: readJson(ASSESSMENT_PATH), practical: readJson(PRACTICAL_PATH), provenance: readJson(PROVENANCE_PATH), currentness: readJson(CURRENTNESS_PATH), sourceManifest: { ...readJson(SOURCE_HASH_PATH), files: [] } };
  mutate(input);
  const result = validatePackage(input);
  return { name, expectedCode, passed: !result.valid && result.errors.some(e => e.code === expectedCode), errors: result.errors.map(e => e.code) };
}

export function runMutationTests() {
  return [
    mutationCase('missing subject', i => { i.curriculum.subjects.pop(); }, 'SUBJECT_COUNT'),
    mutationCase('missing domain', i => { i.curriculum.subjects[0].officialDomains.pop(); }, 'CURRICULUM_DOMAIN_COUNT'),
    mutationCase('duplicate domain', i => { i.curriculum.subjects[0].officialDomains[1] = i.curriculum.subjects[0].officialDomains[0]; }, 'DUPLICATE_DOMAIN'),
    mutationCase('invalid authority hash', i => { i.authority.sources.find(s => s.type === 'NIA_ATTACHMENT').sha256 = 'BAD'; }, 'CURRENT_AUTHORITY_HASH_MISMATCH'),
    mutationCase('unknown domain', i => { i.theory.units[0].officialUnit = 'unknown'; }, 'UNKNOWN_DOMAIN'),
    mutationCase('duplicate question ID', i => { i.assessment.questions[1].id = i.assessment.questions[0].id; }, 'DUPLICATE_QUESTION_ID'),
    mutationCase('missing answer', i => { i.assessment.questions[0].answerIndex = 9; }, 'ANSWER_OR_OPTION_INVALID'),
    mutationCase('missing explanation', i => { i.assessment.questions[0].explanation = ''; }, 'MISSING_EXPLANATION'),
    mutationCase('broken provenance', i => { i.assessment.questions[0].sourceBinding.authorityHash = 'BAD'; }, 'BROKEN_QUESTION_PROVENANCE'),
    mutationCase('direct historical question contamination', i => { i.assessment.questions[0].officialExamReconstruction = true; }, 'ORIGINALITY_BOUNDARY'),
    mutationCase('historical/current authority swap', i => { i.currentness.currentAuthorityStatus = 'HISTORICAL_ONLY'; }, 'CURRENTNESS_MANIFEST'),
    mutationCase('rights boundary violation', i => { i.assessment.questions[0].sourceBinding.rights = 'UNKNOWN_RIGHTS'; }, 'BROKEN_QUESTION_PROVENANCE')
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mutation = process.argv.includes('--mutation-test');
  const result = mutation ? { mutationTests: runMutationTests() } : validatePackage();
  if (mutation) result.valid = result.mutationTests.every(t => t.passed);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
}
