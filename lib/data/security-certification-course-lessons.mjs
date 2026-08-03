import {
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  flattenOfficialCurriculumTree,
} from "../curriculum/security-certification-standards.ts";

export const SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_COURSE_LESSON_SEED";
export const SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE =
  "APPLY_SECURITY_CERTIFICATION_COURSE_LESSON_SEED";

const baseOfficialSecurityCertificationContents = [
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

const systemSecurityFormalContent = {
  title: "시스템보안 정식 학습 개요",
  summary:
    "운영체제, 서버, 클라우드와 시스템 보안 위협을 진단·대응 관점으로 연결해 학습합니다.",
  body: [
    "# 시스템보안 정식 학습 본문",
    "",
    "시스템보안은 단말, 서버, 운영체제, 클라우드 환경에서 발생하는 보안 위협을 식별하고 계정·권한·로그·패치·구성관리로 통제하는 영역입니다. 정보보안기사와 정보보안산업기사 모두에서 공통으로 다루며, 필기에서는 개념과 위협 대응을, 실기에서는 설정 점검과 로그 분석 역량을 요구합니다.",
    "",
    "## 1. 학습 범위",
    "",
    "| 영역 | 판단 질문 | 학습 포인트 |",
    "| --- | --- | --- |",
    "| 시스템 범위와 운영환경 | 보호 대상 시스템이 어디까지인가? | 단말, 서버, 모바일, IoT, 가상화, 클라우드, 운영체제 |",
    "| 계정과 권한 | 누가 어떤 권한으로 접근하는가? | 인증, 권한분리, 최소권한, 관리자 계정, 불필요 계정 제거 |",
    "| 구성과 패치 | 취약한 설정이나 미패치 항목이 있는가? | 보안 기준선, 패치관리, 서비스 최소화, 원격접속 통제 |",
    "| 로그와 사고 대응 | 침해 징후를 어떻게 확인하는가? | 시스템 로그, 인증 로그, 감사 로그, 이벤트 상관분석 |",
    "| 클라우드·컨테이너 | 공유책임과 격리 수준이 적절한가? | IAM, 보안그룹, 스토리지 공개범위, 이미지 취약점 |",
    "",
    "## 2. 운영체제와 서버 보안",
    "",
    "운영체제 보안은 계정, 권한, 프로세스, 서비스, 파일시스템, 로그를 함께 확인해야 합니다. 취약한 시스템은 하나의 설정 오류만으로 침해되는 것이 아니라, 불필요 서비스·약한 비밀번호·과도한 권한·로그 미점검이 함께 쌓이면서 위험이 커집니다.",
    "",
    "### 핵심 점검 순서",
    "",
    "1. 자산과 운영체제 종류를 확인합니다. Windows, Linux, Unix, Android, iOS, Embedded OS 등 플랫폼마다 로그 위치와 점검 방식이 다릅니다.",
    "2. 계정 현황을 확인합니다. 기본 계정, 퇴사자 계정, 장기 미사용 계정, 공유 관리자 계정은 우선 점검 대상입니다.",
    "3. 권한을 확인합니다. 관리자 권한이 필요한 업무인지, 일반 권한으로 충분한지, 권한 부여·회수 절차가 있는지 봅니다.",
    "4. 서비스와 포트를 확인합니다. 사용하지 않는 데몬이나 원격접속 서비스는 공격면을 넓힙니다.",
    "5. 패치와 보안 설정을 확인합니다. 알려진 취약점과 보안 기준선 위반 여부를 함께 봅니다.",
    "6. 로그를 확인합니다. 인증 실패, 권한 상승, 서비스 오류, 비정상 프로세스 실행은 침해 징후로 이어질 수 있습니다.",
    "",
    "## 3. 시스템 보안위협과 공격기법",
    "",
    "| 공격 유형 | 주요 특징 | 대응 방향 |",
    "| --- | --- | --- |",
    "| 계정 탈취 | 약한 비밀번호, 재사용 계정, 피싱으로 인증정보 탈취 | MFA, 비밀번호 정책, 계정 잠금, 이상 로그인 탐지 |",
    "| 권한 상승 | 취약한 설정이나 취약점을 이용해 높은 권한 획득 | 최소권한, 패치, sudo·관리자 권한 통제 |",
    "| 악성코드 | 파일 실행, 스크립트, 매크로, 취약 서비스 악용 | 백신·EDR, 실행 통제, 격리, 백업 |",
    "| 로그 삭제·변조 | 침해 흔적 은폐 | 중앙 로그 수집, 무결성 보호, 감사 로그 보존 |",
    "| 취약한 원격접속 | RDP, SSH, VPN, 관리 포트 노출 | 접근통제, MFA, 접속 허용범위 제한, Bastion 사용 |",
    "",
    "## 4. 클라우드와 가상화 보안",
    "",
    "클라우드 환경에서는 CSP와 사용자의 책임 범위를 구분해야 합니다. 인프라 자체의 물리 보안은 CSP가 담당하더라도, 계정 권한, 스토리지 공개 설정, 네트워크 보안그룹, 로그 활성화, 암호화 설정은 사용자가 관리해야 할 수 있습니다.",
    "",
    "- IAM 권한은 업무 단위로 분리하고, 장기 키 사용을 줄입니다.",
    "- 공개 스토리지와 공개 관리 포트는 우선 점검합니다.",
    "- 보안그룹과 ACL은 최소 허용 원칙으로 관리합니다.",
    "- VM 이미지와 컨테이너 이미지는 취약점 스캔과 서명 검증을 고려합니다.",
    "- 로그와 모니터링은 사후 분석이 가능하도록 중앙화합니다.",
    "",
    "## 5. 실무 점검 시나리오",
    "",
    "시스템 점검 문제는 대개 특정 서버나 운영환경의 증상을 제시하고, 위험 원인과 보완 방안을 묻습니다. 시스템 유형 식별, 공격면 확인, 침해 가능성 판단, 대응 조치 제시 순서로 접근하면 안정적입니다.",
    "",
    "## 6. 자주 틀리는 포인트",
    "",
    "- 계정 잠금과 권한 회수를 같은 조치로 혼동하지 않습니다.",
    "- 로그가 없으면 침해 여부를 확정하기 어렵다는 점을 명확히 합니다.",
    "- 패치 적용만으로 설정 오류나 과도한 권한 문제가 자동 해결되지는 않습니다.",
    "- 클라우드 보안은 CSP 책임과 사용자 책임을 구분해야 합니다.",
    "- 관리자 계정은 존재 자체가 문제가 아니라 사용 범위, 인증 강도, 감사 가능성이 핵심입니다.",
    "",
    "## 7. 연습 체크리스트",
    "",
    "- 제시된 시스템에서 자산, 계정, 권한, 서비스, 로그를 각각 분리해 설명할 수 있는가?",
    "- 취약한 설정과 취약점 공격을 구분할 수 있는가?",
    "- 계정 탈취, 권한 상승, 악성코드, 로그 변조에 맞는 대응 조치를 연결할 수 있는가?",
    "- Windows와 Linux 로그·계정 관리 차이를 기본 수준에서 구분할 수 있는가?",
    "- 클라우드 공유책임 모델에서 사용자가 직접 관리해야 하는 항목을 식별할 수 있는가?",
    "",
    "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 SECURIUM 독립 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
  ].join("\n"),
  learningObjectives: [
    "운영체제와 서버 환경의 보안 점검 항목을 설명할 수 있다.",
    "계정·권한·서비스·패치·로그 관리가 시스템 보안에 미치는 영향을 연결할 수 있다.",
    "계정 탈취, 권한 상승, 악성코드, 로그 변조 등 주요 위협의 대응 방향을 구분할 수 있다.",
    "클라우드와 가상화 환경에서 사용자 책임 보안 항목을 식별할 수 있다.",
  ],
  coreConcepts: [
    "운영체제",
    "서버보안",
    "계정관리",
    "권한관리",
    "패치관리",
    "로그분석",
    "권한 상승",
    "악성코드",
    "클라우드 보안",
  ],
  practicalExamples: [
    "불필요한 계정과 서비스가 남아 있는 서버를 점검 항목별로 분해한다.",
    "인증 실패 로그와 권한 상승 로그를 침해 징후와 운영 오류로 구분해 본다.",
    "클라우드 스토리지 공개 설정과 보안그룹 규칙을 사용자 책임 관점에서 점검한다.",
    "패치 미적용 서버에서 취약점 조치와 서비스 중단 리스크를 함께 고려한다.",
  ],
};

const applicationSecurityFormalContent = {
  title: "애플리케이션보안 정식 학습 개요",
  summary:
    "웹, DB, DNS, 메일, 전자상거래와 안전한 개발 원칙을 서비스 보안 점검 관점으로 연결해 학습합니다.",
  body: [
    "# 애플리케이션보안 정식 학습 본문",
    "",
    "애플리케이션보안은 사용자가 직접 이용하는 서비스 계층에서 인증, 세션, 입력값 검증, 데이터 보호, 서비스 설정, 로그와 오류 처리까지 함께 점검하는 영역입니다. 정보보안기사와 정보보안산업기사 모두에서 공통으로 다루지만, 기사는 취약점 원인 분석과 보완 설계까지 더 깊게 묻는 경향이 있습니다.",
    "",
    "## 1. 학습 범위",
    "",
    "| 영역 | 핵심 질문 | 점검 관점 |",
    "| --- | --- | --- |",
    "| FTP·메일·DNS | 서비스가 안전하게 설정되어 있는가? | 인증, 암호화, 접근제어, 불필요 기능 제거 |",
    "| Web/App | 입력과 세션을 안전하게 처리하는가? | SQL 삽입, XSS, 인증 우회, 권한 검증 |",
    "| DB 보안 | 데이터와 계정 권한이 보호되는가? | 최소권한, 암호화, 감사 로그, 백업 |",
    "| 전자상거래 | 거래 무결성과 인증을 보장하는가? | 전자서명, 인증서, 결제 흐름, 위변조 방지 |",
    "| 개발 보안약점 | 취약한 코드 패턴을 줄였는가? | 입력값 검증, 오류 처리, 안전한 API 사용 |",
    "",
    "## 2. 서비스별 보안 점검",
    "",
    "서비스 보안은 단순히 포트를 열고 닫는 문제가 아니라, 서비스 목적에 맞는 인증 방식과 암호화, 접근 통제, 로그 기록이 함께 동작하는지 확인하는 일입니다. FTP는 평문 인증을 피하고 SFTP 또는 FTPS를 고려해야 하며, 메일은 릴레이 제한과 SPF·DKIM·DMARC 같은 위조 방지 설정을 확인합니다. DNS는 영역 전송 제한, 캐시 오염 대응, 중요 레코드 변경 통제를 함께 봅니다.",
    "",
    "## 3. Web/App 취약점",
    "",
    "웹 취약점은 대부분 신뢰 경계가 무너질 때 발생합니다. 사용자가 입력한 값을 그대로 SQL, HTML, 명령어, 파일 경로, 리다이렉트 URL에 사용하면 삽입 공격이나 우회가 발생할 수 있습니다. 안전한 구현은 입력값 검증, 출력 인코딩, 서버 측 권한 확인, 세션 보호, CSRF 방어, 안전한 오류 메시지를 함께 적용합니다.",
    "",
    "| 취약점 | 원인 | 기본 대응 |",
    "| --- | --- | --- |",
    "| SQL 삽입 | 입력값이 쿼리 구조를 바꿈 | 바인딩 변수, ORM 안전 API, 권한 제한 |",
    "| XSS | 사용자 입력이 스크립트로 실행됨 | 출력 인코딩, CSP, HTML sanitization |",
    "| 인증 우회 | 클라이언트 상태만 신뢰 | 서버 측 세션·권한 검증 |",
    "| 파일 업로드 취약점 | 확장자·MIME·경로 검증 부족 | allowlist, 크기 제한, 저장 키 분리 |",
    "| 오류정보 노출 | 내부 예외와 경로 노출 | 안전한 오류 코드, 민감정보 마스킹 |",
    "",
    "## 4. DB 보안",
    "",
    "DB 보안은 계정 권한, 데이터 암호화, 접근 경로, 감사 로그, 백업과 복구를 함께 관리해야 합니다. 애플리케이션 계정에는 필요한 권한만 부여하고, 운영자 직접 접속은 승인된 경로와 감사 로그를 남겨야 합니다. 중요 데이터는 저장·전송 구간에서 보호하고, 백업 파일도 운영 DB와 같은 수준으로 보호합니다.",
    "",
    "## 5. 안전한 개발과 보안약점 진단",
    "",
    "안전한 개발은 개발 완료 후 취약점을 찾는 활동만이 아니라 요구사항, 설계, 구현, 테스트, 운영 전환 과정에 보안 통제를 넣는 방식입니다. 입력값 검증, 인증·인가, 암호화, 오류 처리, 로깅, 외부 라이브러리 관리, 민감정보 보호는 반복적으로 확인해야 합니다.",
    "",
    "## 6. 실무 평가 시나리오",
    "",
    "문제에서는 웹 서비스 로그, 취약한 코드 조각, DB 권한 표, DNS 설정, 메일 서버 릴레이 정책 같은 자료를 주고 취약점과 보완책을 묻는 경우가 많습니다. 서비스 구성요소를 먼저 구분하고, 신뢰 경계와 데이터 흐름을 따라가며 어떤 통제가 빠졌는지 확인하는 순서가 안정적입니다.",
    "",
    "## 7. 연습 체크리스트",
    "",
    "- 서비스별로 인증, 암호화, 접근제어, 로그를 분리해 설명할 수 있는가?",
    "- SQL 삽입, XSS, 인증 우회, 파일 업로드 취약점의 원인과 대응을 연결할 수 있는가?",
    "- DB 계정 권한과 데이터 암호화, 감사 로그의 목적을 구분할 수 있는가?",
    "- 전자상거래 보안에서 인증서, 전자서명, 무결성의 역할을 설명할 수 있는가?",
    "- 개발 보안약점을 코드 실행 없이 정적 분석 관점에서 판단할 수 있는가?",
    "",
    "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
  ].join("\n"),
  learningObjectives: [
    "FTP, 메일, DNS, Web/App, DB 서비스별 보안 점검 포인트를 설명할 수 있다.",
    "SQL 삽입, XSS, 인증 우회 등 주요 애플리케이션 취약점의 원인과 대응을 연결할 수 있다.",
    "DB 계정 권한, 암호화, 감사 로그, 백업 보안의 목적을 구분할 수 있다.",
    "안전한 개발과 보안약점 진단의 핵심 절차를 학습 문제 풀이에 적용할 수 있다.",
  ],
  coreConcepts: [
    "Web/App 보안",
    "DB 보안",
    "DNS 보안",
    "메일 보안",
    "전자상거래 보안",
    "SQL 삽입",
    "XSS",
    "입력값 검증",
    "출력 인코딩",
    "보안약점 진단",
  ],
  practicalExamples: [
    "로그인 기능에서 세션 쿠키, CSRF 방어, 서버 측 권한 검증 여부를 분리해 점검한다.",
    "검색 파라미터가 SQL 쿼리에 전달되는 흐름을 보고 바인딩 변수 사용 여부를 확인한다.",
    "DNS 영역 전송과 메일 릴레이 설정에서 외부 악용 가능성을 판단한다.",
    "DB 계정 권한과 감사 로그 설정을 개인정보 저장 테이블의 접근 통제와 연결해 검토한다.",
  ],
};

const informationSecurityGeneralFormalContent = {
  title: "정보보안일반 정식 학습 개요",
  summary:
    "인증, 접근통제, 키 분배, 전자서명, 암호 알고리즘, 해시함수와 최신 보안 동향을 보안 원리 중심으로 학습합니다.",
  body: [
    "# 정보보안일반 정식 학습 본문",
    "",
    "정보보안일반은 특정 시스템이나 서비스 한 영역에 머무르지 않고, 보안 통제가 작동하는 원리를 이해하는 과목입니다. 인증과 접근통제는 누가 무엇에 접근할 수 있는지를 정하고, 암호와 해시는 데이터의 기밀성·무결성·인증을 지원합니다. 최신 보안 동향은 이러한 원리가 새로운 기술 환경에서 어떻게 적용되는지를 묻습니다.",
    "",
    "## 1. 학습 범위",
    "",
    "| 영역 | 핵심 질문 | 주요 개념 |",
    "| --- | --- | --- |",
    "| 인증 | 사용자가 누구인지 어떻게 확인하는가? | 지식·소유·생체 기반 인증, 다중인증, 인증서 |",
    "| 접근통제 | 인증된 사용자가 무엇을 할 수 있는가? | DAC, MAC, RBAC, ABAC, 최소권한 |",
    "| 키 분배 | 암호키를 어떻게 안전하게 공유하는가? | 대칭키, 공개키, 세션키, 키 교환 |",
    "| 전자서명 | 부인방지와 무결성을 어떻게 보장하는가? | 공개키, 개인키, 인증서, 서명 검증 |",
    "| 암호·해시 | 데이터를 어떻게 보호하고 검증하는가? | 블록암호, 공개키암호, 해시함수, MAC |",
    "| 최신 보안 동향 | 새로운 기술 환경의 보안 쟁점은 무엇인가? | 양자내성암호, AI 보안, 클라우드 인증, 제로트러스트 |",
    "",
    "## 2. 인증과 접근통제",
    "",
    "인증은 사용자의 신원을 확인하는 절차이고, 접근통제는 인증 이후 허용 범위를 결정하는 절차입니다. 인증 수단은 지식 기반, 소유 기반, 생체 기반으로 구분할 수 있으며, 다중인증은 서로 다른 인증 요소를 결합해 단일 요소 탈취 위험을 줄입니다. 접근통제 모델은 자율적 접근통제, 강제적 접근통제, 역할 기반 접근통제, 속성 기반 접근통제로 나뉘며 시험에서는 모델의 차이와 적용 상황을 자주 묻습니다.",
    "",
    "## 3. 키 분배와 전자서명",
    "",
    "대칭키 암호는 같은 키로 암호화와 복호화를 수행하므로 속도가 빠르지만 키 공유 문제가 있습니다. 공개키 암호는 공개키와 개인키를 나누어 키 교환, 인증, 전자서명에 활용됩니다. 전자서명은 송신자가 개인키로 서명하고 수신자가 공개키로 검증하여 무결성, 인증, 부인방지를 지원합니다. 인증서는 공개키가 누구의 것인지 신뢰할 수 있도록 연결하는 장치입니다.",
    "",
    "## 4. 암호 알고리즘과 해시함수",
    "",
    "암호 알고리즘은 보호 목적과 운영 조건에 따라 선택해야 합니다. 블록암호는 운영 모드와 초기화 벡터, 패딩 처리가 중요하고, 공개키 암호는 키 길이와 알고리즘 안전성을 고려해야 합니다. 해시함수는 임의 길이 입력을 고정 길이 값으로 변환하며, 역상 저항성, 제2역상 저항성, 충돌 저항성이 핵심 성질입니다. MAC과 HMAC은 무결성과 인증을 함께 확인하는 데 활용됩니다.",
    "",
    "## 5. 최신 보안 동향",
    "",
    "최신 보안 동향은 특정 유행어를 외우는 것보다 기존 보안 원리가 새 환경에서 어떻게 달라지는지 이해하는 것이 중요합니다. 양자컴퓨팅은 공개키 암호 안전성에 영향을 줄 수 있고, 양자내성암호는 이에 대비하기 위한 알고리즘 전환 흐름입니다. AI 보안은 모델 입력, 학습 데이터, 출력 신뢰성, 개인정보 보호를 함께 고려해야 하며, 제로트러스트는 네트워크 위치보다 지속적인 검증과 최소권한을 강조합니다.",
    "",
    "## 6. 실무 평가 시나리오",
    "",
    "문제에서는 인증 방식 선택, 접근권한 부여 기준, 전자서명 검증 흐름, 해시와 암호의 차이, 키 관리 실패 사례를 제시하고 적절한 통제를 묻는 경우가 많습니다. 먼저 보호 목적이 기밀성인지, 무결성인지, 인증인지, 부인방지인지 구분하고 그 목적에 맞는 기술을 연결해야 합니다.",
    "",
    "## 7. 연습 체크리스트",
    "",
    "- 인증과 인가, 접근통제를 구분할 수 있는가?",
    "- DAC, MAC, RBAC, ABAC의 차이를 설명할 수 있는가?",
    "- 대칭키와 공개키 암호의 장단점과 사용 위치를 구분할 수 있는가?",
    "- 전자서명과 해시함수, MAC의 목적을 혼동하지 않는가?",
    "- 최신 보안 동향을 기존 보안 원리와 연결해 설명할 수 있는가?",
    "",
    "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
  ].join("\n"),
  learningObjectives: [
    "인증, 인가, 접근통제의 역할과 차이를 설명할 수 있다.",
    "대칭키, 공개키, 해시, 전자서명의 목적과 적용 위치를 구분할 수 있다.",
    "키 분배와 인증서, 전자서명 검증 흐름을 보안 요구사항과 연결할 수 있다.",
    "최신 보안 동향을 기밀성·무결성·인증·부인방지 원리와 연결해 해석할 수 있다.",
  ],
  coreConcepts: [
    "인증",
    "접근통제",
    "RBAC",
    "ABAC",
    "최소권한",
    "대칭키",
    "공개키",
    "전자서명",
    "해시함수",
    "MAC",
    "양자내성암호",
    "제로트러스트",
  ],
  practicalExamples: [
    "관리자 기능에 MFA와 역할 기반 접근통제를 적용하는 이유를 구분한다.",
    "문서 무결성 검증에는 해시를, 부인방지에는 전자서명을 연결한다.",
    "API 통신에서 세션키 교환과 인증서 검증의 목적을 분리해 설명한다.",
    "제로트러스트 환경에서 지속적 검증과 최소권한 정책을 학습 시나리오로 정리한다.",
  ],
};

const managementLawFormalContent = {
  title: "정보보호관리 및 법규 정식 학습 개요",
  summary:
    "정보보호 관리체계, 위험관리, 보호대책, 사고대응, 인증제도와 관련 법규를 정보보안기사 전용 범위로 학습합니다.",
  body: [
    "# 정보보호관리 및 법규 정식 학습 본문",
    "",
    "정보보호관리 및 법규는 정보보안기사 필기에서만 별도 과목으로 다루는 기사 전용 영역입니다. 기술 통제만으로 해결하기 어려운 관리체계, 위험관리, 보호대책 수립, 사고대응 절차, 인증제도와 관련 법규의 목적을 연결해 이해해야 합니다.",
    "",
    "## 1. 학습 범위",
    "",
    "| 영역 | 핵심 질문 | 학습 포인트 |",
    "| --- | --- | --- |",
    "| 정보보호 관리 | 조직은 정보보호를 어떻게 체계화하는가? | 정책, 조직, 역할, 자산 식별, 대책 계획 |",
    "| 위험관리 | 어떤 위험을 우선 처리할 것인가? | 자산·위협·취약점, 가능성, 영향도, 위험처리 |",
    "| 보호대책 구현 | 어떤 통제를 적용하고 운영할 것인가? | 관리적·기술적·물리적 보호대책, 운영 점검 |",
    "| 사고대응 | 침해사고를 어떻게 식별하고 대응하는가? | 탐지, 분석, 보고, 증거보존, 재발방지 |",
    "| 인증제도 | 관리체계 인증은 무엇을 확인하는가? | ISMS-P, 정보보호 공시, 클라우드 보안 인증 |",
    "| 관련 법규 | 법령과 제도는 어떤 의무를 요구하는가? | 개인정보 보호, 정보통신망, 저작권, 전자서명 |",
    "",
    "## 2. 정보보호 관리체계",
    "",
    "정보보호 관리는 단발성 점검이 아니라 정책 수립, 조직과 책임 배정, 자산 식별, 위험 분석, 보호대책 수립, 이행 점검, 개선으로 이어지는 반복 활동입니다. 시험에서는 관리체계의 목적과 구성요소, 정보보호 전략과 조직, 자산 식별 및 분류, 대책 선정과 계획 수립의 흐름을 묻습니다.",
    "",
    "## 3. 위험관리와 보호대책",
    "",
    "위험관리는 자산, 위협, 취약점을 식별하고 가능성과 영향도를 평가하여 처리 우선순위를 정하는 활동입니다. 위험처리 방법은 위험 감소, 회피, 전가, 수용 등으로 구분할 수 있으며, 보호대책은 관리적·기술적·물리적 통제를 조합해 구현합니다. 중요한 점은 위험평가 결과와 보호대책이 연결되어야 한다는 것입니다.",
    "",
    "## 4. 사고대응과 증거보존",
    "",
    "침해사고 대응은 탐지, 접수, 분석, 차단, 복구, 보고, 재발방지로 이어지는 절차입니다. 로그와 증거는 무결성과 연속성을 유지해야 하며, 사고 원인을 기술적 원인과 관리적 원인으로 나누어 보완대책을 수립해야 합니다. 시험에서는 사고대응 절차와 증거보존, 보고와 사후 개선의 목적을 구분하는 문제가 자주 등장합니다.",
    "",
    "## 5. 인증제도와 관련 법규",
    "",
    "인증제도는 조직의 정보보호 관리체계가 기준에 따라 수립·운영되는지 확인하는 장치입니다. 관련 법규는 개인정보 처리, 정보통신서비스, 저작권, 전자서명, 사이버 윤리 등 다양한 의무와 책임을 다룹니다. 법령 원문 전체를 암기하기보다는 제도의 목적, 적용 대상, 주요 의무, 위반 시 영향, 최신 기준일을 구분해 학습하는 것이 중요합니다.",
    "",
    "## 6. 실무 평가 시나리오",
    "",
    "문제에서는 조직의 자산 목록, 위험평가 표, 사고 발생 상황, 보호대책 계획서, 법규 적용 사례를 제시하고 적절한 조치나 순서를 묻는 경우가 많습니다. 먼저 관리체계 단계인지, 위험평가 단계인지, 사고대응 단계인지 구분하고, 필요한 통제와 법적 고려사항을 연결해야 합니다.",
    "",
    "## 7. 연습 체크리스트",
    "",
    "- 정보보호 관리체계의 흐름을 정책, 조직, 위험관리, 보호대책, 점검, 개선으로 설명할 수 있는가?",
    "- 위험 감소, 회피, 전가, 수용을 상황별로 구분할 수 있는가?",
    "- 사고대응 절차와 증거보존의 목적을 설명할 수 있는가?",
    "- 인증제도와 법규를 기술 통제와 분리하지 않고 관리 요구사항으로 연결할 수 있는가?",
    "- 정보보안기사 전용 과목으로 산업기사 진도와 문제 기록에 섞이지 않는지 이해하고 있는가?",
    "",
    "> 이 콘텐츠는 공식 출제기준의 과목 체계를 학습용으로 연결한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다. 법령 원문 전체를 임의로 하드코딩하지 않고 기준일과 버전 관리 구조에 연결해 학습합니다.",
  ].join("\n"),
  learningObjectives: [
    "정보보호 관리체계의 구성요소와 운영 흐름을 설명할 수 있다.",
    "위험평가 결과를 위험처리 방법과 보호대책으로 연결할 수 있다.",
    "침해사고 대응 절차와 증거보존, 재발방지 활동의 목적을 구분할 수 있다.",
    "인증제도와 관련 법규를 기사 전용 학습 범위에서 체계적으로 정리할 수 있다.",
  ],
  coreConcepts: [
    "정보보호관리",
    "위험관리",
    "보호대책",
    "사고대응",
    "증거보존",
    "ISMS-P",
    "정보보호 인증제도",
    "개인정보 보호",
    "정보통신망",
    "전자서명",
    "사이버 윤리",
  ],
  practicalExamples: [
    "자산·위협·취약점 표에서 위험도를 산정하고 처리 우선순위를 정리한다.",
    "침해사고 로그와 대응 기록에서 증거보존과 재발방지 조치를 분리한다.",
    "관리적·기술적·물리적 보호대책을 하나의 위험 시나리오에 연결한다.",
    "인증제도와 관련 법규의 적용 대상을 사례형 문제에서 구분한다.",
  ],
};

const networkSecurityMajorItemContents = [
  {
    id: "content-official-security-cert-network-general",
    slug: "official-security-cert-network-general",
    canonicalKey: "official.security-certification.network-security.network-general",
    title: "네트워크 일반",
    summary:
      "OSI 7계층, TCP/IP, 주소 체계, 네트워크 장비와 기본 서비스 구성을 학습합니다.",
    body: [
      "# 네트워크 일반",
      "",
      "네트워크 일반은 패킷이 어떤 계층과 주소 체계를 거쳐 전달되는지 이해하는 출발점입니다. 정보보안기사와 정보보안산업기사 모두에서 공통으로 다루며, 이후 공격 유형과 보안장비 판단의 기반이 됩니다.",
      "",
      "## 핵심 학습 범위",
      "- OSI 7계층과 TCP/IP 계층의 역할을 비교합니다.",
      "- MAC, IP, Port, Subnet, Routing의 위치와 목적을 구분합니다.",
      "- NIC, Bridge, Switch, Router, Gateway, Hub 등 장비의 역할을 정리합니다.",
      "- 유선·무선 LAN과 기본 네트워크 서비스 운용 관점을 연결합니다.",
      "",
      "## 학습 포인트",
      "시험에서는 계층 이름만 묻기보다, 장애나 보안 이벤트가 어느 계층에서 발생했는지 추론하게 합니다. 주소 체계, 장비 위치, 프로토콜 역할을 함께 연결해 설명할 수 있어야 합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 주요항목을 학습용으로 재구성한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "OSI 7계층과 TCP/IP 계층을 장비·주소·프로토콜과 연결해 설명할 수 있다.",
      "네트워크 주소 체계와 포트의 역할을 구분할 수 있다.",
      "주요 네트워크 장비의 기능과 배치 위치를 비교할 수 있다.",
    ],
    coreConcepts: [
      "OSI 7계층",
      "TCP/IP",
      "MAC",
      "IP",
      "Port",
      "Subnet",
      "Routing",
      "Switch",
      "Router",
      "Gateway",
    ],
    practicalExamples: [
      "패킷 흐름도를 보고 어느 계층의 문제인지 식별합니다.",
      "서브넷과 라우팅 경로를 보고 접근 가능 범위를 추론합니다.",
      "스위치와 라우터의 역할 차이를 보안 통제 관점에서 비교합니다.",
    ],
  },
  {
    id: "content-official-security-cert-network-attack-techniques",
    slug: "official-security-cert-network-attack-techniques",
    canonicalKey:
      "official.security-certification.network-security.attack-techniques",
    title: "네트워크 기반 공격기술의 이해 및 대응",
    summary:
      "서비스 거부, 스캐닝, 스푸핑, 스니핑, 원격접속 공격의 동작 원리와 대응을 학습합니다.",
    body: [
      "# 네트워크 기반 공격기술의 이해 및 대응",
      "",
      "네트워크 기반 공격기술은 공격자가 가용성, 기밀성, 무결성을 어떤 방식으로 침해하는지 이해하고 대응 통제를 선택하는 영역입니다.",
      "",
      "## 핵심 학습 범위",
      "- 서비스 거부와 분산 서비스 거부 공격의 목적과 징후를 구분합니다.",
      "- 스캐닝을 침해 전 정찰 단계로 이해하고 로그 단서를 찾습니다.",
      "- 스푸핑과 스니핑을 신뢰 관계 악용 및 트래픽 관찰 관점에서 비교합니다.",
      "- 원격접속 공격의 계정·서비스·접근 경로 위험을 정리합니다.",
      "",
      "## 학습 포인트",
      "공격명을 외우는 것보다 공격 목적, 관찰 가능한 징후, 우선 대응 순서를 함께 정리해야 합니다. 동일한 트래픽 증가라도 정상 사용 증가인지, 서비스 거부 공격인지, 스캐닝인지 구분하는 사고가 필요합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 주요항목을 학습용으로 재구성한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "주요 네트워크 공격 유형의 목적과 동작 원리를 설명할 수 있다.",
      "공격별 로그·트래픽 징후를 구분할 수 있다.",
      "예방·탐지·대응 통제를 공격 유형에 맞게 선택할 수 있다.",
    ],
    coreConcepts: [
      "DoS",
      "DDoS",
      "스캐닝",
      "스푸핑",
      "스니핑",
      "원격접속 공격",
      "로그 분석",
      "트래픽 분석",
    ],
    practicalExamples: [
      "DDoS 의심 상황에서 가용성 저하와 트래픽 급증을 함께 확인합니다.",
      "스캐닝 이벤트와 실제 침해 이벤트를 로그 단서로 구분합니다.",
      "원격접속 실패 로그와 계정 잠금 정책을 대응 항목으로 연결합니다.",
    ],
  },
  {
    id: "content-official-security-cert-network-security-technology",
    slug: "official-security-cert-network-security-technology",
    canonicalKey:
      "official.security-certification.network-security.security-technology",
    title: "네트워크 보안 기술",
    summary:
      "보안 프로토콜과 방화벽, IDS/IPS, VPN, ESM, UTM, NAC 등 보안 솔루션의 역할을 학습합니다.",
    body: [
      "# 네트워크 보안 기술",
      "",
      "네트워크 보안 기술은 통신을 보호하고, 이상 행위를 탐지하며, 정책에 따라 접근을 통제하는 기술 묶음입니다. 장비 이름보다 적용 위치와 한계를 이해하는 것이 중요합니다.",
      "",
      "## 핵심 학습 범위",
      "- TLS, IPSec, VPN 등 보안 프로토콜의 보호 목적을 정리합니다.",
      "- 방화벽, IDS/IPS, ESM, UTM, NAC의 역할을 비교합니다.",
      "- 로그 분석과 패킷 분석이 어떤 근거를 제공하는지 이해합니다.",
      "- 악성코드 분석 도구와 네트워크 보안 분석 도구의 목적을 구분합니다.",
      "",
      "## 학습 포인트",
      "하나의 보안장비가 모든 위험을 해결하지 않습니다. 차단, 탐지, 인증, 격리, 로그 상관분석의 역할을 나누고, 네트워크 구간에 맞는 통제를 조합해야 합니다.",
      "",
      "> 이 콘텐츠는 공식 출제기준의 주요항목을 학습용으로 재구성한 SECURIUM 자체 작성 자료이며, 공식 문제나 유료 교재 내용을 복제하지 않습니다.",
    ].join("\n"),
    learningObjectives: [
      "보안 프로토콜의 목적과 적용 구간을 설명할 수 있다.",
      "주요 네트워크 보안 솔루션의 역할과 한계를 비교할 수 있다.",
      "로그·패킷 분석 결과를 보안 통제 판단에 활용할 수 있다.",
    ],
    coreConcepts: [
      "TLS",
      "IPSec",
      "Firewall",
      "IDS/IPS",
      "VPN",
      "ESM",
      "UTM",
      "NAC",
      "로그 분석",
      "패킷 분석",
    ],
    practicalExamples: [
      "방화벽 정책과 실제 네트워크 구성을 비교해 과도한 허용 규칙을 찾습니다.",
      "IDS/IPS 탐지 이벤트를 공격 유형과 대응 우선순위로 분류합니다.",
      "VPN 접속 로그와 NAC 정책을 비교해 접근 통제 누락을 점검합니다.",
    ],
  },
];

export const officialSecurityCertificationContents = [
  ...baseOfficialSecurityCertificationContents.map((content) =>
    content.id === "content-official-security-cert-system-security-overview"
      ? { ...content, ...systemSecurityFormalContent }
      : content.id === "content-official-security-cert-application-security-overview"
        ? { ...content, ...applicationSecurityFormalContent }
        : content.id ===
            "content-official-security-cert-information-security-general-overview"
          ? { ...content, ...informationSecurityGeneralFormalContent }
          : content.id === "content-official-security-cert-management-law-overview"
            ? { ...content, ...managementLawFormalContent }
      : content,
  ),
  ...networkSecurityMajorItemContents,
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
    id: "course-lesson-ise-official-network-general",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-02-01",
    contentId: "content-official-security-cert-network-general",
    displayTitle: "정보보안기사 네트워크 일반",
    sortOrder: 2,
    difficulty: "중급",
    importance: 93,
    estimatedMinutes: 12,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-network-attack-techniques",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-02-02",
    contentId: "content-official-security-cert-network-attack-techniques",
    displayTitle: "정보보안기사 네트워크 기반 공격기술의 이해 및 대응",
    sortOrder: 3,
    difficulty: "중급",
    importance: 95,
    estimatedMinutes: 14,
    isRequired: true,
  },
  {
    id: "course-lesson-ise-official-network-security-technology",
    courseId: "course-ise",
    curriculumNodeId: "curriculum-node-ise-2027-2029-01-02-03",
    contentId: "content-official-security-cert-network-security-technology",
    displayTitle: "정보보안기사 네트워크 보안 기술",
    sortOrder: 4,
    difficulty: "중급",
    importance: 94,
    estimatedMinutes: 13,
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
    id: "course-lesson-isie-official-network-general",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-02-01",
    contentId: "content-official-security-cert-network-general",
    displayTitle: "정보보안산업기사 네트워크 일반",
    sortOrder: 2,
    difficulty: "입문",
    importance: 91,
    estimatedMinutes: 11,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-network-attack-techniques",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-02-02",
    contentId: "content-official-security-cert-network-attack-techniques",
    displayTitle: "정보보안산업기사 네트워크 기반 공격기술의 이해 및 대응",
    sortOrder: 3,
    difficulty: "입문",
    importance: 92,
    estimatedMinutes: 12,
    isRequired: true,
  },
  {
    id: "course-lesson-isie-official-network-security-technology",
    courseId: "course-isie",
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-02-03",
    contentId: "content-official-security-cert-network-security-technology",
    displayTitle: "정보보안산업기사 네트워크 보안 기술",
    sortOrder: 4,
    difficulty: "입문",
    importance: 91,
    estimatedMinutes: 12,
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

export const officialSecurityCertificationCourseLessonExtensions = [
  {
    id: "course-lesson-extension-ise-official-network-security-overview",
    courseLessonId: "course-lesson-ise-official-network-security-overview",
    learningObjectivesOverride: [
      "네트워크보안 필기 출제 범위를 계층·공격·보안장비 관점으로 설명한다.",
      "실기형 로그·구성도·보안장비 설정 지문에서 점검 포인트를 도출한다.",
      "서비스 거부, 스캐닝, 스푸핑, 스니핑 공격을 보안 통제와 연결한다.",
    ],
    additionalBody:
      "정보보안기사 과정에서는 네트워크 원리 이해를 바탕으로 실기형 분석까지 연결한다. 단순 용어 암기보다 패킷 흐름, 장비 배치, 로그 단서, 보안정책 적용 여부를 함께 판단하는 연습이 필요하다.",
    examPoints: [
      "필기 20문항 수준의 네트워크보안 범위를 기준으로 학습한다.",
      "실기에서는 방화벽, IDS/IPS, VPN, NAC, ESM/SIEM 설정과 로그 해석을 함께 다룬다.",
      "공격 유형을 식별한 뒤 예방·탐지·대응 통제를 순서대로 제시하는 연습을 포함한다.",
    ],
    practicalNotes:
      "실무형 지문에서는 출발지·목적지·포트·프로토콜·로그 이벤트·차단 정책의 관계를 먼저 정리한 뒤 취약점과 대응 방안을 작성한다.",
    legalNotes: "",
    standardNotes: "",
    evidenceNotes:
      "방화벽 정책표, IDS/IPS 탐지 로그, VPN 접속 기록, NAC 정책, SIEM 상관분석 이벤트를 근거 예시로 사용한다.",
    commonMistakes:
      "스캐닝과 침입 성공을 혼동하거나, DDoS 대응을 단일 장비 차단만으로 설명하는 답안을 피한다.",
    instructorNotes:
      "기사 과정은 산업기사보다 분석형·서술형 답안 작성 비중을 높여 지도한다.",
    version: "1.0.0",
    status: "PUBLISHED",
  },
  {
    id: "course-lesson-extension-isie-official-network-security-overview",
    courseLessonId: "course-lesson-isie-official-network-security-overview",
    learningObjectivesOverride: [
      "네트워크 계층, 주소, 주요 프로토콜의 기본 역할을 구분한다.",
      "대표 공격 유형의 동작 원리와 기본 대응 방법을 설명한다.",
      "보안 프로토콜과 보안장비의 목적을 출제기준 용어와 연결한다.",
    ],
    additionalBody:
      "정보보안산업기사 과정에서는 네트워크보안의 기본 개념과 대표 공격·대응을 정확히 구분하는 데 집중한다. 깊은 운영 설계보다 용어, 원리, 특징, 기본 대응 방법을 안정적으로 연결하는 학습이 우선이다.",
    examPoints: [
      "필기 20문항 수준의 네트워크보안 기본 범위를 기준으로 학습한다.",
      "서비스 거부, 스캐닝, 스푸핑, 스니핑, 원격접속 공격의 동작 원리와 특징을 구분한다.",
      "Firewall, IDS/IPS, VPN, ESM, UTM, NAC의 목적과 기본 역할을 정리한다.",
    ],
    practicalNotes:
      "산업기사 과정은 장비 설정 세부 튜닝보다 공격 유형 식별, 보안장비 역할, 기본 대응 방법을 먼저 확인한다.",
    legalNotes: "",
    standardNotes: "",
    evidenceNotes:
      "포트 스캔 결과, 간단한 방화벽 정책, 보안장비 탐지 이벤트를 기본 근거 예시로 사용한다.",
    commonMistakes:
      "프로토콜 계층과 장비 역할을 섞어 외우거나, 보안장비 약어의 목적을 서로 바꾸어 이해하지 않도록 한다.",
    instructorNotes:
      "산업기사 과정은 기초 용어와 동작 원리 확인 문제의 반복 비중을 높여 지도한다.",
    version: "1.0.0",
    status: "PUBLISHED",
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
    courseLessonExtensionCount:
      officialSecurityCertificationCourseLessonExtensions.length,
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
  const extensionsByCourseLessonId = new Map(
    officialSecurityCertificationCourseLessonExtensions.map((extension) => [
      extension.courseLessonId,
      extension,
    ]),
  );

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
      extensionId: extensionsByCourseLessonId.get(lesson.id)?.id ?? null,
      examPoints:
        extensionsByCourseLessonId.get(lesson.id)?.examPoints.length ?? 0,
    })),
    courseSpecificExtensionCount: courseLessons.filter((lesson) =>
      extensionsByCourseLessonId.has(lesson.id),
    ).length,
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

  for (const extension of officialSecurityCertificationCourseLessonExtensions) {
    statements.push(
      `${insertCourseLessonExtensionSql(extension, dialect)}${statementEnd}`,
    );
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

function insertCourseLessonExtensionSql(extension, dialect) {
  const insert = dialect === "d1" ? "INSERT OR IGNORE" : "INSERT";
  const conflict =
    dialect === "d1"
      ? ""
      : `
ON CONFLICT ("id") DO UPDATE SET
  "course_lesson_id" = EXCLUDED."course_lesson_id",
  "learning_objectives_override_json" = EXCLUDED."learning_objectives_override_json",
  "additional_body" = EXCLUDED."additional_body",
  "exam_points_json" = EXCLUDED."exam_points_json",
  "practical_notes" = EXCLUDED."practical_notes",
  "legal_notes" = EXCLUDED."legal_notes",
  "standard_notes" = EXCLUDED."standard_notes",
  "evidence_notes" = EXCLUDED."evidence_notes",
  "common_mistakes" = EXCLUDED."common_mistakes",
  "instructor_notes" = EXCLUDED."instructor_notes",
  "version" = EXCLUDED."version",
  "status" = EXCLUDED."status",
  "updated_at" = ${nowExpression(dialect)}`;

  return `
${insert} INTO "course_lesson_extensions" (
  "id", "course_lesson_id", "learning_objectives_override_json",
  "additional_body", "exam_points_json", "practical_notes", "legal_notes",
  "standard_notes", "evidence_notes", "common_mistakes", "instructor_notes",
  "version", "status"
)
VALUES (
  ${q(extension.id)},
  ${q(extension.courseLessonId)},
  ${q(JSON.stringify(extension.learningObjectivesOverride))},
  ${q(extension.additionalBody)},
  ${q(JSON.stringify(extension.examPoints))},
  ${q(extension.practicalNotes)},
  ${q(extension.legalNotes)},
  ${q(extension.standardNotes)},
  ${q(extension.evidenceNotes)},
  ${q(extension.commonMistakes)},
  ${q(extension.instructorNotes)},
  ${q(extension.version)},
  ${q(extension.status)}
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
