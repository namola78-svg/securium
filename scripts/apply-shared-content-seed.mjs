import postgres from "postgres";

const CONFIRM_FLAG = "--confirm-production-seed";
const CONFIRM_ENV = "APPLY_SHARED_CONTENT_SEED";

function fail(code, message) {
  console.error(code);
  if (message) console.error(message);
  process.exit(1);
}

if (!process.argv.includes(CONFIRM_FLAG)) {
  fail(
    "CONFIRM_FLAG_REQUIRED",
    `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
  );
}

if (process.env.SECURIUM_CONFIRM_SHARED_CONTENT_SEED !== CONFIRM_ENV) {
  fail(
    "CONFIRM_ENV_REQUIRED",
    `Set SECURIUM_CONFIRM_SHARED_CONTENT_SEED=${CONFIRM_ENV} before running.`,
  );
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DIRECT_URL?.trim();
const connectionUrl = databaseUrl || directUrl;
if (!connectionUrl) {
  fail(
    "DATABASE_URL_OR_DIRECT_URL_REQUIRED",
    "Set DATABASE_URL for pooled runtime access, or DIRECT_URL when direct database access is available.",
  );
}

const contents = [
  {
    id: "content-shared-access-control-basics",
    slug: "shared-access-control-basics",
    canonicalKey: "sample.shared.access-control-basics",
    title: "접근통제 기본 원칙",
    summary:
      "인증, 인가, 계정 관리, 최소 권한 원칙을 공통 보안 관점에서 정리합니다.",
    body: [
      "# 접근통제 기본 원칙",
      "",
      "접근통제는 사용자가 누구인지 확인하고, 확인된 사용자에게 필요한 권한만 부여하며, 권한 사용 내역을 추적하는 관리 체계입니다.",
      "",
      "## 핵심 흐름",
      "- 식별: 사용자를 구분합니다.",
      "- 인증: 사용자가 본인인지 확인합니다.",
      "- 인가: 필요한 범위의 권한만 허용합니다.",
      "- 감사: 권한 사용 기록을 남기고 점검합니다.",
      "",
      "> 최소 권한과 직무 분리는 여러 자격 과정에서 반복되는 공통 핵심입니다.",
    ].join("\n"),
    learningObjectives: [
      "접근통제의 식별·인증·인가·감사 흐름을 설명할 수 있다",
      "최소 권한 원칙과 직무 분리의 필요성을 설명할 수 있다",
      "과정별 시험과 실무 사례에 접근통제 개념을 적용할 수 있다",
    ],
    coreConcepts: ["식별", "인증", "인가", "최소 권한", "직무 분리", "감사로그"],
    practicalExamples: [
      "퇴사자 계정을 비활성화하지 않으면 불필요한 접근 권한이 유지될 수 있다",
      "관리자 권한은 승인, 부여, 회수, 점검 기록이 함께 관리되어야 한다",
    ],
  },
  {
    id: "content-shared-personal-data-encryption",
    slug: "shared-personal-data-encryption",
    canonicalKey: "sample.shared.personal-data-encryption",
    title: "개인정보와 중요정보 보호",
    summary:
      "개인정보와 중요정보를 식별하고 저장·전송 구간에서 보호하는 기본 방식을 학습합니다.",
    body: [
      "# 개인정보와 중요정보 보호",
      "",
      "개인정보와 중요정보는 수집 목적, 처리 위치, 접근 권한, 보존 기간을 함께 관리해야 합니다.",
      "",
      "## 보호 관점",
      "- 수집 최소화",
      "- 저장 구간 암호화",
      "- 전송 구간 보호",
      "- 접근 기록 관리",
      "- 보존 기간 종료 후 안전한 파기",
    ].join("\n"),
    learningObjectives: [
      "개인정보와 중요정보의 보호 기준을 구분할 수 있다",
      "저장·전송 구간 보호 조치를 설명할 수 있다",
      "보존 기간과 파기 관리의 필요성을 설명할 수 있다",
    ],
    coreConcepts: ["개인정보", "중요정보", "암호화", "전송구간 보호", "보존 기간", "파기"],
    practicalExamples: [
      "고객 식별정보를 저장할 때 암호화와 접근권한 통제를 함께 적용한다",
      "외부 연계 구간은 TLS 등 안전한 전송 보호를 적용한다",
    ],
  },
  {
    id: "content-shared-incident-response-lifecycle",
    slug: "shared-incident-response-lifecycle",
    canonicalKey: "sample.shared.incident-response-lifecycle",
    title: "침해사고 대응 절차",
    summary: "탐지부터 분석, 차단, 복구, 재발 방지까지 침해사고 대응 흐름을 정리합니다.",
    body: [
      "# 침해사고 대응 절차",
      "",
      "침해사고 대응은 단순한 장애 처리와 다르게 증거 보존, 영향 범위 판단, 재발 방지 대책이 함께 필요합니다.",
      "",
      "## 대응 단계",
      "1. 탐지 및 신고",
      "2. 초기 분류와 영향 범위 확인",
      "3. 증거 보존과 원인 분석",
      "4. 차단 및 복구",
      "5. 재발 방지 대책 수립",
    ].join("\n"),
    learningObjectives: [
      "침해사고 대응의 주요 단계를 순서대로 설명할 수 있다",
      "증거 보존과 영향 범위 판단의 중요성을 설명할 수 있다",
      "재발 방지 대책을 학습 기록과 문제풀이에 연결할 수 있다",
    ],
    coreConcepts: ["침해사고", "증거 보존", "영향 범위", "복구", "재발 방지"],
    practicalExamples: [
      "웹 서버 이상 로그가 탐지되면 로그 보존 후 영향 시스템을 분류한다",
      "복구 후에는 원인과 통제 미흡점을 개선 계획에 반영한다",
    ],
  },
  {
    id: "content-shared-risk-assessment-method",
    slug: "shared-risk-assessment-method",
    canonicalKey: "sample.shared.risk-assessment-method",
    title: "위험평가 기본 방법",
    summary:
      "자산, 위협, 취약점, 가능성, 영향을 연결해 위험 수준을 판단하는 기본 구조를 학습합니다.",
    body: [
      "# 위험평가 기본 방법",
      "",
      "위험평가는 보호해야 할 자산과 발생 가능한 위협, 악용될 수 있는 취약점을 연결해 우선순위를 정하는 활동입니다.",
      "",
      "| 구성 요소 | 의미 |",
      "| --- | --- |",
      "| 자산 | 보호 가치가 있는 정보와 시스템 |",
      "| 위협 | 사고를 유발할 수 있는 원인 |",
      "| 취약점 | 위협이 실현될 수 있는 약점 |",
      "| 가능성 | 사고가 발생할 확률 또는 빈도 |",
      "| 영향 | 사고 발생 시 피해 규모 |",
    ].join("\n"),
    learningObjectives: [
      "자산·위협·취약점의 관계를 설명할 수 있다",
      "가능성과 영향을 바탕으로 위험 수준을 판단할 수 있다",
      "평가 방법이 조직 기준에 따라 달라질 수 있음을 이해한다",
    ],
    coreConcepts: ["자산", "위협", "취약점", "가능성", "영향", "위험처리"],
    practicalExamples: [
      "개인정보 처리 시스템은 유출 위협과 접근통제 취약점을 함께 평가한다",
      "위험 수준에 따라 회피, 완화, 전가, 수용을 선택한다",
    ],
  },
  {
    id: "content-shared-secure-input-validation",
    slug: "shared-secure-input-validation",
    canonicalKey: "sample.shared.secure-input-validation",
    title: "입력값 검증과 안전한 처리",
    summary:
      "SQL 삽입, 명령어 삽입, 경로 조작 등 입력값 기반 취약점을 예방하는 공통 원칙을 학습합니다.",
    body: [
      "# 입력값 검증과 안전한 처리",
      "",
      "외부 입력은 신뢰할 수 없다는 전제로 길이, 형식, 허용 문자, 업무 규칙을 검증해야 합니다.",
      "",
      "## 안전한 처리 원칙",
      "- 허용 목록 기반 검증을 우선 적용합니다.",
      "- SQL은 파라미터 바인딩을 사용합니다.",
      "- 파일 경로는 기준 디렉터리 밖으로 벗어나지 못하게 검증합니다.",
      "- 오류 메시지에 내부 구조를 노출하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "외부 입력을 신뢰하지 않는 이유를 설명할 수 있다",
      "허용 목록 검증과 파라미터 바인딩의 차이를 설명할 수 있다",
      "코드 분석 문제에서 취약 처리 지점을 찾을 수 있다",
    ],
    coreConcepts: ["입력값 검증", "허용 목록", "파라미터 바인딩", "SQL 삽입", "명령어 삽입", "경로 조작"],
    practicalExamples: [
      "사용자 ID를 SQL 문자열에 직접 결합하지 않고 바인딩 변수로 처리한다",
      "업로드 파일명은 서버 생성 키로 대체한다",
    ],
  },
  {
    id: "content-shared-privacy-data-flow",
    slug: "shared-privacy-data-flow",
    canonicalKey: "sample.shared.privacy-data-flow",
    title: "개인정보 처리 흐름 이해",
    summary: "수집, 이용, 제공, 보관, 파기 단계에서 개인정보가 어떻게 이동하는지 학습합니다.",
    body: [
      "# 개인정보 처리 흐름 이해",
      "",
      "개인정보 처리 흐름은 개인정보가 어디에서 수집되고, 어떤 시스템을 거쳐, 누구에게 제공되며, 언제 파기되는지 나타냅니다.",
      "",
      "## 확인 항목",
      "- 정보주체와 수집 채널",
      "- 처리 시스템과 저장 위치",
      "- 제3자 제공 또는 위탁 여부",
      "- 접근 권한과 보호 조치",
      "- 보존 기간과 파기 절차",
    ].join("\n"),
    learningObjectives: [
      "개인정보 처리 흐름의 주요 구성 요소를 설명할 수 있다",
      "위탁과 제3자 제공 여부를 구분하는 관점을 이해한다",
      "흐름도 기반 영향평가 문제를 분석할 수 있다",
    ],
    coreConcepts: ["개인정보 흐름", "수집", "이용", "제공", "위탁", "파기", "보호 조치"],
    practicalExamples: [
      "회원가입 화면에서 수집된 연락처가 고객관리 시스템과 알림 발송 업체로 전달되는 흐름을 점검한다",
    ],
  },
];

const lessons = [
  ["course-lesson-isms-access-control", "course-isms-p", "content-shared-access-control-basics", "ISMS-P 관점의 접근통제 기본 원칙", 101, 95, 12, true],
  ["course-lesson-cppg-access-control", "course-cppg", "content-shared-access-control-basics", "개인정보 관리 관점의 접근통제", 101, 88, 12, true],
  ["course-lesson-pia-access-control", "course-pia", "content-shared-access-control-basics", "영향평가 관점의 접근통제 점검", 101, 88, 12, true],
  ["course-lesson-ise-access-control", "course-ise", "content-shared-access-control-basics", "정보보안기사 접근통제 핵심", 101, 86, 12, true],
  ["course-lesson-isie-access-control", "course-isie", "content-shared-access-control-basics", "정보보안산업기사 접근통제 핵심", 101, 84, 12, true],
  ["course-lesson-isms-encryption", "course-isms-p", "content-shared-personal-data-encryption", "ISMS-P 개인정보와 중요정보 보호", 102, 92, 11, true],
  ["course-lesson-cppg-encryption", "course-cppg", "content-shared-personal-data-encryption", "CPPG 개인정보 보호 조치", 102, 92, 11, true],
  ["course-lesson-pia-encryption", "course-pia", "content-shared-personal-data-encryption", "영향평가 보호 조치 확인", 102, 90, 11, true],
  ["course-lesson-ise-encryption", "course-ise", "content-shared-personal-data-encryption", "정보보안기사 암호화와 중요정보 보호", 102, 86, 11, true],
  ["course-lesson-isie-encryption", "course-isie", "content-shared-personal-data-encryption", "정보보안산업기사 중요정보 보호", 102, 82, 11, true],
  ["course-lesson-isms-incident-response", "course-isms-p", "content-shared-incident-response-lifecycle", "ISMS-P 침해사고 대응 체계", 103, 90, 10, true],
  ["course-lesson-ise-incident-response", "course-ise", "content-shared-incident-response-lifecycle", "정보보안기사 침해사고 대응", 103, 86, 10, true],
  ["course-lesson-isie-incident-response", "course-isie", "content-shared-incident-response-lifecycle", "정보보안산업기사 침해사고 대응", 103, 82, 10, true],
  ["course-lesson-sw-vuln-incident-response", "course-sw-vuln", "content-shared-incident-response-lifecycle", "보안약점 진단 결과와 사고 대응", 103, 78, 10, false],
  ["course-lesson-isms-risk-assessment", "course-isms-p", "content-shared-risk-assessment-method", "ISMS-P 위험평가 기본 방법", 104, 93, 13, true],
  ["course-lesson-isrm-risk-assessment", "course-isrm", "content-shared-risk-assessment-method", "ISRM 위험평가 기본 방법", 101, 98, 13, true],
  ["course-lesson-pia-risk-assessment", "course-pia", "content-shared-risk-assessment-method", "영향평가 위험 판단 기초", 103, 90, 13, true],
  ["course-lesson-sw-vuln-input-validation", "course-sw-vuln", "content-shared-secure-input-validation", "보안약점 진단 입력값 검증", 101, 96, 14, true],
  ["course-lesson-ise-input-validation", "course-ise", "content-shared-secure-input-validation", "정보보안기사 입력값 검증과 취약점", 104, 84, 14, true],
  ["course-lesson-isie-input-validation", "course-isie", "content-shared-secure-input-validation", "정보보안산업기사 입력값 검증", 104, 82, 14, true],
  ["course-lesson-pia-privacy-flow", "course-pia", "content-shared-privacy-data-flow", "개인정보 영향평가 처리 흐름 이해", 104, 96, 12, true],
  ["course-lesson-cppg-privacy-flow", "course-cppg", "content-shared-privacy-data-flow", "CPPG 개인정보 처리 흐름 이해", 103, 90, 12, true],
  ["course-lesson-isms-privacy-flow", "course-isms-p", "content-shared-privacy-data-flow", "ISMS-P 개인정보 처리 흐름 점검", 105, 88, 12, true],
];

const extensions = [
  ["course-lesson-extension-isms-access-control", "course-lesson-isms-access-control", ["접근권한 검토 주기", "특권 계정 관리", "퇴직자 계정 회수"], "ISMS-P에서는 접근통제 정책, 권한 승인 기록, 계정 점검 이력, 관리자 권한 관리 증적을 함께 확인합니다."],
  ["course-lesson-extension-cppg-encryption", "course-lesson-cppg-encryption", ["개인정보 안전성 확보조치", "접근통제와 암호화", "보존 및 파기"], "CPPG 학습에서는 개인정보의 처리 단계별 보호 조치와 관리 책임을 함께 연결해 보는 것이 중요합니다."],
  ["course-lesson-extension-isrm-risk-assessment", "course-lesson-isrm-risk-assessment", ["자산 식별", "위협과 취약점 매핑", "위험처리 선택"], "ISRM에서는 위험평가 계산 자체보다 평가 기준, 등급 정의, 처리 의사결정의 일관성이 중요합니다."],
  ["course-lesson-extension-sw-vuln-input-validation", "course-lesson-sw-vuln-input-validation", ["취약 라인 식별", "CWE 매핑", "안전한 코드 제안"], "SW 보안약점 진단에서는 입력값이 코드 흐름에서 어디까지 전달되는지 추적합니다."],
  ["course-lesson-extension-pia-privacy-flow", "course-lesson-pia-privacy-flow", ["처리 흐름도", "침해요인 식별", "개선방안 도출"], "영향평가에서는 처리 흐름을 기준으로 개인정보 유형, 처리 목적, 이전 방식, 보호 조치를 함께 확인합니다."],
];

const sql = postgres(connectionUrl, {
  max: 1,
  idle_timeout: 1,
  connect_timeout: 15,
  ssl: "require",
});

let failed = false;

try {
  const requiredTables = ["contents", "course_lessons", "course_lesson_extensions", "courses"];
  const tableRows = await sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ${sql(requiredTables)}
  `;
  const existingTables = new Set(tableRows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));
  if (missingTables.length) {
    fail(
      `SHARED_CONTENT_SCHEMA_MISSING:${missingTables.join(",")}`,
      "Apply curriculum and shared content schema before running the seed.",
    );
  }

  const requiredCourseIds = [...new Set(lessons.map((lesson) => lesson[1]))];
  const courseRows = await sql`
    SELECT id
    FROM courses
    WHERE id IN ${sql(requiredCourseIds)}
  `;
  const existingCourses = new Set(courseRows.map((row) => row.id));
  const missingCourses = requiredCourseIds.filter((id) => !existingCourses.has(id));
  if (missingCourses.length) {
    fail(
      `COURSE_SEED_MISSING:${missingCourses.join(",")}`,
      "Apply or verify the base course seed before running shared content seed.",
    );
  }

  await sql.begin(async (tx) => {
    for (const content of contents) {
      await tx`
        INSERT INTO contents (
          id, slug, canonical_key, title, summary, body, body_format,
          learning_objectives_json, core_concepts_json, practical_examples_json,
          diagrams_json, media_json, version, status, created_by
        )
        VALUES (
          ${content.id}, ${content.slug}, ${content.canonicalKey},
          ${content.title}, ${content.summary}, ${content.body}, 'MARKDOWN',
          ${JSON.stringify(content.learningObjectives)},
          ${JSON.stringify(content.coreConcepts)},
          ${JSON.stringify(content.practicalExamples)},
          '[]', '[]', '1.0.0', 'PUBLISHED', NULL
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    for (const lesson of lessons) {
      await tx`
        INSERT INTO course_lessons (
          id, course_id, curriculum_node_id, content_id, display_title, sort_order,
          difficulty, importance, estimated_minutes, is_required, completion_rule, status
        )
        VALUES (
          ${lesson[0]}, ${lesson[1]}, NULL, ${lesson[2]}, ${lesson[3]},
          ${lesson[4]}, NULL, ${lesson[5]}, ${lesson[6]}, ${lesson[7] ? 1 : 0},
          'MANUAL', 'PUBLISHED'
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    for (const extension of extensions) {
      await tx`
        INSERT INTO course_lesson_extensions (
          id, course_lesson_id, learning_objectives_override_json, additional_body,
          exam_points_json, practical_notes, legal_notes, standard_notes,
          evidence_notes, common_mistakes, instructor_notes, version, status
        )
        VALUES (
          ${extension[0]}, ${extension[1]}, NULL, ${extension[3]},
          ${JSON.stringify(extension[2])}, '', '', '', '', '', '',
          '1.0.0', 'PUBLISHED'
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });

  const [contentCount] = await sql`
    SELECT count(*)::int AS count
    FROM contents
    WHERE canonical_key LIKE 'sample.shared.%'
  `;
  const [lessonCount] = await sql`
    SELECT count(*)::int AS count
    FROM course_lessons
    WHERE id LIKE 'course-lesson-%'
      AND content_id IN ${sql(contents.map((content) => content.id))}
  `;
  const [extensionCount] = await sql`
    SELECT count(*)::int AS count
    FROM course_lesson_extensions
    WHERE id IN ${sql(extensions.map((extension) => extension[0]))}
  `;

  console.log(
    JSON.stringify({
      status: "SHARED_CONTENT_SEED_APPLIED",
      contents: contentCount.count,
      courseLessons: lessonCount.count,
      extensions: extensionCount.count,
    }),
  );
} catch (error) {
  console.error(`SHARED_CONTENT_SEED_FAILED:${error.code || error.name || "UNKNOWN"}`);
  failed = true;
} finally {
  await sql.end({ timeout: 1 });
}

if (failed) process.exit(1);
