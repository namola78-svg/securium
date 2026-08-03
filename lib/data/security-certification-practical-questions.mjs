export const PRACTICAL_SECURITY_CONTENT_ID =
  "content-official-security-cert-practical-overview";

export const PRACTICAL_SECURITY_COURSE_IDS = ["course-ise", "course-isie"];

export const PRACTICAL_SECURITY_CONTENT_IDS = {
  overview: PRACTICAL_SECURITY_CONTENT_ID,
  osVirtualizationCharacteristics:
    "content-official-security-cert-practical-os-virtualization-characteristics",
  protocolCharacteristics:
    "content-official-security-cert-practical-protocol-characteristics",
  serviceCharacteristics:
    "content-official-security-cert-practical-service-characteristics",
  securityDeviceCharacteristics:
    "content-official-security-cert-practical-security-device-characteristics",
  osSecuritySettings:
    "content-official-security-cert-practical-os-security-settings",
  serviceSecuritySettings:
    "content-official-security-cert-practical-service-security-settings",
  networkDeviceSecuritySettings:
    "content-official-security-cert-practical-network-device-security-settings",
  vulnerabilityHistoryManagement:
    "content-official-security-cert-practical-vulnerability-history-management",
  securityObjectiveDetectionResponse:
    "content-official-security-cert-practical-security-objective-detection-response",
  securityLogAnalysisResponse:
    "content-official-security-cert-practical-security-log-analysis-response",
  practicalSecurityTrendsGeneral:
    "content-official-security-cert-practical-practical-security-trends-general",
  itAssetRiskAnalysis:
    "content-official-security-cert-practical-it-asset-risk-analysis",
  organizationalRiskWeaknessAnalysis:
    "content-official-security-cert-practical-organizational-risk-weakness-analysis",
  riskEvaluation: "content-official-security-cert-practical-risk-evaluation",
  controlSelectionImplementationPlan:
    "content-official-security-cert-practical-control-selection-implementation-plan",
};

const practicalSecurityOverviewQuestionSamples = [
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

const sharedPracticalSubItemQuestionDefinitions = [
  {
    id: "practical-security-official-subitem-q01",
    title: "운영체제 보안특성 확인",
    content:
      "가상 서버 점검에서 운영체제 보안특성을 파악할 때 함께 확인해야 할 항목을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.osVirtualizationCharacteristics,
    choices: [
      ["계정 권한과 패치 수준", true, "운영체제 보안특성을 판단하는 핵심 항목이다."],
      ["시스템 로그 수집 여부", true, "침해 추적과 이상 징후 확인에 필요하다."],
      ["가상화 관리 콘솔 접근통제", true, "가상화 환경에서는 관리 평면 보호가 중요하다."],
      ["관리자 책상 위치", false, "운영체제 보안특성과 직접 관련이 없다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q02",
    title: "프로토콜 보안특성 판단",
    content:
      "TCP/IP 기반 통신 분석에서 프로토콜 보안특성으로 보기 어려운 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.protocolCharacteristics,
    choices: [
      ["세션 수립과 종료 절차", false, "TCP 연결 상태와 세션 관리는 분석 대상이다."],
      ["암호화 적용 여부", false, "SSL/TLS, IPSec 등은 보안특성 판단에 중요하다."],
      ["라우팅 경로와 PDU 구조", false, "프로토콜 동작 구조와 관련된다."],
      ["모니터 색온도", true, "프로토콜 보안특성과 관계가 없다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q03",
    title: "서비스별 보안특성",
    content:
      "웹 서비스와 DB 서비스를 점검할 때 서비스별 보안특성은 동일하므로 같은 체크리스트만 적용하면 충분하다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.serviceCharacteristics,
    choices: [
      ["O", false, "서비스별 포트, 인증, 권한, 로그, 입력 처리 특성이 다르다."],
      ["X", true, "서비스 특성에 맞는 점검 항목을 구분해야 한다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q04",
    title: "보안장비 특성",
    content:
      "침입 탐지·차단 장비 점검 시 장비별 역할과 배치 위치를 함께 확인해야 하는 이유는 무엇인가?",
    type: "SHORT_ANSWER",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.securityDeviceCharacteristics,
    acceptedAnswers: ["탐지 범위", "차단 위치", "탐지 범위와 차단 위치", "보호 범위"],
    synonyms: ["적용 범위", "인라인 차단"],
    partialPatterns: ["탐지|차단|범위|위치"],
  },
  {
    id: "practical-security-official-subitem-q05",
    title: "운영체제 보안설정 점검",
    content:
      "운영체제 보안설정 점검에서 불필요한 계정과 원격접속 설정은 우선 확인 대상이다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.osSecuritySettings,
    choices: [
      ["O", true, "불필요한 계정과 원격접속은 침해 경로가 될 수 있다."],
      ["X", false, "계정과 원격접속 설정은 운영체제 점검의 기본 항목이다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q06",
    title: "서비스 보안설정 점검",
    content:
      "서비스 보안설정 점검 결과 파일 권한이 과도하게 열려 있을 때 적절한 조치는 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.serviceSecuritySettings,
    choices: [
      ["필요 최소 권한으로 조정하고 영향 서비스를 검증한다.", true, "권한 축소와 검증이 함께 필요하다."],
      ["모든 사용자에게 쓰기 권한을 추가한다.", false, "위험을 키우는 조치다."],
      ["점검 기록만 남기고 조치하지 않는다.", false, "취약 설정은 보완과 재점검이 필요하다."],
      ["서비스명을 임의로 바꾼다.", false, "근본적인 권한 문제를 해결하지 못한다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q07",
    title: "네트워크 장비 보안설정",
    content:
      "방화벽 정책 점검에서 확인해야 할 항목을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.networkDeviceSecuritySettings,
    choices: [
      ["출발지와 목적지", true, "정책 범위 판단에 필요하다."],
      ["서비스 포트와 방향", true, "허용 서비스와 흐름을 확인해야 한다."],
      ["만료되었거나 미사용인 허용 정책", true, "불필요한 허용은 공격면을 넓힌다."],
      ["관리자 취미", false, "정책 점검 항목이 아니다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q08",
    title: "취약점 이력 관리",
    content:
      "취약점 점검이력 관리에서 조치 완료 후 재점검 결과를 기록해야 하는 이유를 한 단어로 쓰시오.",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.vulnerabilityHistoryManagement,
    acceptedAnswers: ["검증", "확인", "재점검", "증적"],
    synonyms: ["조치 검증", "개선 확인"],
    partialPatterns: ["검증|확인|재점검|증적"],
  },
  {
    id: "practical-security-official-subitem-q09",
    title: "보안목표와 침해 대응",
    content:
      "보안목표에 따라 로그 수집 대상을 정하지 않으면 침해 탐지와 대응 우선순위가 흐려질 수 있다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.securityObjectiveDetectionResponse,
    choices: [
      ["O", true, "목표 기반 수집 범위가 있어야 탐지·대응 기준이 명확해진다."],
      ["X", false, "무작위 수집만으로는 대응 우선순위가 명확하지 않다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q10",
    title: "로그분석 대응 단서",
    content:
      "로그분석에서 침해 정황을 판단할 때 함께 보아야 할 단서를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.securityLogAnalysisResponse,
    choices: [
      ["이벤트 발생 시간", true, "연속성과 공격 시점을 판단한다."],
      ["출발지와 목적지", true, "공격 출처와 대상 범위를 파악한다."],
      ["응답 코드와 이벤트 유형", true, "성공 여부와 행위 유형을 판단한다."],
      ["문서 작성자의 글꼴", false, "로그 이벤트 분석 단서가 아니다."],
    ],
  },
  {
    id: "practical-security-official-subitem-q11",
    title: "최신 보안 동향 해석",
    content:
      "신규 취약점 동향을 조직에 적용할 때 가장 먼저 확인할 것은 우리 조직의 영향 자산 존재 여부이다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.practicalSecurityTrendsGeneral,
    choices: [
      ["O", true, "영향 자산이 있어야 조치 우선순위와 대응 범위를 정할 수 있다."],
      ["X", false, "조직 영향 여부 확인은 우선 판단 항목이다."],
    ],
  },
];

const engineerOnlyPracticalQuestionDefinitions = [
  {
    id: "practical-security-official-engineer-q01",
    title: "IT 자산 위험 분석",
    content:
      "IT 자산 위험 분석에서 자산, 위협, 취약점의 관계를 함께 정리해야 한다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.itAssetRiskAnalysis,
    choices: [
      ["O", true, "위험은 보호 대상 자산과 위협, 취약점의 조합으로 판단한다."],
      ["X", false, "세 요소를 분리하면 위험 시나리오가 불완전해질 수 있다."],
    ],
  },
  {
    id: "practical-security-official-engineer-q02",
    title: "조직 위험 정리",
    content:
      "조직의 정보자산 위험을 정리할 때 포함해야 할 항목을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.organizationalRiskWeaknessAnalysis,
    choices: [
      ["업무 영향", true, "위험 우선순위 판단에 필요하다."],
      ["취약점과 기존 통제", true, "잔여 위험을 판단하는 근거가 된다."],
      ["위험 소유자", true, "대응 책임과 이행 추적에 필요하다."],
      ["회의실 조명 색상", false, "위험 정리 항목이 아니다."],
    ],
  },
  {
    id: "practical-security-official-engineer-q03",
    title: "위험평가 기준",
    content:
      "가능성과 영향도를 조합해 위험도를 산정하고 수용 가능 수준과 비교하는 활동을 무엇이라고 하는가?",
    type: "SHORT_ANSWER",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.riskEvaluation,
    acceptedAnswers: ["위험평가", "리스크 평가", "risk assessment"],
    synonyms: ["위험도 평가", "위험 산정"],
    partialPatterns: ["위험|리스크|평가|assessment"],
  },
  {
    id: "practical-security-official-engineer-q04",
    title: "정보보호대책 이행계획",
    content:
      "정보보호대책 선정 후 이행계획에 포함할 요소를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    contentId: PRACTICAL_SECURITY_CONTENT_IDS.controlSelectionImplementationPlan,
    choices: [
      ["우선순위", true, "위험 수준에 따라 이행 순서를 정한다."],
      ["담당자와 일정", true, "실행 책임과 기한이 필요하다."],
      ["예산과 검증 방법", true, "실현 가능성과 효과 확인에 필요하다."],
      ["문제지 여백 크기", false, "이행계획 요소가 아니다."],
    ],
  },
];

function toPracticalSubItemQuestion(definition, courseIds) {
  return {
    status: "PUBLISHED",
    source: "SECURIUM independently authored practical security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    courseLinks: courseIds.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: definition.contentId,
        relationType: "PRACTICE",
      },
    ],
    answerConfig: buildPracticalAnswerConfig(definition),
    choices: buildPracticalChoices(definition),
    tags: ["실기", "공식 세부항목", ...inferPracticalQuestionTags(definition)],
    ...definition,
  };
}

function buildPracticalChoices(definition) {
  if (!definition.choices) {
    return [];
  }

  return definition.choices.map(([content, isCorrect, explanation], index) => ({
    id: `${definition.id}-choice-${String(index + 1).padStart(2, "0")}`,
    content,
    displayOrder: index + 1,
    isCorrect,
    explanation,
  }));
}

function buildPracticalAnswerConfig(definition) {
  if (definition.type !== "SHORT_ANSWER") {
    return {};
  }

  return {
    ignoreCase: true,
    normalizeWhitespace: true,
    acceptedAnswers: definition.acceptedAnswers ?? [],
    synonyms: definition.synonyms ?? [],
    useRegex: true,
    regexPatterns: definition.partialPatterns ?? [],
    partialCreditRules: (definition.partialPatterns ?? []).map((pattern) => ({
      pattern,
      score: 50,
    })),
  };
}

function inferPracticalQuestionTags(definition) {
  return definition.title
    .split(/[\s·]+/)
    .filter((tag) => tag.length >= 2)
    .slice(0, 4);
}

export const practicalSecurityQuestionSamples = [
  ...practicalSecurityOverviewQuestionSamples,
  ...sharedPracticalSubItemQuestionDefinitions.map((definition) =>
    toPracticalSubItemQuestion(definition, PRACTICAL_SECURITY_COURSE_IDS),
  ),
  ...engineerOnlyPracticalQuestionDefinitions.map((definition) =>
    toPracticalSubItemQuestion(definition, ["course-ise"]),
  ),
];

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
    contentLinkedCount: practicalSecurityQuestionSamples.filter(
      (question) => question.contentLinks.length > 0,
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
    sharedQuestionCount: practicalSecurityQuestionSamples.filter((question) =>
      PRACTICAL_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ).length,
    engineerOnlyQuestionCount: practicalSecurityQuestionSamples.filter(
      (question) =>
        question.courseLinks.length === 1 &&
        question.courseLinks[0]?.courseId === "course-ise",
    ).length,
    allSharedQuestionsLinkedToBothCourses: practicalSecurityQuestionSamples
      .filter((question) => !question.id.includes("engineer"))
      .every((question) =>
      PRACTICAL_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    allEngineerOnlyQuestionsScopedToEngineer: practicalSecurityQuestionSamples
      .filter((question) => question.id.includes("engineer"))
      .every(
        (question) =>
          question.courseLinks.length === 1 &&
          question.courseLinks[0]?.courseId === "course-ise",
      ),
    allLinkedToPracticalContent: practicalSecurityQuestionSamples.every(
      (question) => question.contentLinks.length > 0,
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
