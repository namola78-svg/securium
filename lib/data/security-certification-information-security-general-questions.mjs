export const INFORMATION_SECURITY_GENERAL_CONTENT_ID =
  "content-official-security-cert-information-security-general-overview";

export const INFORMATION_SECURITY_GENERAL_COURSE_IDS = [
  "course-ise",
  "course-isie",
];
export const SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_INFORMATION_SECURITY_GENERAL_QUESTION_SEED";
export const SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_VALUE =
  "APPLY_INFORMATION_SECURITY_GENERAL_QUESTION_SEED";

export const securityCertificationInformationSecurityGeneralQuestionSamples = [
  {
    id: "information-security-general-official-sample-q01",
    title: "인증과 인가의 차이",
    content:
      "사용자의 신원을 확인한 뒤 해당 사용자가 특정 관리자 기능을 실행할 수 있는지 판단하는 단계는 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "인증은 신원을 확인하는 단계이고, 인가 또는 접근통제는 인증된 주체가 특정 자원이나 기능을 사용할 수 있는지 결정하는 단계다.",
    wrongAnswerExplanation:
      "비밀번호 확인은 인증에 해당하지만, 기능 실행 허용 여부 판단은 인가와 접근통제의 영역이다.",
    choices: [
      {
        id: "information-security-general-official-sample-q01-choice-01",
        content: "인가",
        displayOrder: 1,
        isCorrect: true,
        explanation: "인가 단계에서 권한과 정책에 따라 허용 여부를 판단한다.",
      },
      {
        id: "information-security-general-official-sample-q01-choice-02",
        content: "백업",
        displayOrder: 2,
        isCorrect: false,
        explanation: "백업은 가용성과 복구를 위한 통제다.",
      },
      {
        id: "information-security-general-official-sample-q01-choice-03",
        content: "난독화",
        displayOrder: 3,
        isCorrect: false,
        explanation: "난독화는 코드나 데이터 이해를 어렵게 하는 기법이다.",
      },
      {
        id: "information-security-general-official-sample-q01-choice-04",
        content: "압축",
        displayOrder: 4,
        isCorrect: false,
        explanation: "압축은 데이터 크기를 줄이는 처리다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
  {
    id: "information-security-general-official-sample-q02",
    title: "최소권한 원칙",
    content:
      "최소권한 원칙은 업무 수행에 필요한 범위를 넘는 권한을 부여하지 않는 접근통제 원칙이다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "최소권한은 침해나 오남용이 발생했을 때 피해 범위를 줄이기 위한 기본 접근통제 원칙이다.",
    wrongAnswerExplanation:
      "모든 사용자에게 관리자 권한을 주는 방식은 최소권한 원칙과 반대다.",
    choices: [
      {
        id: "information-security-general-official-sample-q02-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "필요한 권한만 부여하는 것이 최소권한 원칙이다.",
      },
      {
        id: "information-security-general-official-sample-q02-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "업무 범위를 넘는 권한 부여는 최소권한 원칙에 어긋난다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 100 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
  {
    id: "information-security-general-official-sample-q03",
    title: "전자서명의 보안 목적",
    content:
      "전자서명이 주로 제공하는 보안 속성을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "전자서명은 개인키로 서명하고 공개키로 검증하여 무결성, 송신자 인증, 부인방지를 지원한다.",
    wrongAnswerExplanation:
      "전자서명 자체가 메시지 내용을 자동으로 암호화해 기밀성을 제공하는 것은 아니다.",
    choices: [
      {
        id: "information-security-general-official-sample-q03-choice-01",
        content: "무결성",
        displayOrder: 1,
        isCorrect: true,
        explanation: "서명 검증 실패는 데이터 변경 가능성을 보여준다.",
      },
      {
        id: "information-security-general-official-sample-q03-choice-02",
        content: "송신자 인증",
        displayOrder: 2,
        isCorrect: true,
        explanation: "개인키 소유자와 공개키 인증서를 통해 송신자를 확인한다.",
      },
      {
        id: "information-security-general-official-sample-q03-choice-03",
        content: "부인방지",
        displayOrder: 3,
        isCorrect: true,
        explanation: "서명자는 서명 사실을 부인하기 어렵다.",
      },
      {
        id: "information-security-general-official-sample-q03-choice-04",
        content: "평문 자동 압축",
        displayOrder: 4,
        isCorrect: false,
        explanation: "압축은 전자서명의 보안 속성이 아니다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
  {
    id: "information-security-general-official-sample-q04",
    title: "해시함수의 핵심 성질",
    content:
      "임의 길이 입력을 고정 길이 값으로 변환하며 무결성 검증에 활용되는 함수는 무엇인가?",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    explanation:
      "해시함수는 입력을 고정 길이 해시값으로 변환하며, 데이터 변경 여부 확인과 MAC, 전자서명 전처리 등에 활용된다.",
    wrongAnswerExplanation:
      "암호화는 복호화를 전제로 하지만, 일반적인 해시함수는 일방향성을 가진다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["해시함수", "해시 함수", "해시"],
      synonyms: ["hash", "hash function"],
      useRegex: false,
      partialCreditRules: [{ pattern: "digest|다이제스트|무결성", score: 50 }],
    },
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
  {
    id: "information-security-general-official-sample-q05",
    title: "접근통제 모델 구분",
    content:
      "역할을 기준으로 사용자에게 권한을 부여하는 접근통제 모델로 가장 적절한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "RBAC는 사용자에게 직접 권한을 부여하기보다 역할에 권한을 연결하고 사용자를 역할에 배정하는 방식이다.",
    wrongAnswerExplanation:
      "MAC은 보안등급과 강제 정책, DAC은 소유자 기반 허가와 관련이 깊다.",
    choices: [
      {
        id: "information-security-general-official-sample-q05-choice-01",
        content: "RBAC",
        displayOrder: 1,
        isCorrect: true,
        explanation: "역할 기반 접근통제 모델이다.",
      },
      {
        id: "information-security-general-official-sample-q05-choice-02",
        content: "RAID",
        displayOrder: 2,
        isCorrect: false,
        explanation: "RAID는 저장장치 구성 방식이다.",
      },
      {
        id: "information-security-general-official-sample-q05-choice-03",
        content: "NAT",
        displayOrder: 3,
        isCorrect: false,
        explanation: "NAT는 주소 변환 기술이다.",
      },
      {
        id: "information-security-general-official-sample-q05-choice-04",
        content: "DNS",
        displayOrder: 4,
        isCorrect: false,
        explanation: "DNS는 이름 해석 서비스다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
  {
    id: "information-security-general-official-sample-q06",
    title: "암호 기술 적용 위치",
    content:
      "보안 목적과 암호 기술의 연결로 적절한 것을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "기밀성은 암호화, 무결성은 해시 또는 MAC, 부인방지는 전자서명과 연결해 이해해야 한다.",
    wrongAnswerExplanation:
      "해시값만으로 평문을 복호화하거나 전자서명만으로 자동 기밀성을 제공한다고 보면 안 된다.",
    choices: [
      {
        id: "information-security-general-official-sample-q06-choice-01",
        content: "기밀성 보호에는 암호화를 활용할 수 있다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "암호화는 인가되지 않은 열람을 막는 데 사용된다.",
      },
      {
        id: "information-security-general-official-sample-q06-choice-02",
        content: "무결성 확인에는 해시 또는 MAC을 활용할 수 있다.",
        displayOrder: 2,
        isCorrect: true,
        explanation: "변경 여부와 인증된 무결성 확인에 활용된다.",
      },
      {
        id: "information-security-general-official-sample-q06-choice-03",
        content: "부인방지에는 전자서명을 활용할 수 있다.",
        displayOrder: 3,
        isCorrect: true,
        explanation: "개인키 기반 서명은 부인방지에 활용된다.",
      },
      {
        id: "information-security-general-official-sample-q06-choice-04",
        content: "해시값을 이용하면 항상 원문을 복구할 수 있다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "일반적인 해시함수는 일방향성을 가진다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 110 },
      { courseId: "course-isie", weight: 100 },
    ],
  },
].map((question) => ({
  ...question,
  status: "PUBLISHED",
  source: "SECURIUM independently authored information security general sample",
  sourceDate: "2026-08-03",
  sampleOnly: true,
  contentLinks: [
    {
      contentType: "CONTENT",
      contentId: INFORMATION_SECURITY_GENERAL_CONTENT_ID,
      relationType: "PRACTICE",
    },
  ],
}));

export function getInformationSecurityGeneralQuestionBankReadiness() {
  const courseCounts = Object.fromEntries(
    INFORMATION_SECURITY_GENERAL_COURSE_IDS.map((courseId) => [
      courseId,
      securityCertificationInformationSecurityGeneralQuestionSamples.filter(
        (question) =>
          question.courseLinks.some((link) => link.courseId === courseId),
      ).length,
    ]),
  );
  const typeCounts =
    securityCertificationInformationSecurityGeneralQuestionSamples.reduce(
      (counts, question) => {
        counts[question.type] = (counts[question.type] ?? 0) + 1;
        return counts;
      },
      {},
    );

  return {
    questionCount:
      securityCertificationInformationSecurityGeneralQuestionSamples.length,
    courseCounts,
    typeCounts,
    contentLinkedCount:
      securityCertificationInformationSecurityGeneralQuestionSamples.filter(
        (question) =>
          question.contentLinks.some(
            (link) =>
              link.contentType === "CONTENT" &&
              link.contentId === INFORMATION_SECURITY_GENERAL_CONTENT_ID,
          ),
      ).length,
    allPublished: securityCertificationInformationSecurityGeneralQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: securityCertificationInformationSecurityGeneralQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored:
      securityCertificationInformationSecurityGeneralQuestionSamples.every(
        (question) => question.source.includes("SECURIUM independently authored"),
      ),
    allLinkedToBothCourses:
      securityCertificationInformationSecurityGeneralQuestionSamples.every(
        (question) =>
          INFORMATION_SECURITY_GENERAL_COURSE_IDS.every((courseId) =>
            question.courseLinks.some((link) => link.courseId === courseId),
          ),
      ),
    allLinkedToGeneralContent:
      securityCertificationInformationSecurityGeneralQuestionSamples.every(
        (question) =>
          question.contentLinks.some(
            (link) =>
              link.contentType === "CONTENT" &&
              link.contentId === INFORMATION_SECURITY_GENERAL_CONTENT_ID,
          ),
      ),
  };
}

export function toInformationSecurityGeneralGradingQuestion(question) {
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

export function generateInformationSecurityGeneralQuestionSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statements = [
    insertSeedMigrationSql(dialect),
    ...securityCertificationInformationSecurityGeneralQuestionSamples.flatMap(
      (question) => [
        insertQuestionSql(question, dialect),
        ...question.choices.map((choice) =>
          insertChoiceSql(question, choice, dialect),
        ),
        ...question.courseLinks.map((courseLink) =>
          insertCourseLinkSql(question, courseLink, dialect),
        ),
        ...question.contentLinks.map((contentLink, index) =>
          insertContentQuestionLinkSql(question, contentLink, index, dialect),
        ),
        insertQuestionVersionSql(question, dialect),
      ],
    ),
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
  'seed_information_security_general_questions_2027_2029',
  'seed_information_security_general_questions_2027_2029',
  'manual-information-security-general-questions-2027-2029',
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
  const id = `information-security-general-course-link-${question.id}-${courseLink.courseId}`;
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
  const id = `information-security-general-content-link-${question.id}-${index + 1}`;
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
    contentId: INFORMATION_SECURITY_GENERAL_CONTENT_ID,
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
  'SECURIUM independently authored information security general sample seed',
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
