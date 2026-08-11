export const SECURITY_CONTENT_INTELLIGENCE_V3_SOURCE = "SECURIUM_CONTENT_UPGRADE_V3";

const provenance = (track, sourceRefs, pattern) => ({
  policy: "CONCEPT_AND_PATTERN_TRANSFORMATION_ONLY",
  track,
  sourceRefs,
  pattern,
  originalityReview: "REQUIRED_AND_PASSED_DRAFT_GATE",
  sourceTextImported: false,
});

const theory = ({ courseId, track, subjectCode, nodeSuffix, slug, title, concepts, prerequisites, sourceRefs, sections }) => ({
  id: `content-v3-${courseId}-${track.toLowerCase()}-${slug}`,
  courseId,
  track,
  subjectCode,
  curriculumNodeId: `curriculum-node-${courseId === "course-ise" ? "ise" : "isie"}-2027-2029-${nodeSuffix}`,
  title,
  concepts,
  prerequisites,
  learningObjectives: sections.objectives,
  sections,
  provenance: provenance(track, sourceRefs, "THEORY_GAP_SYNTHESIS"),
});

const commonSource = [
  "reports/source-text-extraction.json",
  "data/normalized-knowledge-base.json",
];

export const securityContentIntelligenceV3Theory = [
  theory({
    courseId: "course-ise", track: "WRITTEN", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "01-01", slug: "privilege-audit-evidence",
    title: "시스템 권한·감사 증거 기반 판단", concepts: ["Linux security", "Windows security", "Audit and accountability"], prerequisites: ["Authorization and access control"], sourceRefs: commonSource,
    sections: {
      objectives: ["주체·객체·권한·감사 이벤트를 분리해 판단한다.", "권한 상승과 감사 우회가 결합된 상황의 통제 순서를 설명한다."],
      core: "권한 검토는 계정 목록 확인으로 끝나지 않는다. 주체가 어떤 인증정보로 접속했고, 어떤 그룹·토큰·실효 UID를 거쳐 객체에 접근했으며, 그 행위가 변조하기 어려운 감사 기록으로 남았는지를 하나의 증거 사슬로 본다.",
      mechanism: "Linux는 소유자·그룹·기타 권한, ACL, setuid/setgid와 sudo 정책이 실제 권한을 결정한다. Windows는 액세스 토큰, SID, 그룹, 특권과 DACL 평가 결과가 접근을 결정한다. 두 환경 모두 중앙 수집, 시각 동기화, 보존 정책이 감사 증거의 신뢰도를 좌우한다.",
      threatDefense: "공격자는 과도한 그룹 권한, 서비스 계정, 권한 있는 실행 파일과 로그 삭제 권한을 악용한다. 최소 권한, 직무 분리, 특권계정 별도 관리, 중요 로그 원격 전송, 무결성 검증을 함께 적용해야 탐지와 사후 입증이 가능하다.",
      examPoints: "필기에서는 인증과 인가, 파일 권한과 ACL, 감사와 모니터링의 역할을 교차 비교한다. 통제 하나가 모든 위험을 제거한다고 단정하는 선택지를 경계한다.",
      confusion: "로그가 존재한다는 사실과 책임추적성이 확보됐다는 사실은 다르다. 행위자 식별, 시간 신뢰성, 변경 통제, 충분한 보존 기간이 함께 충족되어야 한다.",
      practical: "배포 계정이 관리자 그룹에 속하고 로컬 로그 삭제도 가능한 경우, 그룹 제거만이 아니라 배포용 제한 권한·승인된 상승 절차·원격 감사 로그를 한 묶음으로 설계한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "WRITTEN", subjectCode: "NETWORK_SECURITY", nodeSuffix: "01-02", slug: "protocol-boundary-control",
    title: "프로토콜·경계 장비 복합 판단", concepts: ["TLS and secure protocols", "IDS and IPS", "Firewall and WAF"], prerequisites: ["Network architecture and OSI"], sourceRefs: commonSource,
    sections: {
      objectives: ["TLS의 신뢰 검증과 암호화 범위를 설명한다.", "방화벽·WAF·IDS·IPS의 관찰 지점과 차단 범위를 비교한다."],
      core: "네트워크 통제는 암호화, 허용 정책, 이상 징후 탐지, 애플리케이션 요청 검증을 서로 다른 계층에 배치한다. 장비 이름보다 어떤 트래픽을 복호화·관찰하고 어떤 기준으로 허용 또는 차단하는지가 핵심이다.",
      mechanism: "TLS는 인증서 체인과 호스트명 검증 후 세션 키를 합의해 구간 기밀성과 무결성을 제공한다. 방화벽은 주소·포트·상태를, WAF는 HTTP 의미를, IDS/IPS는 시그니처와 행위 특성을 이용한다. 암호화된 구간은 적절한 종료 지점 없이는 내용 기반 탐지가 제한된다.",
      threatDefense: "인증서 검증 생략, 과도한 허용 규칙, 탐지 전용 장비를 차단 장비로 오인하는 설계가 빈번하다. 최소 허용, 인증서 수명주기, 탐지 튜닝, 예외 승인과 로그 상관분석을 결합한다.",
      examPoints: "필기에서는 계층별 통제 범위, 오탐·미탐, TLS가 보호하지 않는 종단 시스템 위험을 묻는다. '암호화되면 공격이 사라진다'는 진술은 틀리다.",
      confusion: "IDS는 일반적으로 탐지·경보가 목적이고 IPS는 인라인 차단이 가능하다. WAF는 모든 네트워크 공격을 막는 범용 방화벽이 아니다.",
      practical: "외부 TLS가 로드밸런서에서 종료되는 구조라면 WAF 관찰 지점과 내부 재암호화 여부, 인증서 검증 주체를 데이터 흐름에 표시한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "WRITTEN", subjectCode: "APPLICATION_SECURITY", nodeSuffix: "01-03", slug: "web-api-input-session",
    title: "웹·API 입력 및 세션 보안 판단", concepts: ["SQL injection", "XSS and CSRF", "Web and API security"], prerequisites: ["Authentication", "Authorization and access control"], sourceRefs: commonSource,
    sections: {
      objectives: ["입력 데이터와 명령·코드의 경계를 설명한다.", "XSS·CSRF·SQL Injection의 신뢰 경계와 방어 수단을 구분한다."],
      core: "웹 취약점은 신뢰하지 않은 데이터가 SQL, HTML, 셸 또는 권한 판단에 섞이는 지점에서 발생한다. 입력 검증은 업무 규칙을 강제하고, 컨텍스트별 출력 인코딩과 매개변수화는 해석기의 데이터·명령 경계를 보존한다.",
      mechanism: "SQL Injection은 쿼리 구조, XSS는 브라우저 실행 문맥, CSRF는 사용자의 인증 상태를 악용한다. API는 객체 단위 인가와 토큰 범위 검증이 추가로 필요하다. 각 취약점은 같은 '입력값 문제'처럼 보여도 방어 지점이 다르다.",
      threatDefense: "동적 문자열 결합, DOM 직접 삽입, 상태 변경 GET, 예측 가능한 객체 ID가 주요 위험이다. Prepared Statement, 출력 인코딩, CSRF 토큰·SameSite, 서버 측 객체 인가를 적용하고 보안 테스트로 우회 경로를 확인한다.",
      examPoints: "필기에서는 방어 기술의 적용 컨텍스트를 묻는다. Prepared Statement는 SQL 구조 오염을 막지만 저장형 XSS의 출력 인코딩을 대신하지 않는다.",
      confusion: "CORS는 브라우저의 교차 출처 읽기 정책이며 서버 측 인가 수단이 아니다. 입력값을 제거하는 블랙리스트만으로 우회 가능성을 해소할 수 없다.",
      practical: "게시물 API는 숫자형 ID 검증 후에도 요청 사용자가 해당 객체를 읽을 권한이 있는지 서버에서 확인하고, 응답 HTML 문맥에는 별도 인코딩을 적용한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "WRITTEN", subjectCode: "SECURITY_FOUNDATION", nodeSuffix: "01-04", slug: "crypto-auth-access",
    title: "암호·인증·접근통제 비교 판단", concepts: ["Cryptographic algorithms", "Authentication", "Authorization and access control"], prerequisites: ["CIA triad"], sourceRefs: commonSource,
    sections: {
      objectives: ["기밀성·무결성·인증·인가의 통제 목적을 구분한다.", "키 관리 실패가 암호 알고리즘의 안전성을 무력화하는 과정을 설명한다."],
      core: "암호는 데이터를 변환하는 기술이고, 인증은 주체의 신원을 확인하며, 인가는 확인된 주체가 자원에 수행할 수 있는 행위를 결정한다. 안전한 시스템은 이 셋을 순서와 목적에 맞게 결합한다.",
      mechanism: "대칭키는 같은 비밀키를 공유해 빠르게 처리하고, 공개키는 키 쌍을 이용해 키 합의·서명 등에 활용된다. 인증 결과는 세션이나 토큰으로 전달되며 접근통제 정책이 역할·속성·규칙에 따라 요청을 평가한다.",
      threatDefense: "강한 알고리즘도 키 노출, 약한 난수, 토큰 재사용, 과도한 역할 권한이 있으면 보호 효과가 없다. 키 수명주기, 다요소 인증, 세션 보호, 기본 거부와 최소 권한을 적용한다.",
      examPoints: "암호화가 송신자 부인방지를 자동 제공하지 않고, 인증 성공이 모든 자원 접근 허용을 의미하지 않는다는 점이 빈출 판단 포인트다.",
      confusion: "해시와 암호화는 목적이 다르고, 접근통제 목록은 인증 수단이 아니다. 전자서명의 검증 가능성과 데이터 기밀성도 별개다.",
      practical: "관리 API에는 TLS, 관리자 MFA, 짧은 수명의 토큰, 역할별 권한, 키 회전과 감사 로그를 계층적으로 적용한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "WRITTEN", subjectCode: "SECURITY_LAW", nodeSuffix: "01-05", slug: "risk-governance-continuity",
    title: "위험·거버넌스·업무연속성 근거 판단", concepts: ["Risk management", "Security governance and law", "BCP and disaster recovery"], prerequisites: ["CIA triad"], sourceRefs: commonSource,
    sections: {
      objectives: ["자산·위협·취약점·영향으로 위험 판단 근거를 구성한다.", "BCP와 재해복구 통제를 RTO·RPO에 연결한다."],
      core: "위험관리는 기술 취약점 목록이 아니라 조직 목표에 대한 불확실성을 식별·평가·처리·모니터링하는 과정이다. 거버넌스는 책임과 의사결정 기준을 정하고, 업무연속성은 중단 상황에서도 우선 업무를 허용 가능한 수준으로 복구한다.",
      mechanism: "자산과 업무 영향을 식별한 뒤 위협 가능성과 통제 효과를 고려해 잔여 위험을 산정한다. 업무영향분석은 우선순위와 RTO·RPO를 도출하고 복구 전략·훈련·개선으로 이어진다.",
      threatDefense: "정량 점수만 신뢰하거나 백업 존재를 복구 가능성으로 간주하면 실제 중단 시 실패한다. 위험 수용 권한, 복구 테스트, 대체 절차, 공급망 의존성을 명시한다.",
      examPoints: "필기에서는 위험 회피·완화·전가·수용과 RTO·RPO를 상황에 맞게 연결한다. 법적 의무와 권고 통제를 구분해 근거를 확인한다.",
      confusion: "RTO는 복구 목표 시간, RPO는 허용 가능한 데이터 손실 시점이다. 재해복구는 BCP 전체와 동일하지 않고 기술 복구에 더 초점을 둔다.",
      practical: "결제 시스템의 RTO가 2시간, RPO가 15분이면 복제 주기와 대체 처리 절차가 두 목표를 실제로 충족하는지 복구 훈련으로 검증한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "WRITTEN", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "01-01", slug: "account-permission-log-basics",
    title: "기본 계정·권한·로그 점검", concepts: ["Linux security", "Windows security"], prerequisites: ["Authentication"], sourceRefs: ["data/source-file-inventory.json"],
    sections: {
      objectives: ["불필요 계정과 과도한 파일 권한을 식별한다.", "로그온 성공·실패 기록에서 기본 이상 징후를 찾는다."],
      core: "기본 시스템 점검은 사용하지 않는 계정, 기본 비밀번호, 관리자 그룹, 공유 파일 권한, 보안 로그 설정을 확인하는 데서 시작한다.",
      mechanism: "운영체제는 계정 인증 후 그룹과 파일·레지스트리 권한을 평가한다. 로그인 실패 반복, 비정상 시간대 성공, 관리자 그룹 변경은 점검 우선순위가 높은 사건이다.",
      threatDefense: "공용 계정과 전체 쓰기 권한은 행위자 식별과 무결성을 약화한다. 개인 계정, 필요한 권한만 부여, 잠금 정책, 로그 중앙 보관을 적용한다.",
      examPoints: "권한 표기와 그룹 구성, 계정 잠금, 로그 목적을 기본 수준에서 정확히 구분한다.",
      confusion: "파일을 읽을 수 있는 권한과 실행할 수 있는 권한은 다르며, 관리자 계정 이름 변경만으로 권한 위험이 사라지지 않는다.",
      practical: "퇴직자 계정 활성 상태와 공유 폴더 Everyone 쓰기 권한을 발견하면 계정 비활성화, 소유자 확인, 최소 권한 재설정을 순서대로 수행한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "WRITTEN", subjectCode: "NETWORK_SECURITY", nodeSuffix: "01-02", slug: "basic-attacks-devices",
    title: "기본 네트워크 공격과 보안장비 구분", concepts: ["DoS and DDoS", "ARP spoofing", "IDS and IPS"], prerequisites: ["Network architecture and OSI"], sourceRefs: ["data/source-file-inventory.json"],
    sections: {
      objectives: ["DoS와 ARP Spoofing의 징후를 구분한다.", "IDS와 IPS의 기본 배치 및 역할을 설명한다."],
      core: "서비스 거부는 자원 또는 회선을 고갈시키고, ARP Spoofing은 같은 네트워크에서 IP-MAC 대응을 속여 트래픽 경로를 바꾼다. IDS/IPS는 이런 징후를 관찰하거나 차단한다.",
      mechanism: "DoS는 요청량·연결 상태·연산 비용을 악용한다. ARP는 인증 없이 갱신될 수 있어 위조 응답에 취약하다. IDS는 복제 트래픽에서도 탐지할 수 있고 IPS는 인라인에서 패킷을 차단할 수 있다.",
      threatDefense: "비정상 트래픽 임계치, 스위치 보안 기능, ARP 변화 감시, 검증된 차단 정책을 함께 사용한다.",
      examPoints: "공격이 영향을 주는 범위와 장비의 탐지·차단 역할을 연결하는 문제가 중심이다.",
      confusion: "트래픽이 많다고 모두 DDoS는 아니며, IDS 경보가 곧 자동 차단을 뜻하지 않는다.",
      practical: "게이트웨이 MAC이 갑자기 바뀌고 다수 호스트에서 같은 MAC이 관찰되면 ARP 테이블과 스위치 포트를 우선 확인한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "WRITTEN", subjectCode: "APPLICATION_SECURITY", nodeSuffix: "01-03", slug: "service-input-basics",
    title: "기본 서비스·입력값 보안", concepts: ["DNS security", "SQL injection", "XSS and CSRF"], prerequisites: ["Web and API security"], sourceRefs: ["data/source-file-inventory.json"],
    sections: {
      objectives: ["DNS 응답과 웹 입력 처리의 기본 위험을 설명한다.", "SQL Injection과 XSS의 방어 위치를 구분한다."],
      core: "서비스 입력은 형식 검증만이 아니라 사용되는 문맥에서 안전하게 처리해야 한다. DNS는 이름을 주소로 연결하고, 웹 애플리케이션은 입력을 SQL 또는 HTML로 해석할 때 경계를 보존해야 한다.",
      mechanism: "SQL은 매개변수 바인딩으로 데이터와 구문을 분리하고, HTML은 출력 위치에 맞는 인코딩을 적용한다. DNS 캐시와 응답 신뢰도는 별도의 보안 통제로 관리한다.",
      threatDefense: "문자열 결합 쿼리, 검증 없는 HTML 출력, 신뢰하지 않은 DNS 응답을 피하고 표준 라이브러리와 보안 설정을 사용한다.",
      examPoints: "취약점 이름, 발생 위치, 대표 방어법을 정확히 연결한다.",
      confusion: "SQL 특수문자 제거는 완전한 방어가 아니며, HTML 인코딩은 SQL Injection을 막지 않는다.",
      practical: "검색어를 SQL에 직접 이어 붙이지 않고 자리표시자에 바인딩하며, 검색 결과 출력에는 HTML 인코딩을 별도로 적용한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "WRITTEN", subjectCode: "SECURITY_FOUNDATION", nodeSuffix: "01-04", slug: "crypto-auth-hash-basics",
    title: "기본 암호·인증·해시 적용", concepts: ["Authentication", "Hash and message digest", "Digital signature and PKI"], prerequisites: ["Cryptographic algorithms"], sourceRefs: ["data/source-file-inventory.json"],
    sections: {
      objectives: ["암호화와 해시의 목적을 구분한다.", "인증서와 전자서명의 기본 검증 흐름을 설명한다."],
      core: "암호화는 키로 데이터를 읽기 어렵게 만들고, 해시는 고정 길이 요약값으로 무결성 확인에 쓰인다. 전자서명은 개인키로 생성되고 공개키로 검증되며 인증서는 공개키와 주체를 연결한다.",
      mechanism: "수신자는 인증서 체인과 유효기간을 확인하고 서명 검증으로 데이터 변경 여부와 서명 키 보유를 확인한다. 비밀번호는 복호화 가능한 암호문보다 salt를 포함한 느린 해시로 저장한다.",
      threatDefense: "약한 해시, 인증서 경고 무시, 개인키 공유를 피하고 승인된 알고리즘과 안전한 키 저장을 사용한다.",
      examPoints: "해시·암호화·서명·인증서의 목적과 사용하는 키를 기본 수준에서 묻는다.",
      confusion: "해시는 일반적으로 원문 복구용이 아니며, 인증서가 있다고 상대 시스템 전체가 안전한 것은 아니다.",
      practical: "다운로드 파일의 해시를 공식 배포 채널 값과 비교하고, TLS 인증서의 이름과 유효기간도 별도로 확인한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "PRACTICAL", subjectCode: "NETWORK_SECURITY", nodeSuffix: "02-01-01", slug: "architecture-protocol-analysis",
    title: "복합 시스템·네트워크 보안특성 분석", concepts: ["Network architecture and OSI", "Virtualization and cloud security"], prerequisites: ["TLS and secure protocols", "Firewall and WAF"], sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource],
    sections: {
      objectives: ["데이터 흐름에서 신뢰 경계와 통제 공백을 표시한다.", "가상화·클라우드 책임 경계를 반영한 개선안을 작성한다."],
      core: "실기 답안은 구성요소 이름을 나열하지 않고 사용자부터 데이터 저장소까지 흐름, 인증·암호화 종료 지점, 관리 평면, 외부 의존성을 표시해야 한다.",
      mechanism: "각 홉에서 프로토콜, 포트, 주체, 자격증명, 로그 생성 위치를 표로 정리하면 암호화가 끊기거나 과도한 관리 권한이 모이는 지점을 찾을 수 있다.",
      threatDefense: "공개 관리 포트, 공유 서비스 계정, 보안그룹 전체 허용, 메타데이터 접근을 확인한다. 사설 경로, 최소 규칙, 워크로드 신원, 관리 로그와 구성 변경 감사를 적용한다.",
      examPoints: "정답은 취약 지점, 공격 가능 경로, 구체 통제, 검증 방법을 한 세트로 제시한다.",
      confusion: "클라우드 제공자의 인프라 보안과 고객의 계정·데이터·설정 책임을 혼동하지 않는다.",
      practical: "인터넷→로드밸런서→애플리케이션→DB 흐름에 TLS 종료, 방화벽 규칙, 서비스 계정, 감사 로그를 표시해 종단 간 통제를 검증한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "PRACTICAL", subjectCode: "APPLICATION_SECURITY", nodeSuffix: "02-01-02", slug: "code-config-remediation",
    title: "취약 코드·설정 진단과 보완", concepts: ["Vulnerability management", "SQL injection", "Command and code injection"], prerequisites: ["Web and API security"], sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource],
    sections: {
      objectives: ["데이터 흐름으로 취약 코드의 원인을 추적한다.", "수정 코드와 보완 통제를 함께 제시한다."],
      core: "코드 분석은 입력원, 변환, 검증, 위험한 실행 지점을 연결한다. 문자열이 SQL·셸·템플릿의 구문으로 해석되면 단순 필터보다 안전한 API로 경계를 재설계해야 한다.",
      mechanism: "SQL은 매개변수 바인딩, 운영체제 명령은 인자 배열과 허용 목록, 파일 경로는 정규화 후 기준 디렉터리 확인을 적용한다. 실행 계정 권한과 오류 노출도 함께 점검한다.",
      threatDefense: "블랙리스트 정규식만 추가하면 인코딩·구문 차이로 우회될 수 있다. 안전한 API, 최소 권한, 테스트 케이스, 로그와 배포 검증을 결합한다.",
      examPoints: "취약점명 1점, 근거가 되는 코드 흐름 1점, 직접 수정 1점, 보완 통제 1점처럼 채점 포인트를 분리한다.",
      confusion: "Prepared Statement는 테이블명 같은 SQL 구조 요소를 매개변수화하지 못하므로 그런 값은 허용 목록으로 제한한다.",
      practical: "사용자 입력을 셸 문자열에 붙이는 백업 기능은 명령 실행 API의 인자 배열로 바꾸고 대상 파일을 승인된 디렉터리로 제한한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "PRACTICAL", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "02-01-03", slug: "timeline-incident-response",
    title: "로그 타임라인·침해사고 대응", concepts: ["Logging and incident response", "Forensics"], prerequisites: ["Audit and accountability"], sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource],
    sections: {
      objectives: ["서로 다른 로그의 시간을 정규화해 공격 타임라인을 만든다.", "증거 보존과 확산 차단을 균형 있게 수행한다."],
      core: "단일 경보가 아니라 인증, 프로세스, 네트워크, 파일 변경 이벤트를 공통 시간축에 배치하고 사실·추론·미확인을 구분한다.",
      mechanism: "시간대와 시계 오차를 보정하고 사용자·호스트·세션·프로세스 ID로 사건을 연결한다. 원본은 해시와 인계 기록을 남겨 보존하고 분석 사본에서 조사한다.",
      threatDefense: "성급한 재부팅이나 로그 삭제는 증거를 훼손할 수 있다. 격리 범위, 메모리 확보 필요성, 계정 폐기, 지표 차단을 영향도에 맞게 순서화한다.",
      examPoints: "관찰된 근거, 침해 범위, 즉시 조치, 근본 원인 제거, 복구 후 모니터링을 답안에 포함한다.",
      confusion: "격리는 삭제와 다르며, 포렌식 이미징만으로 서비스 복구가 완료되는 것도 아니다.",
      practical: "비정상 로그인 뒤 새 서비스 등록과 외부 연결이 이어지면 계정·호스트를 격리하고 메모리·이벤트 로그를 보존한 뒤 동일 지표를 전사 검색한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "PRACTICAL", subjectCode: "SECURITY_LAW", nodeSuffix: "02-01-04", slug: "risk-treatment-plan",
    title: "위험평가와 보호대책 이행계획", concepts: ["Risk management", "Audit and accountability"], prerequisites: ["Security governance and law"], sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource],
    sections: {
      objectives: ["평가 근거가 재현 가능한 위험 시나리오를 작성한다.", "담당자·기한·검증 기준이 있는 이행계획을 수립한다."],
      core: "실기 위험평가는 자산가치와 가능성 숫자만 제시하지 않고 위협 사건, 악용 취약점, 기존 통제, 업무 영향과 잔여 위험을 설명해야 한다.",
      mechanism: "평가 기준과 가정을 먼저 고정하고 통제 적용 전·후 위험을 비교한다. 처리 계획은 통제 소유자, 완료일, 증빙, 잔여 위험 승인자를 포함한다.",
      threatDefense: "근거 없는 점수 조정과 통제 설치만으로 종료하는 관행을 피한다. 취약점 재검증, 로그 관찰, 복구 훈련 등 효과 검증을 명시한다.",
      examPoints: "위험 식별, 산정 근거, 처리 선택, 이행 책임, 잔여 위험의 다섯 요소로 답안을 구성한다.",
      confusion: "위험 전가는 책임 전체의 이전이 아니며, 수용은 평가와 승인 없이 방치하는 것이 아니다.",
      practical: "지원 종료 서버는 교체 일정과 네트워크 격리, 관리자 접근 제한, 탐지 강화, 잔여 위험 승인 기한을 함께 기록한다.",
    },
  }),
  theory({
    courseId: "course-ise", track: "PRACTICAL", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "02-01-05", slug: "modern-threat-operations",
    title: "최신 위협의 운영 영향 평가", concepts: ["Endpoint detection and response", "Malware and ransomware"], prerequisites: ["Logging and incident response"], sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource],
    sections: {
      objectives: ["EDR 행위 이벤트로 랜섬웨어 진행 단계를 추론한다.", "운영 연속성을 고려한 봉쇄·복구 결정을 설명한다."],
      core: "최신 위협 분석은 제품명보다 초기 접근, 실행, 권한 상승, 자격증명 접근, 측면 이동, 데이터 반출·암호화의 행위 연쇄를 본다.",
      mechanism: "EDR은 프로세스 트리, 명령행, 파일·레지스트리·네트워크 이벤트를 연결한다. 탐지 규칙은 단일 해시보다 행위와 관계를 사용해야 변종에도 대응할 수 있다.",
      threatDefense: "감염 호스트 격리, 자격증명 폐기, 관리 채널 보호, 변경 불가능한 백업 검증, 동일 지표 헌팅을 병행한다.",
      examPoints: "증거에서 확인된 단계와 추정 단계를 구분하고, 조치가 업무에 미치는 영향과 우선순위를 설명한다.",
      confusion: "파일 복구만으로 공격자 접근이 제거되지 않으며, EDR 설치만으로 모든 엔드포인트 가시성이 자동 확보되지 않는다.",
      practical: "문서 프로그램→스크립트 엔진→자격증명 도구→대량 파일 변경 프로세스 트리를 근거로 호스트 격리와 계정 회전을 우선 시행한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "PRACTICAL", subjectCode: "NETWORK_SECURITY", nodeSuffix: "02-01-01", slug: "basic-system-protocol-check",
    title: "기본 시스템·프로토콜 보안특성 확인", concepts: ["Linux security", "TLS and secure protocols", "DNS security"], prerequisites: ["Network architecture and OSI"], sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"],
    sections: {
      objectives: ["기본 명령 결과에서 서비스·권한 이상을 찾는다.", "TLS와 DNS 설정의 기본 확인 항목을 제시한다."],
      core: "실기 기본 점검은 서비스가 어떤 주소와 포트에서 실행되고 어떤 계정 권한을 사용하며 이름 해석과 암호화가 올바른지를 확인한다.",
      mechanism: "프로세스·포트·설정 파일·인증서의 정보를 순서대로 대조한다. 인증서 이름·기간·체인과 DNS 레코드가 실제 서비스 대상과 일치해야 한다.",
      threatDefense: "불필요한 외부 바인딩, 관리자 권한 실행, 만료 인증서, 잘못된 DNS 위임을 수정하고 변경 후 재점검한다.",
      examPoints: "관찰 값 하나와 그 의미, 기본 조치 하나를 정확히 쓰는 연습을 한다.",
      confusion: "포트가 열려 있다는 사실만으로 취약하다고 단정하지 않고 업무 필요성과 접근 범위를 확인한다.",
      practical: "관리 서비스가 0.0.0.0에 바인딩된 결과를 보면 사설 관리 주소로 제한하고 방화벽 규칙을 확인한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "PRACTICAL", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "02-01-02", slug: "basic-config-remediation",
    title: "기본 보안설정 점검과 보완", concepts: ["Vulnerability management", "Firewall and WAF"], prerequisites: ["Authorization and access control"], sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"],
    sections: {
      objectives: ["설정값의 위험을 기준 설정과 비교한다.", "최소 범위의 수정안과 확인 방법을 작성한다."],
      core: "설정 진단은 현재 값, 안전 기준, 예외 사유, 수정 값, 검증 명령을 한 줄로 연결한다.",
      mechanism: "방화벽은 출발지·목적지·포트·방향·상태를 평가하고 시스템 설정은 계정·서비스·파일 권한에 영향을 준다.",
      threatDefense: "전체 허용 규칙과 기본 계정을 제거하되 서비스 영향과 승인된 예외를 기록한다.",
      examPoints: "문제의 설정 행에서 위험한 범위를 정확히 지목하고 더 좁은 허용값을 제시한다.",
      confusion: "규칙 순서가 있는 장비에서는 좁은 차단 규칙이 뒤에 있어 효과가 없을 수 있다.",
      practical: "관리 포트의 출발지 ANY 규칙을 관리망 CIDR로 제한하고 외부에서 차단되는지 테스트한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "PRACTICAL", subjectCode: "SYSTEM_SECURITY", nodeSuffix: "02-01-03", slug: "basic-log-first-response",
    title: "기본 로그 판별과 초동 대응", concepts: ["Logging and incident response", "IDS and IPS"], prerequisites: ["Authentication"], sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"],
    sections: {
      objectives: ["로그에서 시간·출발지·대상·결과를 추출한다.", "오탐 확인을 포함한 초동 대응 순서를 작성한다."],
      core: "로그 분석의 기본 단위는 언제, 누가 또는 어디서, 무엇을 대상으로, 어떤 행위를 했고 결과가 어땠는지이다.",
      mechanism: "반복 실패 뒤 성공, 여러 대상에 대한 순차 접근, 차단되지 않은 고위험 경보를 우선 확인한다. 자산 소유자와 정상 작업 여부를 대조한다.",
      threatDefense: "원본 로그를 보존하고 의심 출발지를 제한하며 계정 비밀번호 변경과 추가 로그 확인을 수행한다.",
      examPoints: "공격명만 쓰지 말고 로그 필드 근거와 첫 조치를 함께 제시한다.",
      confusion: "IDS의 한 번의 경보만으로 침해를 확정하지 않고 주변 이벤트로 검증한다.",
      practical: "10분 동안 한 IP에서 다수 계정 로그인 실패 후 성공이 있으면 성공 계정의 세션과 이후 행위를 확인하고 계정을 보호한다.",
    },
  }),
  theory({
    courseId: "course-isie", track: "PRACTICAL", subjectCode: "APPLICATION_SECURITY", nodeSuffix: "02-01-04", slug: "modern-security-basics",
    title: "최신 보안 동향의 기본 적용", concepts: ["Endpoint detection and response", "Email authentication"], prerequisites: ["Logging and incident response"], sourceRefs: ["data/source-file-inventory.json"],
    sections: {
      objectives: ["EDR 경보의 프로세스 관계를 읽는다.", "SPF·DKIM·DMARC 결과를 기본 수준에서 해석한다."],
      core: "최신 통제도 기본 원리는 같다. EDR은 엔드포인트 행위를 연결하고 이메일 인증은 발송 권한, 메시지 서명, 도메인 정책 결과를 함께 본다.",
      mechanism: "SPF는 발송 서버, DKIM은 메시지 서명, DMARC는 정렬과 처리 정책을 다룬다. EDR은 부모·자식 프로세스와 파일·네트워크 이벤트를 연결한다.",
      threatDefense: "실패 결과를 단순 수신 거부로만 해석하지 않고 정책과 포워딩 영향을 확인한다. 의심 프로세스는 격리 전 업무 영향도 확인한다.",
      examPoints: "각 기술의 역할과 로그 필드가 의미하는 기본 상태를 묻는다.",
      confusion: "SPF 통과만으로 본문 변조가 검증되는 것은 아니며, EDR 경보는 백신 탐지와 완전히 같은 개념이 아니다.",
      practical: "메일 헤더에서 SPF 실패·DKIM 통과·DMARC 실패가 보이면 정렬 조건과 발신 도메인을 확인하고 피싱 여부를 조사한다.",
    },
  }),
];

const mcq = ({ id, courseId, subjectCode, contentId, difficulty, concepts, stem, choices, answerIndex, explanation, distractorRationales }) => ({
  id: `question-v3-${courseId}-written-${id}`,
  courseId, track: "WRITTEN", subjectCode, contentId, difficulty, type: "SINGLE_CHOICE", concepts, stem, choices, answerIndex, explanation, distractorRationales,
  learningObjective: "복합 지문에서 통제 목적과 적용 범위를 근거로 최선의 답을 선택한다.",
  provenance: provenance("WRITTEN", commonSource, id.includes("scenario") ? "SCENARIO_DECISION" : "CONCEPT_COMPARISON"),
});

const practical = ({ id, courseId, subjectCode, contentId, difficulty, type, concepts, scenario, evidence, task, expectedAnswer, scoringPoints, explanation, sourceRefs }) => ({
  id: `question-v3-${courseId}-practical-${id}`,
  courseId, track: "PRACTICAL", subjectCode, contentId, difficulty, type, concepts, scenario, evidence, task, expectedAnswer, scoringPoints, explanation,
  learningObjective: "증거를 해석해 재현 가능한 판단과 실행 가능한 보안 조치를 제시한다.",
  provenance: provenance("PRACTICAL", sourceRefs, type),
});

const cid = (courseId, track, slug) => `content-v3-${courseId}-${track.toLowerCase()}-${slug}`;

export const securityContentIntelligenceV3Questions = [
  mcq({ id: "system-compare", courseId: "course-ise", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-ise", "WRITTEN", "privilege-audit-evidence"), difficulty: "HARD", concepts: ["Linux security", "Windows security", "Audit and accountability"], stem: "관리자 권한 행위를 사후에 특정 사용자에게 귀속시키기 위한 통제 조합으로 가장 적절한 것은?", choices: ["공용 관리자 계정과 로컬 로그 보관", "개인별 특권 계정, 승인된 권한 상승, 원격 불변 로그와 시각 동기화", "관리자 계정 이름 변경과 로그온 배너", "파일 암호화와 정기 백업"], answerIndex: 1, explanation: "행위자 식별·승인된 상승·변조 곤란한 감사 증거·정확한 시간축이 책임추적성을 함께 만든다.", distractorRationales: ["공용 계정은 행위자를 구분하지 못하고 로컬 로그는 삭제될 수 있다.", null, "계정 이름과 배너는 행위 증거를 보장하지 않는다.", "기밀성과 가용성 통제로 관리자 행위 귀속을 직접 보장하지 않는다."] }),
  mcq({ id: "system-scenario", courseId: "course-ise", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-ise", "WRITTEN", "privilege-audit-evidence"), difficulty: "HARD", concepts: ["Linux security", "Windows security"], stem: "배포 서비스 계정이 로컬 관리자이며 로그 삭제 권한도 가진다. 업무 중단을 최소화하면서 우선 적용할 개선안은?", choices: ["서비스 계정을 즉시 삭제한다.", "계정 비밀번호 길이만 늘린다.", "필요 작업별 권한으로 분리하고 승인된 상승 절차와 원격 로그 전송을 적용한다.", "모든 로그 기록을 중지해 저장공간을 확보한다."], answerIndex: 2, explanation: "서비스 연속성을 유지하면서 최소 권한과 감사 증거를 동시에 회복하는 방안이다.", distractorRationales: ["업무 의존성 확인 없이 삭제하면 장애 위험이 있다.", "과도한 권한과 로그 훼손 위험은 남는다.", null, "탐지와 책임추적성을 상실한다."] }),
  mcq({ id: "network-compare", courseId: "course-ise", subjectCode: "NETWORK_SECURITY", contentId: cid("course-ise", "WRITTEN", "protocol-boundary-control"), difficulty: "HARD", concepts: ["TLS and secure protocols", "IDS and IPS", "Firewall and WAF"], stem: "TLS로 보호된 웹 트래픽의 애플리케이션 공격을 탐지하려는 설계 설명으로 옳은 것은?", choices: ["TLS가 적용되면 WAF나 애플리케이션 로그는 불필요하다.", "복호화 가능한 신뢰 경계에 WAF를 배치하고 인증서·내부 구간·로그 통제를 함께 검토한다.", "네트워크 IDS는 키 없이 모든 암호화 본문을 항상 분석한다.", "상태 기반 방화벽은 HTTP 매개변수의 업무 의미를 자동 검증한다."], answerIndex: 1, explanation: "내용 기반 분석은 적절한 TLS 종료 지점이 필요하며 다른 구간과 종단 통제도 유지해야 한다.", distractorRationales: ["TLS는 취약한 애플리케이션 논리를 제거하지 않는다.", null, "키나 복호화 지점 없이 본문 분석은 제한된다.", "일반 방화벽의 계층과 WAF의 역할을 혼동했다."] }),
  mcq({ id: "network-scenario", courseId: "course-ise", subjectCode: "NETWORK_SECURITY", contentId: cid("course-ise", "WRITTEN", "protocol-boundary-control"), difficulty: "HARD", concepts: ["IDS and IPS", "Firewall and WAF"], stem: "신규 IPS 차단 적용 후 정상 결제 요청도 간헐적으로 실패한다. 가장 적절한 대응은?", choices: ["모든 탐지 규칙을 영구 비활성화한다.", "결제 서버를 인터넷에 직접 연결한다.", "경보·패킷·업무 로그를 상관분석해 오탐 규칙을 제한적으로 튜닝하고 변경을 검증한다.", "차단 사실을 숨기기 위해 로그를 삭제한다."], answerIndex: 2, explanation: "업무 영향과 공격 탐지 근거를 함께 확인한 뒤 범위를 좁혀 튜닝하고 회귀 검증해야 한다.", distractorRationales: ["탐지 공백이 과도하게 커진다.", "공격면을 확대한다.", null, "감사 증거를 훼손한다."] }),
  mcq({ id: "application-compare", courseId: "course-ise", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-ise", "WRITTEN", "web-api-input-session"), difficulty: "HARD", concepts: ["SQL injection", "XSS and CSRF"], stem: "웹 취약점과 주된 방어 위치의 연결로 가장 적절한 것은?", choices: ["SQL Injection—HTML 출력 인코딩", "저장형 XSS—DB 계정 비밀번호 변경만 적용", "CSRF—상태 변경 요청의 위조 방지 토큰과 쿠키 정책", "객체 단위 인가 누락—CORS 허용 출처 확대"], answerIndex: 2, explanation: "CSRF는 사용자의 인증 상태를 악용한 위조 요청이므로 요청의 의도 검증과 쿠키 정책이 핵심이다.", distractorRationales: ["SQL에는 매개변수화가 핵심이다.", "브라우저 출력 문맥에서 인코딩이 필요하다.", null, "CORS는 서버의 객체 인가를 대신하지 않는다."] }),
  mcq({ id: "application-scenario", courseId: "course-ise", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-ise", "WRITTEN", "web-api-input-session"), difficulty: "HARD", concepts: ["Web and API security", "Authorization and access control"], stem: "API가 요청 경로의 주문 ID 형식은 검증하지만 로그인한 사용자가 다른 고객 주문도 조회할 수 있다. 직접적인 개선은?", choices: ["주문 ID 길이를 늘린다.", "서버에서 요청 사용자와 주문 소유권 또는 허용 역할을 매 요청마다 검증한다.", "응답에 CORS 와일드카드를 추가한다.", "클라이언트 화면에서 다른 주문 링크를 숨긴다."], answerIndex: 1, explanation: "객체 단위 인가는 서버의 신뢰 경계에서 수행되어야 한다.", distractorRationales: ["식별자 복잡도는 인가를 대체하지 않는다.", null, "교차 출처 정책은 소유권 검증이 아니다.", "클라이언트 통제는 우회 가능하다."] }),
  mcq({ id: "foundation-compare", courseId: "course-ise", subjectCode: "SECURITY_FOUNDATION", contentId: cid("course-ise", "WRITTEN", "crypto-auth-access"), difficulty: "HARD", concepts: ["Cryptographic algorithms", "Authentication", "Authorization and access control"], stem: "인증과 인가에 대한 설명으로 옳은 것은?", choices: ["인증에 성공하면 모든 객체 접근이 허용된다.", "인가는 주체의 신원 확인 이전에만 수행된다.", "인증 결과를 바탕으로 인가 정책이 자원별 허용 행위를 평가한다.", "데이터 암호화가 사용자 권한 정책을 자동 생성한다."], answerIndex: 2, explanation: "인증은 신원을 확인하고 인가는 확인된 주체의 요청을 정책에 따라 평가한다.", distractorRationales: ["인증과 전권 허용을 혼동했다.", "일반적으로 신원이 확인된 문맥에서 인가한다.", null, "암호와 접근통제의 목적이 다르다."] }),
  mcq({ id: "foundation-scenario", courseId: "course-ise", subjectCode: "SECURITY_FOUNDATION", contentId: cid("course-ise", "WRITTEN", "crypto-auth-access"), difficulty: "HARD", concepts: ["Cryptographic algorithms", "Authentication"], stem: "강한 암호 알고리즘을 사용하지만 모든 서버가 같은 장기 개인키를 공유한다. 우선 개선해야 할 것은?", choices: ["암호문 길이를 화면에 숨긴다.", "서비스별 키 분리, 안전한 저장, 회전·폐기 절차를 적용한다.", "인증서 검증을 생략해 연결 속도를 높인다.", "감사 로그의 시간 정보를 제거한다."], answerIndex: 1, explanation: "키 공유는 침해 범위를 확대하므로 키 수명주기와 격리가 핵심이다.", distractorRationales: ["표시 여부는 키 노출 위험을 해결하지 않는다.", null, "중간자 공격 위험을 키운다.", "조사 가능성을 훼손한다."] }),
  mcq({ id: "law-compare", courseId: "course-ise", subjectCode: "SECURITY_LAW", contentId: cid("course-ise", "WRITTEN", "risk-governance-continuity"), difficulty: "HARD", concepts: ["Risk management", "BCP and disaster recovery"], stem: "업무연속성 지표의 설명으로 옳은 것은?", choices: ["RTO는 허용 가능한 데이터 손실 시점을 뜻한다.", "RPO는 서비스가 복구되어야 하는 최대 시간을 뜻한다.", "RTO는 목표 복구 시간, RPO는 허용 가능한 데이터 손실 시점을 나타낸다.", "백업이 존재하면 RTO와 RPO 검증은 불필요하다."], answerIndex: 2, explanation: "RTO는 시간, RPO는 데이터 복구 시점을 나타내며 실제 훈련으로 충족 여부를 검증해야 한다.", distractorRationales: ["RPO의 의미다.", "RTO의 의미다.", null, "복구 가능성과 소요 시간은 테스트해야 한다."] }),
  mcq({ id: "law-scenario", courseId: "course-ise", subjectCode: "SECURITY_LAW", contentId: cid("course-ise", "WRITTEN", "risk-governance-continuity"), difficulty: "HARD", concepts: ["Risk management", "Security governance and law"], stem: "지원 종료 서버를 당장 교체할 수 없어 위험을 한시적으로 수용하려 한다. 가장 적절한 기록은?", choices: ["담당자의 구두 동의만 남긴다.", "위험 시나리오·기존 및 보완 통제·기한·승인 권한·재검토 조건을 기록한다.", "취약점 점수를 낮게 수정한다.", "관련 로그를 수집하지 않는다."], answerIndex: 1, explanation: "위험 수용은 근거, 권한, 기간과 모니터링 조건이 있는 의사결정이어야 한다.", distractorRationales: ["재현성과 책임이 없다.", null, "근거 없는 점수 조정이다.", "잔여 위험 감시를 약화한다."] }),
  mcq({ id: "system-compare", courseId: "course-isie", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-isie", "WRITTEN", "account-permission-log-basics"), difficulty: "MEDIUM", concepts: ["Linux security", "Windows security"], stem: "공유 폴더 권한 점검에서 가장 먼저 개선할 항목은?", choices: ["업무상 필요한 읽기 전용 그룹", "관리자만 변경 가능한 감사 로그", "모든 사용자에게 부여된 쓰기 권한", "정상적인 파일 소유자 정보"], answerIndex: 2, explanation: "전체 사용자 쓰기 권한은 무단 변경 가능성을 키우므로 업무 그룹별 최소 권한으로 줄여야 한다.", distractorRationales: ["업무 필요성이 확인된 최소 권한일 수 있다.", "로그 보호에 유리하다.", null, "정상 소유권은 개선 대상이 아니다."] }),
  mcq({ id: "system-scenario", courseId: "course-isie", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-isie", "WRITTEN", "account-permission-log-basics"), difficulty: "MEDIUM", concepts: ["Authentication", "Windows security"], stem: "한 계정에서 로그인 실패가 반복된 뒤 새벽에 성공 기록이 나타났다. 우선 조치는?", choices: ["성공 기록을 삭제한다.", "해당 계정 소유자와 정상 사용 여부를 확인하고 세션·후속 행위를 조사한다.", "모든 계정의 이름을 바꾼다.", "로그 수집을 중지한다."], answerIndex: 1, explanation: "의심 이벤트를 검증하고 침해 여부와 범위를 확인하는 기본 초동 절차다.", distractorRationales: ["증거를 훼손한다.", null, "근거 없는 광범위 변경이다.", "가시성을 잃는다."] }),
  mcq({ id: "network-compare", courseId: "course-isie", subjectCode: "NETWORK_SECURITY", contentId: cid("course-isie", "WRITTEN", "basic-attacks-devices"), difficulty: "MEDIUM", concepts: ["DoS and DDoS", "ARP spoofing", "IDS and IPS"], stem: "공격 또는 장비 설명으로 옳은 것은?", choices: ["ARP Spoofing은 DNS 도메인 소유권만 변경한다.", "IDS는 항상 인라인에서 패킷을 차단한다.", "DDoS는 여러 출발지에서 자원을 고갈시킬 수 있다.", "IPS는 암호화 키 없이 모든 TLS 본문을 해독한다."], answerIndex: 2, explanation: "분산된 다수 출발지의 요청으로 서비스 자원을 소진시키는 것이 DDoS의 대표 특성이다.", distractorRationales: ["ARP는 IP와 MAC 대응을 다룬다.", "탐지 전용 배치도 가능하다.", null, "암호화 본문은 복호화 지점이 필요하다."] }),
  mcq({ id: "network-scenario", courseId: "course-isie", subjectCode: "NETWORK_SECURITY", contentId: cid("course-isie", "WRITTEN", "basic-attacks-devices"), difficulty: "MEDIUM", concepts: ["ARP spoofing"], stem: "여러 PC의 ARP 표에서 기본 게이트웨이 IP가 갑자기 같은 낯선 MAC으로 바뀌었다. 가장 관련 깊은 공격은?", choices: ["ARP Spoofing", "SQL Injection", "Password Spraying", "Directory Traversal"], answerIndex: 0, explanation: "위조 ARP 응답으로 게이트웨이의 IP-MAC 대응을 공격자 MAC으로 오염시킨 징후다.", distractorRationales: [null, "DB 쿼리 입력 취약점이다.", "인증 공격이다.", "파일 경로 입력 취약점이다."] }),
  mcq({ id: "application-compare", courseId: "course-isie", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-isie", "WRITTEN", "service-input-basics"), difficulty: "MEDIUM", concepts: ["SQL injection", "XSS and CSRF"], stem: "방어 방법의 연결로 옳은 것은?", choices: ["SQL Injection—매개변수화된 쿼리", "XSS—DB 포트 변경만 적용", "CSRF—화면 밝기 조정", "DNS 위조—HTML 글꼴 변경"], answerIndex: 0, explanation: "매개변수화는 입력을 SQL 구문이 아닌 데이터로 처리한다.", distractorRationales: [null, "브라우저 출력 인코딩 등 문맥 방어가 필요하다.", "보안과 무관하다.", "DNS 신뢰 통제와 무관하다."] }),
  mcq({ id: "application-scenario", courseId: "course-isie", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-isie", "WRITTEN", "service-input-basics"), difficulty: "MEDIUM", concepts: ["SQL injection"], stem: "검색 기능이 입력값을 SQL 문자열에 직접 연결한다. 가장 직접적인 수정은?", choices: ["검색 버튼 색상을 바꾼다.", "입력을 로그에만 남긴다.", "자리표시자를 사용하는 매개변수화 쿼리로 변경한다.", "DB 오류를 더 자세히 사용자에게 표시한다."], answerIndex: 2, explanation: "데이터와 SQL 구문을 분리하는 것이 직접적인 방어다.", distractorRationales: ["보안 경계를 바꾸지 않는다.", "기록만으로 실행 위험을 막지 못한다.", null, "공격자에게 정보를 더 제공할 수 있다."] }),
  mcq({ id: "foundation-compare", courseId: "course-isie", subjectCode: "SECURITY_FOUNDATION", contentId: cid("course-isie", "WRITTEN", "crypto-auth-hash-basics"), difficulty: "MEDIUM", concepts: ["Hash and message digest", "Digital signature and PKI"], stem: "해시와 전자서명에 대한 설명으로 옳은 것은?", choices: ["해시는 항상 원문으로 복호화된다.", "전자서명은 서명자의 개인키로 생성하고 대응 공개키로 검증한다.", "인증서는 개인키를 모든 사용자에게 공개한다.", "해시값이 같으면 파일 이름도 반드시 같다."], answerIndex: 1, explanation: "전자서명의 생성과 검증에는 개인키와 공개키가 각각 사용된다.", distractorRationales: ["해시는 일반적으로 일방향 함수다.", null, "인증서는 공개키와 주체 정보를 연결한다.", "파일 이름과 해시 입력 내용은 별개다."] }),
  mcq({ id: "foundation-scenario", courseId: "course-isie", subjectCode: "SECURITY_FOUNDATION", contentId: cid("course-isie", "WRITTEN", "crypto-auth-hash-basics"), difficulty: "MEDIUM", concepts: ["Hash and message digest"], stem: "다운로드한 설치 파일이 공식 파일과 같은지 확인하려 한다. 적절한 방법은?", choices: ["파일 아이콘 색상을 비교한다.", "공식 채널이 제공한 해시와 계산한 해시를 비교한다.", "파일명을 짧게 바꾼다.", "압축률만 비교한다."], answerIndex: 1, explanation: "신뢰할 수 있는 채널의 해시와 직접 계산한 값을 비교해 무결성을 확인한다.", distractorRationales: ["내용 무결성과 관계없다.", null, "이름은 내용 검증 수단이 아니다.", "압축률은 무결성 증거가 아니다."] }),
  practical({ id: "architecture-analysis", courseId: "course-ise", subjectCode: "NETWORK_SECURITY", contentId: cid("course-ise", "PRACTICAL", "architecture-protocol-analysis"), difficulty: "HARD", type: "ARCHITECTURE_ANALYSIS", concepts: ["Network architecture and OSI", "Virtualization and cloud security"], scenario: "외부 사용자는 TLS 로드밸런서를 거쳐 애플리케이션에 접속한다. 애플리케이션과 DB 사이는 평문이며, 관리 API는 인터넷에서 접근 가능하고 같은 서비스 계정을 공유한다.", evidence: ["LB에서 TLS 종료", "APP→DB 평문", "관리 API 0.0.0.0/0 허용", "공유 서비스 계정"], task: "신뢰 경계의 핵심 위험 3개와 우선 개선안을 각각 작성하시오.", expectedAnswer: "내부 평문 구간의 도청·변조 위험에는 내부 TLS와 인증서 검증을, 공개 관리 API에는 관리망 제한과 MFA를, 공유 계정에는 워크로드별 최소 권한 신원과 키 회전을 적용한다.", scoringPoints: ["내부 평문 구간 식별 및 재암호화", "관리 평면 노출 식별 및 접근 제한", "공유 신원 식별 및 분리·최소 권한"], explanation: "데이터 흐름과 관리 평면을 분리해 각 신뢰 경계에 맞는 통제를 제시해야 한다.", sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource] }),
  practical({ id: "code-remediation", courseId: "course-ise", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-ise", "PRACTICAL", "code-config-remediation"), difficulty: "HARD", type: "CODE_ANALYSIS", concepts: ["SQL injection", "Command and code injection"], scenario: "백업 API가 userFile을 받아 `exec('tar -czf out.tgz ' + userFile)`을 실행하고, 작업 이력을 문자열 결합 SQL로 저장한다.", evidence: ["셸 명령 문자열 결합", "사용자 경로 검증 없음", "SQL 문자열 결합", "서비스 계정에 광범위 파일 읽기 권한"], task: "취약점 2개, 악용 근거와 코드 수준 수정 방법을 작성하시오.", expectedAnswer: "명령어 인젝션은 셸을 거치지 않는 인자 배열 API와 허용된 기준 디렉터리 검증으로 수정한다. SQL Injection은 매개변수화 쿼리를 사용한다. 실행 계정 파일 권한도 백업 대상에 한정한다.", scoringPoints: ["명령어 인젝션과 데이터 흐름 근거", "인자 배열·허용 목록 수정", "SQL Injection과 매개변수화", "최소 권한 보완"], explanation: "블랙리스트만 제시하지 않고 위험한 해석기 경계를 제거하는 수정이 필요하다.", sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource] }),
  practical({ id: "incident-timeline", courseId: "course-ise", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-ise", "PRACTICAL", "timeline-incident-response"), difficulty: "HARD", type: "LOG_ANALYSIS", concepts: ["Logging and incident response", "Forensics"], scenario: "VPN 로그인 성공 직후 같은 계정으로 서버에 접속했고 새 서비스가 등록된 뒤 외부 IP로 주기적 연결이 발생했다.", evidence: ["01:12 VPN 해외 IP 성공", "01:16 서버 원격 로그인", "01:19 자동 시작 서비스 등록", "01:21부터 60초 간격 외부 연결"], task: "가능한 침해 타임라인, 즉시 조치 3개, 증거 보존 항목을 작성하시오.", expectedAnswer: "탈취 계정으로 초기 접근 후 지속성을 등록하고 명령제어 통신을 시작한 것으로 판단한다. 계정 폐기, 호스트 네트워크 격리, 외부 지표 차단을 수행하고 메모리·이벤트 로그·서비스 설정·네트워크 기록을 해시와 인계 기록과 함께 보존한다.", scoringPoints: ["근거 순서에 따른 타임라인", "계정과 호스트 격리", "지표 차단·전사 검색", "원본 증거 해시·인계 기록"], explanation: "관찰 사실과 추론을 구분하고 증거 보존과 확산 차단을 병행해야 한다.", sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource] }),
  practical({ id: "risk-treatment", courseId: "course-ise", subjectCode: "SECURITY_LAW", contentId: cid("course-ise", "PRACTICAL", "risk-treatment-plan"), difficulty: "HARD", type: "RISK_ANALYSIS", concepts: ["Risk management", "Audit and accountability"], scenario: "지원 종료 서버가 핵심 정산 업무에 사용된다. 즉시 교체는 어렵고 외부 협력사도 관리자 계정을 사용한다.", evidence: ["보안 패치 중단", "RTO 4시간", "협력사 공용 관리자 계정", "교체 예정 6개월 후"], task: "위험 시나리오와 6개월 동안의 처리 계획, 잔여 위험 승인 조건을 작성하시오.", expectedAnswer: "취약점 악용과 공용 계정 오남용으로 정산 중단·변조가 발생할 수 있다. 네트워크 격리, 협력사 개인별 계정·MFA, 원격 감사 로그, 백업·복구 시험을 적용하고 교체 책임자·기한·검증 증빙을 정한다. 잔여 위험은 업무 소유자가 기간과 재검토 조건을 명시해 승인한다.", scoringPoints: ["위협·취약점·업무영향 시나리오", "보완 통제", "책임자·기한·검증", "권한 있는 잔여 위험 승인"], explanation: "한시적 수용도 통제와 모니터링, 종료 조건이 있는 공식 의사결정이어야 한다.", sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource] }),
  practical({ id: "ransomware-operations", courseId: "course-ise", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-ise", "PRACTICAL", "modern-threat-operations"), difficulty: "HARD", type: "THREAT_HUNT", concepts: ["Endpoint detection and response", "Malware and ransomware"], scenario: "EDR에서 문서 프로그램의 자식으로 스크립트 엔진이 실행되고 자격증명 접근 도구, 원격 관리 도구, 대량 파일 이름 변경이 연속 발생했다.", evidence: ["office→script 프로세스 트리", "자격증명 저장소 접근", "원격 관리 연결", "분당 2천 파일 변경"], task: "공격 단계와 우선 대응 순서를 근거와 함께 작성하시오.", expectedAnswer: "악성 문서 실행 후 자격증명 접근·측면 이동·암호화 단계로 진행한 정황이다. 감염 호스트와 원격 세션을 격리하고 관련 계정을 폐기하며 동일 지표를 헌팅한다. 변경 불가능한 백업과 복구 지점을 검증한 뒤 재이미징·복구한다.", scoringPoints: ["행위 연쇄 기반 단계 식별", "호스트·세션 격리", "자격증명 폐기와 헌팅", "백업 검증 후 복구"], explanation: "파일 복구보다 공격자 접근과 확산 경로 제거가 먼저다.", sourceRefs: ["정보보안기사 실기 기출.txt", ...commonSource] }),
  practical({ id: "protocol-check", courseId: "course-isie", subjectCode: "NETWORK_SECURITY", contentId: cid("course-isie", "PRACTICAL", "basic-system-protocol-check"), difficulty: "MEDIUM", type: "CONFIG_ANALYSIS", concepts: ["TLS and secure protocols", "DNS security"], scenario: "내부 관리 사이트 인증서의 SAN은 admin.example.local인데 사용자는 IP 주소로 접속하며 인증서가 만료되었다.", evidence: ["접속 주소 10.0.5.7", "SAN admin.example.local", "유효기간 종료", "브라우저 경고 무시 안내"], task: "인증서 경고 원인 2개와 기본 조치를 작성하시오.", expectedAnswer: "접속 이름과 SAN 불일치, 인증서 만료가 원인이다. DNS 이름으로 접속하게 하고 해당 이름을 포함한 유효한 인증서를 갱신·배포하며 경고 우회를 금지한다.", scoringPoints: ["호스트명 불일치", "유효기간 만료", "DNS·인증서 갱신 조치"], explanation: "TLS는 암호화뿐 아니라 접속 대상의 이름과 인증서 체인 검증이 필요하다.", sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"] }),
  practical({ id: "firewall-remediation", courseId: "course-isie", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-isie", "PRACTICAL", "basic-config-remediation"), difficulty: "MEDIUM", type: "CONFIG_ANALYSIS", concepts: ["Vulnerability management", "Firewall and WAF"], scenario: "서버 방화벽 규칙의 첫 줄이 `ALLOW ANY -> server:22`이고 다음 줄이 `DENY internet -> server:22`이다.", evidence: ["규칙은 위에서 아래로 평가", "첫 번째 일치 규칙 적용", "관리망은 10.20.0.0/24"], task: "현재 위험과 수정 규칙을 작성하시오.", expectedAnswer: "첫 ANY 허용이 먼저 일치해 인터넷 SSH 접근이 허용된다. 첫 규칙을 `ALLOW 10.20.0.0/24 -> server:22`로 제한하고 그 뒤 기본 거부를 두며 외부 차단을 시험한다.", scoringPoints: ["규칙 순서와 ANY 위험", "관리망으로 출발지 제한", "기본 거부와 검증"], explanation: "방화벽 정책은 값뿐 아니라 평가 순서까지 확인해야 한다.", sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"] }),
  practical({ id: "login-log-response", courseId: "course-isie", subjectCode: "SYSTEM_SECURITY", contentId: cid("course-isie", "PRACTICAL", "basic-log-first-response"), difficulty: "MEDIUM", type: "LOG_ANALYSIS", concepts: ["Logging and incident response", "IDS and IPS"], scenario: "한 외부 IP에서 8분 동안 35개 계정의 로그인 실패가 발생했고 한 계정에서 성공한 뒤 파일 다운로드가 이어졌다.", evidence: ["동일 출발지", "다수 계정·소수 시도", "로그인 성공 1건", "성공 후 대량 다운로드"], task: "공격 유형 후보와 근거, 초동 조치 3개를 작성하시오.", expectedAnswer: "다수 계정에 소수 비밀번호를 시도한 Password Spraying 후보이며 성공 후 데이터 접근 정황이 있다. 성공 계정을 잠그고 세션을 종료하며 출발지를 제한한 뒤 다운로드 범위와 동일 패턴을 추가 조사한다.", scoringPoints: ["Password Spraying과 다수 계정 근거", "계정·세션 보호", "출발지 제한", "후속 행위·범위 조사"], explanation: "실패 횟수만 보지 않고 대상 계정 분포와 성공 후 행위를 연결한다.", sourceRefs: ["2022 2회차 산업기사 필기.pdf", "data/source-file-inventory.json"] }),
  practical({ id: "mail-edr-basics", courseId: "course-isie", subjectCode: "APPLICATION_SECURITY", contentId: cid("course-isie", "PRACTICAL", "modern-security-basics"), difficulty: "MEDIUM", type: "HEADER_AND_PROCESS_ANALYSIS", concepts: ["Email authentication", "Endpoint detection and response"], scenario: "메일 헤더는 SPF fail, DKIM pass, DMARC fail이며 첨부파일 실행 뒤 문서 프로그램이 스크립트 엔진을 시작했다.", evidence: ["SPF=fail", "DKIM=pass", "DMARC=fail", "document→script child process"], task: "메일과 엔드포인트에서 확인할 위험 2개와 기본 대응을 작성하시오.", expectedAnswer: "발신 도메인 정렬이 충족되지 않아 DMARC가 실패했고 피싱 가능성이 있다. 문서의 자식 스크립트 실행도 의심 행위다. 메일을 격리하고 발신 도메인·링크를 확인하며 단말을 네트워크에서 격리해 후속 프로세스와 파일을 조사한다.", scoringPoints: ["DMARC 실패와 도메인 정렬 확인", "의심 프로세스 트리 식별", "메일·단말 격리와 조사"], explanation: "메일 인증 결과 하나만으로 결론내리지 않고 엔드포인트 행위와 결합한다.", sourceRefs: ["data/source-file-inventory.json", "reports/source-text-extraction.json"] }),
];

export function validateSecurityContentIntelligenceV3() {
  const ids = [...securityContentIntelligenceV3Theory, ...securityContentIntelligenceV3Questions].map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("SECURITY_CONTENT_INTELLIGENCE_V3_DUPLICATE_ID");
  if ([...securityContentIntelligenceV3Theory, ...securityContentIntelligenceV3Questions].some((item) => !["course-ise", "course-isie"].includes(item.courseId))) {
    throw new Error("SECURITY_CONTENT_INTELLIGENCE_V3_SCOPE_INVALID");
  }
  const theoryIds = new Set(securityContentIntelligenceV3Theory.map((item) => item.id));
  if (securityContentIntelligenceV3Questions.some((item) => !theoryIds.has(item.contentId))) throw new Error("SECURITY_CONTENT_INTELLIGENCE_V3_CONTENT_LINK_INVALID");
  for (const question of securityContentIntelligenceV3Questions.filter((item) => item.track === "WRITTEN")) {
    if (question.choices.length !== 4 || question.answerIndex < 0 || question.answerIndex > 3 || question.distractorRationales.length !== 4) {
      throw new Error(`SECURITY_CONTENT_INTELLIGENCE_V3_WRITTEN_INVALID:${question.id}`);
    }
  }
  return {
    contentCount: securityContentIntelligenceV3Theory.length,
    questionCount: securityContentIntelligenceV3Questions.length,
    writtenQuestionCount: securityContentIntelligenceV3Questions.filter((item) => item.track === "WRITTEN").length,
    practicalQuestionCount: securityContentIntelligenceV3Questions.filter((item) => item.track === "PRACTICAL").length,
    courseIseContentCount: securityContentIntelligenceV3Theory.filter((item) => item.courseId === "course-ise").length,
    courseIsieContentCount: securityContentIntelligenceV3Theory.filter((item) => item.courseId === "course-isie").length,
  };
}
