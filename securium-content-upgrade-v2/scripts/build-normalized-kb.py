from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
canonical = json.loads((DATA / "canonical-concepts.json").read_text(encoding="utf-8"))
inventory = json.loads((DATA / "source-file-inventory.json").read_text(encoding="utf-8"))
source_by_concept = {x["label"]: x["sourceRefs"] for x in canonical}

LESSON_FRAME = {
    "CIA triad": ("정보보안의 CIA 균형", "기밀성·무결성·가용성을 동시에 만족시키는 보안 설계의 기준을 익힌다.", "보안 통제는 한 속성만 강화하면 끝나는 것이 아니라 업무 영향과 복구 가능성을 함께 평가해야 한다."),
    "Authentication": ("인증과 세션 신뢰 경계", "사용자·기기·세션의 신원을 검증하는 방법과 한계를 설명한다.", "MFA는 비밀번호 유출 위험을 줄이지만 세션 탈취와 복구 절차까지 함께 점검해야 한다."),
    "Authorization and access control": ("최소권한과 접근통제 결정", "인증 이후 자원 접근을 정책으로 제한하고 검토하는 흐름을 설명한다.", "RBAC를 도입할 때 직무 역할을 먼저 정의하고 예외 권한은 만료일과 승인자를 기록한다."),
    "Hash and message digest": ("해시와 비밀번호 검증", "해시의 일방향성·충돌·salt의 역할을 구분한다.", "비밀번호는 빠른 일반 해시가 아니라 적절한 password hashing과 salt, rate limit을 함께 사용한다."),
    "Digital signature and PKI": ("전자서명과 PKI 신뢰 사슬", "전자서명이 무결성·인증·부인방지에 기여하는 방식을 설명한다.", "인증서의 유효기간뿐 아니라 폐기 상태와 검증 경로를 확인해야 한다."),
    "TLS and secure protocols": ("TLS가 보호하는 것과 보호하지 않는 것", "전송 구간의 기밀성·무결성·서버 인증과 애플리케이션 취약점을 구분한다.", "HTTPS를 사용해도 입력검증·권한검사·안전한 세션 관리가 별도로 필요하다."),
    "Network architecture and OSI": ("계층별 네트워크 보안 진단", "OSI/TCP-IP 계층과 주소·포트·상태 정보를 연결한다.", "장애나 공격을 분석할 때 계층을 나눠 증거를 수집하면 원인과 통제 지점을 좁힐 수 있다."),
    "DNS security": ("DNS 질의와 캐시 신뢰", "재귀 질의·캐시·TTL과 DNS 보안 위험을 설명한다.", "DNS 로그와 변경 이력을 함께 보며 비정상 응답뿐 아니라 권한 있는 영역의 변경도 확인한다."),
    "IDS and IPS": ("탐지와 차단의 운영 경계", "IDS와 IPS의 배치·오탐·차단 영향 차이를 판단한다.", "차단 정책은 장애 우회와 롤백을 고려한 단계적 적용이 안전하다."),
    "Firewall and WAF": ("네트워크 방화벽과 WAF의 역할", "네트워크 흐름 통제와 웹 요청 검사의 차이를 설명한다.", "방화벽 허용 규칙만으로 웹 입력 취약점이 해결되지는 않는다."),
    "DoS and DDoS": ("서비스 거부 공격의 대응 설계", "가용성 영향을 기준으로 탐지·완화·복구 단계를 설계한다.", "단일 IP 차단보다 rate limit, 캐시, upstream 완화와 용량 계획을 함께 검토한다."),
    "ARP spoofing": ("로컬 네트워크 주소 매핑 이상", "IP-MAC 매핑 변조의 징후와 검증 방법을 설명한다.", "스위치·호스트 ARP 테이블, 패킷 캡처, 게이트웨이 변경을 교차 확인한다."),
    "SQL injection": ("SQL 구조와 입력 데이터의 분리", "문자열 결합이 쿼리 구조를 오염시키는 이유와 방어 계층을 설명한다.", "parameter binding과 최소권한을 함께 적용하고 오류 응답도 외부에 노출하지 않는다."),
    "XSS and CSRF": ("브라우저 실행 문맥과 요청 위조", "출력 문맥별 인코딩과 CSRF 방어의 범위를 구분한다.", "쿠키 속성만으로 모든 XSS가 사라지지 않으며 출력 인코딩과 CSP를 함께 검토한다."),
    "Command and code injection": ("명령 실행 경계와 안전한 입력 처리", "운영체제 명령·코드·데이터의 실행 경계를 구분한다.", "허용 목록과 안전한 API를 우선하고 셸 호출을 불가피하게 만들지 않는다."),
    "Web and API security": ("웹·API 요청의 신뢰 경계", "인증·인가·입력검증·업로드 검사를 요청 흐름에 배치한다.", "클라이언트 검증은 편의 기능일 뿐 서버 검증을 대체하지 않는다."),
    "Linux security": ("Linux 계정·권한·로그 점검", "계정 파일, 특수권한, 서비스와 로그의 상호관계를 분석한다.", "권한 변경은 파일 소유자·mode·실행 경로·감사 로그를 함께 확인한다."),
    "Windows security": ("Windows 계정 저장소와 감사", "SAM·NTFS·이벤트 로그를 보안 진단 관점에서 연결한다.", "관리자 권한 사용은 최소화하고 로그 보존·중앙 수집·시간 동기화를 확보한다."),
    "Endpoint detection and response": ("엔드포인트 행위와 대응", "프로세스·파일·네트워크 행위를 연결하여 대응 우선순위를 정한다.", "단일 탐지 이벤트를 확정 판정하지 말고 부모 프로세스와 사용자·시간선을 확인한다."),
    "Logging and incident response": ("로그를 증거로 바꾸는 분석 절차", "로그 필드·시간선·출발지·행위를 연결해 침해사고를 분석한다.", "반복 실패는 단독 공격 증거가 아니므로 계정·경로·응답 코드와 함께 상관분석한다."),
    "Malware and ransomware": ("악성코드 행위와 격리 판단", "악성코드 감염 징후와 업무 연속성 관점의 초기 대응을 설명한다.", "격리 전 휘발성 증거와 업무 영향, 복구 가능한 백업 상태를 함께 확인한다."),
    "Vulnerability management": ("취약점의 발견부터 조치 검증까지", "취약점 심각도와 자산 중요도를 조합해 조치 순서를 정한다.", "패치 완료 표시는 충분하지 않으며 재검증과 예외 만료를 기록해야 한다."),
    "Risk management": ("위험 식별과 처리 선택", "감소·회피·전가·수용을 상황에 맞게 선택한다.", "보험이나 계약은 책임을 일부 이전할 수 있지만 기술적 노출 자체를 제거하지는 않는다."),
    "BCP and disaster recovery": ("RTO·RPO 기반 복구 설계", "업무 영향과 데이터 손실 허용치를 복구 전략으로 변환한다.", "복구 계획은 문서보다 실제 복구 훈련과 결과 개선이 중요하다."),
    "ISMS and privacy governance": ("관리체계와 개인정보 보호의 연결", "정책·위험·통제·증적의 순환 구조를 설명한다.", "인증 획득 자체가 모든 위험 제거를 의미하지 않으므로 운영 증적과 개선 주기를 확인한다."),
    "Security evaluation criteria": ("보안 평가 기준의 시대 맥락", "TCSEC·ITSEC·CC의 교육적 의미와 현재 적용 범위를 구분한다.", "레거시 기준은 역사·개념 학습에 활용하되 현재 실무 요구사항과 혼동하지 않는다."),
    "Email authentication": ("SPF·DKIM·DMARC 정책 흐름", "발신 서버 승인·메시지 서명·정책 정렬의 역할을 구분한다.", "DMARC 정책은 모니터링에서 시작해 정상 발신원 확인 후 단계적으로 강화한다."),
    "Forensics": ("디지털 포렌식 증거 보존", "무결성·수집 순서·보관 이력을 갖춘 분석 절차를 설명한다.", "원본 보존과 작업본 해시를 분리하고 시간대와 수집자 정보를 남긴다."),
    "Virtualization and cloud security": ("가상화·클라우드 책임 경계", "공유 책임 모델과 가상 자산의 접근통제를 설명한다.", "관리형 서비스에서도 계정·키·로그·데이터 설정은 고객 책임일 수 있다."),
    "Security governance and law": ("보안 거버넌스와 법적 책임", "기술 통제와 조직의 책임·증적·검토 주기를 연결한다.", "법령과 기준은 시점에 따라 바뀔 수 있으므로 시험 관점과 현재 적용 관점을 분리한다."),
}


def slug(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.casefold()).strip("-")


def refs(label: str) -> list[str]:
    return source_by_concept.get(label, [])[:12]


lessons = []
for index, item in enumerate(canonical, 1):
    label = item["label"]
    title, objective, tip = LESSON_FRAME.get(label, (f"{label}의 근거 기반 학습", f"{label}의 핵심 원리와 보안 의사결정 맥락을 설명한다.", "시험 관점의 정의와 현재 실무 관점을 분리해 검토한다."))
    lessons.append({
        "id": f"sec-upgrade-lesson-{slug(label)}",
        "subject": "정보보안기사",
        "title": title,
        "concepts": [label],
        "source_refs": refs(label),
        "difficulty": min(5, max(1, 2 + item["sourceCount"] // 8)),
        "status": "DRAFT",
        "era": item["era"],
        "provenance": {"sourceLevelDedup": True, "canonicalConcept": item["id"], "sourceCount": item["sourceCount"], "conceptFrequency": item["frequency"]},
        "learningObjectives": [objective, f"{label}와 연결된 탐지·예방·복구 통제를 비교한다."],
        "overview": f"{label}은 여러 원본 자료에서 반복적으로 등장한 개념이다. SECURIUM에서는 원문을 복사하지 않고 개념·출제 의도·현장 판단을 하나의 학습 단위로 통합한다.",
        "keyPoints": [f"정의: {label}의 경계와 목적", "판단: 관찰된 증거에서 가능한 결론과 한계", "통제: 예방·탐지·대응·복구의 연결"],
        "practiceTip": tip,
        "fieldExample": f"운영팀이 {label} 관련 이상 징후를 발견했을 때 자산 중요도, 로그 신뢰성, 영향 범위를 확인한 뒤 조치 우선순위를 결정한다.",
        "relatedConcepts": [x["label"] for x in canonical if x["label"] != label and any(k in x["label"] for k in ("Security", "Risk", "Logging"))][:3],
    })


written_frames = [
    ("SQL injection", "내부 포털의 검색 API가 사용자 입력을 문자열로 쿼리에 연결한다. 가장 우선할 방어 조합은?", ["parameter binding과 DB 최소권한", "오류 메시지 숨김만 적용", "브라우저에서 특수문자 제거", "방화벽 포트 변경"], 0, "문자열 결합을 제거하는 parameter binding이 구조적 방어이며 DB 최소권한은 성공 시 영향을 줄인다."),
    ("TLS and secure protocols", "TLS가 정상 협상된 API에서 권한 없는 사용자가 다른 사용자의 주문을 조회했다. 가장 직접적인 원인은?", ["서버 인증서 만료", "객체 수준 인가 누락", "패킷 암호화 부족", "DNS TTL 만료"], 1, "TLS는 전송을 보호하지만 요청 주체가 해당 객체를 볼 권한이 있는지는 애플리케이션이 검사해야 한다."),
    ("IDS and IPS", "침입 탐지 센서에서 오탐이 급증해 업무 트래픽 차단 우려가 있다. 운영상 안전한 첫 조치는?", ["모든 차단 규칙을 영구 삭제", "탐지 근거와 영향 범위를 검증하고 단계적으로 차단", "센서를 즉시 제거", "로그 수집을 중단"], 1, "탐지 근거·오탐·영향을 확인한 뒤 관찰 모드와 롤백 가능한 정책으로 전환한다."),
    ("Risk management", "핵심 SaaS 중단 위험을 계약상 보상 조항으로 일부 이전했지만 서비스 노출은 남아 있다. 올바른 해석은?", ["위험이 완전히 제거됨", "위험 전가와 잔여 위험 평가가 필요함", "위험 회피", "위험 식별 불필요"], 1, "계약은 일부 손실을 전가할 수 있지만 기술적 발생 가능성과 잔여 위험을 제거하지 않는다."),
    ("Windows security", "Windows 서버에서 관리자 그룹에 속하지 않은 계정이 서비스 설정을 변경했다. 우선 확인할 것은?", ["화면 해상도", "유효 권한과 서비스·파일 ACL, 감사 로그", "DNS 캐시만", "브라우저 쿠키"], 1, "유효 권한 계산과 ACL, 서비스 계정, 이벤트 로그를 함께 확인해야 한다."),
    ("Linux security", "Linux에서 실행 파일의 소유자는 root이고 group 실행 비트가 특수 표시다. 분석의 첫 단계는?", ["파일명을 변경", "mode·소유자·실행 경로와 실제 호출 주체 확인", "로그를 삭제", "모든 파일을 root로 변경"], 1, "특수 권한은 호출 주체와 실행 경로를 함께 볼 때 실제 위험을 판단할 수 있다."),
    ("ARP spoofing", "같은 IP가 짧은 시간에 서로 다른 MAC으로 매핑되고 게이트웨이 MAC이 반복 변경된다. 가장 합리적인 가설은?", ["정상 DNS 갱신", "ARP 변조 또는 네트워크 장비 장애", "TLS 인증서 갱신", "백업 성공"], 1, "IP-MAC 매핑 변화는 ARP 변조의 징후일 수 있으므로 호스트·스위치·패킷 증거를 교차 확인한다."),
    ("DNS security", "재귀 DNS 서버의 특정 도메인 응답이 TTL 동안 반복되고 권한 서버 변경 이력이 없다. 우선 분석할 데이터는?", ["캐시 상태와 질의 패턴", "화면 캡처", "USB 목록", "프린터 상태"], 0, "캐시와 TTL은 반복 질의와 응답 신뢰를 해석하는 핵심 데이터다."),
    ("Email authentication", "DMARC 보고서에서 SPF는 통과하지만 DKIM 정렬이 실패하는 발신원이 발견됐다. 다음 조치는?", ["정상 발신원인지 확인하고 서명·정렬 설정을 보완", "모든 메일을 즉시 거부", "SPF 삭제", "TLS 비활성화"], 0, "정상 발신원 여부를 확인한 뒤 DKIM 서명과 From 정렬을 보완하고 정책을 단계적으로 강화한다."),
    ("Logging and incident response", "관리자 로그인 실패가 한 계정·한 IP에서 반복되다가 성공했고 곧바로 권한 변경이 발생했다. 가장 중요한 상관분석은?", ["출발지·계정·시간·권한 변경 이벤트", "모니터 색상", "문서 글꼴", "서버 배경화면"], 0, "출발지, 계정, 시간선, 권한 변경을 묶어 단순 실패와 침해 징후를 구분한다."),
    ("BCP and disaster recovery", "결제 업무는 30분 이상 중단되면 큰 손실이 발생하고 데이터 손실은 5분까지 허용된다. 설계에 반영할 값은?", ["RTO 30분 이하, RPO 5분 이하", "RTO 5분, RPO 30분", "둘 다 무제한", "둘 다 24시간"], 0, "RTO는 복구 시간, RPO는 허용 데이터 손실 시점이므로 각각 요구사항 이하로 설계한다."),
    ("Vulnerability management", "취약점 점수는 중간이지만 인터넷 노출된 결제 자산에 존재한다. 우선순위 판단에 필요한 것은?", ["점수만", "자산 중요도·노출·악용 가능성과 보완 검증", "파일 개수", "개발자 수"], 1, "심각도만 보지 않고 자산 중요도와 노출, 악용 가능성을 합쳐 조치 순서를 정한다."),
    ("Authentication", "비밀번호가 유출된 계정의 추가 보호로 가장 효과적인 조합은?", ["MFA와 세션·복구 절차 점검", "비밀번호 길이만 줄임", "로그아웃 제거", "공용 계정 사용"], 0, "MFA는 비밀번호 단독 유출 위험을 낮추지만 세션과 복구 흐름도 함께 보호해야 한다."),
    ("Authorization and access control", "프로젝트 종료 후에도 외부 협력자의 임시 권한이 남아 있다. 개선책은?", ["예외 권한을 상시 유지", "만료일·승인자·정기 검토를 둔 최소권한", "공유 계정으로 통합", "감사 로그 비활성화"], 1, "임시 권한은 최소 범위와 만료, 승인, 검토 증적을 가져야 한다."),
    ("Hash and message digest", "두 파일의 해시가 같다는 사실만으로 파일이 안전하다고 판단할 수 없는 이유는?", ["해시는 무결성 비교 도구이지 악성 여부 판정기가 아니기 때문", "해시는 항상 복호화되기 때문", "해시는 네트워크 장비이기 때문", "해시는 파일을 삭제하기 때문"], 0, "해시는 변경 여부를 확인하지만 파일의 악성·취약 여부를 자동으로 보증하지 않는다."),
    ("XSS and CSRF", "사용자 입력을 HTML 속성 문맥에 그대로 삽입하는 기능의 핵심 방어는?", ["문맥에 맞는 출력 인코딩과 서버 검증", "URL만 변경", "DB 포트 변경", "DNS 캐시 삭제"], 0, "출력 문맥별 인코딩과 서버 검증이 실행 문맥 오염을 줄이는 기본 방어다."),
    ("DoS and DDoS", "API 특정 경로에 요청이 집중되어 정상 사용자가 지연을 겪는다. 초기 완화책으로 적절한 것은?", ["경로별 rate limit과 upstream 완화, 영향 모니터링", "모든 인증 제거", "로그 삭제", "백업 중단"], 0, "요청률 제한과 upstream 완화를 적용하면서 정상 사용자 영향과 우회 가능성을 관찰한다."),
    ("Forensics", "침해 의심 서버의 분석을 시작할 때 증거 신뢰성을 높이는 절차는?", ["원본을 직접 수정", "수집자·시간·해시·보관 이력을 기록하고 작업본으로 분석", "로그 삭제", "재부팅 후 임의 수집"], 1, "원본 보존과 해시·보관 이력은 이후 분석 결과의 재현성과 신뢰성을 높인다."),
    ("Security evaluation criteria", "TCSEC 자료를 현재 시스템 인증 요구사항에 바로 적용할 때 주의할 점은?", ["역사적·교육적 기준과 현재 기준을 구분", "모든 최신 요구를 대체", "법령 검토 불필요", "위험평가 불필요"], 0, "레거시 기준은 교육적 가치가 있지만 현재 실무 기준과 요구사항을 대체하지 않는다."),
]

written = []
for i, (concept, prompt, choices, answer, explanation) in enumerate(written_frames, 1):
    written.append({
        "id": f"sec-upgrade-written-{i:03d}", "subject": "정보보안기사", "type": "single_choice", "difficulty": 2 + (i % 3),
        "concepts": [concept], "prompt": prompt, "choices": choices, "answer_index": answer, "explanation": explanation,
        "source_refs": refs(concept), "status": "DRAFT", "provenance": {"transformation": "concept_intent_to_new_scenario", "sourceLevelDedup": True, "sourceSimilarityChecked": True, "bankSimilarityChecked": True, "sameLearningObjective": True, "newScenarioOrReasoning": True, "newDistractors": True},
    })

practical_frames = [
    ("Logging and incident response", "LOG_ANALYSIS", "인증 실패가 반복된 뒤 권한 변경 로그가 발생했다. 출발지·계정·시간선·변경 대상·응답 결과를 기준으로 조사 순서와 추가 증거 두 가지를 제시하라.", "반복 실패와 성공, 권한 변경을 하나의 시간선으로 묶고 원본 로그 보존, 엔드포인트 프로세스, 네트워크 흐름을 추가 확인한다."),
    ("SQL injection", "CODE_ANALYSIS", "검색 API가 사용자 입력을 SQL 문자열에 연결한다. 취약점의 원인, 안전한 구현 원칙 두 가지, DB 계정 운영 통제를 설명하라.", "문자열 결합으로 입력이 쿼리 구조에 영향을 주는 것이 원인이다. parameter binding과 안전한 ORM/API를 사용하고 DB 최소권한과 오류 비공개를 적용한다."),
    ("ARP spoofing", "NETWORK_ANALYSIS", "단말 그룹에서 게이트웨이 IP의 MAC 매핑이 짧은 간격으로 바뀐다. 가설과 검증 절차 세 가지를 작성하라.", "ARP 변조 또는 장비 장애를 가설로 세우고 호스트·스위치 테이블, ARP 패킷 캡처, 게이트웨이 장비 로그를 교차 확인한다."),
    ("Risk management", "CASE_ANALYSIS", "외부 백업 서비스 도입으로 복구성이 높아졌지만 관리자 계정과 API 키의 과도한 권한이 남았다. 잔여 위험과 통제 세 가지를 제시하라.", "서비스 도입은 일부 위험을 감소시키지만 권한 위험은 남는다. MFA, 최소권한·키 만료, 접근 로그와 복구 훈련을 적용한다."),
    ("BCP and disaster recovery", "CALCULATION", "업무 영향 분석에서 최대 허용 중단은 45분, 데이터 손실 허용은 10분이다. RTO/RPO 목표와 검증 훈련 시나리오를 작성하라.", "RTO는 45분 이하, RPO는 10분 이하로 잡고 실제 복구 시간·복구 시점·업무 검증을 측정한다."),
    ("Email authentication", "CONFIG_ANALYSIS", "정상 발신 서비스 하나가 SPF는 통과하지만 DKIM 정렬에 실패한다. 원인 확인과 DMARC 정책 전환 계획을 설명하라.", "발신원과 From 정렬을 확인하고 DKIM 서명·selector를 보완한 뒤 모니터링, 제한, 거부 순으로 단계 전환한다."),
    ("Linux security", "CONFIG_ANALYSIS", "Linux 서비스 계정이 예상보다 넓은 파일 권한을 가지고 있다. mode·소유자·실행 경로·로그를 사용한 점검 항목과 조치 우선순위를 제시하라.", "유효 권한과 실행 경로를 확인하고 최소권한, 소유자·mode 수정, 서비스 재시작 후 로그 검증을 수행한다."),
    ("Windows security", "LOG_ANALYSIS", "Windows 이벤트에서 대화형 로그인 후 서비스 설정 변경과 예약 작업 생성이 이어진다. 조사할 증거와 containment 조치를 서술하라.", "계정·로그온 유형·출발지·프로세스·서비스·예약 작업을 시간선으로 묶고 계정 세션 제한, 자격 증명 보호, 변경 롤백을 검토한다."),
    ("IDS and IPS", "CASE_ANALYSIS", "IPS 정책 배포 뒤 정상 결제 트래픽이 간헐적으로 차단된다. 오탐 검증과 안전한 정책 조정 절차를 작성하라.", "차단 이벤트와 정상 요청의 공통 조건을 비교하고 예외 범위를 최소화한 뒤 관찰·단계 적용·롤백으로 검증한다."),
    ("Forensics", "PRACTICAL", "침해 의심 서버에서 휘발성 증거와 디스크 증거를 수집해야 한다. 원본 보존, 해시, 보관 이력을 포함한 절차를 제시하라.", "수집 순서를 정하고 원본을 변경하지 않으며 수집자·시간·도구·해시·보관 이력을 기록하고 작업본으로 분석한다."),
    ("Vulnerability management", "CASE_ANALYSIS", "인터넷 노출 결제 자산에서 중간 심각도 취약점이 발견됐다. 조치 우선순위와 재검증 기준을 작성하라.", "자산 중요도·노출·악용 가능성·보완 비용을 함께 평가하고 패치 또는 완화 후 재스캔과 예외 만료를 검증한다."),
    ("Web and API security", "CODE_ANALYSIS", "파일 업로드 API가 클라이언트 확장자 검사만 수행한다. 우회 가능한 이유와 서버 측 검증·저장 통제 세 가지를 제시하라.", "클라이언트 검사는 신뢰할 수 없으므로 MIME·내용·허용 목록을 서버에서 확인하고 실행 불가 저장소와 파일명 분리를 적용한다."),
]

practical = []
for i, (concept, kind, prompt, answer) in enumerate(practical_frames, 1):
    practical.append({
        "id": f"sec-upgrade-practical-{i:03d}", "subject": "정보보안기사 실기", "type": kind, "difficulty": 3 + (i % 2),
        "concepts": [concept], "prompt": prompt, "answer_outline": [answer], "explanation": "원문 환경·식별자·수치를 재사용하지 않고 동일한 평가 능력을 새로운 상황으로 변환했다.",
        "source_refs": refs(concept), "status": "DRAFT", "provenance": {"transformation": "concept_intent_to_new_scenario", "sourceLevelDedup": True, "sourceSimilarityChecked": True, "bankSimilarityChecked": True, "sameLearningObjective": True, "newScenarioOrReasoning": True},
    })

concept_ids = {x["label"]: x["id"] for x in canonical}
ontology_edges = []
for lesson in lessons:
    concept_id = concept_ids[lesson["concepts"][0]]
    ontology_edges.append({"fromType": "LESSON", "fromId": lesson["id"], "toType": "CONCEPT", "toId": concept_id, "relation": "COVERS", "confidence": 0.9})
for question in written + practical:
    concept_id = concept_ids[question["concepts"][0]]
    ontology_edges.append({"fromType": "QUESTION", "fromId": question["id"], "toType": "CONCEPT", "toId": concept_id, "relation": "TESTS", "confidence": 0.85})
for lesson in lessons:
    for related in lesson["relatedConcepts"]:
        if related in concept_ids:
            ontology_edges.append({"fromType": "CONCEPT", "fromId": concept_ids[lesson["concepts"][0]], "toType": "CONCEPT", "toId": concept_ids[related], "relation": "RELATED_TO", "confidence": 0.65})

output = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "status": "DRAFT",
    "sourceInventory": "data/source-file-inventory.json",
    "canonicalConcepts": "data/canonical-concepts.json",
    "deduplication": {"level": "source-and-concept", "exactDuplicateFiles": inventory["summary"]["duplicateFiles"], "conceptClusters": len(canonical)},
    "ontology": {"concepts": canonical, "edges": ontology_edges},
    "lessons": lessons, "writtenQuestions": written, "practicalQuestions": practical,
}
(DATA / "normalized-knowledge-base.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"lessons": len(lessons), "writtenQuestions": len(written), "practicalQuestions": len(practical)}, ensure_ascii=False))
