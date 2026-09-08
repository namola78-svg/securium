import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentRoot = path.join(root, 'content-drafts', 'crypto-module-tester-duration-neutral');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(contentRoot, file), 'utf8'));
const write = (file, text) => {
  const target = path.join(contentRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
};
const theory = readJson('theory-authority.json');
const assessment = readJson('assessment-authority.json');

const theoryMd = `# Securium 「암호모듈 시험자」 duration-neutral theory\n\n- course_id: ${theory.course_id}\n- authority: ${theory.authority_count}\n- duration: UNESTABLISHED\n- structure: SECURIUM_PEDAGOGICAL\n- official 12-field claim: NONE\n\n${theory.units.map((u) => `## ${u.id} ${u.title}\n\n### 학습 목적\n${u.purpose}\n\n### 핵심 개념\n${u.core_concepts.map((x) => `- ${x}`).join('\n')}\n\n### 주요 용어\n${u.key_terms.join(', ')}\n\n### 원리\n${u.principles.map((x) => `- ${x}`).join('\n')}\n\n### 시험자 관점\n${u.tester_perspective}\n\n### 확인해야 할 증적\n${u.evidence_to_check.map((x) => `- ${x}`).join('\n')}\n\n### 흔한 오해\n${u.common_misconceptions.map((x) => `- ${x}`).join('\n')}\n\n### 판단 포인트\n${u.judgment_points.map((x) => `- ${x}`).join('\n')}\n\n### 실무 예시\n${u.practical_example}\n\n### 학습 체크포인트\n${u.learning_checkpoints.map((x) => `- ${x}`).join('\n')}`).join('\n\n')}\n\n> This is a Securium-original, source-informed pedagogical projection. It is not an official KISA curriculum timetable or official 12-field list.\n`;
write('projections/theory.md', theoryMd);

for (const q of assessment.questions) {
  const body = [
    `# ${q.id} ${q.type}`,
    '',
    `- learning_unit: ${q.learning_unit}`,
    `- objective: ${q.objective}`,
    `- topic: ${q.topic}`,
    `- difficulty: ${q.difficulty}`,
    `- cognitive: ${q.cognitive}`,
    '',
    q.prompt,
    '',
    ...(q.type === 'MULTIPLE_CHOICE' ? [q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n'), ''] : []),
    '## 해설/채점',
    '',
    q.explanation,
    ...(q.type === 'SHORT_ANSWER' ? ['', `정답: ${q.canonical_answer}`, `허용 답: ${q.accepted_answers.join(', ')}`, `정규화: ${q.normalization}`] : []),
    ...(q.type === 'DESCRIPTIVE' ? ['', '루브릭:', q.rubric] : []),
    '',
  ];
  write(`projections/assessment/${q.id}.md`, body.join('\n'));
}

for (const [type, filename] of [['MULTIPLE_CHOICE', 'multiple-choice.json'], ['SHORT_ANSWER', 'short-answer.json'], ['DESCRIPTIVE', 'descriptive.json']]) {
  write(`projections/assessment/${filename}`, JSON.stringify({
    projection: 'GENERATED_READ_ONLY_PROJECTION',
    authority: 'assessment-authority.json',
    type,
    questions: assessment.questions.filter((q) => q.type === type),
  }, null, 2));
}

console.log(JSON.stringify({ authority_only: true, theory_projection: 'projections/theory.md', assessment_projection_count: assessment.questions.length }, null, 2));
