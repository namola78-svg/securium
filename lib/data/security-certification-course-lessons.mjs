export const SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_COURSE_LESSON_SEED";
export const SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE =
  "APPLY_SECURITY_CERTIFICATION_COURSE_LESSON_SEED";

export const officialSecurityCertificationContents = [
  {
    id: "content-official-security-cert-system-security-overview",
    slug: "official-security-cert-system-security-overview",
    canonicalKey: "official.security-certification.system-security.overview",
    title: "시스템보안 학습 개요",
    summary:
      "운영체제, 서버, 클라우드와 시스템 보안 위협을 연결해 학습하는 공통 개요입니다.",
    body: [
      "# 시스템보안 학습 개요",
      "",
      "시스템보안은 단말, 서버, 운영체제, 클라우드 환경에서 발생할 수 있는 보안 위협과 대응 절차를 이해하는 영역입니다.",
      "",
      "## 학습 방향",
      "- 운영체제와 서버 환경의 기본 구조를 먼저 정리합니다.",
      "- 계정, 권한, 로그, 패치, 설정 관리가 보안 수준에 미치는 영향을 연결합니다.",
      "- 공격기법은 탐지와 대응 관점에서 함께 학습합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "시스템 구성요소와 보안 관리 포인트를 설명할 수 있다.",
      "시스템 보안위협과 대응 절차를 구분할 수 있다.",
      "운영체제, 서버, 클라우드 보안 항목을 시험 범위와 연결할 수 있다.",
    ],
    coreConcepts: ["운영체제", "서버보안", "권한관리", "로그분석", "취약점 대응"],
    practicalExamples: [
      "불필요한 계정과 서비스가 남아 있는 서버를 점검 항목으로 분해합니다.",
      "로그 이벤트를 침해 징후와 운영상 오류로 구분해 봅니다.",
    ],
  },
  {
    id: "content-official-security-cert-network-security-overview",
    slug: "official-security-cert-network-security-overview",
    canonicalKey: "official.security-certification.network-security.overview",
    title: "네트워크보안 학습 개요",
    summary:
      "네트워크 구조, 프로토콜, 공격 유형과 보안장비 운용을 연결해 학습하는 공통 개요입니다.",
    body: [
      "# 네트워크보안 학습 개요",
      "",
      "네트워크보안은 통신 구조와 프로토콜을 이해하고, 서비스 거부, 스캐닝, 스푸핑, 스니핑 등 주요 공격과 대응 방식을 다룹니다.",
      "",
      "## 학습 방향",
      "- OSI 7계층과 TCP/IP 동작을 먼저 정리합니다.",
      "- 공격 유형별 징후와 대응 장비를 연결합니다.",
      "- 방화벽, IDS/IPS, VPN, NAC 등 보안솔루션의 역할을 비교합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "네트워크 계층과 주요 프로토콜의 보안 의미를 설명할 수 있다.",
      "주요 네트워크 공격의 특징과 대응 방법을 구분할 수 있다.",
      "네트워크 보안장비의 역할과 적용 지점을 비교할 수 있다.",
    ],
    coreConcepts: ["TCP/IP", "서비스 거부", "스캐닝", "스푸핑", "방화벽", "IDS/IPS"],
    practicalExamples: [
      "서비스 거부 공격 상황에서 로그와 트래픽 증상을 분리해 확인합니다.",
      "방화벽 정책과 네트워크 구성을 비교해 과도한 허용 규칙을 찾습니다.",
    ],
  },
  {
    id: "content-official-security-cert-application-security-overview",
    slug: "official-security-cert-application-security-overview",
    canonicalKey: "official.security-certification.application-security.overview",
    title: "애플리케이션보안 학습 개요",
    summary:
      "웹, DB, DNS, 전자상거래와 애플리케이션 취약점을 실무 점검 관점으로 학습합니다.",
    body: [
      "# 애플리케이션보안 학습 개요",
      "",
      "애플리케이션보안은 서비스 구성요소와 입력값 처리, 인증·인가, 데이터 보호, 웹 취약점 대응을 함께 다루는 영역입니다.",
      "",
      "## 학습 방향",
      "- 서비스별 보안 운영 포인트를 먼저 파악합니다.",
      "- Web/App, DB, DNS, 메일 등 서비스 취약점의 원인을 비교합니다.",
      "- 안전한 개발과 취약점 점검 항목을 실제 사례형 문제와 연결합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "주요 애플리케이션 서비스의 보안 요구사항을 설명할 수 있다.",
      "웹·앱 취약점과 안전한 개발 원칙을 연결할 수 있다.",
      "DB, DNS, 메일 서비스 보안 점검 포인트를 구분할 수 있다.",
    ],
    coreConcepts: ["Web/App 보안", "DB 보안", "DNS 보안", "입력값 검증", "보안약점"],
    practicalExamples: [
      "웹 로그인 기능에서 인증, 세션, 입력값 검증 흐름을 점검합니다.",
      "DB 계정 권한과 암호화 설정을 서비스 운영 관점에서 확인합니다.",
    ],
  },
  {
    id: "content-official-security-cert-information-security-general-overview",
    slug: "official-security-cert-information-security-general-overview",
    canonicalKey: "official.security-certification.information-security-general.overview",
    title: "정보보안일반 학습 개요",
    summary:
      "인증, 접근통제, 암호학과 최신 보안 동향을 정보보호 기본 체계로 정리합니다.",
    body: [
      "# 정보보안일반 학습 개요",
      "",
      "정보보안일반은 인증, 접근통제, 키 분배, 전자서명, 암호 알고리즘, 해시함수와 최신 보안 동향을 체계적으로 이해하는 영역입니다.",
      "",
      "## 학습 방향",
      "- 인증과 접근통제 개념을 먼저 구분합니다.",
      "- 암호 알고리즘, 공개키, 해시, 전자서명의 목적과 한계를 비교합니다.",
      "- 최신 보안 동향은 기본 보안 원칙과 연결해 정리합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "인증과 접근통제의 핵심 개념을 설명할 수 있다.",
      "암호기술의 목적과 적용 범위를 구분할 수 있다.",
      "최신 보안 동향을 기본 보안 원칙과 연결해 해석할 수 있다.",
    ],
    coreConcepts: ["인증", "접근통제", "암호 알고리즘", "전자서명", "해시함수"],
    practicalExamples: [
      "서비스 로그인 구조에서 인증과 인가 책임을 분리해 봅니다.",
      "전자서명과 해시가 무결성 확인에 어떻게 쓰이는지 비교합니다.",
    ],
  },
  {
    id: "content-official-security-cert-management-law-overview",
    slug: "official-security-cert-management-law-overview",
    canonicalKey: "official.security-certification.management-law.overview",
    title: "정보보안관리 및 법규 학습 개요",
    summary:
      "정보보호 관리체계, 위험관리, 사고대응과 관련 법규를 정보보안기사 필기 범위에 맞춰 정리합니다.",
    body: [
      "# 정보보안관리 및 법규 학습 개요",
      "",
      "정보보안관리 및 법규는 정보보호 관리체계, 위험관리, 대책 구현, 사고대응, 인증제도와 관련 법령을 연결해 이해하는 영역입니다.",
      "",
      "## 학습 방향",
      "- 관리체계와 위험관리 절차를 먼저 정리합니다.",
      "- 기술적·관리적·물리적 보호대책을 구분합니다.",
      "- 법령과 인증제도는 기준일과 개정 가능성을 함께 확인합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "정보보호 관리체계와 위험관리 흐름을 설명할 수 있다.",
      "보호대책 유형과 사고대응 절차를 구분할 수 있다.",
      "관련 법규와 인증제도를 기준일 관점에서 학습할 수 있다.",
    ],
    coreConcepts: ["정보보호관리", "위험관리", "보호대책", "사고대응", "관련 법규"],
    practicalExamples: [
      "위험 식별 결과를 보호대책 수립과 이행계획으로 연결합니다.",
      "사고대응 절차에서 증거 보존과 재발 방지 활동을 구분합니다.",
    ],
  },
  {
    id: "content-official-security-cert-practical-overview",
    slug: "official-security-cert-practical-overview",
    canonicalKey: "official.security-certification.practical.overview",
    title: "정보보안 실무 학습 개요",
    summary:
      "시스템·네트워크 보안특성 파악, 취약점 점검, 로그 분석, 대책 수립을 실기형 사고로 연결합니다.",
    body: [
      "# 정보보안 실무 학습 개요",
      "",
      "정보보안 실무는 운영체제, 네트워크, 서비스, 보안장비의 보안 특성을 파악하고 점검·분석·대응하는 수행형 역량을 다룹니다.",
      "",
      "## 학습 방향",
      "- 설정 점검과 로그 분석을 단순 암기보다 절차 중심으로 정리합니다.",
      "- 취약점 발견, 영향 판단, 보완 방안 수립을 하나의 답안 흐름으로 연습합니다.",
      "- 기사와 산업기사는 같은 실무 기반을 공유하지만 요구 깊이와 학습 진도는 과정별로 분리됩니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "시스템과 네트워크 환경의 보안특성을 파악할 수 있다.",
      "취약점 점검 결과를 보완 조치로 연결할 수 있다.",
      "로그 분석과 침해 대응 결과를 구조화된 답안으로 정리할 수 있다.",
    ],
    coreConcepts: ["보안특성 파악", "취약점 점검", "로그 분석", "보완 조치", "대책 수립"],
    practicalExamples: [
      "방화벽 정책과 서버 로그를 함께 보고 접근통제 문제를 분석합니다.",
      "취약점 점검 결과를 반복 취약 항목과 개선 계획으로 정리합니다.",
    ],
  },
];

export const officialSecurityCertificationCourseLessons = [
  {
    id: "course-lesson-ise-official-system-security-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-01",
    contentId: "content-official-security-cert-system-security-overview",
    displayTitle: "정보보안기사 시스템보안 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 95,
    estimatedMinutes: 15,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-network-security-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-02",
    contentId: "content-official-security-cert-network-security-overview",
    displayTitle: "정보보안기사 네트워크보안 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 95,
    estimatedMinutes: 15,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-application-security-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-03",
    contentId: "content-official-security-cert-application-security-overview",
    displayTitle: "정보보안기사 애플리케이션보안 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 92,
    estimatedMinutes: 14,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-information-security-general-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-04",
    contentId: "content-official-security-cert-information-security-general-overview",
    displayTitle: "정보보안기사 정보보안일반 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 90,
    estimatedMinutes: 14,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-management-law-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-05",
    contentId: "content-official-security-cert-management-law-overview",
    displayTitle: "정보보안기사 정보보안관리 및 법규 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 90,
    estimatedMinutes: 15,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-practical-overview",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-02-01",
    contentId: "content-official-security-cert-practical-overview",
    displayTitle: "정보보안기사 실기 학습 개요",
    sortOrder: 1,
    difficulty: "심화",
    importance: 96,
    estimatedMinutes: 18,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-system-security-overview",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-01",
    contentId: "content-official-security-cert-system-security-overview",
    displayTitle: "정보보안산업기사 시스템보안 학습 개요",
    sortOrder: 1,
    difficulty: "입문",
    importance: 92,
    estimatedMinutes: 14,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-network-security-overview",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-02",
    contentId: "content-official-security-cert-network-security-overview",
    displayTitle: "정보보안산업기사 네트워크보안 학습 개요",
    sortOrder: 1,
    difficulty: "입문",
    importance: 92,
    estimatedMinutes: 14,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-application-security-overview",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-03",
    contentId: "content-official-security-cert-application-security-overview",
    displayTitle: "정보보안산업기사 애플리케이션보안 학습 개요",
    sortOrder: 1,
    difficulty: "입문",
    importance: 90,
    estimatedMinutes: 13,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-information-security-general-overview",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-04",
    contentId: "content-official-security-cert-information-security-general-overview",
    displayTitle: "정보보안산업기사 정보보안일반 학습 개요",
    sortOrder: 1,
    difficulty: "입문",
    importance: 88,
    estimatedMinutes: 13,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-practical-overview",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-02-01",
    contentId: "content-official-security-cert-practical-overview",
    displayTitle: "정보보안산업기사 실기 학습 개요",
    sortOrder: 1,
    difficulty: "중급",
    importance: 94,
    estimatedMinutes: 16,
    isRequired: true,
  },
];

export function getSecurityCertificationCourseLessonSeedStats() {
  const contentIds = new Set(
    officialSecurityCertificationContents.map((content) => content.id),
  );
  const sharedContentIds = new Set(
    officialSecurityCertificationCourseLessons.map((lesson) => lesson.contentId),
  );

  return {
    contentCount: officialSecurityCertificationContents.length,
    courseLessonCount: officialSecurityCertificationCourseLessons.length,
    linkedContentCount: sharedContentIds.size,
    reusedContentCount: [...sharedContentIds].filter((contentId) => {
      return (
        officialSecurityCertificationCourseLessons.filter(
          (lesson) => lesson.contentId === contentId,
        ).length > 1
      );
    }).length,
    allLessonsHaveKnownContent: [...sharedContentIds].every((contentId) =>
      contentIds.has(contentId),
    ),
  };
}

export function generateSecurityCertificationCourseLessonSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statementEnd = dialect === "d1" ? ";" : ";";
  const statements = [];

  if (dialect === "postgres") statements.push("BEGIN;");

  for (const content of officialSecurityCertificationContents) {
    statements.push(`${insertContentSql(content, dialect)}${statementEnd}`);
  }

  for (const lesson of officialSecurityCertificationCourseLessons) {
    statements.push(`${insertCourseLessonSql(lesson, dialect)}${statementEnd}`);
  }

  if (dialect === "postgres") {
    statements.push(`
INSERT INTO app_schema_migrations (id, checksum)
VALUES ('seed_security_certification_course_lessons_2027_2029', 'manual-security-certification-course-lessons-2027-2029')
ON CONFLICT (id) DO NOTHING;`.trim());
    statements.push("COMMIT;");
  }

  return `${statements.join("\n\n")}\n`;
}

function insertContentSql(content, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "learning_objectives_json" = EXCLUDED."learning_objectives_json",
  "core_concepts_json" = EXCLUDED."core_concepts_json",
  "practical_examples_json" = EXCLUDED."practical_examples_json",
  "version" = EXCLUDED."version",
  "status" = EXCLUDED."status",
  "deleted_at" = NULL,
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "contents" (
  "id", "slug", "canonical_key", "title", "summary", "body", "body_format",
  "learning_objectives_json", "core_concepts_json", "practical_examples_json",
  "diagrams_json", "media_json", "version", "status", "created_by", "deleted_at"
)
VALUES (
  ${q(content.id)},
  ${q(content.slug)},
  ${q(content.canonicalKey)},
  ${q(content.title)},
  ${q(content.summary)},
  ${q(content.body)},
  'MARKDOWN',
  ${q(JSON.stringify(content.learningObjectives))},
  ${q(JSON.stringify(content.coreConcepts))},
  ${q(JSON.stringify(content.practicalExamples))},
  '[]',
  '[]',
  '1.0.0',
  'PUBLISHED',
  NULL,
  NULL
)
${conflict}`.trim();
}

function insertCourseLessonSql(lesson, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO UPDATE SET
  "curriculum_node_id" = EXCLUDED."curriculum_node_id",
  "content_id" = EXCLUDED."content_id",
  "display_title" = EXCLUDED."display_title",
  "sort_order" = EXCLUDED."sort_order",
  "difficulty" = EXCLUDED."difficulty",
  "importance" = EXCLUDED."importance",
  "estimated_minutes" = EXCLUDED."estimated_minutes",
  "is_required" = EXCLUDED."is_required",
  "unlock_condition" = EXCLUDED."unlock_condition",
  "completion_rule" = EXCLUDED."completion_rule",
  "status" = EXCLUDED."status",
  "deleted_at" = NULL,
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "course_lessons" (
  "id", "course_id", "curriculum_node_id", "content_id", "lesson_id",
  "display_title", "sort_order", "difficulty", "importance", "estimated_minutes",
  "is_required", "unlock_condition", "completion_rule", "status", "deleted_at"
)
VALUES (
  ${q(lesson.id)},
  ${q(lesson.courseId)},
  ${q(lesson.curriculumNodeId)},
  ${q(lesson.contentId)},
  NULL,
  ${q(lesson.displayTitle)},
  ${lesson.sortOrder},
  ${q(lesson.difficulty)},
  ${lesson.importance},
  ${lesson.estimatedMinutes},
  ${lesson.isRequired ? 1 : 0},
  NULL,
  'MANUAL',
  'PUBLISHED',
  NULL
)
${conflict}`.trim();
}

function nowExpression(dialect) {
  return dialect === "postgres" ? "CURRENT_TIMESTAMP::text" : "CURRENT_TIMESTAMP";
}

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}
