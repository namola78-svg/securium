export const MANAGEMENT_LAW_CONTENT_ID =
  "content-official-security-cert-management-law-overview";

export const MANAGEMENT_LAW_COURSE_IDS = ["course-ise"];
export const MANAGEMENT_LAW_EXCLUDED_COURSE_IDS = ["course-isie"];
export const SECURITY_CERTIFICATION_MANAGEMENT_LAW_QUESTION_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_MANAGEMENT_LAW_QUESTION_SEED";
export const SECURITY_CERTIFICATION_MANAGEMENT_LAW_QUESTION_CONFIRM_ENV_VALUE =
  "APPLY_MANAGEMENT_LAW_QUESTION_SEED";

export const managementLawQuestionSamples = [
  {
    id: "management-law-official-sample-q01",
    title: "위험관리 절차의 핵심",
    content:
      "자산, 위협, 취약점을 식별하고 가능성과 영향도를 평가해 보호대책 우선순위를 정하는 활동은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "위험관리는 보호할 자산과 위험요인을 식별하고 평가하여 적절한 위험처리 방안을 정하는 관리 활동이다.",
    wrongAnswerExplanation:
      "단순 백업이나 암호화 설정은 위험관리 결과에 따라 선택될 수 있는 보호대책이지 절차 전체를 의미하지 않는다.",
    choices: [
      {
        id: "management-law-official-sample-q01-choice-01",
        content: "위험관리",
        displayOrder: 1,
        isCorrect: true,
        explanation: "위험 식별, 분석, 평가, 처리로 이어지는 관리 절차다.",
      },
      {
        id: "management-law-official-sample-q01-choice-02",
        content: "패킷 포워딩",
        displayOrder: 2,
        isCorrect: false,
        explanation: "패킷 전달은 네트워크 동작과 관련된 기술 개념이다.",
      },
      {
        id: "management-law-official-sample-q01-choice-03",
        content: "압축",
        displayOrder: 3,
        isCorrect: false,
        explanation: "압축은 데이터 크기를 줄이는 처리다.",
      },
      {
        id: "management-law-official-sample-q01-choice-04",
        content: "캐시",
        displayOrder: 4,
        isCorrect: false,
        explanation: "캐시는 성능 향상 목적의 저장 구조다.",
      },
    ],
  },
  {
    id: "management-law-official-sample-q02",
    title: "위험 수용의 의미",
    content:
      "위험 수용은 모든 위험을 즉시 제거하는 것이 아니라, 잔여위험을 조직이 정한 기준 안에서 받아들이는 처리 방식이다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "위험 수용은 비용, 영향도, 가능성, 조직의 위험 기준을 고려해 잔여위험을 받아들이는 결정이다.",
    wrongAnswerExplanation:
      "위험 수용은 위험이 없다는 뜻이 아니며 승인과 근거가 필요하다.",
    choices: [
      {
        id: "management-law-official-sample-q02-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "잔여위험을 기준 안에서 받아들이는 처리 방식이다.",
      },
      {
        id: "management-law-official-sample-q02-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "위험 수용은 위험 제거와 다르다.",
      },
    ],
  },
  {
    id: "management-law-official-sample-q03",
    title: "보호대책 유형",
    content:
      "정보보호 대책을 분류할 때 관리적·기술적·물리적 보호대책의 예로 적절한 것을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "보호대책은 정책과 절차 같은 관리적 대책, 접근통제와 암호화 같은 기술적 대책, 출입통제와 잠금장치 같은 물리적 대책으로 나눌 수 있다.",
    wrongAnswerExplanation:
      "업무 편의를 이유로 통제를 생략하는 것은 보호대책이 아니다.",
    choices: [
      {
        id: "management-law-official-sample-q03-choice-01",
        content: "정보보호 정책과 책임 배정",
        displayOrder: 1,
        isCorrect: true,
        explanation: "관리적 보호대책에 해당한다.",
      },
      {
        id: "management-law-official-sample-q03-choice-02",
        content: "접근통제와 암호화",
        displayOrder: 2,
        isCorrect: true,
        explanation: "기술적 보호대책에 해당한다.",
      },
      {
        id: "management-law-official-sample-q03-choice-03",
        content: "전산실 출입통제",
        displayOrder: 3,
        isCorrect: true,
        explanation: "물리적 보호대책에 해당한다.",
      },
      {
        id: "management-law-official-sample-q03-choice-04",
        content: "감사 편의를 위해 로그 기록 중단",
        displayOrder: 4,
        isCorrect: false,
        explanation: "로그 기록 중단은 보호대책이 아니라 위험을 키우는 조치다.",
      },
    ],
  },
  {
    id: "management-law-official-sample-q04",
    title: "침해사고 대응 순서",
    content:
      "침해사고 대응에서 사고 원인 분석과 재발방지 대책 수립은 탐지 이후의 중요한 절차다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    explanation:
      "침해사고 대응은 탐지와 접수, 분석, 차단과 복구, 보고, 재발방지로 이어지는 절차를 포함한다.",
    wrongAnswerExplanation:
      "탐지만 하고 원인 분석과 개선을 하지 않으면 같은 사고가 반복될 수 있다.",
    choices: [
      {
        id: "management-law-official-sample-q04-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "원인 분석과 재발방지는 사고대응의 핵심 후속 절차다.",
      },
      {
        id: "management-law-official-sample-q04-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "탐지 이후 분석과 개선이 필요하다.",
      },
    ],
  },
  {
    id: "management-law-official-sample-q05",
    title: "ISMS-P의 성격",
    content:
      "정보보호 및 개인정보보호 관리체계가 기준에 따라 수립·운영되는지 확인하는 인증제도를 대표하는 명칭을 쓰시오.",
    type: "SHORT_ANSWER",
    difficulty: "MEDIUM",
    explanation:
      "ISMS-P는 정보보호 및 개인정보보호 관리체계 인증으로, 관리체계 수립과 운영 여부를 기준에 따라 확인한다.",
    wrongAnswerExplanation:
      "단순 취약점 점검이나 특정 기술 인증과 구분해야 한다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["ISMS-P", "ISMSP", "정보보호 및 개인정보보호 관리체계 인증"],
      synonyms: ["정보보호관리체계 인증", "isms-p certification"],
      useRegex: false,
      partialCreditRules: [{ pattern: "ISMS|관리체계|인증", score: 50 }],
    },
  },
  {
    id: "management-law-official-sample-q06",
    title: "법규 학습의 기준일 관리",
    content:
      "정보보호 관련 법규 학습 콘텐츠를 관리할 때 필요한 항목을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "법규와 기준은 개정될 수 있으므로 기준일, 버전, 출처, 최신성 여부를 함께 관리해야 한다.",
    wrongAnswerExplanation:
      "법령과 기준은 변경 가능하므로 기준일 없이 고정된 사실처럼 표시해서는 안 된다.",
    choices: [
      {
        id: "management-law-official-sample-q06-choice-01",
        content: "기준일",
        displayOrder: 1,
        isCorrect: true,
        explanation: "내용이 어느 날짜 기준인지 표시해야 한다.",
      },
      {
        id: "management-law-official-sample-q06-choice-02",
        content: "버전",
        displayOrder: 2,
        isCorrect: true,
        explanation: "개정 전후 내용을 구분하는 데 필요하다.",
      },
      {
        id: "management-law-official-sample-q06-choice-03",
        content: "출처 또는 근거",
        displayOrder: 3,
        isCorrect: true,
        explanation: "검증 가능한 근거를 남겨야 한다.",
      },
      {
        id: "management-law-official-sample-q06-choice-04",
        content: "변경될 수 없다는 표시",
        displayOrder: 4,
        isCorrect: false,
        explanation: "법규와 기준은 개정될 수 있다.",
      },
    ],
  },
].map((question) => ({
  ...question,
  status: "PUBLISHED",
  source: "SECURIUM independently authored management law sample",
  sourceDate: "2026-08-03",
  sampleOnly: true,
  courseLinks: [{ courseId: "course-ise", weight: 110 }],
  contentLinks: [
    {
      contentType: "CONTENT",
      contentId: MANAGEMENT_LAW_CONTENT_ID,
      relationType: "PRACTICE",
    },
  ],
}));

export function getManagementLawQuestionBankReadiness() {
  const typeCounts = managementLawQuestionSamples.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    questionCount: managementLawQuestionSamples.length,
    courseCounts: {
      "course-ise": managementLawQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === "course-ise"),
      ).length,
      "course-isie": managementLawQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === "course-isie"),
      ).length,
    },
    typeCounts,
    contentLinkedCount: managementLawQuestionSamples.filter((question) =>
      question.contentLinks.some(
        (link) =>
          link.contentType === "CONTENT" &&
          link.contentId === MANAGEMENT_LAW_CONTENT_ID,
      ),
    ).length,
    allPublished: managementLawQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: managementLawQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored: managementLawQuestionSamples.every((question) =>
      question.source.includes("SECURIUM independently authored"),
    ),
    allLinkedToEngineerCourseOnly: managementLawQuestionSamples.every(
      (question) =>
        question.courseLinks.length === 1 &&
        question.courseLinks[0].courseId === "course-ise",
    ),
    leaksToIndustrialEngineer: managementLawQuestionSamples.some((question) =>
      question.courseLinks.some((link) => link.courseId === "course-isie"),
    ),
    allLinkedToManagementContent: managementLawQuestionSamples.every((question) =>
      question.contentLinks.some(
        (link) =>
          link.contentType === "CONTENT" &&
          link.contentId === MANAGEMENT_LAW_CONTENT_ID,
      ),
    ),
  };
}

export function toManagementLawGradingQuestion(question) {
  return {
    type: question.type,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      content: choice.content,
      isCorrect: choice.isCorrect,
    })),
    answerConfig: question.answerConfig,
  };
}

export function generateManagementLawQuestionSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statements = [
    insertSeedMigrationSql(dialect),
    ...managementLawQuestionSamples.flatMap((question) => [
      insertQuestionSql(question, dialect),
      ...question.choices.map((choice) => insertChoiceSql(question, choice, dialect)),
      ...question.courseLinks.map((courseLink) =>
        insertCourseLinkSql(question, courseLink, dialect),
      ),
      ...question.contentLinks.map((contentLink, index) =>
        insertContentQuestionLinkSql(question, contentLink, index, dialect),
      ),
      insertQuestionVersionSql(question, dialect),
    ]),
  ];

  const body = statements.join("\n\n");
  return dialect === "postgres" ? `BEGIN;\n\n${body}\n\nCOMMIT;\n` : `${body}\n`;
}

function insertSeedMigrationSql(dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict = dialect === "d1" ? "" : `\nON CONFLICT ("id") DO NOTHING`;
  return `
${insert} INTO "schema_migrations" ("id", "name", "checksum", "applied_at")
VALUES (
  'seed_management_law_questions_2027_2029',
  'seed_management_law_questions_2027_2029',
  'manual-management-law-questions-2027-2029',
  ${nowExpression(dialect)}
)
${conflict};`.trim();
}

function insertQuestionSql(question, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "type" = EXCLUDED."type",
  "difficulty" = EXCLUDED."difficulty",
  "explanation" = EXCLUDED."explanation",
  "wrong_answer_explanation" = EXCLUDED."wrong_answer_explanation",
  "status" = EXCLUDED."status",
  "source" = EXCLUDED."source",
  "source_date" = EXCLUDED."source_date",
  "is_sample" = EXCLUDED."is_sample",
  "answer_config" = EXCLUDED."answer_config",
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "questions" (
  "id", "title", "content", "type", "difficulty", "explanation",
  "wrong_answer_explanation", "status", "source", "source_date", "version",
  "created_by", "reviewed_by", "published_at", "is_sample", "answer_config"
)
VALUES (
  ${q(question.id)},
  ${q(question.title)},
  ${q(question.content)},
  ${q(question.type)},
  ${q(question.difficulty)},
  ${q(question.explanation)},
  ${q(question.wrongAnswerExplanation)},
  ${q(question.status)},
  ${q(question.source)},
  ${q(question.sourceDate)},
  1,
  'user-admin',
  'user-content-reviewer',
  ${nowExpression(dialect)},
  1,
  ${q(JSON.stringify(question.answerConfig ?? null))}
)
${conflict};`.trim();
}

function insertChoiceSql(question, choice, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO UPDATE SET
  "content" = EXCLUDED."content",
  "display_order" = EXCLUDED."display_order",
  "is_correct" = EXCLUDED."is_correct",
  "explanation" = EXCLUDED."explanation"`;

  return `
${insert} INTO "question_choices" (
  "id", "question_id", "content", "display_order", "is_correct", "explanation"
)
VALUES (
  ${q(choice.id)},
  ${q(question.id)},
  ${q(choice.content)},
  ${choice.displayOrder},
  ${choice.isCorrect ? 1 : 0},
  ${q(choice.explanation)}
)
${conflict};`.trim();
}

function insertCourseLinkSql(question, courseLink, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const id = `management-law-course-link-${question.id}-${courseLink.courseId}`;
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("question_id", "course_id") DO UPDATE SET
  "weight" = EXCLUDED."weight"`;

  return `
${insert} INTO "question_courses" ("id", "question_id", "course_id", "weight")
VALUES (${q(id)}, ${q(question.id)}, ${q(courseLink.courseId)}, ${courseLink.weight})
${conflict};`.trim();
}

function insertContentQuestionLinkSql(question, contentLink, index, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const id = `management-law-content-link-${question.id}-${index + 1}`;
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("content_type", "content_id", "question_id") DO UPDATE SET
  "relation_type" = EXCLUDED."relation_type",
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "content_question_links" (
  "id", "content_type", "content_id", "question_id", "relation_type"
)
VALUES (
  ${q(id)},
  ${q(contentLink.contentType)},
  ${q(contentLink.contentId)},
  ${q(question.id)},
  ${q(contentLink.relationType)}
)
${conflict};`.trim();
}

function insertQuestionVersionSql(question, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const versionId = `version-${question.id}-v1`;
  const snapshot = {
    id: question.id,
    title: question.title,
    type: question.type,
    difficulty: question.difficulty,
    sampleOnly: question.sampleOnly,
    sourceDate: question.sourceDate,
    contentId: MANAGEMENT_LAW_CONTENT_ID,
    courseIds: question.courseLinks.map((link) => link.courseId),
  };
  const conflict = dialect === "d1" ? "" : `\nON CONFLICT ("id") DO NOTHING`;

  return `
${insert} INTO "question_versions" (
  "id", "question_id", "version", "snapshot_json", "review_comment", "created_by"
)
VALUES (
  ${q(versionId)},
  ${q(question.id)},
  1,
  ${q(JSON.stringify(snapshot))},
  'SECURIUM independently authored management law sample seed',
  'user-admin'
)
${conflict};`.trim();
}

function nowExpression(dialect) {
  return dialect === "postgres" ? "CURRENT_TIMESTAMP::text" : "CURRENT_TIMESTAMP";
}

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}
