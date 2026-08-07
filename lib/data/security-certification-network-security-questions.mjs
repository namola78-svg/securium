export const NETWORK_SECURITY_CONTENT_ID =
  "content-official-security-cert-network-security-overview";
export const NETWORK_SECURITY_CONTENT_IDS = {
  overview: NETWORK_SECURITY_CONTENT_ID,
  networkConcepts: "content-official-security-cert-network-network-concepts",
  networkUsage: "content-official-security-cert-network-network-usage",
  dosDdos: "content-official-security-cert-network-dos-ddos",
  scanning: "content-official-security-cert-network-scanning",
  spoofing: "content-official-security-cert-network-spoofing",
  arpSpoofingVerticalSlice:
    "content-official-security-cert-network-arp-spoofing-vertical-slice",
  sniffing: "content-official-security-cert-network-sniffing",
  remoteAccessAttacks:
    "content-official-security-cert-network-remote-access-attacks",
  securityProtocols: "content-official-security-cert-network-security-protocols",
  networkSecuritySolutions:
    "content-official-security-cert-network-network-security-solutions",
};

export const NETWORK_SECURITY_COURSE_IDS = ["course-ise", "course-isie"];
export const SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_NETWORK_SECURITY_QUESTION_SEED";
export const SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE =
  "APPLY_NETWORK_SECURITY_QUESTION_SEED";

function contentPracticeLinks(...contentIds) {
  return [NETWORK_SECURITY_CONTENT_IDS.overview, ...contentIds].map((contentId) => ({
    contentType: "CONTENT",
    contentId,
    relationType: "PRACTICE",
  }));
}

export const networkSecurityQuestionSamples = [
  {
    id: "network-security-official-sample-q10",
    title: "네트워크 보안 개요의 학습 범위",
    content:
      "네트워크 보안 과목을 처음 학습할 때 가장 먼저 구분해야 할 범위로 적절한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "네트워크 보안 개요에서는 네트워크 일반, 네트워크 기반 공격기술과 대응, 네트워크 보안 기술의 큰 흐름을 먼저 구분해야 세부항목 학습으로 자연스럽게 이어진다.",
    wrongAnswerExplanation:
      "특정 장비 명령어나 개별 제품명만 먼저 외우면 공식 과목 구조와 공격·대응 흐름을 놓치기 쉽다.",
    choices: [
      {
        id: "network-security-official-sample-q10-choice-01",
        content:
          "네트워크 일반, 공격기술과 대응, 네트워크 보안 기술의 관계",
        displayOrder: 1,
        isCorrect: true,
        explanation:
          "공식 과목 개요에서 세부 학습으로 내려가기 위한 가장 적절한 상위 구분이다.",
      },
      {
        id: "network-security-official-sample-q10-choice-02",
        content: "특정 방화벽 제품의 관리 화면 메뉴 순서",
        displayOrder: 2,
        isCorrect: false,
        explanation:
          "제품별 조작법은 실무 보조 지식일 수 있지만 과목 개요의 핵심 범위는 아니다.",
      },
      {
        id: "network-security-official-sample-q10-choice-03",
        content: "하나의 공격 도구 사용 절차",
        displayOrder: 3,
        isCorrect: false,
        explanation:
          "도구 사용 절차보다 공격 유형과 대응 원리를 먼저 구조화해야 한다.",
      },
      {
        id: "network-security-official-sample-q10-choice-04",
        content: "법령 조문 번호 암기",
        displayOrder: 4,
        isCorrect: false,
        explanation:
          "법규 학습은 정보보호관리 및 법규 범위에 가깝고 네트워크 보안 개요의 1차 범위가 아니다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.overview,
        relationType: "PRACTICE",
      },
    ],
    tags: ["네트워크 보안 개요", "학습 범위", "공식 과목 구조"],
    source: "SECURIUM independently authored network security overview sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q11",
    title: "공격과 대응 흐름의 개요 판단",
    content:
      "네트워크 보안 개요 관점에서 DoS/DDoS, 스캐닝, 스푸핑, 스니핑, 원격접속 공격을 학습할 때 공통적으로 먼저 확인할 질문은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "공격 유형은 세부 기법을 암기하기 전에 공격 목적, 영향을 받는 보안 속성, 탐지·완화 통제의 관계를 먼저 연결해야 한다.",
    wrongAnswerExplanation:
      "개별 명령어, 포트 번호, 장비 설정값은 중요할 수 있지만 개요 단계의 공통 판단 질문은 공격 목적과 영향, 대응 원리다.",
    choices: [
      {
        id: "network-security-official-sample-q11-choice-01",
        content:
          "공격 목적은 무엇이며 어떤 보안 속성에 영향을 주고 어떤 대응 원리로 줄일 수 있는가?",
        displayOrder: 1,
        isCorrect: true,
        explanation:
          "개요 단계에서 여러 공격 유형을 하나의 학습 체계로 묶는 질문이다.",
      },
      {
        id: "network-security-official-sample-q11-choice-02",
        content: "가장 최신 공격 도구의 실행 옵션은 무엇인가?",
        displayOrder: 2,
        isCorrect: false,
        explanation:
          "도구 옵션은 변동성이 크고 공식 개요의 구조적 이해를 대체하지 못한다.",
      },
      {
        id: "network-security-official-sample-q11-choice-03",
        content: "특정 회사 장비의 기본 관리자 계정은 무엇인가?",
        displayOrder: 3,
        isCorrect: false,
        explanation:
          "실제 기본 계정 정보는 보안상 부적절하며 학습 개요의 판단 기준도 아니다.",
      },
      {
        id: "network-security-official-sample-q11-choice-04",
        content: "공격 코드를 직접 실행하면 어떤 결과가 나오는가?",
        displayOrder: 4,
        isCorrect: false,
        explanation:
          "SECURIUM 샘플 학습은 코드를 실행하지 않고 원리와 대응 중심으로 학습한다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.overview,
        relationType: "PRACTICE",
      },
    ],
    tags: ["네트워크 보안 개요", "공격 대응 흐름", "보안 속성"],
    source: "SECURIUM independently authored network security overview sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q01",
    title: "서비스 거부 공격의 주요 영향",
    content:
      "네트워크 서비스 거부 공격은 정상 사용자가 서비스를 이용하지 못하게 만드는 가용성 침해와 가장 직접적으로 관련된다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "서비스 거부 공격은 대량 트래픽, 세션 고갈, 자원 고갈 등을 통해 정상 서비스 이용을 방해한다.",
    wrongAnswerExplanation:
      "기밀성이나 무결성 침해가 함께 발생할 수는 있지만, 대표적인 1차 영향은 가용성 저하다.",
    choices: [
      {
        id: "network-security-official-sample-q01-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "서비스 거부 공격의 핵심 영향은 가용성 저하다.",
      },
      {
        id: "network-security-official-sample-q01-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "서비스 거부 공격은 정상 서비스 이용을 방해한다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.dosDdos,
        relationType: "PRACTICE",
      },
    ],
    tags: ["DoS/DDoS", "가용성", "공격 유형"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q02",
    title: "스캐닝의 목적",
    content:
      "공격자가 침투 전 정찰 단계에서 열린 포트와 서비스 버전을 확인하려는 행위에 가장 가까운 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "스캐닝은 포트, 서비스, 운영체제, 취약 서비스 여부를 탐색해 다음 공격 가능성을 판단하는 활동이다.",
    wrongAnswerExplanation:
      "스푸핑은 신원·주소 위조, 스니핑은 트래픽 관찰, 서비스 거부는 가용성 저하를 목적으로 한다.",
    choices: [
      {
        id: "network-security-official-sample-q02-choice-01",
        content: "스캐닝",
        displayOrder: 1,
        isCorrect: true,
        explanation: "열린 포트와 서비스 버전 확인은 스캐닝의 대표 목적이다.",
      },
      {
        id: "network-security-official-sample-q02-choice-02",
        content: "스푸핑",
        displayOrder: 2,
        isCorrect: false,
        explanation: "스푸핑은 주소나 신원을 속이는 행위다.",
      },
      {
        id: "network-security-official-sample-q02-choice-03",
        content: "스니핑",
        displayOrder: 3,
        isCorrect: false,
        explanation: "스니핑은 네트워크 트래픽을 엿보거나 수집하는 행위다.",
      },
      {
        id: "network-security-official-sample-q02-choice-04",
        content: "DDoS",
        displayOrder: 4,
        isCorrect: false,
        explanation: "DDoS는 분산된 출발지에서 서비스 가용성을 저하시킨다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.scanning,
        relationType: "PRACTICE",
      },
    ],
    tags: ["스캐닝", "정찰", "포트"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q03",
    title: "스푸핑과 스니핑 대응",
    content:
      "ARP 스푸핑과 트래픽 스니핑 위험을 줄이기 위한 대응으로 적절한 것을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "스푸핑은 위조를 줄이는 통제, 스니핑은 평문 노출을 줄이는 암호화와 네트워크 분리 통제가 중요하다.",
    wrongAnswerExplanation:
      "모든 ICMP를 무조건 허용하거나 인증 없는 관리 포트를 열어두는 것은 대응이 아니다.",
    choices: [
      {
        id: "network-security-official-sample-q03-choice-01",
        content: "중요 구간 통신 암호화",
        displayOrder: 1,
        isCorrect: true,
        explanation: "암호화는 스니핑으로 인한 평문 노출 위험을 줄인다.",
      },
      {
        id: "network-security-official-sample-q03-choice-02",
        content: "스위치 보안 기능과 ARP 이상 징후 탐지",
        displayOrder: 2,
        isCorrect: true,
        explanation: "ARP 위조나 비정상 매핑을 탐지·차단하는 통제가 도움이 된다.",
      },
      {
        id: "network-security-official-sample-q03-choice-03",
        content: "인증 없는 원격 관리 포트 상시 개방",
        displayOrder: 3,
        isCorrect: false,
        explanation: "관리 포트 개방은 공격면을 넓힐 수 있다.",
      },
      {
        id: "network-security-official-sample-q03-choice-04",
        content: "업무망과 중요 서버망의 적절한 분리",
        displayOrder: 4,
        isCorrect: true,
        explanation: "망 분리는 관찰·위조 가능한 범위를 줄이는 데 도움이 된다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.spoofing,
        relationType: "PRACTICE",
      },
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.sniffing,
        relationType: "PRACTICE",
      },
    ],
    tags: ["스푸핑", "스니핑", "암호화", "망분리"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q04",
    title: "VPN의 핵심 목적",
    content:
      "원격 사용자가 공용망을 통해 내부 시스템에 접속할 때 기밀성과 무결성을 높이기 위해 사용하는 암호화된 통신 경로를 무엇이라고 하는가?",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    explanation:
      "VPN은 공용망 위에 암호화된 터널을 구성해 원격 접속의 보안성을 높이는 기술이다.",
    wrongAnswerExplanation:
      "단순 원격 접속 허용만으로는 암호화와 터널링을 보장하지 않는다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["VPN", "가상사설망", "암호화 터널"],
      synonyms: ["virtual private network", "보안 터널"],
      useRegex: false,
      partialCreditRules: [{ pattern: "터널|암호화|원격", score: 50 }],
    },
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.remoteAccessAttacks,
        relationType: "PRACTICE",
      },
    ],
    tags: ["VPN", "암호화", "원격접속"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q05",
    title: "IDS와 IPS의 차이",
    content:
      "다음 중 IDS와 IPS의 차이를 가장 적절히 설명한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "IDS는 탐지와 알림 중심, IPS는 인라인 위치에서 탐지한 트래픽을 차단할 수 있는 통제까지 수행한다.",
    wrongAnswerExplanation:
      "두 장비 모두 네트워크 보안장비지만, 배치 방식과 차단 가능 여부가 다르다.",
    choices: [
      {
        id: "network-security-official-sample-q05-choice-01",
        content: "IDS는 탐지 중심이고 IPS는 차단까지 수행할 수 있다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "대표적인 구분 기준이다.",
      },
      {
        id: "network-security-official-sample-q05-choice-02",
        content: "IDS는 암호화 장비이고 IPS는 백업 장비다.",
        displayOrder: 2,
        isCorrect: false,
        explanation: "둘 다 침입 탐지·방지 계열 보안장비다.",
      },
      {
        id: "network-security-official-sample-q05-choice-03",
        content: "IDS는 항상 무선망 전용이고 IPS는 항상 유선망 전용이다.",
        displayOrder: 3,
        isCorrect: false,
        explanation: "유무선 여부가 핵심 구분 기준은 아니다.",
      },
      {
        id: "network-security-official-sample-q05-choice-04",
        content: "IDS와 IPS는 기능 차이가 없으며 명칭만 다르다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "탐지 후 조치 방식과 배치 방식에서 차이가 있다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.networkSecuritySolutions,
        relationType: "PRACTICE",
      },
    ],
    tags: ["IDS/IPS", "보안장비", "차단"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q06",
    title: "SIEM 상관분석에 활용할 수 있는 로그",
    content:
      "SIEM에서 네트워크 공격 의심 상황을 상관분석하기 위해 함께 볼 수 있는 로그로 적절한 것을 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "SIEM은 여러 보안·시스템 로그를 수집해 시간, 출발지, 목적지, 이벤트 유형을 기준으로 상관분석한다.",
    wrongAnswerExplanation:
      "임의로 작성한 미검증 메모만으로는 상관분석 근거로 보기 어렵다.",
    choices: [
      {
        id: "network-security-official-sample-q06-choice-01",
        content: "방화벽 허용·차단 로그",
        displayOrder: 1,
        isCorrect: true,
        explanation: "네트워크 접근 흐름과 차단 여부를 확인할 수 있다.",
      },
      {
        id: "network-security-official-sample-q06-choice-02",
        content: "IDS/IPS 탐지 이벤트",
        displayOrder: 2,
        isCorrect: true,
        explanation: "공격 패턴 탐지 여부를 확인할 수 있다.",
      },
      {
        id: "network-security-official-sample-q06-choice-03",
        content: "VPN 접속 기록",
        displayOrder: 3,
        isCorrect: true,
        explanation: "원격 접속 주체와 시간을 확인하는 데 도움이 된다.",
      },
      {
        id: "network-security-official-sample-q06-choice-04",
        content: "근거 없는 구두 전달 내용",
        displayOrder: 4,
        isCorrect: false,
        explanation: "검증 가능한 시스템 기록으로 보기 어렵다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 120 : 90,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.networkSecuritySolutions,
        relationType: "PRACTICE",
      },
    ],
    tags: ["SIEM", "Firewall", "IDS/IPS", "VPN", "로그"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q07",
    title: "OSI 7계층과 TCP/IP 계층 이해",
    content:
      "다음 중 OSI 7계층에서 전송 계층의 대표적인 역할을 가장 적절히 설명한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "전송 계층은 종단 간 통신, 흐름 제어, 오류 제어, 포트 기반 다중화와 같이 애플리케이션 간 데이터 전달을 지원한다.",
    wrongAnswerExplanation:
      "물리적 신호 변환은 물리 계층, 경로 선택은 네트워크 계층, 사용자 인터페이스 제공은 응용 계층에 더 가깝다.",
    choices: [
      {
        id: "network-security-official-sample-q07-choice-01",
        content: "종단 간 통신과 포트 기반 데이터 전달을 지원한다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "TCP와 UDP가 대표적인 전송 계층 프로토콜이다.",
      },
      {
        id: "network-security-official-sample-q07-choice-02",
        content: "전기 신호와 케이블 규격을 정의한다.",
        displayOrder: 2,
        isCorrect: false,
        explanation: "이는 물리 계층의 역할에 가깝다.",
      },
      {
        id: "network-security-official-sample-q07-choice-03",
        content: "IP 주소 기반 경로를 선택한다.",
        displayOrder: 3,
        isCorrect: false,
        explanation: "경로 선택은 네트워크 계층의 핵심 역할이다.",
      },
      {
        id: "network-security-official-sample-q07-choice-04",
        content: "웹 브라우저 화면을 직접 렌더링한다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "사용자 화면 구성은 네트워크 계층 모델의 전송 계층 역할이 아니다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.networkConcepts,
        relationType: "PRACTICE",
      },
    ],
    tags: ["OSI 7계층", "TCP/IP", "전송 계층"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q08",
    title: "NAT의 기본 활용",
    content:
      "NAT는 내부 사설 IP 주소를 외부 통신이 가능한 주소로 변환하여 주소 부족 완화와 내부 주소 노출 감소에 활용될 수 있다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "NAT는 사설망과 공용망 사이에서 주소를 변환하며, 주소 절약과 내부 구조 노출 감소에 도움을 줄 수 있다.",
    wrongAnswerExplanation:
      "NAT는 암호화 기술 자체는 아니며, 접근통제나 암호화 통제를 대체하지 않는다.",
    choices: [
      {
        id: "network-security-official-sample-q08-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "NAT의 대표 활용을 설명한 문장이다.",
      },
      {
        id: "network-security-official-sample-q08-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "NAT는 주소 변환 기술이며 설명의 핵심은 맞다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.networkUsage,
        relationType: "PRACTICE",
      },
    ],
    tags: ["NAT", "사설 IP", "주소 변환"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-official-sample-q09",
    title: "보안 프로토콜의 목적",
    content:
      "전송 구간에서 기밀성과 무결성을 보호하기 위해 웹 통신에 널리 사용하는 보안 프로토콜은 무엇인가?",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    explanation:
      "TLS는 HTTPS의 기반이 되는 보안 프로토콜로, 전송 구간에서 기밀성, 무결성, 서버 인증 등을 지원한다.",
    wrongAnswerExplanation:
      "단순 HTTP는 암호화된 전송을 보장하지 않으며, DNS나 ARP는 웹 전송 구간 보호를 위한 대표 보안 프로토콜이 아니다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["TLS", "SSL/TLS", "Transport Layer Security"],
      synonyms: ["https 보안 프로토콜", "전송 계층 보안"],
      useRegex: false,
      partialCreditRules: [{ pattern: "SSL|HTTPS|암호화", score: 50 }],
    },
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 100,
    })),
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: NETWORK_SECURITY_CONTENT_IDS.securityProtocols,
        relationType: "PRACTICE",
      },
    ],
    tags: ["TLS", "SSL", "HTTPS", "보안 프로토콜"],
    source: "SECURIUM independently authored network security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-arp-spoofing-slice-q01",
    title: "ARP의 목적",
    content: "ARP가 같은 네트워크 구간에서 수행하는 주된 역할은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "ARP는 IP 주소에 대응하는 MAC 주소를 알아내기 위해 사용된다.",
    wrongAnswerExplanation:
      "라우팅 경로 계산이나 도메인 이름 해석은 ARP의 역할이 아니다.",
    choices: [
      {
        id: "network-security-arp-spoofing-slice-q01-choice-01",
        content: "IP 주소에 대응하는 MAC 주소 확인",
        displayOrder: 1,
        isCorrect: true,
        explanation: "ARP의 핵심 목적이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q01-choice-02",
        content: "도메인 이름을 IP 주소로 변환",
        displayOrder: 2,
        isCorrect: false,
        explanation: "DNS의 역할이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q01-choice-03",
        content: "최적 라우팅 경로 계산",
        displayOrder: 3,
        isCorrect: false,
        explanation: "라우팅 프로토콜의 영역이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q01-choice-04",
        content: "웹 통신 암호화",
        displayOrder: 4,
        isCorrect: false,
        explanation: "TLS 같은 보안 프로토콜의 역할이다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: [
      ...contentPracticeLinks(
        NETWORK_SECURITY_CONTENT_IDS.spoofing,
        NETWORK_SECURITY_CONTENT_IDS.arpSpoofingVerticalSlice,
      ),
    ],
    tags: ["ARP", "MAC 주소", "IP 주소"],
    source: "SECURIUM independently authored ARP spoofing vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-arp-spoofing-slice-q02",
    title: "ARP Spoofing 판단",
    content:
      "공격자가 게이트웨이 IP의 MAC 주소를 자신의 MAC 주소로 속였다. 이 공격 유형은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "ARP 매핑을 위조해 통신 경로를 속이는 공격은 ARP Spoofing이다.",
    wrongAnswerExplanation:
      "단순 스니핑은 관찰 행위이며, ARP Spoofing은 경로를 속이는 선행 공격이다.",
    choices: [
      {
        id: "network-security-arp-spoofing-slice-q02-choice-01",
        content: "ARP Spoofing",
        displayOrder: 1,
        isCorrect: true,
        explanation: "IP-MAC 매핑 관계를 속이는 공격이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q02-choice-02",
        content: "DDoS",
        displayOrder: 2,
        isCorrect: false,
        explanation: "가용성을 저하시키는 대량 트래픽 공격이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q02-choice-03",
        content: "Port Scanning",
        displayOrder: 3,
        isCorrect: false,
        explanation: "열린 포트나 서비스 탐색이다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q02-choice-04",
        content: "DNS Zone Transfer",
        displayOrder: 4,
        isCorrect: false,
        explanation: "DNS 영역 정보 노출과 관련된다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      NETWORK_SECURITY_CONTENT_IDS.spoofing,
      NETWORK_SECURITY_CONTENT_IDS.arpSpoofingVerticalSlice,
    ),
    tags: ["ARP Spoofing", "스푸핑", "중간자 공격"],
    source: "SECURIUM independently authored ARP spoofing vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-arp-spoofing-slice-q03",
    title: "스푸핑과 스니핑 구분",
    content:
      "스푸핑은 속이는 행위이고 스니핑은 트래픽을 관찰하는 행위이다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "스푸핑은 신뢰 관계나 주소 정보를 속이는 행위이고, 스니핑은 트래픽을 수집·관찰하는 행위다.",
    wrongAnswerExplanation:
      "두 용어는 함께 등장할 수 있지만 같은 의미가 아니다.",
    choices: [
      {
        id: "network-security-arp-spoofing-slice-q03-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "두 공격 행위의 핵심 차이를 올바르게 설명했다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q03-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "스푸핑과 스니핑은 구분해야 한다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      NETWORK_SECURITY_CONTENT_IDS.spoofing,
      NETWORK_SECURITY_CONTENT_IDS.arpSpoofingVerticalSlice,
    ),
    tags: ["스푸핑", "스니핑", "MITM"],
    source: "SECURIUM independently authored ARP spoofing vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-arp-spoofing-slice-q04",
    title: "ARP Spoofing 대응",
    content:
      "ARP Spoofing 대응으로 적절한 조치를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "Dynamic ARP Inspection, DHCP Snooping, 포트 보안, 암호화된 전송은 ARP Spoofing 영향 완화에 도움이 된다.",
    wrongAnswerExplanation:
      "평문 전송 확대나 모든 포트 개방은 위험을 키울 수 있다.",
    choices: [
      {
        id: "network-security-arp-spoofing-slice-q04-choice-01",
        content: "Dynamic ARP Inspection 적용",
        displayOrder: 1,
        isCorrect: true,
        explanation: "위조 ARP 응답 탐지·차단에 활용된다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q04-choice-02",
        content: "DHCP Snooping 기반 검증",
        displayOrder: 2,
        isCorrect: true,
        explanation: "신뢰 가능한 IP-MAC 바인딩 근거를 제공한다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q04-choice-03",
        content: "평문 프로토콜 사용 확대",
        displayOrder: 3,
        isCorrect: false,
        explanation: "중간자 공격 시 정보 노출 위험이 커진다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q04-choice-04",
        content: "중요 통신 구간 TLS 적용",
        displayOrder: 4,
        isCorrect: true,
        explanation: "경로가 노출되어도 내용 보호에 도움이 된다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      NETWORK_SECURITY_CONTENT_IDS.spoofing,
      NETWORK_SECURITY_CONTENT_IDS.arpSpoofingVerticalSlice,
    ),
    tags: ["DAI", "DHCP Snooping", "TLS"],
    source: "SECURIUM independently authored ARP spoofing vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "network-security-arp-spoofing-slice-q05",
    title: "ARP 이상 징후",
    content:
      "동일 IP에 대해 MAC 주소가 짧은 시간에 반복 변경되는 로그는 ARP Spoofing 의심 근거가 될 수 있다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    explanation:
      "ARP 매핑이 비정상적으로 자주 바뀌면 위조 응답이나 중간자 공격 가능성을 점검해야 한다.",
    wrongAnswerExplanation:
      "정상 네트워크 변경도 있을 수 있지만 보안 점검 근거로는 충분히 중요하다.",
    choices: [
      {
        id: "network-security-arp-spoofing-slice-q05-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "ARP Spoofing 점검 단서가 될 수 있다.",
      },
      {
        id: "network-security-arp-spoofing-slice-q05-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "반복 변경은 반드시 확인해야 할 이상 징후다.",
      },
    ],
    answerConfig: {},
    courseLinks: NETWORK_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      NETWORK_SECURITY_CONTENT_IDS.spoofing,
      NETWORK_SECURITY_CONTENT_IDS.arpSpoofingVerticalSlice,
    ),
    tags: ["ARP Cache", "MAC 변경", "로그 분석"],
    source: "SECURIUM independently authored ARP spoofing vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
];

export function getNetworkSecurityQuestionBankReadiness() {
  const courseCounts = Object.fromEntries(
    NETWORK_SECURITY_COURSE_IDS.map((courseId) => [
      courseId,
      networkSecurityQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ).length,
    ]),
  );
  const typeCounts = networkSecurityQuestionSamples.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
    return counts;
  }, {});
  const contentLinkedCount = networkSecurityQuestionSamples.filter((question) =>
    question.contentLinks.some(
      (link) =>
        link.contentType === "CONTENT" &&
        Object.values(NETWORK_SECURITY_CONTENT_IDS).includes(link.contentId),
    ),
  ).length;
  const contentLinkCounts = Object.fromEntries(
    Object.values(NETWORK_SECURITY_CONTENT_IDS).map((contentId) => [
      contentId,
      networkSecurityQuestionSamples.filter((question) =>
        question.contentLinks.some(
          (link) =>
            link.contentType === "CONTENT" && link.contentId === contentId,
        ),
      ).length,
    ]),
  );

  return {
    questionCount: networkSecurityQuestionSamples.length,
    courseCounts,
    typeCounts,
    contentLinkedCount,
    contentLinkCounts,
    allPublished: networkSecurityQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: networkSecurityQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored: networkSecurityQuestionSamples.every((question) =>
      question.source.includes("independently authored"),
    ),
    allLinkedToBothCourses: networkSecurityQuestionSamples.every((question) =>
      NETWORK_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    allLinkedToNetworkContent:
      contentLinkedCount === networkSecurityQuestionSamples.length,
  };
}

export function toNetworkSecurityGradingQuestion(question) {
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

export function generateNetworkSecurityQuestionSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statements = [];
  if (dialect === "postgres") statements.push("BEGIN;");

  for (const question of networkSecurityQuestionSamples) {
    statements.push(insertQuestionSql(question, dialect));
    for (const choice of question.choices) {
      statements.push(insertChoiceSql(question, choice, dialect));
    }
    for (const courseLink of question.courseLinks) {
      statements.push(insertQuestionCourseSql(question, courseLink, dialect));
      statements.push(insertSubjectLinkSql(question, courseLink, dialect));
      statements.push(insertTopicLinkSql(question, courseLink, dialect));
    }
    for (const contentLink of question.contentLinks) {
      statements.push(insertContentQuestionLinkSql(question, contentLink, dialect));
    }
    statements.push(insertQuestionVersionSql(question, dialect));
  }

  if (dialect === "postgres") {
    statements.push(`
INSERT INTO app_schema_migrations (id, checksum)
VALUES ('seed_network_security_questions_2027_2029', 'manual-network-security-questions-2027-2029')
ON CONFLICT (id) DO NOTHING;`.trim());
    statements.push("COMMIT;");
  }

  return `${statements.join("\n\n")}\n`;
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
  "version" = EXCLUDED."version",
  "answer_config_json" = EXCLUDED."answer_config_json",
  "is_sample" = EXCLUDED."is_sample",
  "reviewed_by" = EXCLUDED."reviewed_by",
  "published_at" = COALESCE("questions"."published_at", EXCLUDED."published_at"),
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "questions" (
  "id", "title", "content", "type", "difficulty", "explanation",
  "wrong_answer_explanation", "status", "source", "source_date", "version",
  "answer_config_json", "is_sample", "created_by", "reviewed_by", "published_at"
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
  ${q(JSON.stringify(question.answerConfig))},
  ${question.sampleOnly ? 1 : 0},
  'user-admin',
  'user-content-reviewer',
  ${nowExpression(dialect)}
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

function insertQuestionCourseSql(question, courseLink, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("question_id", "course_id") DO UPDATE SET
  "weight" = EXCLUDED."weight"`;

  return `
${insert} INTO "question_courses" ("question_id", "course_id", "weight")
VALUES (${q(question.id)}, ${q(courseLink.courseId)}, ${courseLink.weight})
${conflict};`.trim();
}

function insertSubjectLinkSql(question, courseLink, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const subjectId = `${courseLink.courseId}-subject-foundation`;
  const conflict = dialect === "d1" ? "" : `\nON CONFLICT ("question_id", "subject_id") DO NOTHING`;

  return `
${insert} INTO "question_subjects" ("question_id", "subject_id")
SELECT ${q(question.id)}, ${q(subjectId)}
WHERE EXISTS (
  SELECT 1 FROM "subjects" WHERE "id" = ${q(subjectId)}
)
${conflict};`.trim();
}

function insertTopicLinkSql(question, courseLink, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const topicId = `${courseLink.courseId}-subject-foundation-topic-core`;
  const conflict = dialect === "d1" ? "" : `\nON CONFLICT ("question_id", "topic_id") DO NOTHING`;

  return `
${insert} INTO "question_topics" ("question_id", "topic_id")
SELECT ${q(question.id)}, ${q(topicId)}
WHERE EXISTS (
  SELECT 1 FROM "topics" WHERE "id" = ${q(topicId)}
)
${conflict};`.trim();
}

function insertContentQuestionLinkSql(question, contentLink, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const contentKey = contentLink.contentId
    .replace(/^content-official-security-cert-network-/, "")
    .replaceAll(/[^a-z0-9-]/gi, "-");
  const id = `network-security-content-link-${question.id}-${contentKey}`;
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
    contentIds: question.contentLinks.map((link) => link.contentId),
    courseIds: question.courseLinks.map((link) => link.courseId),
  };
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO NOTHING`;

  return `
${insert} INTO "question_versions" (
  "id", "question_id", "version", "snapshot_json", "review_comment", "created_by"
)
VALUES (
  ${q(versionId)},
  ${q(question.id)},
  1,
  ${q(JSON.stringify(snapshot))},
  'SECURIUM independently authored network security sample seed',
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
