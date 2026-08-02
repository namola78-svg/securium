import {
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  flattenOfficialCurriculumTree,
} from "../curriculum/security-certification-standards.ts";

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
      "# 네트워크보안 정식 학습 본문",
      "",
      "네트워크보안은 통신이 어떻게 흐르는지 이해한 뒤, 그 흐름을 방해하거나 가로채거나 속이는 공격을 식별하고 적절한 보안 통제를 설계하는 영역입니다. 정보보안기사와 정보보안산업기사 모두에서 공통으로 다루며, 필기에서는 원리와 구분 능력, 실기에서는 구성도·로그·장비 설정을 해석하는 능력이 중요합니다.",
      "",
      "## 1. 학습 범위",
      "",
      "| 영역 | 핵심 질문 | 학습 포인트 |",
      "| --- | --- | --- |",
      "| 네트워크 일반 | 패킷은 어떤 계층과 주소 체계를 거쳐 전달되는가? | OSI 7계층, TCP/IP, MAC, IP, Port, Subnet, Routing |",
      "| 네트워크 활용 | 조직 네트워크는 어떤 장비와 서비스로 구성되는가? | NIC, Router, Bridge, Switch, Hub, Gateway, 무선 LAN, 서비스 운영 |",
      "| 공격 이해와 대응 | 공격자는 어떤 방식으로 가용성·기밀성·무결성을 침해하는가? | DoS/DDoS, 스캐닝, 스푸핑, 스니핑, 원격접속 공격 |",
      "| 보안 기술 | 보안장비와 보안 프로토콜은 어디에 배치되는가? | TLS, IPSec, Firewall, IDS/IPS, VPN, ESM, UTM, NAC, 로그·패킷 분석 |",
      "",
      "## 2. 네트워크 일반",
      "",
      "네트워크 문제를 풀 때는 먼저 계층을 분리해야 합니다. 물리 계층 문제인지, 데이터링크 계층의 MAC 주소 문제인지, 네트워크 계층의 IP·라우팅 문제인지, 전송 계층의 Port·TCP 상태 문제인지가 달라지면 원인과 대응도 달라집니다.",
      "",
      "### OSI 7계층과 TCP/IP",
      "",
      "- OSI 모델은 네트워크 현상을 계층별로 나누어 설명하는 기준입니다.",
      "- TCP/IP 모델은 실제 인터넷 통신 구현과 더 가깝습니다.",
      "- 시험에서는 계층 이름을 외우는 것보다 각 계층의 장비, 주소, 프로토콜, 보안 통제를 연결하는 문제가 자주 나옵니다.",
      "",
      "| 계층 관점 | 대표 단서 | 보안 점검 예시 |",
      "| --- | --- | --- |",
      "| 데이터링크 | MAC, ARP, 스위칭 | ARP 스푸핑 징후, VLAN 분리, 포트 보안 |",
      "| 네트워크 | IP, 라우팅, ICMP | ACL, 라우팅 경로, ICMP 허용 범위 |",
      "| 전송 | TCP, UDP, Port | 불필요한 포트, 세션 상태, SYN Flood 징후 |",
      "| 응용 | DNS, HTTP, SMTP 등 | 서비스 설정, 인증, 암호화, 로그 |",
      "",
      "## 3. 주요 공격 유형",
      "",
      "공격 유형은 공격 목적과 관찰 가능한 현상으로 구분합니다. 이름만 암기하면 유사 지문에서 헷갈리기 쉽기 때문에, 공격자가 노리는 보안 속성과 대표 징후를 함께 정리해야 합니다.",
      "",
      "### 서비스 거부와 분산 서비스 거부",
      "",
      "서비스 거부 공격은 정상 사용자가 서비스를 이용하지 못하게 만드는 공격입니다. 분산 서비스 거부는 여러 출발지나 봇넷을 이용해 탐지와 차단을 어렵게 만듭니다.",
      "",
      "- 주요 영향: 가용성 저하",
      "- 관찰 단서: 비정상 트래픽 증가, 세션 고갈, 응답 지연, 특정 자원 사용률 급증",
      "- 대응 관점: 임계치 기반 탐지, 속도 제한, 우회 경로, 필터링, CDN·DDoS 방어 서비스, 장애 대응 절차",
      "",
      "### 스캐닝",
      "",
      "스캐닝은 공격 전 정찰 단계에서 자주 사용됩니다. 열린 포트, 서비스 버전, 취약 서비스 존재 여부를 확인해 다음 공격 경로를 정합니다.",
      "",
      "- 주요 영향: 직접 침해보다 공격 준비 단계",
      "- 관찰 단서: 짧은 시간 내 다수 포트 접근, 순차적 포트 탐색, 비정상 User-Agent 또는 프로브",
      "- 대응 관점: 로그 상관분석, 침입탐지, 불필요 서비스 제거, 외부 노출면 최소화",
      "",
      "### 스푸핑과 스니핑",
      "",
      "스푸핑은 신뢰할 수 있는 대상처럼 속이는 공격이고, 스니핑은 통신 내용을 몰래 관찰하는 행위입니다. 둘은 함께 등장할 수 있지만 목적이 다릅니다.",
      "",
      "| 구분 | 핵심 의미 | 대응 방향 |",
      "| --- | --- | --- |",
      "| 스푸핑 | 주소·식별자를 위조해 신뢰 관계를 악용 | 인증 강화, ARP 보호, 라우팅 보안, 세션 보호 |",
      "| 스니핑 | 네트워크 트래픽을 수집·분석 | 암호화, 스위치 환경 관리, 무선 보안, 중요정보 평문 전송 차단 |",
      "",
      "## 4. 보안 프로토콜과 보안장비",
      "",
      "보안 기술은 장비 이름을 외우는 것으로 끝나지 않습니다. 어떤 위치에서 어떤 위험을 줄이는지, 탐지 장비인지 차단 장비인지, 네트워크 경계에 둘지 내부 구간에 둘지를 설명할 수 있어야 합니다.",
      "",
      "### 보안 프로토콜",
      "",
      "- TLS는 응용 서비스 통신의 기밀성과 무결성을 보호하는 데 널리 사용됩니다.",
      "- IPSec은 IP 계층에서 터널 또는 전송 방식으로 보호를 제공합니다.",
      "- VPN은 외부 사용자나 지점 간 통신을 안전한 논리적 경로로 묶는 데 사용됩니다.",
      "",
      "### 보안장비",
      "",
      "| 장비·솔루션 | 주 역할 | 한계 또는 주의점 |",
      "| --- | --- | --- |",
      "| Firewall | 정책 기반 허용·차단 | 응용 계층 세부 행위 탐지는 제한적일 수 있음 |",
      "| IDS/IPS | 침입 징후 탐지·차단 | 오탐·미탐 조정과 시그니처 관리 필요 |",
      "| VPN | 암호화된 원격 접속 또는 지점 연결 | 계정 탈취 시 내부 접근로가 될 수 있음 |",
      "| NAC | 단말 접근 제어 | 예외 정책과 운영 프로세스 관리 필요 |",
      "| ESM/SIEM | 로그 수집·상관분석 | 로그 품질과 룰 튜닝이 성능을 좌우 |",
      "",
      "## 5. 실무형 접근 순서",
      "",
      "네트워크 보안 문제를 만났을 때는 다음 순서로 사고하면 안정적입니다.",
      "",
      "1. 자산과 구간을 식별합니다. 인터넷 경계, 내부망, 관리망, 무선망 중 어디인지 확인합니다.",
      "2. 통신 방향과 프로토콜을 확인합니다. 출발지·목적지·포트·세션 상태를 분리합니다.",
      "3. 관찰된 현상을 공격 유형과 연결합니다. 가용성 저하인지, 위장인지, 도청인지, 정찰인지 판단합니다.",
      "4. 현재 통제를 확인합니다. 방화벽 정책, IDS/IPS 룰, VPN 설정, 로그 수집 범위를 봅니다.",
      "5. 대응 방안을 제시합니다. 차단, 탐지 강화, 구성 변경, 암호화, 운영 절차 개선을 구분합니다.",
      "",
      "## 6. 자주 헷갈리는 포인트",
      "",
      "- DoS/DDoS는 주로 가용성 문제입니다. 정보 유출 문제와 섞어 판단하지 않습니다.",
      "- 스푸핑은 속임, 스니핑은 관찰입니다. 둘 다 기밀성 침해로 이어질 수 있지만 동작 방식이 다릅니다.",
      "- IDS는 탐지 중심, IPS는 차단까지 수행할 수 있다는 차이를 기억합니다.",
      "- VPN은 암호화된 통로를 제공하지만, 접속 주체의 권한 관리까지 자동으로 해결하지는 않습니다.",
      "- 로그 분석은 장비가 남긴 이벤트를 해석하는 일이고, 패킷 분석은 실제 통신 단위를 보는 일입니다.",
      "",
      "## 7. 연습 체크리스트",
      "",
      "- 주어진 지문에서 계층, 프로토콜, 장비, 공격 목적을 각각 표시할 수 있는가?",
      "- 특정 공격의 관찰 단서와 대응 통제를 2개 이상 연결할 수 있는가?",
      "- 방화벽, IDS/IPS, VPN, NAC, SIEM의 역할과 한계를 비교할 수 있는가?",
      "- 기사와 산업기사 모두에서 공통으로 다루는 네트워크보안 범위임을 설명할 수 있는가?",
      "",
      "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 개요이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "OSI 7계층과 TCP/IP 관점에서 통신 현상을 분리해 설명할 수 있다.",
      "DoS/DDoS, 스캐닝, 스푸핑, 스니핑의 목적·징후·대응을 구분할 수 있다.",
      "Firewall, IDS/IPS, VPN, NAC, SIEM의 역할과 배치 지점을 비교할 수 있다.",
      "네트워크 구성도나 로그 단서를 보고 점검 순서를 제시할 수 있다.",
    ],
    coreConcepts: [
      "OSI 7계층",
      "TCP/IP",
      "서비스 거부",
      "스캐닝",
      "스푸핑",
      "스니핑",
      "방화벽",
      "IDS/IPS",
      "VPN",
      "NAC",
      "SIEM",
    ],
    practicalExamples: [
      "서비스 거부 공격 상황에서 로그와 트래픽 증상을 분리해 확인합니다.",
      "방화벽 정책과 네트워크 구성을 비교해 과도한 허용 규칙을 찾습니다.",
      "스캐닝 이벤트와 실제 침해 이벤트를 로그 단서로 구분합니다.",
      "VPN 접속 계정 탈취 상황에서 접근 제어와 로그 확인 항목을 정리합니다.",
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
  const coveragePlan = getSecurityCertificationCourseLessonCoveragePlan();

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
    expectedTopLevelNodeCount: coveragePlan.reduce(
      (total, tree) => total + tree.expectedNodeCount,
      0,
    ),
    mappedTopLevelNodeCount: coveragePlan.reduce(
      (total, tree) => total + tree.mappedNodeCount,
      0,
    ),
    unmappedTopLevelNodeCount: coveragePlan.reduce(
      (total, tree) => total + tree.unmappedNodeCount,
      0,
    ),
  };
}

export function getSecurityCertificationCourseLessonCoveragePlan() {
  const courseLessonsByNodeId = new Map();
  for (const lesson of officialSecurityCertificationCourseLessons) {
    const lessons = courseLessonsByNodeId.get(lesson.curriculumNodeId) ?? [];
    lessons.push(lesson);
    courseLessonsByNodeId.set(lesson.curriculumNodeId, lessons);
  }

  return SECURITY_CERTIFICATION_CURRICULUM_TREES.map((tree) => {
    const flattenedNodes = flattenOfficialCurriculumTree(tree);
    const expectedNodes = flattenedNodes.filter((node) =>
      ["SUBJECT", "PRACTICAL"].includes(node.nodeType),
    );
    const mappedNodes = [];
    const unmappedNodes = [];

    for (const node of expectedNodes) {
      const nodeId = curriculumNodeIdFromStableKey(node.stableKey);
      const lessons = courseLessonsByNodeId.get(nodeId) ?? [];
      const item = {
        stableKey: node.stableKey,
        nodeId,
        title: node.title,
        nodeType: node.nodeType,
        officialLevel: node.officialLevel,
        courseLessonIds: lessons.map((lesson) => lesson.id),
        contentIds: lessons.map((lesson) => lesson.contentId),
      };

      if (lessons.length > 0) {
        mappedNodes.push(item);
      } else {
        unmappedNodes.push(item);
      }
    }

    return {
      treeId: tree.treeId,
      courseId: tree.courseId,
      courseCode: tree.courseCode,
      expectedNodeCount: expectedNodes.length,
      mappedNodeCount: mappedNodes.length,
      unmappedNodeCount: unmappedNodes.length,
      mappedNodes,
      unmappedNodes,
    };
  });
}

export function getSecurityCertificationNetworkSecurityFlowReadiness() {
  const contentId = "content-official-security-cert-network-security-overview";
  const content = officialSecurityCertificationContents.find(
    (item) => item.id === contentId,
  );
  const courseLessons = officialSecurityCertificationCourseLessons
    .filter((lesson) => lesson.contentId === contentId)
    .sort((a, b) => a.courseId.localeCompare(b.courseId));

  const practiceSearchTokens = [
    "DoS/DDoS",
    "스캐닝",
    "스푸핑",
    "스니핑",
    "Firewall",
    "IDS/IPS",
    "VPN",
    "NAC",
    "SIEM",
  ];
  const searchableText = [
    content?.title,
    content?.summary,
    content?.body,
    ...(content?.learningObjectives ?? []),
    ...(content?.coreConcepts ?? []),
    ...(content?.practicalExamples ?? []),
  ]
    .filter(Boolean)
    .join("\n");
  const tokenCoverage = practiceSearchTokens.map((token) => ({
    token,
    present: searchableText.includes(token),
  }));
  const courseLessonIds = new Set(courseLessons.map((lesson) => lesson.id));
  const courseIds = new Set(courseLessons.map((lesson) => lesson.courseId));
  const nodeIds = new Set(courseLessons.map((lesson) => lesson.curriculumNodeId));

  return {
    contentId,
    canonicalKey: content?.canonicalKey ?? null,
    contentExists: Boolean(content),
    linkedCourseLessonCount: courseLessons.length,
    linkedCourseLessons: courseLessons.map((lesson) => ({
      id: lesson.id,
      courseId: lesson.courseId,
      curriculumNodeId: lesson.curriculumNodeId,
      displayTitle: lesson.displayTitle,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
    })),
    sharedContentReused: courseLessons.length > 1 && Boolean(content),
    progressIsolatedByCourseLesson:
      courseLessonIds.size === courseLessons.length &&
      courseIds.size === courseLessons.length &&
      nodeIds.size === courseLessons.length,
    practiceRoutePattern: "/practice/[courseSlug]",
    tokenCoverage,
    allPracticeSearchTokensPresent: tokenCoverage.every((item) => item.present),
  };
}

function curriculumNodeIdFromStableKey(stableKey) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
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
