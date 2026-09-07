// Wave A: 정보보안일반. Local authoring candidate; not a seed or canonical write.
export const WAVE_A_SUBJECT = "정보보안일반";
export const WAVE_A_QUALIFICATION = "정보보안기사";
export const WAVE_A_CURRENT_AUTHORITY = {
  issuer: "한국방송통신전파진흥원(KCA), CQ",
  sourceUrl: "https://www.cq.or.kr/qh_quagm01_020.do",
  usage: "CURRENT_SCOPE_REFERENCE",
  scope: "subject-level qualification and examination structure",
  officialFineGrainedUnitCount: 0,
};
export const WAVE_A_EXCLUDED_SOURCES = [
  "THIRD-PARTY-ISE-2023-TISTORY-01",
  "COMMERCIAL-ISE-2026-ALLINONE-01",
  "HISTORICAL_EXAM_AND_ANSWER_MATERIALS",
];

const sourceMetadata = {
  authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING",
  contentClass: "SECURIUM_DERIVED",
  qualification: WAVE_A_QUALIFICATION,
  subject: WAVE_A_SUBJECT,
  currentness: "CURRENT_SUBJECT_LEVEL_SCOPE_ONLY",
  rights: "ORIGINAL_EXPRESSION_WITH_FACTUAL_SCOPE_REFERENCE",
  expressionReuse: "NOT_USED",
  authorityReference: WAVE_A_CURRENT_AUTHORITY.sourceUrl,
  excludedSources: WAVE_A_EXCLUDED_SOURCES,
};

export const waveAInformationSecurityGeneralUnits = [
  { id: "ise-wave-a-general-unit-01", title: "보안 목표와 위험 판단의 연결", classification: "SECURIUM_DERIVED", learningObjective: "기밀성·무결성·가용성의 보안 목표를 위협, 취약점, 영향 및 위험 판단과 연결한다.", concepts: ["기밀성", "무결성", "가용성", "위협", "취약점", "위험", "보안 목표"], sharedConceptRefs: ["risk-based-control", "event-triage"], existingAssetCoverage: ["content-official-security-cert-information-security-general-overview"], gapState: "PARTIAL" },
  { id: "ise-wave-a-general-unit-02", title: "암호 기능과 키 관리의 구분", classification: "SECURIUM_DERIVED", learningObjective: "대칭키·공개키 암호, 해시, MAC, 전자서명의 목적을 구분하고 키 생명주기 관리와 연결한다.", concepts: ["대칭키 암호", "공개키 암호", "해시", "MAC", "전자서명", "키 관리"], sharedConceptRefs: ["authentication-boundary", "evidence-preservation"], existingAssetCoverage: ["content-official-security-cert-information-security-general-overview"], gapState: "PARTIAL" },
];

const lesson = (id, slug, key, title, summary, objectives, concepts, body, examples) => ({ id, slug, canonicalKey: key, title, summary, body: [`# ${title}`, ...body].join("\n\n"), learningObjectives: objectives, coreConcepts: concepts, practicalExamples: examples, sourceMetadata });

export const waveAInformationSecurityGeneralLessons = [
  lesson("ise-wave-a-general-lesson-01", "ise-wave-a-general-security-objectives-and-risk", "securium.ise.wave-a.information-security-general.security-objectives-and-risk", "보안 목표를 위험 판단으로 연결하기", "보안 문제를 기밀성·무결성·가용성으로 분해하고 위협과 취약점이 자산에 미치는 영향을 위험으로 판단합니다.", ["기밀성·무결성·가용성을 구분한다.", "위협·취약점·영향·위험의 관계를 설명한다.", "보안 목표에 맞는 통제 우선순위를 판단한다."], ["기밀성", "무결성", "가용성", "위협", "취약점", "위험", "보안 목표"], [
    "정보보안일반의 출발점은 대책의 이름을 외우는 것이 아니라 무엇을 보호해야 하는지와 어떤 손실을 줄여야 하는지를 설명하는 것입니다.",
    "## 세 가지 보안 목표\n- 기밀성은 허가받지 않은 주체에게 정보가 공개되지 않도록 하는 목표입니다.\n- 무결성은 정보와 처리 결과가 부적절하게 변경되지 않도록 하는 목표입니다.\n- 가용성은 정당한 사용자가 필요한 시점에 서비스와 정보에 접근하도록 하는 목표입니다.",
    "하나의 사건은 여러 목표를 동시에 손상시킬 수 있습니다. 권한 없는 고객 기록 조회는 기밀성 문제이고, 기록 변경은 무결성 문제이기도 합니다.",
    "## 위협·취약점·위험\n위협은 손실을 일으킬 수 있는 원인이나 행위이고, 취약점은 위협이 악용할 수 있는 약점입니다. 위험은 가능성과 결과의 크기를 자산 및 업무 영향과 함께 판단한 결과입니다.",
    "취약점이 발견되었다는 사실만으로 대응 순위가 자동 결정되지는 않습니다. 자산 중요도, 노출 범위, 기존 통제와 대체 가능성을 함께 검토해야 합니다.",
    "## 판단 순서\n1. 보호 대상 자산과 업무 영향을 확인합니다.\n2. 달성해야 할 보안 목표를 선택합니다.\n3. 위협과 악용 가능한 취약점을 구분합니다.\n4. 가능성과 영향을 검토합니다.\n5. 통제와 남은 위험을 기록합니다.",
    "접근통제는 기밀성에 기여하지만, 잘못된 정책이나 운영 기록의 부재는 무결성과 책임추적성에도 영향을 줄 수 있습니다. 통제의 존재만으로 충분하다고 결론내리지 않아야 합니다.",
    "## 핵심 정리\n보안 목표는 위험 판단의 기준이고, 위협·취약점·영향을 구분해야 대책의 우선순위를 설명할 수 있습니다.",
  ], ["고객정보 조회 API의 인증, 권한, 변경 검증 및 감사 로그를 보안 목표별로 분류합니다.", "중요 서비스의 취약점은 노출 범위와 업무 영향까지 반영하여 조치 순서를 정합니다."]),
  lesson("ise-wave-a-general-lesson-02", "ise-wave-a-general-cryptographic-purpose-and-key-management", "securium.ise.wave-a.information-security-general.cryptographic-purpose-and-key-management", "암호 기능과 키 관리의 역할 구분", "암호 기술을 목적별로 구분하고 키의 생성부터 폐기까지의 관리가 기술 선택만큼 중요하다는 점을 학습합니다.", ["대칭키·공개키 암호의 목적과 키 구조를 비교한다.", "해시·MAC·전자서명의 검증 목적을 구분한다.", "키 생명주기와 접근통제의 필요성을 설명한다."], ["대칭키 암호", "공개키 암호", "해시", "MAC", "전자서명", "키 관리"], [
    "암호 기술은 이름이 아니라 보호하려는 속성과 검증하려는 주체를 기준으로 선택해야 합니다.",
    "## 목적별 구분\n대칭키 암호는 같은 비밀키로 대량 데이터의 기밀성을 효율적으로 보호합니다. 공개키 암호는 공개키와 개인키 관계를 사용합니다. 해시는 고정 길이 요약값을 만들며 원문 복호화 기능을 제공하지 않습니다.",
    "MAC은 공유 비밀을 아는 주체 사이에서 메시지의 무결성과 인증을 확인합니다. 전자서명은 서명자의 개인키와 검증자의 공개키로 무결성과 서명자 검증을 지원합니다.",
    "## 키 관리\n키 생성, 배포, 보관, 사용, 교체, 백업, 폐기 및 접근기록을 생명주기로 관리해야 합니다. 강한 알고리즘도 키가 노출되거나 목적별 분리가 되지 않으면 보호 효과가 약해집니다.",
    "대칭키는 공유 과정과 보관 주체를 관리하고, 개인키는 소유자와 사용 목적을 분명히 하며 접근을 제한해야 합니다.",
    "## 선택 질문\n먼저 기밀성·무결성·인증 중 필요한 목적, 키 공유 가능 여부, 검증자와 유효기간을 확인한 뒤 알고리즘과 운영 통제를 선택합니다.",
    "## 핵심 정리\n해시는 암호화가 아니며 MAC과 전자서명은 키 구조와 검증 주체가 다릅니다. 암호 기능은 키 관리와 함께 평가해야 합니다.",
  ], ["API 메시지 보호에서 기밀성, 무결성, 발신자 검증 요구를 분리하여 기능을 선택합니다.", "키 교체 주기와 폐기 기록을 검토하여 암호화 설정만으로 보안을 판단하지 않습니다."]),
];

const questionMetadata = { ...sourceMetadata, qualificationOwnership: "ISE_ONLY", runtimeMapping: "ISE_ONLY", isieQuestionIdReuse: false, revisionIdentity: "ISE_WAVE_A_LOCAL_CANDIDATE", governanceIdentity: "ISE_WAVE_A_LOCAL_CANDIDATE" };
const makeQuestion = (id, title, content, difficulty, correct, choices, explanation, objective, concepts, lessonId) => ({ id, title, content, type: "SINGLE_CHOICE", difficulty, choices: choices.map((text, index) => ({ id: `${id}-choice-${String(index + 1).padStart(2, "0")}`, content: text, displayOrder: index + 1, isCorrect: index === correct, explanation: index === correct ? explanation : "이 선택지는 제시된 보안 목표 또는 암호 기능의 역할과 일치하지 않습니다." })), explanation, learningObjective: objective, concepts, courseLinks: [{ courseId: "course-ise", weight: 100 }], contentLinks: [{ contentType: "CONTENT", contentId: lessonId, relationType: "PRACTICE" }], sourceMetadata: questionMetadata });

export const waveAInformationSecurityGeneralQuestions = [
  makeQuestion("ise-wave-a-general-question-01", "보안 목표와 위험 판단", "고객정보 조회 API에서 권한 없는 사용자가 기록을 조회하고 변경할 수 있다. 가장 적절한 설명은 무엇인가?", "EASY", 0, ["기밀성과 무결성에 영향을 주는 접근통제 위험", "가용성만의 문제", "취약점이 있으면 위험 판단은 불필요함", "백업만으로 해결되는 문제"], "권한 없는 조회는 기밀성, 부적절한 변경은 무결성에 영향을 주므로 접근통제와 변경 검증을 함께 검토해야 합니다.", "기밀성·무결성·가용성을 사건 영향과 연결한다.", ["기밀성", "무결성", "위험", "접근통제"], "ise-wave-a-general-lesson-01"),
  makeQuestion("ise-wave-a-general-question-02", "위협과 취약점 구분", "입력값 검증이 없는 웹 기능이 공격에 노출될 수 있다는 설명에서 ‘입력값 검증 부재’는 무엇인가?", "EASY", 0, ["취약점", "보안 목표", "영향", "통제 효과"], "공격에 악용될 수 있는 시스템의 약점이므로 취약점입니다.", "위협·취약점·영향을 구분한다.", ["위협", "취약점", "입력값 검증", "위험"], "ise-wave-a-general-lesson-01"),
  makeQuestion("ise-wave-a-general-question-03", "암호 기능 선택", "사전 공유 비밀 없이 메시지의 무결성과 발신자 검증을 지원하려 한다. 적절한 조합은 무엇인가?", "MEDIUM", 0, ["전자서명과 공개키 검증", "해시만 계산", "MAC과 공개키만 공개", "대칭키를 공개 저장"], "서명자는 개인키를 사용하고 검증자는 공개키를 사용하므로 사전 비밀 공유 없이 검증할 수 있습니다.", "해시·MAC·전자서명의 목적과 키 구조를 구분한다.", ["전자서명", "공개키 암호", "해시", "MAC", "인증 경계"], "ise-wave-a-general-lesson-02"),
  makeQuestion("ise-wave-a-general-question-04", "해시와 암호화 구분", "저장된 파일의 변경 여부를 이후에 확인하려는 목적에 가장 직접적으로 맞는 방법은 무엇인가?", "EASY", 0, ["파일의 해시를 계산하고 신뢰된 값과 비교한다", "해시값으로 원문을 복호화한다", "키를 공개하면 무결성이 보장된다", "백업 파일만 있으면 비교가 불필요하다"], "동일한 입력의 요약값을 비교하면 저장 이후 변경 여부를 탐지할 수 있습니다.", "해시의 변경 탐지 목적을 설명한다.", ["해시", "무결성", "증적 보존"], "ise-wave-a-general-lesson-02"),
  makeQuestion("ise-wave-a-general-question-05", "키 생명주기", "암호키가 더 이상 사용되지 않을 때 가장 적절한 조치는 무엇인가?", "MEDIUM", 0, ["사용 중지와 폐기를 기록하고 잔여 복사본을 통제한다", "편의를 위해 모든 시스템에 영구 보관한다", "키 이름만 바꾸고 계속 사용한다", "키와 암호문을 공개 저장소에 둔다"], "키 생명주기의 종료 단계에서는 사용 중지, 폐기, 잔여 복사본 통제와 기록이 필요합니다.", "키 생명주기의 종료와 접근통제 요구를 설명한다.", ["키 관리", "접근통제", "증적 보존"], "ise-wave-a-general-lesson-02"),
  makeQuestion("ise-wave-a-general-question-06", "위험 기반 통제 우선순위", "두 취약점의 기술적 심각도가 같을 때 조치 순위를 정하는 기준은 무엇인가?", "MEDIUM", 0, ["자산 중요도, 노출 범위, 악용 가능성 및 업무 영향을 함께 비교한다", "발견된 순서대로만 처리한다", "사용자가 많은 시스템을 항상 먼저 처리한다", "기존 통제가 있는 취약점은 항상 제외한다"], "위험 기반 우선순위는 기술 점수뿐 아니라 자산과 업무 영향, 노출 및 가능성을 함께 고려합니다.", "위험 기반 통제의 우선순위를 시나리오에 적용한다.", ["위험", "위험 기반 통제", "자산", "영향"], "ise-wave-a-general-lesson-01"),
];
