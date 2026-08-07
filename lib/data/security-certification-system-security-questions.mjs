export const SYSTEM_SECURITY_CONTENT_ID =
  "content-official-security-cert-system-security-overview";

export const SYSTEM_SECURITY_SUBITEM_CONTENT_IDS = {
  endpointServerSystems:
    "content-official-security-cert-system-endpoint-server-systems",
  operatingSystems: "content-official-security-cert-system-operating-systems",
  linuxFilePermissions:
    "content-official-security-cert-system-linux-file-permissions",
  systemInformation: "content-official-security-cert-system-system-information",
  systemSecurityThreats:
    "content-official-security-cert-system-system-security-threats",
  systemAttackTechniques:
    "content-official-security-cert-system-system-attack-techniques",
  systemSecurityResponseTechniques:
    "content-official-security-cert-system-system-security-response-techniques",
  systemAnalysisTools:
    "content-official-security-cert-system-system-analysis-tools",
  systemSecuritySolutions:
    "content-official-security-cert-system-system-security-solutions",
};

export const SYSTEM_SECURITY_COURSE_IDS = ["course-ise", "course-isie"];

export const SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SYSTEM_SECURITY_QUESTION_SEED";
export const SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE =
  "APPLY_SYSTEM_SECURITY_QUESTION_SEED";

function contentPracticeLinks(...contentIds) {
  return [SYSTEM_SECURITY_CONTENT_ID, ...contentIds].map((contentId) => ({
    contentType: "CONTENT",
    contentId,
    relationType: "PRACTICE",
  }));
}

export const systemSecurityQuestionSamples = [
  {
    id: "system-security-official-sample-q01",
    title: "불필요 계정 관리의 목적",
    content:
      "운영 서버에서 퇴사자 계정과 장기 미사용 계정을 정기적으로 비활성화하는 주된 보안 목적은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "불필요 계정은 공격자가 탈취하거나 내부자가 오용할 수 있는 접근 경로가 되므로 최소권한과 계정 생명주기 관리 관점에서 제거하거나 비활성화해야 한다.",
    wrongAnswerExplanation:
      "성능 개선이나 저장공간 절약보다 접근권한 오남용과 계정 탈취 위험을 줄이는 것이 핵심이다.",
    choices: [
      {
        id: "system-security-official-sample-q01-choice-01",
        content: "권한 없는 접근 경로와 계정 탈취 위험을 줄이기 위해서",
        displayOrder: 1,
        isCorrect: true,
        explanation: "계정 생명주기 관리의 핵심 목적이다.",
      },
      {
        id: "system-security-official-sample-q01-choice-02",
        content: "서버 디스크 사용량을 줄이기 위해서",
        displayOrder: 2,
        isCorrect: false,
        explanation: "계정 정리의 부수 효과일 수 있으나 보안상 핵심 목적은 아니다.",
      },
      {
        id: "system-security-official-sample-q01-choice-03",
        content: "네트워크 대역폭을 늘리기 위해서",
        displayOrder: 3,
        isCorrect: false,
        explanation: "계정 관리는 네트워크 대역폭 증가와 직접 관련이 없다.",
      },
      {
        id: "system-security-official-sample-q01-choice-04",
        content: "모든 로그 수집을 중단하기 위해서",
        displayOrder: 4,
        isCorrect: false,
        explanation: "로그 수집은 중단이 아니라 강화해야 할 통제다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
    ),
    tags: ["계정관리", "최소권한", "접근통제"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q02",
    title: "관리자 권한 사용 원칙",
    content:
      "관리자 권한은 업무 편의를 위해 모든 사용자에게 상시 부여하는 것이 바람직하다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "관리자 권한은 최소권한 원칙에 따라 필요한 사용자와 필요한 시간에 제한적으로 부여하고, 사용 이력을 감사할 수 있어야 한다.",
    wrongAnswerExplanation:
      "상시 관리자 권한은 침해 발생 시 피해 범위를 크게 만들 수 있다.",
    choices: [
      {
        id: "system-security-official-sample-q02-true",
        content: "O",
        displayOrder: 1,
        isCorrect: false,
        explanation: "상시·광범위 관리자 권한 부여는 최소권한 원칙에 어긋난다.",
      },
      {
        id: "system-security-official-sample-q02-false",
        content: "X",
        displayOrder: 2,
        isCorrect: true,
        explanation: "관리자 권한은 제한적으로 부여하고 감사해야 한다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
    ),
    tags: ["권한관리", "최소권한", "관리자계정"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q03",
    title: "침해 징후 로그 선택",
    content:
      "시스템 침해 가능성을 판단할 때 우선 확인할 수 있는 로그 또는 이벤트를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "반복 인증 실패, 권한 상승, 비정상 프로세스 실행, 중요 파일 변경은 침해 징후 분석에 활용할 수 있다.",
    wrongAnswerExplanation:
      "근거 없는 구두 보고만으로는 침해 징후를 검증하기 어렵다.",
    choices: [
      {
        id: "system-security-official-sample-q03-choice-01",
        content: "짧은 시간 안에 반복된 로그인 실패",
        displayOrder: 1,
        isCorrect: true,
        explanation: "무차별 대입이나 계정 탈취 시도 징후일 수 있다.",
      },
      {
        id: "system-security-official-sample-q03-choice-02",
        content: "관리자 권한 상승 또는 sudo 실행 기록",
        displayOrder: 2,
        isCorrect: true,
        explanation: "권한 상승이나 관리자 작업 추적에 중요하다.",
      },
      {
        id: "system-security-official-sample-q03-choice-03",
        content: "승인되지 않은 프로세스 실행",
        displayOrder: 3,
        isCorrect: true,
        explanation: "악성코드나 비인가 도구 실행의 단서가 될 수 있다.",
      },
      {
        id: "system-security-official-sample-q03-choice-04",
        content: "출처와 시간이 확인되지 않는 구두 전달 내용",
        displayOrder: 4,
        isCorrect: false,
        explanation: "검증 가능한 시스템 기록이 아니므로 1차 로그 근거로 보기 어렵다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 115 : 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemInformation,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemAttackTechniques,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
    ),
    tags: ["로그분석", "권한 상승", "침해징후"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q04",
    title: "클라우드 공유책임",
    content:
      "클라우드 환경에서 사용자가 직접 관리해야 하는 대표적인 보안 항목으로 보기 어려운 것은?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "일반적으로 물리 데이터센터의 출입통제와 시설 보안은 CSP 책임에 가깝고, IAM 권한, 스토리지 공개 설정, 보안그룹, 로그 활성화는 사용자의 설정 책임이 될 수 있다.",
    wrongAnswerExplanation:
      "클라우드 사용자는 서비스 유형에 따라 계정, 접근권한, 네트워크 노출, 데이터 보호 설정을 직접 관리해야 한다.",
    choices: [
      {
        id: "system-security-official-sample-q04-choice-01",
        content: "클라우드 데이터센터 물리 출입통제",
        displayOrder: 1,
        isCorrect: true,
        explanation: "대부분 CSP의 물리 보안 책임 범위에 속한다.",
      },
      {
        id: "system-security-official-sample-q04-choice-02",
        content: "IAM 권한과 장기 키 관리",
        displayOrder: 2,
        isCorrect: false,
        explanation: "사용자 책임 설정 항목이 될 수 있다.",
      },
      {
        id: "system-security-official-sample-q04-choice-03",
        content: "스토리지 공개 범위 설정",
        displayOrder: 3,
        isCorrect: false,
        explanation: "사용자 실수로 공개될 수 있어 직접 관리해야 한다.",
      },
      {
        id: "system-security-official-sample-q04-choice-04",
        content: "보안그룹의 인바운드 허용 범위",
        displayOrder: 4,
        isCorrect: false,
        explanation: "네트워크 노출 범위는 중요한 사용자 관리 항목이다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 115 : 95,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.endpointServerSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityThreats,
    ),
    tags: ["클라우드 보안", "공유책임", "IAM"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q05",
    title: "원격접속 보안 통제",
    content:
      "관리용 SSH 또는 RDP가 인터넷에 노출되어 있을 때 우선 적용할 수 있는 보안 통제를 모두 고르시오.",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "관리 포트는 허용 IP 제한, MFA, Bastion 또는 VPN 경유, 접속 로그 모니터링을 통해 노출과 오용 가능성을 낮춘다.",
    wrongAnswerExplanation:
      "관리 포트를 모든 IP에 열어두거나 로그를 비활성화하면 침해 탐지와 접근통제가 약해진다.",
    choices: [
      {
        id: "system-security-official-sample-q05-choice-01",
        content: "허용 IP 또는 관리망으로 접근 범위를 제한한다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "노출 범위를 줄이는 기본 통제다.",
      },
      {
        id: "system-security-official-sample-q05-choice-02",
        content: "MFA 또는 강화된 인증을 적용한다.",
        displayOrder: 2,
        isCorrect: true,
        explanation: "계정 탈취 피해 가능성을 낮춘다.",
      },
      {
        id: "system-security-official-sample-q05-choice-03",
        content: "Bastion 또는 VPN 경유 접속을 사용한다.",
        displayOrder: 3,
        isCorrect: true,
        explanation: "직접 노출을 줄이고 접근 경로를 통제할 수 있다.",
      },
      {
        id: "system-security-official-sample-q05-choice-04",
        content: "접속 로그를 저장하지 않도록 설정한다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "접속 로그는 감사와 침해 분석에 필요하다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecuritySolutions,
    ),
    tags: ["원격접속", "MFA", "Bastion", "로그"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q06",
    title: "최소권한 원칙",
    content:
      "사용자나 서비스 계정에 업무 수행에 필요한 권한만 부여하고 불필요한 권한을 제거하는 보안 원칙은 무엇인가?",
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    explanation:
      "최소권한 원칙은 침해나 오남용이 발생하더라도 피해 범위를 줄이기 위한 기본 접근통제 원칙이다.",
    wrongAnswerExplanation:
      "모든 권한 부여나 기본 허용 정책은 최소권한 원칙과 반대 방향이다.",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: ["최소권한", "최소 권한", "최소권한 원칙"],
      synonyms: ["least privilege", "principle of least privilege"],
      useRegex: false,
      partialCreditRules: [{ pattern: "권한|privilege", score: 50 }],
    },
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
    ),
    tags: ["최소권한", "접근통제", "권한관리"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q07",
    title: "시스템 분석 도구의 활용",
    content:
      "컨테이너 이미지의 알려진 취약 패키지와 보안 권고를 점검하는 데 적합한 도구 활용 예로 가장 알맞은 것은?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "컨테이너 이미지 취약점 점검에는 Trivy 같은 이미지·패키지 취약점 스캐너를 사용할 수 있으며, 결과는 운영 영향도와 패치 가능성을 함께 검토해야 한다.",
    wrongAnswerExplanation:
      "도구 이름보다 점검 대상과 목적을 맞추는 것이 핵심이다. Nmap은 주로 네트워크·포트 노출면 확인에, ScoutSuite나 Wiz는 클라우드 구성 점검에 더 가깝다.",
    choices: [
      {
        id: "system-security-official-sample-q07-choice-01",
        content: "Trivy로 컨테이너 이미지의 취약 패키지를 스캔한다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "컨테이너 이미지 취약점 분석 도구 활용 예로 적절하다.",
      },
      {
        id: "system-security-official-sample-q07-choice-02",
        content: "Nmap으로 임직원 교육 이수율을 계산한다.",
        displayOrder: 2,
        isCorrect: false,
        explanation: "Nmap은 교육 이수율 관리 도구가 아니다.",
      },
      {
        id: "system-security-official-sample-q07-choice-03",
        content: "백신 예외 목록만 보고 클라우드 IAM 과다 권한을 확정한다.",
        displayOrder: 3,
        isCorrect: false,
        explanation: "IAM 과다 권한은 계정·정책·권한 범위를 별도로 분석해야 한다.",
      },
      {
        id: "system-security-official-sample-q07-choice-04",
        content: "방화벽 정책표만으로 서버 패키지 취약점 존재를 확정한다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "방화벽 정책은 네트워크 접근 통제 근거이지 패키지 취약점 근거가 아니다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: courseId === "course-ise" ? 110 : 95,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemAnalysisTools,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityThreats,
    ),
    tags: ["취약점 분석", "Trivy", "컨테이너 보안"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-official-sample-q08",
    title: "시스템 보안 솔루션의 한계",
    content:
      "EDR이나 백신 같은 시스템 보안 솔루션을 설치하면 계정 권한 관리와 로그 모니터링을 생략해도 된다.",
    type: "TRUE_FALSE",
    difficulty: "EASY",
    explanation:
      "시스템 보안 솔루션은 탐지·차단·격리와 모니터링에 도움을 주지만, 계정 권한 관리, 패치, 로그 점검 같은 기본 운영 통제를 대체하지 않는다.",
    wrongAnswerExplanation:
      "보안 솔루션은 여러 통제 중 하나이며, 운영 정책과 로그 근거가 함께 관리되어야 한다.",
    choices: [
      {
        id: "system-security-official-sample-q08-true",
        content: "O",
        displayOrder: 1,
        isCorrect: false,
        explanation: "보안 솔루션만으로 모든 운영 통제를 대체할 수 없다.",
      },
      {
        id: "system-security-official-sample-q08-false",
        content: "X",
        displayOrder: 2,
        isCorrect: true,
        explanation: "솔루션과 기본 보안 운영 통제를 함께 적용해야 한다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecuritySolutions,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.systemSecurityResponseTechniques,
    ),
    tags: ["EDR", "백신", "보안 솔루션", "로그 모니터링"],
    source: "SECURIUM independently authored system security sample",
    sourceDate: "2026-08-03",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-linux-permission-slice-q01",
    title: "chmod 750 해석",
    content: "Linux에서 chmod 750이 의미하는 권한 설명으로 가장 적절한 것은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation:
      "750은 소유자 rwx, 그룹 r-x, 기타 사용자 --- 권한을 의미한다.",
    wrongAnswerExplanation:
      "각 자리의 7, 5, 0은 소유자·그룹·기타 사용자 순서로 해석한다.",
    choices: [
      {
        id: "system-security-linux-permission-slice-q01-choice-01",
        content: "소유자 rwx, 그룹 r-x, 기타 사용자 ---",
        displayOrder: 1,
        isCorrect: true,
        explanation: "7=4+2+1, 5=4+1, 0=권한 없음이다.",
      },
      {
        id: "system-security-linux-permission-slice-q01-choice-02",
        content: "소유자 r--, 그룹 rw-, 기타 사용자 rwx",
        displayOrder: 2,
        isCorrect: false,
        explanation: "750의 순서와 값이 맞지 않는다.",
      },
      {
        id: "system-security-linux-permission-slice-q01-choice-03",
        content: "모든 사용자 rwx",
        displayOrder: 3,
        isCorrect: false,
        explanation: "모든 사용자 rwx는 777이다.",
      },
      {
        id: "system-security-linux-permission-slice-q01-choice-04",
        content: "소유자와 기타 사용자만 실행 가능",
        displayOrder: 4,
        isCorrect: false,
        explanation: "750에서 기타 사용자는 권한이 없다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.linuxFilePermissions,
    ),
    tags: ["Linux", "chmod", "파일 권한"],
    source: "SECURIUM independently authored Linux file permission vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-linux-permission-slice-q02",
    title: "권한 숫자와 의미",
    content: "Linux 파일 권한에서 쓰기 권한(w)에 해당하는 숫자는 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation: "읽기 r=4, 쓰기 w=2, 실행 x=1로 계산한다.",
    wrongAnswerExplanation: "4는 읽기, 1은 실행 권한이다.",
    choices: [
      {
        id: "system-security-linux-permission-slice-q02-choice-01",
        content: "2",
        displayOrder: 1,
        isCorrect: true,
        explanation: "쓰기 권한의 숫자 값이다.",
      },
      {
        id: "system-security-linux-permission-slice-q02-choice-02",
        content: "4",
        displayOrder: 2,
        isCorrect: false,
        explanation: "읽기 권한 값이다.",
      },
      {
        id: "system-security-linux-permission-slice-q02-choice-03",
        content: "1",
        displayOrder: 3,
        isCorrect: false,
        explanation: "실행 권한 값이다.",
      },
      {
        id: "system-security-linux-permission-slice-q02-choice-04",
        content: "0",
        displayOrder: 4,
        isCorrect: false,
        explanation: "권한 없음이다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.linuxFilePermissions,
    ),
    tags: ["Linux", "rwx", "chmod"],
    source: "SECURIUM independently authored Linux file permission vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-linux-permission-slice-q03",
    title: "과도한 권한 식별",
    content:
      "중요 설정 파일에 기타 사용자(other) 쓰기 권한이 부여되어 있다. 보안상 가장 적절한 판단은 무엇인가?",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation:
      "기타 사용자 쓰기 권한은 중요 파일 변조 위험을 키우므로 업무 필요성 검토 후 제거해야 한다.",
    wrongAnswerExplanation:
      "편의성을 이유로 넓은 쓰기 권한을 유지하면 최소권한 원칙에 어긋난다.",
    choices: [
      {
        id: "system-security-linux-permission-slice-q03-choice-01",
        content: "변조 위험이 있으므로 최소권한 기준으로 조정한다.",
        displayOrder: 1,
        isCorrect: true,
        explanation: "중요 파일의 쓰기 권한은 엄격히 제한해야 한다.",
      },
      {
        id: "system-security-linux-permission-slice-q03-choice-02",
        content: "접근 편의를 위해 777로 변경한다.",
        displayOrder: 2,
        isCorrect: false,
        explanation: "위험을 더 키우는 조치다.",
      },
      {
        id: "system-security-linux-permission-slice-q03-choice-03",
        content: "로그 확인 없이 그대로 둔다.",
        displayOrder: 3,
        isCorrect: false,
        explanation: "중요 설정 파일 권한은 점검 대상이다.",
      },
      {
        id: "system-security-linux-permission-slice-q03-choice-04",
        content: "파일명을 바꾸면 충분하다.",
        displayOrder: 4,
        isCorrect: false,
        explanation: "권한 문제의 근본 대책이 아니다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.linuxFilePermissions,
    ),
    tags: ["최소권한", "파일 변조", "Linux"],
    source: "SECURIUM independently authored Linux file permission vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-linux-permission-slice-q04",
    title: "디렉터리 실행 권한",
    content:
      "Linux 디렉터리에서 실행(x) 권한은 디렉터리 내부로 진입하거나 경로 탐색을 가능하게 하는 의미를 가진다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    explanation:
      "디렉터리의 x 권한은 파일 실행과 동일하게만 보지 말고 탐색·진입 권한으로 이해해야 한다.",
    wrongAnswerExplanation:
      "디렉터리 권한에서 x는 경로 접근 가능성과 관련된다.",
    choices: [
      {
        id: "system-security-linux-permission-slice-q04-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "디렉터리 x 권한의 의미를 올바르게 설명했다.",
      },
      {
        id: "system-security-linux-permission-slice-q04-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "디렉터리 x 권한은 경로 탐색과 관련된다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.linuxFilePermissions,
    ),
    tags: ["디렉터리 권한", "x 권한", "Linux"],
    source: "SECURIUM independently authored Linux file permission vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
  {
    id: "system-security-linux-permission-slice-q05",
    title: "특수 권한 점검",
    content:
      "setuid가 설정된 실행 파일은 실행 사용자가 아닌 파일 소유자의 권한으로 동작할 수 있으므로 별도 점검 대상이다.",
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    explanation:
      "setuid는 권한 상승 경로가 될 수 있어 중요 파일과 실행 파일에서 별도로 확인해야 한다.",
    wrongAnswerExplanation:
      "특수 권한은 일반 r/w/x보다 영향이 클 수 있다.",
    choices: [
      {
        id: "system-security-linux-permission-slice-q05-true",
        content: "O",
        displayOrder: 1,
        isCorrect: true,
        explanation: "setuid의 보안 영향을 올바르게 설명했다.",
      },
      {
        id: "system-security-linux-permission-slice-q05-false",
        content: "X",
        displayOrder: 2,
        isCorrect: false,
        explanation: "setuid는 별도 점검 대상이다.",
      },
    ],
    answerConfig: {},
    courseLinks: SYSTEM_SECURITY_COURSE_IDS.map((courseId) => ({
      courseId,
      weight: 100,
    })),
    contentLinks: contentPracticeLinks(
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.operatingSystems,
      SYSTEM_SECURITY_SUBITEM_CONTENT_IDS.linuxFilePermissions,
    ),
    tags: ["setuid", "권한 상승", "Linux"],
    source: "SECURIUM independently authored Linux file permission vertical slice sample",
    sourceDate: "2026-08-07",
    sampleOnly: true,
    status: "PUBLISHED",
  },
];

export function getSystemSecurityQuestionBankReadiness() {
  const courseCounts = Object.fromEntries(
    SYSTEM_SECURITY_COURSE_IDS.map((courseId) => [
      courseId,
      systemSecurityQuestionSamples.filter((question) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ).length,
    ]),
  );
  const typeCounts = systemSecurityQuestionSamples.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
    return counts;
  }, {});
  const contentLinkedCount = systemSecurityQuestionSamples.filter((question) =>
    question.contentLinks.some(
      (link) =>
        link.contentType === "CONTENT" &&
        link.contentId === SYSTEM_SECURITY_CONTENT_ID,
    ),
  ).length;
  const linkedSubItemContentIds = new Set(
    systemSecurityQuestionSamples.flatMap((question) =>
      question.contentLinks
        .filter(
          (link) =>
            link.contentType === "CONTENT" &&
            Object.values(SYSTEM_SECURITY_SUBITEM_CONTENT_IDS).includes(
              link.contentId,
            ),
        )
        .map((link) => link.contentId),
    ),
  );

  return {
    questionCount: systemSecurityQuestionSamples.length,
    courseCounts,
    typeCounts,
    contentLinkedCount,
    allPublished: systemSecurityQuestionSamples.every(
      (question) => question.status === "PUBLISHED",
    ),
    allSampleOnly: systemSecurityQuestionSamples.every(
      (question) => question.sampleOnly === true,
    ),
    allIndependentlyAuthored: systemSecurityQuestionSamples.every((question) =>
      question.source.includes("independently authored"),
    ),
    allLinkedToBothCourses: systemSecurityQuestionSamples.every((question) =>
      SYSTEM_SECURITY_COURSE_IDS.every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    allLinkedToSystemContent:
      contentLinkedCount === systemSecurityQuestionSamples.length,
    linkedSubItemContentCount: linkedSubItemContentIds.size,
    allSubItemContentsLinked:
      linkedSubItemContentIds.size ===
      Object.keys(SYSTEM_SECURITY_SUBITEM_CONTENT_IDS).length,
  };
}

export function toSystemSecurityGradingQuestion(question) {
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

export function generateSystemSecurityQuestionSeedSql({ dialect }) {
  if (!["d1", "postgres"].includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const statements = [];
  if (dialect === "postgres") statements.push("BEGIN;");

  for (const question of systemSecurityQuestionSamples) {
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
VALUES ('seed_system_security_questions_2027_2029', 'manual-system-security-questions-2027-2029')
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
  const id = `system-security-content-link-${question.id}-${contentLink.contentId.replace(
    "content-official-security-cert-system-",
    "",
  )}`;
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
  'SECURIUM independently authored system security sample seed',
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
