# SECURIUM Product Design Sprint

## 1. 목적

SECURIUM은 단순한 자격증 문제풀이 사이트가 아니라, 공식 커리큘럼, 콘텐츠, 문제은행, 온톨로지, AI Retrieval, Coverage, Analytics를 연결하는 정보보호·개인정보보호 AI 통합 학습 플랫폼이다.

이번 Product Design Sprint의 목적은 신규 기능을 계속 추가하기 전에 제품 철학, 정보구조, 화면 패턴, 관리자 Console UX를 먼저 정리하여 이후 구현 단계의 재작업을 줄이는 것이다.

## 2. 제품 철학

> 복잡한 정보보호 지식을 공식 기준과 AI 근거를 바탕으로 가장 직관적으로 학습하게 하는 플랫폼

SECURIUM의 핵심 경험은 “학습자가 무엇을 왜 배워야 하는지 이해하고, 문제·해설·복습·AI 설명의 근거를 다시 공식 기준으로 추적할 수 있는 것”이다.

## 3. 디자인 원칙

### 공식성

국가기술자격, ISMS-P, CPPG, 개인정보 영향평가 등 공식 기준과 출제기준을 학습 구조의 중심에 둔다.

- 공식 명칭을 첫 번째 시각 요소로 표시한다.
- 내부 코드, stable key, source type은 보조 정보로 낮춘다.
- 기준일, 출처, 버전 정보를 숨기지 않는다.

### 신뢰성

AI 설명은 항상 검증 가능한 근거와 함께 제공한다.

- AI 답변과 관리자 검수 콘텐츠를 명확히 구분한다.
- AI Trace, Citation, Retrieval Context를 관리자와 고급 사용자에게 추적 가능하게 제공한다.
- “공식 답변”처럼 오인될 수 있는 표현을 피한다.

### 단순성

복잡한 보안 개념도 사용자가 탐색 가능한 작은 단위로 나눈다.

- 한 화면에는 하나의 주요 판단만 남긴다.
- 중첩 카드보다 compact tree, table, split panel을 우선한다.
- 빈 상태, 준비 상태, 오류 상태를 명확하게 분리한다.

### 연결성

문제, 커리큘럼, 온톨로지, 콘텐츠, AI 해설, 오답노트가 단절되지 않게 연결한다.

- 문제에서 관련 CurriculumNode와 Concept로 이동할 수 있어야 한다.
- AI 해설에서 근거 콘텐츠와 공식 기준으로 되돌아갈 수 있어야 한다.
- Coverage 화면에서 누락된 콘텐츠와 문항을 바로 조치할 수 있어야 한다.

### 학습 중심

관리자 기능은 강력해야 하지만, 최종 우선순위는 학습자의 이해와 성취다.

- 관리자 화면은 학습 품질을 높이기 위한 운영 도구로 설계한다.
- 학생 화면은 “다음에 무엇을 해야 하는지”가 항상 분명해야 한다.
- 진행률보다 이해도, 취약 영역, 복습 우선순위를 더 중요하게 보여준다.

### 검증 가능성

학습 콘텐츠와 AI 결과는 “어떤 근거로 만들어졌는지” 추적 가능해야 한다.

- 공식 PDF 페이지, 기준일, 버전, 검수 상태를 노출한다.
- AI Retrieval 결과는 Context Viewer와 Citation Viewer로 확인 가능해야 한다.
- 운영자는 Coverage Gap을 확인하고 보완 액션으로 이어갈 수 있어야 한다.

## 4. 제품 성격

SECURIUM의 UI는 다음 제품들의 장점을 혼합한다.

| 참고 제품 | 가져올 장점 | SECURIUM 적용 |
| --- | --- | --- |
| Linear | 빠른 탐색, 밀도 높은 업무 UI, 명확한 상태 | 관리자 Console, Coverage, Review queue |
| Notion | 구조화된 콘텐츠 읽기, 문서형 학습 | Lesson, 공식 기준 상세, AI Context |
| Vercel Dashboard | 운영 상태, 배포/검증 중심 패널 | 운영 대시보드, Health, Coverage summary |
| Supabase Studio | 데이터 관계 탐색, 테이블/레코드 중심 UX | Ontology, Curriculum, Content mapping |
| Uxcel | 학습 진행감, 카드형 과제, 피드백 | 학생 대시보드, 문제풀이, 복습 |

## 5. 핵심 사용자

### 학습자

- 정보보안기사·산업기사 준비자
- ISMS-P, CPPG, 개인정보 영향평가, ISRM 학습자
- 실무 보안 담당자

핵심 니즈:

- 무엇부터 학습할지 알고 싶다.
- 공식 기준과 문제의 연결을 이해하고 싶다.
- 틀린 문제와 약한 영역을 효율적으로 복습하고 싶다.
- AI 설명을 참고하되 근거를 확인하고 싶다.

### 콘텐츠 관리자

- 커리큘럼, 이론, 문제, 해설을 등록·검수하는 운영자

핵심 니즈:

- 공식 기준 대비 누락 영역을 빠르게 파악하고 싶다.
- 콘텐츠와 문제가 어떤 과정·노드·개념에 연결됐는지 보고 싶다.
- AI 결과를 검수하고 검수본으로 승격하고 싶다.

### 플랫폼 관리자

- 권한, 감사로그, 배포, 운영 상태를 관리하는 관리자

핵심 니즈:

- 위험한 작업과 일반 작업을 구분하고 싶다.
- 감사로그와 운영 상태를 빠르게 확인하고 싶다.
- Production 데이터 변경 전 영향 범위를 알고 싶다.

## 6. Sprint 산출물

이번 디자인 Sprint는 다음 문서로 나눈다.

- `docs/design/product-design-sprint.md`: 제품 철학과 디자인 원칙
- `docs/design/design-system-direction.md`: 디자인 시스템 방향
- `docs/design/information-architecture.md`: 사이트맵과 Console 구조
- `docs/design/learner-experience-ux.md`: 학습자 경험 설계
- `docs/design/admin-console-ux.md`: 관리자 Console 설계
- `docs/design/screen-inventory.md`: 화면 목록과 구현 우선순위

## 7. 구현 전제

- 기존 App Router, API Route, Repository 구조는 유지한다.
- 기능을 전면 재작성하지 않고 화면 단위로 점진 교체한다.
- 과정명, 과목명, 공식 기준명은 DB와 CurriculumTree 데이터를 기준으로 표시한다.
- Mock 또는 준비 중 기능은 운영 화면에서 실제 기능처럼 보이지 않게 한다.
- `.openai/hosting.json`, Vercel, Supabase 운영 설정은 이 Sprint에서 변경하지 않는다.

## 8. 구현 우선순위

1. 공통 Design System 토큰과 레이아웃 패턴 정리
2. 공개 홈과 과정 탐색 개선
3. 학습 홈과 과정별 학습 개요 개선
4. CurriculumTree compact list와 detail panel 고도화
5. 관리자 Dashboard와 Console shell 정리
6. Ontology Console, AI Trace Console, Coverage Console 개선
7. Analytics와 Review workflow 개선

## 9. 성공 기준

- 학습자는 첫 방문 후 30초 안에 “무엇을 할 수 있는 플랫폼인지” 이해한다.
- 로그인 사용자는 대시보드에서 다음 학습 행동을 즉시 선택할 수 있다.
- 관리자는 공식 기준 대비 콘텐츠·문항·개념 Coverage Gap을 한 화면에서 확인할 수 있다.
- AI 설명은 항상 근거, 출처, 검수 상태와 함께 확인 가능하다.
- 신규 과정 또는 콘텐츠 추가 시 화면 구조를 복사하지 않고 공통 패턴으로 확장 가능하다.
