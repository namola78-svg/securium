import {
  createCurriculumContentOntologyEdges,
  createOntologyConcept,
  createOntologyEdge,
} from "../services/ontology-service.ts";
import {
  SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE,
  securityContentIntelligenceV3Questions,
  securityContentIntelligenceV3Theory,
  validateSecurityContentIntelligenceV3,
} from "./security-content-intelligence-v3.mjs";

export const SECURITY_CONTENT_V3_TARGET_COURSE_IDS = ["course-ise", "course-isie"];
export const SECURITY_CONTENT_V3_SOURCE_COURSE_ID = "course-ise";
export const SECURITY_CONTENT_V3_SOURCE = "SECURIUM_CONTENT_UPGRADE_V2";
export const SECURITY_CONTENT_V3_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CONTENT_UPGRADE_V3";
export const SECURITY_CONTENT_V3_CONFIRM_ENV_VALUE =
  "APPLY_SECURITY_CONTENT_UPGRADE_V3";

const namespace = "security-certification";

const conceptDefinitions = [
  ["Cryptographic algorithms", "암호 알고리즘", "SECURITY_FOUNDATION", "01-04-02-01", ["Cryptographic Algorithm", "Encryption Algorithm"]],
  ["Authentication", "인증", "SECURITY_FOUNDATION", "01-04-01-01", ["Authentication"]],
  ["ISMS and privacy governance", "ISMS 및 개인정보 거버넌스", "SECURITY_LAW", "01-05-01-04", ["ISMS", "Privacy Governance"]],
  ["Logging and incident response", "로그 분석 및 침해 대응", "SYSTEM_SECURITY", "01-01-03-02", ["Log Analysis", "Incident Response"]],
  ["Network architecture and OSI", "네트워크 구조와 OSI", "NETWORK_SECURITY", "01-02-01-01", ["OSI", "Network Architecture"]],
  ["TLS and secure protocols", "TLS", "NETWORK_SECURITY", "01-02-03-01", ["Transport Layer Security", "보안 프로토콜"]],
  ["CIA triad", "CIA 3요소", "SECURITY_FOUNDATION", "01-04", ["Confidentiality Integrity Availability", "기밀성 무결성 가용성"]],
  ["Digital signature and PKI", "디지털서명 및 PKI", "SECURITY_FOUNDATION", "01-04-01-04", ["Digital Signature", "Public Key Infrastructure", "전자서명"]],
  ["Vulnerability management", "취약점 관리", "SYSTEM_SECURITY", "01-01-03-01", ["Vulnerability Management", "취약점 점검"]],
  ["IDS and IPS", "IDS/IPS", "NETWORK_SECURITY", "01-02-03-02", ["Intrusion Detection System", "Intrusion Prevention System"]],
  ["Windows security", "Windows 보안", "SYSTEM_SECURITY", "01-01-01-02", ["윈도우 보안"]],
  ["DNS security", "DNS", "APPLICATION_SECURITY", "01-03-01-04", ["DNS Security", "Domain Name System"]],
  ["Authorization and access control", "접근통제", "SECURITY_FOUNDATION", "01-04-01-02", ["Authorization", "Access Control", "인가"]],
  ["DoS and DDoS", "서비스 거부", "NETWORK_SECURITY", "01-02-02-01", ["DoS", "DDoS", "Denial of Service"]],
  ["Hash and message digest", "해시함수", "SECURITY_FOUNDATION", "01-04-02-02", ["Hash Function", "Message Digest"]],
  ["Linux security", "Linux 보안", "SYSTEM_SECURITY", "01-01-01-02", ["리눅스 보안"]],
  ["Security governance and law", "정보보호 관리 및 법규", "SECURITY_LAW", "01-05-01-01", ["Security Governance", "정보보호 거버넌스"]],
  ["ARP spoofing", "ARP Spoofing", "NETWORK_SECURITY", "01-02-02-03", ["ARP 스푸핑", "ARP Cache Poisoning"]],
  ["XSS and CSRF", "XSS/CSRF", "APPLICATION_SECURITY", "01-03-02-01", ["Cross-Site Scripting", "Cross-Site Request Forgery"]],
  ["Firewall and WAF", "방화벽 및 WAF", "NETWORK_SECURITY", "01-02-03-02", ["Firewall", "Web Application Firewall"]],
  ["Risk management", "위험관리", "SECURITY_LAW", "01-05-01-02", ["Risk Management", "위험평가"]],
  ["Malware and ransomware", "악성코드 및 랜섬웨어", "SYSTEM_SECURITY", "01-01-02-01", ["Malware", "Ransomware"]],
  ["Audit and accountability", "감사 및 책임추적성", "SECURITY_LAW", "01-05-01-01", ["Audit", "Accountability"]],
  ["SQL injection", "SQL Injection", "APPLICATION_SECURITY", "01-03-02-01", ["SQL 삽입", "SQL 인젝션"]],
  ["Forensics", "디지털 포렌식", "SYSTEM_SECURITY", "01-01-03-02", ["Digital Forensics", "Forensics"]],
  ["BCP and disaster recovery", "BCP 및 재해복구", "SECURITY_LAW", "01-05-01-03", ["Business Continuity Planning", "Disaster Recovery"]],
  ["Virtualization and cloud security", "가상화 및 클라우드 보안", "SYSTEM_SECURITY", "01-01-01-01", ["Virtualization Security", "Cloud Security"]],
  ["Security evaluation criteria", "보안 평가 기준", "SECURITY_LAW", "01-05-01-04", ["Security Evaluation Criteria", "CC"]],
  ["Email authentication", "이메일 인증", "APPLICATION_SECURITY", "01-03-01-02", ["Email Authentication", "SPF", "DKIM", "DMARC"]],
  ["Command and code injection", "명령어 및 코드 인젝션", "APPLICATION_SECURITY", "01-03-02-01", ["Command Injection", "Code Injection"]],
  ["Web and API security", "웹 및 API 보안", "APPLICATION_SECURITY", "01-03-01-03", ["Web Security", "API Security"]],
  ["Endpoint detection and response", "EDR", "SYSTEM_SECURITY", "01-01-03-03", ["Endpoint Detection and Response"]],
];

export const SECURITY_CONTENT_V3_CONCEPT_MAP = Object.freeze(
  Object.fromEntries(
    conceptDefinitions.map(([sourceConcept, label, subjectCode, nodeSuffix, aliases]) => [
      sourceConcept,
      Object.freeze({
        sourceConcept,
        label,
        aliases,
        subjectCode,
        subjectId: `course-ise-subject-${subjectCode.toLowerCase()}`,
        topicId: `course-ise-subject-${subjectCode.toLowerCase()}-topic-core`,
        curriculumNodeId: `curriculum-node-ise-2027-2029-${nodeSuffix}`,
      }),
    ]),
  ),
);

export function validateSecurityContentV3Source(input) {
  const requiredGroups = ["lessons", "writtenQuestions", "practicalQuestions"];
  for (const group of requiredGroups) {
    if (!Array.isArray(input?.[group])) {
      throw new Error(`SECURITY_CONTENT_V3_SOURCE_GROUP_MISSING:${group}`);
    }
  }

  const allItems = requiredGroups.flatMap((group) => input[group]);
  const unmapped = allItems
    .map((item) => item.concepts?.[0])
    .filter((concept) => !SECURITY_CONTENT_V3_CONCEPT_MAP[concept]);
  if (unmapped.length) {
    throw new Error(`SECURITY_CONTENT_V3_CONCEPT_UNMAPPED:${[...new Set(unmapped)].join(",")}`);
  }

  if (input.lessons.some((lesson) => !lesson.id.startsWith("sec-upgrade-lesson-"))) {
    throw new Error("SECURITY_CONTENT_V3_LESSON_SCOPE_INVALID");
  }
  if (
    [...input.writtenQuestions, ...input.practicalQuestions].some(
      (question) => !question.id.startsWith("sec-upgrade-"),
    )
  ) {
    throw new Error("SECURITY_CONTENT_V3_QUESTION_SCOPE_INVALID");
  }

  return {
    lessonCount: input.lessons.length,
    writtenQuestionCount: input.writtenQuestions.length,
    practicalQuestionCount: input.practicalQuestions.length,
    conceptCount: new Set(allItems.map((item) => item.concepts[0])).size,
  };
}

export function buildSecurityContentV3Plan(input) {
  const sourceSummary = validateSecurityContentV3Source(input);
  const contents = input.lessons.map(toContent);
  const contentByConcept = new Map(
    input.lessons.map((lesson) => [lesson.concepts[0], lesson.id]),
  );
  const courseLessons = input.lessons.map((lesson, index) =>
    toCourseLesson(lesson, index),
  );
  const questions = [
    ...input.writtenQuestions.map((question) => toQuestion(question, "WRITTEN")),
    ...input.practicalQuestions.map((question) => toQuestion(question, "PRACTICAL")),
  ];
  const concepts = conceptDefinitions.map(([sourceConcept, label, , , aliases]) =>
    createOntologyConcept({
      label,
      namespace,
      category: "content-core-concept",
      aliases: [sourceConcept, ...aliases],
      sourceType: "CONTENT_UPGRADE",
      sourceId: SECURITY_CONTENT_V3_SOURCE,
      weight: 20,
    }),
  );
  const conceptBySource = new Map(
    concepts.map((concept, index) => [conceptDefinitions[index][0], concept]),
  );
  const ontologyEdges = [];

  for (const lesson of input.lessons) {
    const mapping = SECURITY_CONTENT_V3_CONCEPT_MAP[lesson.concepts[0]];
    const concept = conceptBySource.get(lesson.concepts[0]);
    ontologyEdges.push(
      ...createCurriculumContentOntologyEdges({
        courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
        curriculumNodeId: mapping.curriculumNodeId,
        courseLessonId: courseLessonId(lesson),
        contentId: lesson.id,
        conceptIds: [concept.key],
        evidence: [SECURITY_CONTENT_V3_SOURCE],
      }),
    );
  }

  for (const question of questions) {
    const concept = conceptBySource.get(question.sourceConcept);
    const contentId = contentByConcept.get(question.sourceConcept);
    ontologyEdges.push(
      createOntologyEdge({
        courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
        fromType: "QUESTION",
        fromId: question.id,
        toType: "CONTENT",
        toId: contentId,
        relation: "DERIVED_FROM",
        confidence: 0.8,
        evidence: [SECURITY_CONTENT_V3_SOURCE],
      }),
      createOntologyEdge({
        courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
        fromType: "QUESTION",
        fromId: question.id,
        toType: "CONCEPT",
        toId: concept.key,
        relation: "TESTS",
        confidence: 0.8,
        evidence: [SECURITY_CONTENT_V3_SOURCE],
      }),
    );
  }

  return {
    sourceSummary,
    contents,
    courseLessons,
    questions,
    concepts,
    ontologyEdges: [...new Map(ontologyEdges.map((edge) => [edge.key, edge])).values()],
  };
}

export function generateSecurityContentV3Sql(input, { dialect, actorId = "user-content-editor" }) {
  if (!new Set(["d1", "postgres"]).has(dialect)) {
    throw new Error(`SECURITY_CONTENT_V3_DIALECT_INVALID:${dialect}`);
  }
  const plan = buildSecurityContentV3Plan(input);
  const statements = [dialect === "postgres" ? "BEGIN;" : "BEGIN TRANSACTION;"];

  for (const content of plan.contents) statements.push(upsertContent(content, dialect, actorId));
  for (const lesson of plan.courseLessons) statements.push(upsertCourseLesson(lesson, dialect));
  for (const question of plan.questions) {
    statements.push(upsertQuestion(question, dialect, actorId));
    for (const choice of question.choices) statements.push(upsertChoice(choice, dialect));
  }

  const questionIds = plan.questions.map((question) => question.id);
  statements.push(scopedQuestionRelationshipCleanup(questionIds));
  for (const question of plan.questions) {
    statements.push(insertQuestionCourse(question, dialect));
    statements.push(insertQuestionSubject(question, dialect));
    statements.push(insertQuestionTopic(question, dialect));
    statements.push(insertContentQuestionLink(question, dialect));
    statements.push(insertQuestionVersion(question, dialect, actorId));
  }

  for (const concept of plan.concepts) {
    statements.push(upsertOntologyConcept(concept, dialect));
    for (const alias of concept.aliases) statements.push(upsertOntologyAlias(concept, alias, dialect));
  }
  for (const edge of plan.ontologyEdges) statements.push(upsertOntologyEdge(edge, dialect));

  statements.push(dialect === "postgres" ? "COMMIT;" : "COMMIT;");
  return `${statements.join("\n\n")}\n`;
}

export function buildSecurityContentIntelligenceV3Plan() {
  const sourceSummary = validateSecurityContentIntelligenceV3();
  const concepts = conceptDefinitions.map(([sourceConcept, label, , , aliases]) =>
    createOntologyConcept({
      label,
      namespace,
      category: "content-core-concept",
      aliases: [sourceConcept, ...aliases],
      sourceType: "CONTENT_UPGRADE",
      sourceId: SECURITY_CONTENT_V3_SOURCE,
      weight: 20,
    }),
  );
  const conceptBySource = new Map(
    concepts.map((concept, index) => [conceptDefinitions[index][0], concept]),
  );
  const contents = securityContentIntelligenceV3Theory.map((item) => ({
    id: item.id,
    slug: item.id,
    canonicalKey: `securium.content-v3.${item.courseId}.${item.track.toLowerCase()}.${slug(item.title)}`,
    title: item.title,
    summary: item.sections.core,
    body: JSON.stringify({
      ...item.sections,
      relatedConcepts: item.concepts.map((key) => SECURITY_CONTENT_V3_CONCEPT_MAP[key].label),
      prerequisiteConcepts: item.prerequisites.map((key) => SECURITY_CONTENT_V3_CONCEPT_MAP[key].label),
      writtenPoints: item.track === "WRITTEN" ? item.sections.examPoints : "관련 필기 개념을 전제로 적용 근거를 설명한다.",
      practicalPoints: item.track === "PRACTICAL" ? item.sections.practical : "필기 판단 기준을 실무 시나리오에 연결한다.",
      provenance: item.provenance,
    }),
    learningObjectives: item.learningObjectives,
    coreConcepts: item.concepts.map((key) => SECURITY_CONTENT_V3_CONCEPT_MAP[key].label),
    practicalExamples: [item.sections.practical],
  }));
  const courseLessons = securityContentIntelligenceV3Theory.map((item, index) => ({
    id: `course-lesson-${item.id}`,
    courseId: item.courseId,
    curriculumNodeId: item.curriculumNodeId,
    contentId: item.id,
    displayTitle: item.title,
    sortOrder: 10000 + index,
    difficulty: item.courseId === "course-ise" ? (item.track === "PRACTICAL" ? "HARD" : "MEDIUM") : "EASY",
  }));
  const questions = securityContentIntelligenceV3Questions.map((item) => {
    const choices = (item.choices ?? []).map((content, index) => ({
      id: `${item.id}-choice-${String(index + 1).padStart(2, "0")}`,
      questionId: item.id,
      content,
      displayOrder: index + 1,
      isCorrect: index === item.answerIndex,
      explanation: item.distractorRationales?.[index] ?? item.explanation,
    }));
    const practicalPrompt = item.track === "PRACTICAL"
      ? `시나리오: ${item.scenario}\n\n증거:\n${item.evidence.map((value) => `- ${value}`).join("\n")}\n\n과제: ${item.task}`
      : item.stem;
    return {
      id: item.id,
      title: item.track === "PRACTICAL" ? item.task : item.stem,
      content: practicalPrompt,
      type: normalizeIntelligenceQuestionType(item.type),
      difficulty: item.difficulty,
      explanation: item.explanation,
      wrongAnswerExplanation: item.track === "WRITTEN" ? "각 선택지의 통제 목적과 적용 범위를 지문에 대입해 판단한다." : "근거, 판단, 조치와 검증 방법이 모두 포함되어야 한다.",
      answerConfig: {
        answerIndex: item.answerIndex,
        expectedAnswer: item.expectedAnswer,
        scoringPoints: item.scoringPoints ?? [],
        learningObjective: item.learningObjective,
        examTrack: item.track,
        questionPattern: item.type,
        provenance: item.provenance,
        validationStatus: "DRAFT_GATE_PASSED",
      },
      choices,
      sourceConcepts: item.concepts,
      contentId: item.contentId,
      courseId: item.courseId,
      subjectId: `${item.courseId}-subject-${item.subjectCode.toLowerCase()}`,
      topicId: `${item.courseId}-subject-${item.subjectCode.toLowerCase()}-topic-core`,
      examTrack: item.track,
    };
  });
  const courseLessonByContent = new Map(courseLessons.map((item) => [item.contentId, item]));
  const theoryById = new Map(securityContentIntelligenceV3Theory.map((item) => [item.id, item]));
  const ontologyEdges = [];
  for (const item of securityContentIntelligenceV3Theory) {
    const lesson = courseLessonByContent.get(item.id);
    const conceptIds = item.concepts.map((key) => conceptBySource.get(key).key);
    ontologyEdges.push(...createCurriculumContentOntologyEdges({
      courseId: item.courseId,
      curriculumNodeId: item.curriculumNodeId,
      courseLessonId: lesson.id,
      contentId: item.id,
      conceptIds,
      evidence: [SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE, ...item.provenance.sourceRefs],
    }));
  }
  for (const question of questions) {
    const source = securityContentIntelligenceV3Questions.find((item) => item.id === question.id);
    const theoryItem = theoryById.get(question.contentId);
    ontologyEdges.push(createOntologyEdge({
      courseId: question.courseId,
      fromType: "QUESTION",
      fromId: question.id,
      toType: "CONTENT",
      toId: question.contentId,
      relation: "DERIVED_FROM",
      confidence: 0.92,
      evidence: [SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE, ...source.provenance.sourceRefs],
    }));
    for (const sourceConcept of source.concepts) {
      ontologyEdges.push(createOntologyEdge({
        courseId: question.courseId,
        fromType: "QUESTION",
        fromId: question.id,
        toType: "CONCEPT",
        toId: conceptBySource.get(sourceConcept).key,
        relation: "TESTS",
        confidence: 0.92,
        evidence: [SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE, ...source.provenance.sourceRefs],
      }));
    }
    for (const prerequisite of theoryItem.prerequisites) {
      ontologyEdges.push(createOntologyEdge({
        courseId: question.courseId,
        fromType: "CONCEPT",
        fromId: conceptBySource.get(prerequisite).key,
        toType: "QUESTION",
        toId: question.id,
        relation: "PREREQUISITE_OF",
        confidence: 0.85,
        evidence: [SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE],
      }));
    }
  }
  return {
    sourceSummary,
    contents,
    courseLessons,
    questions,
    concepts,
    ontologyEdges: [...new Map(ontologyEdges.map((edge) => [edge.key, edge])).values()],
  };
}

function normalizeIntelligenceQuestionType(type) {
  if (["SINGLE_CHOICE", "CODE_ANALYSIS", "LOG_ANALYSIS", "ESSAY", "SHORT_ANSWER", "CALCULATION"].includes(type)) return type;
  return "CASE_ANALYSIS";
}

export function generateSecurityContentIntelligenceV3Sql({ dialect, actorId = "user-content-editor" }) {
  if (!new Set(["d1", "postgres"]).has(dialect)) throw new Error(`SECURITY_CONTENT_INTELLIGENCE_V3_DIALECT_INVALID:${dialect}`);
  const plan = buildSecurityContentIntelligenceV3Plan();
  const statements = [dialect === "postgres" ? "BEGIN;" : "BEGIN TRANSACTION;"];
  for (const content of plan.contents) statements.push(upsertContent(content, dialect, actorId));
  for (const lesson of plan.courseLessons) statements.push(upsertCourseLesson(lesson, dialect));
  for (const question of plan.questions) {
    statements.push(upsertQuestionWithSource(question, dialect, SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE, actorId));
    for (const choice of question.choices) statements.push(upsertChoice(choice, dialect));
  }
  statements.push(scopedQuestionRelationshipCleanup(plan.questions.map((question) => question.id)));
  for (const question of plan.questions) {
    statements.push(insertQuestionCourse(question, dialect));
    statements.push(insertQuestionSubject(question, dialect));
    statements.push(insertQuestionTopic(question, dialect));
    statements.push(insertContentQuestionLink(question, dialect));
    statements.push(insertQuestionVersion(question, dialect, actorId));
  }
  // Canonical concepts are prerequisites for this phase and are reused as-is.
  // V3 intelligence must not reset or mutate the shared concept dictionary.
  for (const edge of plan.ontologyEdges) statements.push(upsertOntologyEdge(edge, dialect));
  statements.push("COMMIT;");
  return `${statements.join("\n\n")}\n`;
}

function toContent(lesson) {
  const body = {
    overview: lesson.overview,
    keyPoints: lesson.keyPoints,
    practiceTip: lesson.practiceTip,
    fieldExample: lesson.fieldExample,
    relatedConcepts: lesson.relatedConcepts,
    provenance: {
      source: SECURITY_CONTENT_V3_SOURCE,
      sourceIds: lesson.source_refs,
      canonicalConcept: lesson.provenance?.canonicalConcept,
      reviewStatus: "DRAFT",
    },
  };
  return {
    id: lesson.id,
    slug: lesson.id,
    canonicalKey: `securium.content-v3.${slug(lesson.concepts[0])}`,
    title: lesson.title,
    summary: lesson.overview,
    body: JSON.stringify(body),
    learningObjectives: lesson.learningObjectives ?? [],
    coreConcepts: [SECURITY_CONTENT_V3_CONCEPT_MAP[lesson.concepts[0]].label],
    practicalExamples: [lesson.fieldExample].filter(Boolean),
  };
}

function toCourseLesson(lesson, index) {
  const mapping = SECURITY_CONTENT_V3_CONCEPT_MAP[lesson.concepts[0]];
  return {
    id: courseLessonId(lesson),
    courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
    courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
    curriculumNodeId: mapping.curriculumNodeId,
    contentId: lesson.id,
    displayTitle: lesson.title,
    sortOrder: 9000 + index,
    difficulty: difficulty(lesson.difficulty),
  };
}

function toQuestion(question, examTrack) {
  const mapping = SECURITY_CONTENT_V3_CONCEPT_MAP[question.concepts[0]];
  const choices = (question.choices ?? []).map((content, index) => ({
    id: `${question.id}-choice-${String(index + 1).padStart(2, "0")}`,
    questionId: question.id,
    content,
    displayOrder: index + 1,
    isCorrect: index === question.answer_index,
    explanation:
      index === question.answer_index
        ? "시나리오의 핵심 통제 목적과 직접 연결된다."
        : "문제의 신뢰 경계 또는 통제 범위를 충족하지 못한다.",
  }));
  return {
    id: question.id,
    title: question.title ?? `${mapping.label} 적용 판단`,
    content: question.prompt,
    type: questionType(question.type),
    difficulty: difficulty(question.difficulty),
    explanation: question.explanation ?? "",
    wrongAnswerExplanation: "오답은 요구된 보안 판단 범위와 맞지 않거나 통제 효과를 과대평가한다.",
    answerConfig: {
      answerIndex: question.answer_index,
      answerOutline: question.answer_outline ?? [],
      examTrack,
      provenance: {
        source: SECURITY_CONTENT_V3_SOURCE,
        sourceIds: question.source_refs,
        reviewStatus: "DRAFT",
      },
    },
    choices,
    courseId: SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
    sourceConcept: question.concepts[0],
    contentId: `sec-upgrade-lesson-${slug(question.concepts[0])}`,
    subjectId: mapping.subjectId,
    topicId: mapping.topicId,
    examTrack,
  };
}

function courseLessonId(lesson) {
  return `upgrade-course-lesson-${slug(lesson.concepts[0])}`;
}

function questionType(type) {
  const normalized = String(type).toUpperCase();
  if (normalized === "SINGLE_CHOICE") return normalized;
  if (normalized === "LOG_ANALYSIS") return normalized;
  if (["PRACTICAL", "NETWORK_ANALYSIS", "CONFIG_ANALYSIS"].includes(normalized)) {
    return "CASE_ANALYSIS";
  }
  return normalized;
}

function difficulty(value) {
  if (value <= 2) return "EASY";
  if (value >= 4) return "HARD";
  return "MEDIUM";
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}

function upsertContent(row, dialect, actorId) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("id") DO UPDATE SET
  "title"=EXCLUDED."title", "summary"=EXCLUDED."summary", "body"=EXCLUDED."body",
  "learning_objectives_json"=EXCLUDED."learning_objectives_json",
  "core_concepts_json"=EXCLUDED."core_concepts_json",
  "practical_examples_json"=EXCLUDED."practical_examples_json", "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("id") DO UPDATE SET
  "title"=excluded."title", "summary"=excluded."summary", "body"=excluded."body",
  "learning_objectives_json"=excluded."learning_objectives_json",
  "core_concepts_json"=excluded."core_concepts_json",
  "practical_examples_json"=excluded."practical_examples_json", "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "contents" ("id","slug","canonical_key","title","summary","body","body_format","learning_objectives_json","core_concepts_json","practical_examples_json","version","status","created_by") VALUES (${q(row.id)},${q(row.slug)},${q(row.canonicalKey)},${q(row.title)},${q(row.summary)},${q(row.body)},'STRUCTURED_JSON',${q(JSON.stringify(row.learningObjectives))},${q(JSON.stringify(row.coreConcepts))},${q(JSON.stringify(row.practicalExamples))},'3.0.0','DRAFT',${q(actorId)}) ${conflict};`;
}

function upsertCourseLesson(row, dialect) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("id") DO UPDATE SET "course_id"=EXCLUDED."course_id", "curriculum_node_id"=EXCLUDED."curriculum_node_id", "content_id"=EXCLUDED."content_id", "display_title"=EXCLUDED."display_title", "difficulty"=EXCLUDED."difficulty", "status"='DRAFT', "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("id") DO UPDATE SET "course_id"=excluded."course_id", "curriculum_node_id"=excluded."curriculum_node_id", "content_id"=excluded."content_id", "display_title"=excluded."display_title", "difficulty"=excluded."difficulty", "status"='DRAFT', "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "course_lessons" ("id","course_id","curriculum_node_id","content_id","lesson_id","display_title","sort_order","difficulty","importance","estimated_minutes","is_required","completion_rule","status") VALUES (${q(row.id)},${q(row.courseId ?? SECURITY_CONTENT_V3_SOURCE_COURSE_ID)},${q(row.curriculumNodeId)},${q(row.contentId)},NULL,${q(row.displayTitle)},${row.sortOrder},${q(row.difficulty)},70,15,0,'MANUAL','DRAFT') ${conflict};`;
}

function upsertQuestion(row, dialect, actorId) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "content"=EXCLUDED."content", "type"=EXCLUDED."type", "difficulty"=EXCLUDED."difficulty", "explanation"=EXCLUDED."explanation", "wrong_answer_explanation"=EXCLUDED."wrong_answer_explanation", "answer_config_json"=EXCLUDED."answer_config_json", "source"=EXCLUDED."source", "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("id") DO UPDATE SET "title"=excluded."title", "content"=excluded."content", "type"=excluded."type", "difficulty"=excluded."difficulty", "explanation"=excluded."explanation", "wrong_answer_explanation"=excluded."wrong_answer_explanation", "answer_config_json"=excluded."answer_config_json", "source"=excluded."source", "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "questions" ("id","title","content","type","difficulty","explanation","wrong_answer_explanation","status","source","version","answer_config_json","is_sample","created_by") VALUES (${q(row.id)},${q(row.title)},${q(row.content)},${q(row.type)},${q(row.difficulty)},${q(row.explanation)},${q(row.wrongAnswerExplanation)},'DRAFT',${q(SECURITY_CONTENT_V3_SOURCE)},1,${q(JSON.stringify(row.answerConfig))},0,${q(actorId)}) ${conflict};`;
}

function upsertQuestionWithSource(row, dialect, source, actorId) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "content"=EXCLUDED."content", "type"=EXCLUDED."type", "difficulty"=EXCLUDED."difficulty", "explanation"=EXCLUDED."explanation", "wrong_answer_explanation"=EXCLUDED."wrong_answer_explanation", "answer_config_json"=EXCLUDED."answer_config_json", "source"=EXCLUDED."source", "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("id") DO UPDATE SET "title"=excluded."title", "content"=excluded."content", "type"=excluded."type", "difficulty"=excluded."difficulty", "explanation"=excluded."explanation", "wrong_answer_explanation"=excluded."wrong_answer_explanation", "answer_config_json"=excluded."answer_config_json", "source"=excluded."source", "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "questions" ("id","title","content","type","difficulty","explanation","wrong_answer_explanation","status","source","version","answer_config_json","is_sample","created_by") VALUES (${q(row.id)},${q(row.title)},${q(row.content)},${q(row.type)},${q(row.difficulty)},${q(row.explanation)},${q(row.wrongAnswerExplanation)},'DRAFT',${q(source)},1,${q(JSON.stringify(row.answerConfig))},0,${q(actorId)}) ${conflict};`;
}

function upsertChoice(row, dialect) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("id") DO UPDATE SET "content"=EXCLUDED."content", "display_order"=EXCLUDED."display_order", "is_correct"=EXCLUDED."is_correct", "explanation"=EXCLUDED."explanation"` : `ON CONFLICT ("id") DO UPDATE SET "content"=excluded."content", "display_order"=excluded."display_order", "is_correct"=excluded."is_correct", "explanation"=excluded."explanation"`;
  return `INSERT INTO "question_choices" ("id","question_id","content","display_order","is_correct","explanation") VALUES (${q(row.id)},${q(row.questionId)},${q(row.content)},${row.displayOrder},${row.isCorrect ? 1 : 0},${q(row.explanation)}) ${conflict};`;
}

function scopedQuestionRelationshipCleanup(questionIds) {
  const ids = questionIds.map(q).join(",");
  return `DELETE FROM "question_subjects" WHERE "question_id" IN (${ids}) AND "subject_id" IN (SELECT "id" FROM "subjects" WHERE "course_id" IN ('course-ise','course-isie'));
DELETE FROM "question_topics" WHERE "question_id" IN (${ids}) AND "topic_id" IN (SELECT t."id" FROM "topics" t JOIN "subjects" s ON s."id"=t."subject_id" WHERE s."course_id" IN ('course-ise','course-isie'));
DELETE FROM "question_courses" WHERE "question_id" IN (${ids}) AND "course_id" IN ('course-ise','course-isie');`;
}

function insertQuestionCourse(row, dialect) {
  return `INSERT INTO "question_courses" ("question_id","course_id","weight") VALUES (${q(row.id)},${q(row.courseId ?? SECURITY_CONTENT_V3_SOURCE_COURSE_ID)},100) ${doNothing(dialect, '("question_id","course_id")')};`;
}

function insertQuestionSubject(row, dialect) {
  return `INSERT INTO "question_subjects" ("question_id","subject_id") VALUES (${q(row.id)},${q(row.subjectId)}) ${doNothing(dialect, '("question_id","subject_id")')};`;
}

function insertQuestionTopic(row, dialect) {
  return `INSERT INTO "question_topics" ("question_id","topic_id") VALUES (${q(row.id)},${q(row.topicId)}) ${doNothing(dialect, '("question_id","topic_id")')};`;
}

function insertContentQuestionLink(row, dialect) {
  const id = `content-v3-link-${row.id}`;
  return `INSERT INTO "content_question_links" ("id","content_type","content_id","question_id","relation_type") VALUES (${q(id)},'CONTENT',${q(row.contentId)},${q(row.id)},'PRACTICE') ${doNothing(dialect, '("content_type","content_id","question_id")')};`;
}

function insertQuestionVersion(row, dialect, actorId) {
  const snapshot = { id: row.id, type: row.type, difficulty: row.difficulty, examTrack: row.examTrack, courseIds: [row.courseId ?? SECURITY_CONTENT_V3_SOURCE_COURSE_ID], contentIds: [row.contentId] };
  return `INSERT INTO "question_versions" ("id","question_id","version","snapshot_json","review_comment","created_by") VALUES (${q(`version-${row.id}-v1`)},${q(row.id)},1,${q(JSON.stringify(snapshot))},'SECURIUM content upgrade V3 draft import',${q(actorId)}) ${doNothing(dialect, '("id")')};`;
}

function upsertOntologyConcept(concept, dialect) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("concept_key") DO UPDATE SET "label"=EXCLUDED."label", "normalized_label"=EXCLUDED."normalized_label", "category"=EXCLUDED."category", "weight"=EXCLUDED."weight", "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("concept_key") DO UPDATE SET "label"=excluded."label", "normalized_label"=excluded."normalized_label", "category"=excluded."category", "weight"=excluded."weight", "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "ontology_concepts" ("id","concept_key","namespace","label","normalized_label","category","source_type","source_id","weight","status") VALUES (${q(concept.key)},${q(concept.key)},${q(concept.namespace)},${q(concept.label)},${q(concept.normalizedLabel)},${q(concept.category)},${q(concept.sourceType)},${q(concept.sourceId)},${concept.weight},'DRAFT') ${conflict};`;
}

function upsertOntologyAlias(concept, alias, dialect) {
  const normalized = String(alias).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const id = `ontology-alias:${slug(concept.key)}:${slug(alias)}`;
  return `INSERT INTO "ontology_aliases" ("id","concept_id","alias","normalized_alias","language","source") VALUES (${q(id)},${q(concept.key)},${q(alias)},${q(normalized)},'und',${q(SECURITY_CONTENT_V3_SOURCE)}) ${doNothing(dialect, '("concept_id","normalized_alias")')};`;
}

function upsertOntologyEdge(edge, dialect) {
  const conflict = dialect === "postgres" ? `ON CONFLICT ("edge_key") DO UPDATE SET "confidence"=EXCLUDED."confidence", "evidence_json"=EXCLUDED."evidence_json", "status"=EXCLUDED."status", "updated_at"=CURRENT_TIMESTAMP::text` : `ON CONFLICT ("edge_key") DO UPDATE SET "confidence"=excluded."confidence", "evidence_json"=excluded."evidence_json", "status"=excluded."status", "updated_at"=CURRENT_TIMESTAMP`;
  return `INSERT INTO "ontology_edges" ("id","edge_key","course_id","from_type","from_id","to_type","to_id","relation","confidence","evidence_json","status") VALUES (${q(edge.key)},${q(edge.key)},${q(edge.courseId)},${q(edge.fromType)},${q(edge.fromId)},${q(edge.toType)},${q(edge.toId)},${q(edge.relation)},${Math.round(edge.confidence * 10000)},${q(JSON.stringify(edge.evidence))},'DRAFT') ${conflict};`;
}

function doNothing(dialect, target) {
  return dialect === "postgres" ? `ON CONFLICT ${target} DO NOTHING` : `ON CONFLICT ${target} DO NOTHING`;
}

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}
