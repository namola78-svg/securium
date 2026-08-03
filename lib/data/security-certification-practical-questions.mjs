export const PRACTICAL_SECURITY_CONTENT_ID =
  "content-official-security-cert-practical-overview";

export const PRACTICAL_SECURITY_COURSE_IDS = ["course-ise", "course-isie"];

export const practicalSecurityQuestionSamples = [
  {
    id: "practical-security-official-sample-q01",
    title: "로그 분석의 우선 확인 대상",
    content:
      "웹 서버에서 관리자 페이지 접근 실패가 짧은 시간에 반복되었다. 침해 징후 확인을 위해 가장 먼저 함께 확인해야 할 항목은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "반복 실패 로그는 출발지 IP, 사용자 계정, 요청 경로, 시간대, 응답 코드와 함께 보아야 공격 패턴과 영향 범위를 판단할 수 있다.",
    wrongAnswerExplanation:
      "단순히 서버 재부팅 여부나 디스크 사용량만 보는 것은 인증 실패의 원인과 공격 여부 판단에 직접적인 근거가 부족하다.",
    choices: [
      {
        id: "practical-security-official-sample-q01-choice-01",
        content: "출발지 IP, 계정, 요청 경로, 시간대",
        displayOrder: 1,
        isCorrect: true,
        explanation: "인증 실패 패턴과 공격 출처를 파악하는 핵심 로그 항목이다.",
      },
      {
        id: "practical-security-official-sample-q01-choice-02",
        content: "서버실 온도와 랙 위치",
        displayOrder: 2,
        isCorrect: false,
        explanation: "물리 환경 정보는 인증 실패 분석의 1차 항목이 아니다.",
      },
      {
        id: "practical-security-official-sample-q01-choice-03",
        content: "프린터 큐와 문서 출력 기록",
        displayOrder: 3,
        isCorrect: false,
        explanation: "관리자 페이지 접근 실패 분석과 직접 관련성이 낮다.",
      },
      {
        id: "practical-security-official-sample-q01-choice-04",
        content: "모니터 해상도와 브라우저 테마",
        displayOrder: 4,
        isCorrect: false,
        explanation: "보안 로그 분석의 핵심 근거가 아니다.",
      },
    ],
  },
  {
    id: "practical-security-official-sample-q02",
    title: "취약점 조치 확인",
    content:
      "취약점 점검 결과를 받은 뒤에는 발견 사실만 기록하는 것으로 충분하고, 조치 결과와 재점검 기록은 남기지 않아도 된다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "취약점 관리는 발견, 영향 판단, 조치 계획, 조치 결과, 재점검 기록까지 연결되어야 개선 여부를 입증할 수 있다.",
    wrongAnswerExplanation:
      "조치 결과와 재점검 기록이 없으면 실제 위험이 줄었는지 확인하기 어렵다.",
    choices: [
      {
        id: "practical-security-official-sample-q02-true",
        content: "O",
        displayOrder: 1,
        isCorrect: false,
        explanation: "발견 기록만으로는 조치 완료를 입증하기 어렵다.",
      },
      {
        id: "practical-security-official-sample-q02-false",
        content: "X",
        displayOrder: 2,
        isCorrect: true,
        explanation: "조치와 재점검 기록까지 관리해야 한다.",
      },
    ],
  },
  {
    id: "practical-security-official-sample-q03",
    title: "보안 설정 점검 요소",
    content:
      "서버 보안 설정 점검에서 최소 권한 원칙을 확인할 때 함께 검토할 항목을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "최소 권한 점검은 관리자 계정, 불필요한 계정, 파일 권한, 서비스 권한, 원격 접속 권한을 함께 확인한다.",
    wrongAnswerExplanation:
      "화면 색상이나 배경 이미지는 권한 설정과 직접 관련이 없다.",
    choices: [
      {
        id: "practical-security-official-sample-q03-choice-01",
        content: "관리자 권한 계정 목록",
        displayOrder: 1,
        isCorrect: true,
        explanation: "과도한 관리자 권한 여부를 확인한다.",
      },
      {
        id: "practical-security-official-sample-q03-choice-02",
        content: "불필요하거나 장기간 미사용 계정",
        displayOrder: 2,
        isCorrect: true,
        explanation: "사용되지 않는 계정은 악용 경로가 될 수 있다.",
      },
      {
        id: "practical-security-official-sample-q03-choice-03",
        content: "중요 파일과 디렉터리 권한",
        displayOrder: 3,
        isCorrect: true,
        explanation: "중요 파일의 쓰기·실행 권한은 침해 영향과 연결된다.",
      },
      {
        id: "practical-security-official-sample-q03-choice-04",
        content: "운영자 개인 배경화면",
        displayOrder: 4,
        isCorrect: false,
        explanation: "최소 권한 점검의 핵심 항목이 아니다.",
      },
    ],
  },
  {
    id: "practical-security-official-sample-q04",
    title: "사고 대응 절차",
    content:
      "보안 사고 대응에서 침해 정황을 확인한 뒤 영향을 줄이기 위해 우선 수행하는 격리·차단 중심 조치를 무엇이라고 하는가?",
    type: "SHORT_ANSWER",
    difficulty: "MEDIUM",
    explanation:
      "격리 또는 차단은 침해 확산을 막기 위한 초동 대응 조치이며, 이후 원인 분석과 복구가 이어진다.",
    wrongAnswerExplanation:
      "보고서 작성이나 최종 복구는 중요하지만 확산 방지 단계와 구분된다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["격리", "차단", "containment", "Containment"],
      synonyms: ["확산 방지", "침해 확산 방지"],
      useRegex: true,
      regexPatterns: ["격리|차단|containment|확산\\s*방지"],
      partialCreditRules: [{ pattern: "대응|조치|복구", score: 40 }],
    },
  },
  {
    id: "practical-security-official-sample-q05",
    title: "네트워크 장비 설정 변경 관리",
    content:
      "방화벽 정책을 변경할 때 변경 전후 정책, 승인 근거, 적용 시간, 검증 결과를 함께 남겨야 한다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "네트워크 보안장비 변경은 승인, 적용, 검증, 롤백 가능성을 남겨야 추적성과 감사 가능성을 확보할 수 있다.",
    wrongAnswerExplanation:
      "변경 결과만 남기면 누가 왜 변경했는지와 문제가 생겼을 때 되돌릴 근거가 부족하다.",
    choices: [
      {
        id: "practical-security-official-sample-q05-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "변경 관리의 기본 증적이다.",
      },
      {
        id: "practical-security-official-sample-q05-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "변경 전후와 검증 결과를 함께 남겨야 한다.",
      },
    ],
  },
  {
    id: "practical-security-official-sample-q06",
    title: "최신 보안 동향 적용",
    content:
      "신규 취약점 공지가 확인되었을 때 조직이 우선순위를 정하기 위해 확인할 요소를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "취약점 공지는 영향 자산, 악용 가능성, 현재 보완통제, 패치 가능성, 업무 영향도를 함께 고려해야 한다.",
    wrongAnswerExplanation:
      "단순히 공지 제목의 길이나 제조사 로고만으로 우선순위를 정할 수 없다.",
    choices: [
      {
        id: "practical-security-official-sample-q06-choice-01",
        content: "우리 조직 영향 자산 존재 여부",
        displayOrder: 1,
        isCorrect: true,
        explanation: "영향을 받는 자산이 없으면 우선순위가 달라질 수 있다.",
      },
      {
        id: "practical-security-official-sample-q06-choice-02",
        content: "취약점 악용 가능성과 공개 exploit 여부",
        displayOrder: 2,
        isCorrect: true,
        explanation: "실제 악용 가능성은 조치 우선순위의 핵심이다.",
      },
      {
        id: "practical-security-official-sample-q06-choice-03",
        content: "패치 적용 가능성과 업무 영향",
        displayOrder: 3,
        isCorrect: true,
        explanation: "긴급 조치와 변경 관리 계획에 필요하다.",
      },
      {
        id: "practical-security-official-sample-q06-choice-04",
        content: "공지 문서의 글꼴 종류",
        displayOrder: 4,
        isCorrect: false,
        explanation: "보안 우선순위 판단 기준이 아니다.",
      },
    ],
  },
].map((question) => ({
  status: "PUBLISHED",
  source: "SECURIUM independently authored practical security sample",
  sourceDate: "2026-08-03",
  sampleOnly: true,
  courseLinks: PRACTICAL_SECURITY_COURSE_IDS.map((courseId) => ({
    courseId,
    weight: 100,
  })),
  contentLinks: [
    {
      contentType: "CONTENT",
      contentId: PRACTICAL_SECURITY_CONTENT_ID,
      relationType: "PRACTICE",
    },
  ],
  answerConfig: {},
  ...question,
}));

export function getPracticalSecurityQuestionBankReadiness() {
  const courseCounts = Object.fromEntries(
    PRACTICAL_SECURITY_COURSE_IDS.map((courseId) => [
      courseId,
      practicalSecurityQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ).length,
    ]),
  );
  const typeCounts = practicalSecurityQuestionSamples.reduce((acc, question) => {
    acc[question.type] = (acc[question.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    questionCount: practicalSecurityQuestionSamples.length,
    courseCounts,
    typeCounts,
    contentLinkedCount: practicalSecurityQuestionSamples.filter((question) =>
      question.contentLinks.some(
        (link) => link.contentId === PRACTICAL_SECURITY_CONTENT_ID,
      ),
    ).length,
    allPublished: practicalSecurityQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: practicalSecurityQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored: practicalSecurityQuestionSamples.every((question) =>
      question.source.includes("SECURIUM independently authored"),
    ),
    allLinkedToBothCourses: practicalSecurityQuestionSamples.every((question) =>
      PRACTICAL_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    allLinkedToPracticalContent: practicalSecurityQuestionSamples.every((question) =>
      question.contentLinks.some(
        (link) => link.contentId === PRACTICAL_SECURITY_CONTENT_ID,
      ),
    ),
  };
}

export function toPracticalSecurityGradingQuestion(question) {
  return {
    type: question.type,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      content: choice.content,
      isCorrect: choice.isCorrect,
    })),
    answerConfig: question.answerConfig ?? {},
  };
}
