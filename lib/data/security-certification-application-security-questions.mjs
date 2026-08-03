export const APPLICATION_SECURITY_CONTENT_ID =
  "content-official-security-cert-application-security-overview";

export const APPLICATION_SECURITY_COURSE_IDS = ["course-ise", "course-isie"];

export const APPLICATION_SECURITY_SUBITEM_CONTENT_IDS = [
  "content-official-security-cert-application-ftp-security",
  "content-official-security-cert-application-mail-security",
  "content-official-security-cert-application-web-app-security",
  "content-official-security-cert-application-dns-security",
  "content-official-security-cert-application-db-security",
  "content-official-security-cert-application-application-weakness-response",
  "content-official-security-cert-application-secure-development-overview",
];

export const SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_APPLICATION_SECURITY_QUESTION_SEED";
export const SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_VALUE =
  "APPLY_APPLICATION_SECURITY_QUESTION_SEED";

function contentPracticeLinks(contentIds) {
  return [APPLICATION_SECURITY_CONTENT_ID, ...contentIds].map((contentId) => ({
    contentType: "CONTENT",
    contentId,
    relationType: "PRACTICE",
  }));
}

export const applicationSecurityQuestionSamples = [
  {
    id: "application-security-official-sample-q01",
    title: "SQL 삽입 방어의 핵심 원칙",
    content:
      "사용자가 입력한 검색어가 SQL 조건절에 포함되는 기능에서 SQL 삽입 위험을 줄이는 가장 직접적인 보안 대책은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "SQL 삽입은 입력값이 SQL 구조로 해석될 때 발생하므로, 바인딩 변수나 ORM의 안전한 파라미터 처리 기능을 사용해야 한다.",
    wrongAnswerExplanation:
      "입력 길이 제한이나 화면 메시지 변경만으로는 SQL 구조 변조를 안정적으로 막을 수 없다.",
    choices: [
      {
        id: "application-security-official-sample-q01-choice-01",
        content: "바인딩 변수 또는 안전한 파라미터 처리 사용",
        displayOrder: 1,
        isCorrect: true,
        explanation: "SQL 구조와 입력 데이터를 분리하는 핵심 대책이다.",
      },
      {
        id: "application-security-official-sample-q01-choice-02",
        content: "검색어 최대 길이만 20자로 제한",
        displayOrder: 2,
        isCorrect: false,
        explanation: "일부 공격 문자열을 줄일 수는 있지만 근본 대책은 아니다.",
      },
      {
        id: "application-security-official-sample-q01-choice-03",
        content: "오류 메시지를 사용자에게 자세히 표시",
        displayOrder: 3,
        isCorrect: false,
        explanation: "오히려 내부 구조 노출 위험이 커질 수 있다.",
      },
      {
        id: "application-security-official-sample-q01-choice-04",
        content: "검색 결과를 많이 보여주지 않도록 페이지 크기 축소",
        displayOrder: 4,
        isCorrect: false,
        explanation: "조회량 제어와 SQL 삽입 방어는 별개의 통제다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 110 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-web-app-security",
      "content-official-security-cert-application-application-weakness-response",
      "content-official-security-cert-application-secure-development-overview",
    ],
  },
  {
    id: "application-security-official-sample-q02",
    title: "XSS와 출력 인코딩",
    content:
      "사용자 입력을 HTML 화면에 다시 표시할 때 스크립트 실행을 막기 위해 출력 위치에 맞는 인코딩을 적용해야 한다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "XSS 방어에서는 입력값 검증과 함께 HTML, 속성, JavaScript, URL 등 출력 문맥에 맞는 인코딩이 중요하다.",
    wrongAnswerExplanation:
      "출력 인코딩 없이 입력값만 신뢰하면 저장형 또는 반사형 XSS가 발생할 수 있다.",
    choices: [
      {
        id: "application-security-official-sample-q02-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "출력 문맥별 인코딩은 XSS 방어의 기본 통제다.",
      },
      {
        id: "application-security-official-sample-q02-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "출력 인코딩을 생략하면 브라우저에서 스크립트로 해석될 수 있다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-web-app-security",
      "content-official-security-cert-application-application-weakness-response",
      "content-official-security-cert-application-secure-development-overview",
    ],
  },
  {
    id: "application-security-official-sample-q03",
    title: "안전한 파일 업로드 점검 항목",
    content:
      "웹 서비스의 파일 업로드 기능을 점검할 때 필요한 보안 통제를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "파일 업로드는 확장자와 MIME 검증, 크기 제한, 서버 생성 저장 키, 실행 권한 차단 등을 함께 적용해야 한다.",
    wrongAnswerExplanation:
      "사용자 파일명을 그대로 신뢰하거나 업로드 경로에서 실행을 허용하면 웹셸 등으로 이어질 수 있다.",
    choices: [
      {
        id: "application-security-official-sample-q03-choice-01",
        content: "허용 확장자와 MIME type을 함께 검증한다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "두 기준을 함께 확인해야 우회 가능성을 줄일 수 있다.",
      },
      {
        id: "application-security-official-sample-q03-choice-02",
        content: "서버가 생성한 저장 키를 사용하고 경로 조작을 차단한다.",
        displayOrder: 2,
        isCorrect: true,
        explanation: "사용자 파일명만으로 저장 경로를 만들면 경로 조작 위험이 생긴다.",
      },
      {
        id: "application-security-official-sample-q03-choice-03",
        content: "업로드 저장소에서 스크립트 실행을 차단한다.",
        displayOrder: 3,
        isCorrect: true,
        explanation: "실행 가능한 위치에 저장하면 업로드 파일이 코드로 동작할 수 있다.",
      },
      {
        id: "application-security-official-sample-q03-choice-04",
        content: "사용자 파일명이 익숙하면 별도 검증을 생략한다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "파일명은 신뢰할 수 없는 입력이다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-web-app-security",
      "content-official-security-cert-application-application-weakness-response",
      "content-official-security-cert-application-secure-development-overview",
    ],
  },
  {
    id: "application-security-official-sample-q04",
    title: "DNS 보안 설정",
    content:
      "DNS 서버 운영에서 외부 노출 시 특히 제한해야 하는 항목으로 가장 적절한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "DNS 영역 전송은 도메인 내부 구조와 중요 레코드를 노출할 수 있으므로 허가된 보조 DNS 등으로 제한해야 한다.",
    wrongAnswerExplanation:
      "정상 질의 응답 자체를 모두 막는 것은 서비스 운영 목적과 맞지 않는다.",
    choices: [
      {
        id: "application-security-official-sample-q04-choice-01",
        content: "영역 전송을 허가된 대상에게만 제한",
        displayOrder: 1,
        isCorrect: true,
        explanation: "영역 전송 노출은 내부 구조 정보 수집에 악용될 수 있다.",
      },
      {
        id: "application-security-official-sample-q04-choice-02",
        content: "모든 DNS 질의를 무조건 차단",
        displayOrder: 2,
        isCorrect: false,
        explanation: "공개 DNS 서비스 목적과 맞지 않는 과도한 조치다.",
      },
      {
        id: "application-security-official-sample-q04-choice-03",
        content: "모든 레코드 TTL을 0으로 설정",
        displayOrder: 3,
        isCorrect: false,
        explanation: "캐시 정책과 가용성에 영향을 주며 핵심 보안 대책은 아니다.",
      },
      {
        id: "application-security-official-sample-q04-choice-04",
        content: "관리자 비밀번호를 DNS 레코드에 기록",
        displayOrder: 4,
        isCorrect: false,
        explanation: "민감정보를 DNS에 저장해서는 안 된다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-dns-security",
    ],
  },
  {
    id: "application-security-official-sample-q05",
    title: "DB 보안의 기본 통제",
    content:
      "애플리케이션 DB 계정과 중요 데이터 보호를 위해 적용할 수 있는 통제를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "DB 보안은 최소권한, 중요 데이터 암호화, 감사 로그와 접근 경로 통제를 함께 적용해야 한다.",
    wrongAnswerExplanation:
      "편의를 이유로 권한을 과도하게 부여하면 침해 시 피해 범위가 커진다.",
    choices: [
      {
        id: "application-security-official-sample-q05-choice-01",
        content: "애플리케이션 계정에 필요한 권한만 부여",
        displayOrder: 1,
        isCorrect: true,
        explanation: "최소권한 원칙은 DB 계정에도 적용된다.",
      },
      {
        id: "application-security-official-sample-q05-choice-02",
        content: "중요 데이터 암호화와 키 관리",
        displayOrder: 2,
        isCorrect: true,
        explanation: "저장 데이터 보호와 키 분리는 중요 통제다.",
      },
      {
        id: "application-security-official-sample-q05-choice-03",
        content: "접근 및 변경 작업 감사 로그 기록",
        displayOrder: 3,
        isCorrect: true,
        explanation: "사후 분석과 책임 추적을 위해 필요하다.",
      },
      {
        id: "application-security-official-sample-q05-choice-04",
        content: "운영 편의를 위해 모든 계정에 DBA 권한 부여",
        displayOrder: 4,
        isCorrect: false,
        explanation: "과도한 권한 부여는 기본 보안 원칙에 어긋난다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 110 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-db-security",
    ],
  },
  {
    id: "application-security-official-sample-q06",
    title: "XSS 방어 핵심 용어",
    content:
      "사용자 입력을 HTML에 표시하기 전에 문맥에 맞게 안전한 문자 표현으로 바꾸는 XSS 방어 기법을 쓰시오.",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    explanation:
      "출력 인코딩은 사용자 입력이 브라우저에서 HTML이나 스크립트로 실행되지 않도록 표현을 변환하는 기법이다.",
    wrongAnswerExplanation:
      "입력 검증만으로 모든 출력 문맥의 스크립트 실행 위험을 제거하기 어렵다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["출력 인코딩", "출력인코딩", "인코딩"],
      synonyms: ["output encoding", "html encoding", "escaping"],
      useRegex: false,
      partialCreditRules: [{ pattern: "encoding|escape|이스케이프", score: 50 }],
    },
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-web-app-security",
      "content-official-security-cert-application-application-weakness-response",
      "content-official-security-cert-application-secure-development-overview",
    ],
  },
  {
    id: "application-security-official-sample-q07",
    title: "FTP 서비스 보안 설정",
    content:
      "FTP 서비스를 외부에 제공할 때 평문 인증과 과도한 디렉터리 접근 권한을 줄이기 위한 조치로 가장 적절한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "FTP 보안에서는 SFTP 또는 FTPS 같은 보호된 전송 방식, 계정별 최소권한, 업로드·다운로드 범위 제한과 접속 로그 점검이 중요하다.",
    wrongAnswerExplanation:
      "익명 접근이나 전체 디렉터리 쓰기 권한은 파일 유출·변조·악성 파일 업로드 위험을 키운다.",
    choices: [
      {
        id: "application-security-official-sample-q07-choice-01",
        content: "SFTP 또는 FTPS 사용과 계정별 최소권한 적용",
        displayOrder: 1,
        isCorrect: true,
        explanation: "전송 구간 보호와 접근권한 통제를 함께 적용하는 기본 조치다.",
      },
      {
        id: "application-security-official-sample-q07-choice-02",
        content: "모든 사용자의 익명 쓰기 권한 허용",
        displayOrder: 2,
        isCorrect: false,
        explanation: "익명 쓰기 권한은 무단 업로드와 변조 위험을 만든다.",
      },
      {
        id: "application-security-official-sample-q07-choice-03",
        content: "운영 편의를 위해 접속 로그를 남기지 않음",
        displayOrder: 3,
        isCorrect: false,
        explanation: "접속 로그는 침해 흔적 확인과 책임 추적에 필요하다.",
      },
      {
        id: "application-security-official-sample-q07-choice-04",
        content: "계정 비밀번호를 공유 문서에 보관",
        displayOrder: 4,
        isCorrect: false,
        explanation: "공유 문서에 인증정보를 보관하면 계정 탈취 위험이 높아진다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-ftp-security",
    ],
  },
  {
    id: "application-security-official-sample-q08",
    title: "메일 릴레이 제한",
    content:
      "메일 서버가 외부에서 무단 릴레이에 악용되지 않도록 허가된 발신 주체와 인증 정책을 제한해야 한다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "무단 릴레이는 스팸 발송과 평판 하락, 차단 목록 등록으로 이어질 수 있으므로 인증, 허용 네트워크, SPF·DKIM·DMARC 등과 함께 관리해야 한다.",
    wrongAnswerExplanation:
      "메일 릴레이를 무제한 허용하면 외부 공격자가 서버를 스팸 발송 경유지로 악용할 수 있다.",
    choices: [
      {
        id: "application-security-official-sample-q08-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "릴레이 제한과 발신자 위조 방지 설정은 메일 보안의 핵심 통제다.",
      },
      {
        id: "application-security-official-sample-q08-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "무단 릴레이 허용은 외부 악용 위험이 크다.",
      },
    ],
    courseLinks: [
      { courseId: "course-ise", weight: 105 },
      { courseId: "course-isie", weight: 100 },
    ],
    subItemContentIds: [
      "content-official-security-cert-application-mail-security",
    ],
  },
].map((question) => ({
  ...question,
  status: "PUBLISHED",
  source: "SECURIUM independently authored application security sample",
  sourceDate: "2026-08-03",
  sampleOnly: true,
  contentLinks: contentPracticeLinks(question.subItemContentIds ?? []),
}));

export function getApplicationSecurityQuestionBankReadiness() {
  const courseCounts = Object.fromEntries(
    APPLICATION_SECURITY_COURSE_IDS.map((courseId) => [
      courseId,
      applicationSecurityQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ).length,
    ]),
  );
  const typeCounts = applicationSecurityQuestionSamples.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    questionCount: applicationSecurityQuestionSamples.length,
    courseCounts,
    typeCounts,
    contentLinkedCount: applicationSecurityQuestionSamples.filter((question) =>
      question.contentLinks.some(
        (link) =>
          link.contentType === "CONTENT" &&
          link.contentId === APPLICATION_SECURITY_CONTENT_ID,
      ),
    ).length,
    subItemContentLinkedCount: new Set(
      applicationSecurityQuestionSamples.flatMap((question) =>
        question.contentLinks
          .filter((link) =>
            APPLICATION_SECURITY_SUBITEM_CONTENT_IDS.includes(link.contentId),
          )
          .map((link) => link.contentId),
      ),
    ).size,
    allPublished: applicationSecurityQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: applicationSecurityQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored: applicationSecurityQuestionSamples.every((question) =>
      question.source.includes("SECURIUM independently authored"),
    ),
    allLinkedToBothCourses: applicationSecurityQuestionSamples.every((question) =>
      APPLICATION_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    allLinkedToApplicationContent: applicationSecurityQuestionSamples.every(
      (question) =>
        question.contentLinks.some(
          (link) =>
            link.contentType === "CONTENT" &&
            link.contentId === APPLICATION_SECURITY_CONTENT_ID,
        ),
    ),
    allLinkedToApplicationSubItemContent: APPLICATION_SECURITY_SUBITEM_CONTENT_IDS.every(
      (contentId) =>
        applicationSecurityQuestionSamples.some((question) =>
          question.contentLinks.some((link) => link.contentId === contentId),
        ),
    ),
  };
}

export function toApplicationSecurityGradingQuestion(question) {
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

export function generateApplicationSecurityQuestionSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statements = [
    insertSeedMigrationSql(dialect),
    ...applicationSecurityQuestionSamples.flatMap((question) => [
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
  'seed_application_security_questions_2027_2029',
  'seed_application_security_questions_2027_2029',
  'manual-application-security-questions-2027-2029',
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
  const id = `application-security-course-link-${question.id}-${courseLink.courseId}`;
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
  const id = `application-security-content-link-${question.id}-${index + 1}`;
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
    contentId: APPLICATION_SECURITY_CONTENT_ID,
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
  'SECURIUM independently authored application security sample seed',
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
