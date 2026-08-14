const OFFICIAL_SOURCE_URL =
  "https://www.cq.or.kr/ac_flecm02_001.do?atchFileId=53426c2c81474591bef0207cdf4b9562&fileSn=1";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const engineerPracticalLogMonitoringAuthoringMetadata = deepFreeze({
  course: "Information Security Engineer",
  courseId: "course-ise",
  track: "PRACTICAL",
  officialSource: {
    url: OFFICIAL_SOURCE_URL,
    sha256: "23e78b2452db75e3a37c31b7e1aa263d890131c6e38d364a79eba1744ceb2352",
    publishedAt: "2026-07-23",
    effectiveFrom: "2027-01-01",
    effectiveTo: "2029-12-31",
    absolutePdfPage: 10,
    practicalSectionPage: 5,
  },
  currentness: "CURRENT",
  authoringProvenance: "AUTHOR_CREATED_FROM_OFFICIAL_SCOPE",
  lifecycle: "AUTHORING_ONLY_UNLINKED",
  ambiguousTopics: {
    centralization: "DEFERRED",
    forwarding: "DEFERRED",
    retention: "DEFERRED",
    timeSynchronization: "DEFERRED",
    thresholds: "DEFERRED",
    alerting: "DEFERRED",
    dashboards: "DEFERRED",
  },
});

const contentBody = `# 보안 로그 수집 및 모니터링

## 1. 학습 목표와 공식 범위

이 학습의 목표는 운영체제, 서비스, 보안장비와 네트워크 장비에서 어떤 로그가 생성되는지 식별하고, 필요한 로그가 실제로 생성되도록 수준과 구성요소를 설정한 뒤, 수집 상태와 내용을 모니터링·통제하는 것이다. 여기서 **로그 생성**, **수집**, **관리**, **모니터링**은 서로 이어지지만 같은 활동은 아니다.

- 로그 생성: 시스템이나 장비가 사건과 상태를 기록하도록 기능과 수준을 설정하는 단계
- 로그 수집: 필요한 기록을 빠짐없이 확보하는 단계
- 로그 관리: 대상, 설정, 접근 권한과 운영 상태를 일관되게 유지하는 단계
- 로그 모니터링·통제: 기록이 의도대로 생성되고 관찰 가능한지 확인하고 설정 이탈을 바로잡는 단계

로그의 의미를 깊이 해석해 공격 여부를 판정하는 분석, 침입 탐지 결과의 조사, 사고 대응과 복구는 인접한 후속 범위다. 이 학습에서는 해당 활동을 핵심 절차로 다루지 않는다.

## 2. 로그 발생 대상 식별

수집 설계의 출발점은 도구 선택이 아니라 로그 발생 대상의 목록화다. 먼저 업무 흐름을 구성하는 시스템, 운영체제와 버전, 실행 서비스, 보안장비, 네트워크 장비를 구분한다. 각 대상에 대해 다음을 확인한다.

1. 어떤 기능 또는 구성요소가 기록을 생성하는가?
2. 기본 설정에서 기록되는 항목과 별도 활성화가 필요한 항목은 무엇인가?
3. 인증, 접근, 오류, 설정 변경처럼 운영 확인에 필요한 사건이 남는가?
4. 로그 생성 기능을 켰을 때 서비스 동작에 미치는 영향은 무엇인가?
5. 설정 후 시험 행위를 통해 실제 기록 생성을 확인했는가?

같은 제품이라도 운영체제 버전, 서비스 버전, 활성 모듈과 배치 방식에 따라 로그 위치와 구성요소가 달라질 수 있다. 따라서 제품 이름만 적는 대신 버전과 실행 구성을 함께 기록해야 한다.

## 3. 운영체제·버전·서비스별 로그 이해

운영체제에서는 인증 성공·실패, 계정과 권한 변경, 서비스 시작·중지, 시스템 오류와 주요 설정 변경 기록을 우선 식별한다. 단, 모든 이벤트를 무조건 많이 남기는 것이 목표는 아니다. 보안목표와 운영 목적에 필요한 사건이 빠지지 않도록 생성 범위를 정하고 검증하는 것이 핵심이다.

서비스별로는 동작 특성에 맞는 로그를 구분한다.

- FTP·메일: 인증, 접속, 전송 처리와 오류 기록
- WEB: 요청, 응답 상태, 인증과 애플리케이션 오류 기록
- DNS: 질의 처리, 서비스 오류와 관리 변경 기록
- DB: 접속·인증, 권한 사용, 주요 오류와 감사 대상으로 정한 작업 기록

서비스 로그와 운영체제 로그는 발생 주체와 의미가 다르므로 한쪽만 보고 다른 쪽이 자동으로 충족된다고 판단하지 않는다. 설정 후 정상·실패 시험을 수행해 필요한 기록이 각각 생성되는지 확인한다.

## 4. 보안·네트워크 장비 로그

보안장비와 네트워크 장비는 정책 적용, 접속, 관리 작업과 장비 상태를 확인할 수 있는 로그를 제공한다.

- Firewall: 정책 허용·차단 결과, 정책 또는 관리 설정 변경 기록
- IDS·IPS: 탐지 이벤트와 정책·구성 변경 기록
- Switch·Router: 관리자 접속, 구성 변경, 인터페이스와 장비 상태 기록
- 무선접속 AP: 관리 접속, 단말 연결·인증과 구성 변경 기록

이 절에서 IDS·IPS는 **로그를 제공하는 장비**로 다룬다. 탐지 이벤트를 상호 연관해 침입을 판정하거나 대응 절차를 수행하는 것은 별도의 로그 분석 및 침해 탐지·대응 범위다.

## 5. 로그 수집 및 관리

수집 대상 목록에는 대상 시스템 또는 장비, 버전, 서비스·구성요소, 필요한 로그 종류, 생성 설정, 확인 책임을 연결한다. 로그 관리 도구를 사용할 때에도 먼저 해당 도구가 필요한 로그 원본을 인식하고 설정 상태를 확인할 수 있는지 검증한다.

운영 중에는 대상 누락, 서비스 추가, 버전 변경, 장비 교체로 인해 수집 범위가 어긋날 수 있다. 변경이 발생하면 대상 목록과 로그 설정을 함께 점검하고, 시험 기록을 통해 현재 구성에서도 수집이 이어지는지 확인한다. 수집 도구가 동작한다는 사실만으로 모든 필수 로그가 생성된다고 가정하지 않는다.

## 6. 로그 생성 수준 설정

로그 생성 수준은 기록의 상세도와 대상 사건의 범위를 결정한다. 너무 낮으면 필요한 근거가 빠지고, 목적 없이 과도하게 높이면 중요한 기록을 찾기 어려워지거나 시스템 부담이 커질 수 있다.

설정 순서는 다음과 같다.

1. 보안목표와 운영 목적에 필요한 사건을 정의한다.
2. 제품·버전별 설정 항목과 가능한 수준을 확인한다.
3. 필요한 사건이 포함되는 수준을 선택한다.
4. 정상, 실패, 설정 변경 등의 시험 행위를 수행한다.
5. 예상한 필드와 사건이 실제 로그에 기록되는지 확인한다.

생성 수준은 이름만 비교하지 않는다. 같은 “정보” 또는 “상세” 수준이라도 제품마다 포함 사건이 다를 수 있으므로 실제 생성 결과로 검증한다.

## 7. 구성요소별 로그 설정

하나의 시스템이나 장비 안에서도 구성요소별 로그 설정이 분리될 수 있다. 운영체제의 인증·감사 기능, 웹 서버의 접근·오류 기록, DB의 접속·감사 기능, 방화벽 정책 기록, 장비 관리 기능을 각각 확인한다.

구성요소별 점검표에는 최소한 다음 항목을 둔다.

- 구성요소와 기능 이름
- 활성화 여부와 생성 수준
- 기록해야 할 사건 유형
- 설정 확인 위치 또는 관리 도구
- 시험 방법과 확인 결과
- 변경 승인과 점검 책임

전체 로그 기능이 켜져 있다는 표시만 확인하지 말고, 필요한 구성요소가 실제로 활성화되어 있는지 확인한다.

## 8. 로그 모니터링

이 범위의 모니터링은 로그가 **의도한 대상에서, 의도한 설정으로, 계속 생성되는지** 관찰하는 활동이다. 다음 상태를 중심으로 확인한다.

- 대상 시스템·서비스·장비의 로그 생성 여부
- 필요한 인증, 접근, 오류와 설정 변경 기록의 존재
- 서비스 또는 구성 변경 뒤의 로그 연속성
- 로그 관리 도구가 보여 주는 대상·구성요소 상태
- 시험 사건과 실제 생성 기록의 대응 여부

모니터링에서 이상 징후를 발견할 수는 있지만, 여러 로그를 통합·정렬·상관하여 공격을 판정하는 심층 분석은 다음 공식 항목의 책임이다.

## 9. 통제 및 운영 점검

통제는 로그 설정이 임의로 약화되거나 누락되지 않도록 운영하는 것이다. 설정 변경은 승인된 절차로 수행하고, 변경 전후 값과 검증 결과를 남긴다. 정기 점검에서는 대상 목록과 실제 구성의 일치, 필요한 구성요소의 활성화, 시험 로그의 생성 여부를 확인한다.

점검에서 누락이 발견되면 먼저 생성 대상과 설정을 바로잡고 다시 시험한다. 그 로그를 근거로 침입 경로를 조사하거나 사고를 수습하는 활동은 이 항목의 설정·운영 통제와 구분한다.

## 10. 실기 핵심 포인트와 경계 주의사항

실기 지문에서는 **대상 식별 → 생성 수준·구성요소 설정 → 시험 로그 확인 → 지속적인 모니터링·통제**의 순서로 답안을 구성한다. 제품명만 나열하지 말고 어떤 로그를 왜 확인하며 어떤 설정을 검증할지 연결한다.

다음은 이 학습의 핵심 범위가 아니다.

- 여러 원천 로그의 정규화·상관과 심층 분석
- 침입 여부 판정과 사고 분류
- 사고 억제, 근절, 복구와 포렌식

중앙화, 전달 방식, 보존 기간, 시각 동기화, 임계값, 경보와 대시보드는 환경에 따라 함께 고려될 수 있지만, 현재 인증된 근거만으로 이 세부항목의 공식 핵심 요구사항이라고 단정하지 않는다. 이 주제들은 추가 근거 검토 전까지 유보한다.

> 이 콘텐츠는 인증된 2027–2029 정보보안기사 출제기준의 범위를 바탕으로 SECURIUM이 독립적으로 작성한 학습 자료이며, 공식 기출문제나 원문을 복제하지 않습니다.`;

export const engineerPracticalLogMonitoringContent = deepFreeze({
  id: "content-official-security-cert-ise-practical-log-collection-monitoring",
  slug: "official-security-cert-ise-practical-log-collection-monitoring",
  canonicalKey: "official.security-certification.ise.practical.log-collection-monitoring",
  title: "보안 로그 수집 및 모니터링",
  summary:
    "운영체제·서비스·보안 및 네트워크 장비의 로그 발생 대상을 식별하고, 생성 수준과 구성요소를 설정한 뒤 수집 상태를 모니터링·통제하는 실기 학습 자료입니다.",
  body: contentBody,
  bodyFormat: "MARKDOWN",
  learningObjectives: [
    "운영체제, 버전, 서비스와 장비별 로그 발생 대상을 구분할 수 있다.",
    "보안목표에 맞는 로그 생성 수준과 구성요소 설정을 설명할 수 있다.",
    "로그 수집·관리·모니터링·통제와 후속 분석·대응의 경계를 설명할 수 있다.",
  ],
  coreConcepts: [
    "로그 발생 대상 식별",
    "로그 수집 및 관리",
    "운영체제·버전·서비스별 로그",
    "보안·네트워크 장비 로그",
    "로그 생성 수준",
    "구성요소별 로그 설정",
    "로그 모니터링",
    "로그 통제",
  ],
  practicalExamples: [
    "웹·DB 서비스에서 인증·접근·오류 로그의 생성 설정과 시험 결과를 점검한다.",
    "Firewall·IDS·IPS와 네트워크 장비에서 관리 도구로 생성 수준과 구성요소를 확인한다.",
    "대상 목록과 실제 설정을 대조하여 로그 누락과 설정 이탈을 식별한다.",
  ],
  version: "1.0.0-draft",
  status: "DRAFT",
  authoringOnly: true,
  authoringMetadata: engineerPracticalLogMonitoringAuthoringMetadata,
});

export const engineerPracticalLogMonitoringQuestion = deepFreeze({
  id: "practical-security-official-engineer-log-monitoring-q01",
  title: "서비스·장비별 로그 수집 설정",
  content:
    "웹 서비스와 DB, Firewall, IDS가 운영 중이다. 보안 로그 수집 및 모니터링을 준비하는 조치로 적절한 것을 모두 고르시오.",
  type: "MULTIPLE_CHOICE",
  difficulty: "MEDIUM",
  status: "DRAFT",
  source: "SECURIUM independently authored from authenticated official scope",
  sourceClass: "AUTHOR_CREATED_FROM_OFFICIAL_SCOPE",
  sourceDate: "2026-08-15",
  sampleOnly: true,
  courseLinks: [],
  contentLinks: [],
  intendedCourseId: "course-ise",
  intendedContentId:
    "content-official-security-cert-ise-practical-log-collection-monitoring",
  answerConfig: {
    selectionMode: "MULTIPLE",
    correctChoiceIds: [
      "practical-security-official-engineer-log-monitoring-q01-choice-01",
      "practical-security-official-engineer-log-monitoring-q01-choice-02",
    ],
  },
  choices: [
    {
      id: "practical-security-official-engineer-log-monitoring-q01-choice-01",
      content:
        "운영체제·서비스 버전별 인증·접근·오류 로그를 식별하고 필요한 생성 수준을 설정한 뒤 시험 로그를 확인한다.",
      displayOrder: 1,
      isCorrect: true,
      explanation:
        "로그 발생 대상을 식별하고 생성 수준을 설정한 뒤 실제 생성 여부를 확인하는 것은 목표 범위의 핵심 절차다.",
    },
    {
      id: "practical-security-official-engineer-log-monitoring-q01-choice-02",
      content:
        "Firewall과 IDS의 로그 관리 도구에서 정책·탐지 기록에 필요한 구성요소를 설정하고 기록 생성 상태를 점검한다.",
      displayOrder: 2,
      isCorrect: true,
      explanation:
        "보안장비의 생성 수준과 구성요소 설정 및 모니터링은 공식 목표 범위에 포함된다. IDS는 여기서 로그 원천으로 다룬다.",
    },
    {
      id: "practical-security-official-engineer-log-monitoring-q01-choice-03",
      content:
        "먼저 모든 로그를 심층 상관 분석해 공격자를 확정한 다음 수집 대상을 정한다.",
      displayOrder: 3,
      isCorrect: false,
      explanation:
        "수집 대상과 생성 설정이 먼저 정해져야 한다. 통합·상관과 공격 판정은 인접한 로그 분석 및 침해 탐지 범위다.",
    },
    {
      id: "practical-security-official-engineer-log-monitoring-q01-choice-04",
      content:
        "로그 설정 단계의 주된 목표를 침해사고 억제·근절·복구 절차 수행으로 정한다.",
      displayOrder: 4,
      isCorrect: false,
      explanation:
        "억제·근절·복구는 사고 대응 범위다. 이 항목의 주된 목표는 로그 생성·수집 설정과 모니터링·통제다.",
    },
  ],
  explanation:
    "정답은 1번과 2번이다. 목표 범위는 로그 원천을 식별하고 서비스·장비별 생성 수준과 구성요소를 설정하며, 필요한 기록이 계속 생성되는지 모니터링·통제하는 데 있다. 심층 상관 분석과 공격 판정, 사고 억제·근절·복구는 인접하거나 범위 밖의 후속 활동이다.",
  wrongAnswerExplanation:
    "분석·탐지·대응을 로그 생성 및 수집 설정과 같은 단계로 취급하면 공식 세부항목의 책임 경계가 흐려진다.",
  tags: ["정보보안기사", "실기", "로그 수집", "로그 설정", "로그 모니터링"],
  authoringOnly: true,
  authoringMetadata: engineerPracticalLogMonitoringAuthoringMetadata,
});
