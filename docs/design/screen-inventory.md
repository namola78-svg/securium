# SECURIUM Screen Inventory

이 문서는 SECURIUM UI/UX Foundation 이후 상세 화면 설계에 사용할 화면 목록이다.  
범위는 학생 화면 15개, 관리자 화면 20개, AI 화면 10개, Ontology 화면 15개로 나눈다.

상태 기준:

- `Core`: 제품 핵심 경험
- `Console`: 관리자 운영 핵심
- `Support`: 보조 화면
- `Advanced`: 고급 기능 또는 후속 확장

우선순위 기준:

- `P0`: 다음 UI/UX Sprint에서 반드시 설계
- `P1`: 핵심 흐름 이후 바로 설계
- `P2`: 구조는 잡되 후속 고도화

## 1. 학생 화면 15개

| No | 화면 | 경로 | 상태 | 우선순위 | 설계 목적 |
| --- | --- | --- | --- | --- | --- |
| S01 | 랜딩 | `/` | Core | P0 | SECURIUM 가치와 무료 학습 시작 CTA 전달 |
| S02 | 과정 목록 | `/courses` | Core | P0 | 7개 과정을 비교하고 탐색 |
| S03 | 과정 상세 | `/courses/[courseSlug]` | Core | P0 | 수강 판단에 필요한 정보와 CTA 제공 |
| S04 | 로그인 | `/login` | Core | P0 | Google/이메일 로그인과 안전한 redirect 처리 |
| S05 | 회원가입 | `/signup` | Core | P1 | 신규 학습자 가입 |
| S06 | 내 학습 대시보드 | `/dashboard` | Core | P0 | 오늘의 학습, 복습, 진행률 요약 |
| S07 | 내 과정 | `/my-courses` | Core | P0 | 수강 중인 과정과 과정별 상태 관리 |
| S08 | 과정 학습 개요 | `/learn/[courseSlug]` | Core | P0 | 공식 커리큘럼 기반 학습 허브 |
| S09 | CourseLesson 상세 | `/learn/[courseSlug]/course-lessons/[courseLessonId]` | Core | P1 | 공통 콘텐츠 기반 이론 학습 |
| S10 | 문제풀이 홈 | `/practice` | Core | P1 | 과정별 문제풀이 진입 |
| S11 | 과정별 문제풀이 | `/practice/[courseSlug]` | Core | P1 | 문제 풀이, 채점, 해설 확인 |
| S12 | 오답노트 | `/wrong-notes` | Core | P1 | 반복 오답과 미숙지 문제 복습 |
| S13 | 오늘의 복습 | `/reviews` | Core | P1 | 스마트 복습 대상과 연체 복습 확인 |
| S14 | 학습 분석 | `/analytics` | Core | P1 | 통합·과정별 학습 성과 확인 |
| S15 | 프로필/학습 설정 | `/profile`, `/settings` | Support | P2 | 계정 정보와 목표 학습량 설정 |

학생 화면 설계 원칙:

- 첫 화면에서 다음 학습 행동이 보여야 한다.
- 과정별 진도와 통계가 섞이지 않아야 한다.
- 공식 커리큘럼, 문제, AI 해설, 오답노트가 자연스럽게 연결되어야 한다.
- 모바일에서는 CTA와 이어학습이 우선 노출되어야 한다.

## 2. 관리자 화면 20개

| No | 화면 | 경로 | 상태 | 우선순위 | 설계 목적 |
| --- | --- | --- | --- | --- | --- |
| A01 | 관리자 운영 대시보드 | `/admin` | Console | P0 | 전체 운영 현황과 우선 조치 요약 |
| A02 | 과정군 관리 | `/admin/course-groups` | Console | P1 | 과정 그룹 생성·수정·활성화 |
| A03 | 과정 관리 | `/admin/courses` | Console | P1 | 과정 등록, 공개, 정렬, 상태 관리 |
| A04 | 과정 상세 관리 | `/admin/courses/[courseId]` | Console | P1 | 과정별 세부 설정 |
| A05 | 과목 관리 | `/admin/courses/[courseId]/subjects` | Console | P1 | 과정별 과목 구조 관리 |
| A06 | 주제 관리 | `/admin/subjects/[subjectId]/topics` | Console | P1 | 과목별 주제 구조 관리 |
| A07 | 커리큘럼 Console | `/admin/curriculum` | Console | P0 | 공식 출제기준 tree, node, coverage 관리 |
| A08 | 공통 콘텐츠 관리 | `/admin/shared-content` | Console | P0 | CourseLesson 연결과 공유 콘텐츠 운영 |
| A09 | 이론 레슨 관리 | `/admin/lessons` | Console | P1 | Lesson 작성, 공개, preview |
| A10 | 레슨 미리보기 | `/admin/lessons/[lessonId]/preview` | Support | P2 | 학습자 노출 전 콘텐츠 검수 |
| A11 | 문제은행 | `/admin/questions` | Console | P1 | 문제 검색, 필터, 상태 관리 |
| A12 | 문제 등록 | `/admin/questions/new` | Console | P1 | 신규 문제 작성 |
| A13 | 문제 상세/검수 | `/admin/questions/[questionId]` | Console | P1 | 문제 수정, 승인, 반려, 게시 |
| A14 | 문제 신고 관리 | `/admin/question-reports` | Console | P1 | 사용자 신고 검토와 처리 |
| A15 | 모의고사 관리 | `/admin/mock-exams` | Console | P2 | 모의고사 등록, 섹션, 공개 관리 |
| A16 | 모의고사 상세 | `/admin/mock-exams/[mockExamId]` | Console | P2 | 응시 현황과 문제 구성 관리 |
| A17 | 콘텐츠 버전 관리 | `/admin/content-revisions` | Console | P1 | 새 버전 초안, 게시, 보관 |
| A18 | 학습 분석 운영 | `/admin/analytics` | Console | P1 | 과정·문제·복습·커버리지 분석 |
| A19 | 감사로그 | `/admin/audit-logs` | Console | P1 | 중요 관리자 작업 추적 |
| A20 | 실무형/특화 콘텐츠 | `/admin/practical-specializations`, `/admin/specialized` | Advanced | P2 | SW 보안약점, PIA, ISMS-P 등 특화 관리 |

관리자 화면 설계 원칙:

- CRUD 페이지보다 운영 Console처럼 구성한다.
- Metric Summary, Filter Bar, Work Area, Inspector Panel을 기본 패턴으로 사용한다.
- 대량 관계 데이터는 table + split view + inspector 패턴을 우선한다.
- 위험 작업은 상태와 영향 범위를 명확히 보여준다.

## 3. AI 화면 10개

| No | 화면 | 경로 | 상태 | 우선순위 | 설계 목적 |
| --- | --- | --- | --- | --- | --- |
| AI01 | AI 튜터 홈 | `/ai-tutor` | Core | P1 | 학습자가 AI 설명과 추천을 시작 |
| AI02 | 문제 AI 해설 | `/practice/[courseSlug]` 내부 | Core | P1 | 문제 의도, 정답 이유, 오답 이유, 근거 표시 |
| AI03 | 서술형 보조채점 | 문제풀이/특화 화면 내부 | Advanced | P2 | 공식 점수와 분리된 참고 채점 |
| AI04 | 보안약점 코드 설명 | `/practical/[courseSlug]/code/[sampleId]` | Advanced | P2 | CWE, 취약 라인, 조치방안 설명 |
| AI05 | ISRM 위험 시나리오 검토 | 특화 화면 내부 | Advanced | P2 | 자산·위협·취약점·처리방안 검토 |
| AI06 | 개인정보 영향평가 검토 | 특화 화면 내부 | Advanced | P2 | 평가항목, 흐름, 개선방안 검토 |
| AI07 | AI Explainability Console | `/admin/ai-explainability` | Console | P0 | Trace, Retrieval, Prompt, Citation 확인 |
| AI08 | AI 검수 Queue | `/admin/ai-reviews` | Console | P1 | AI 원본과 검수본 분리, 승인/반려 |
| AI09 | Retrieval Context Viewer | AI Console 내부 | Console | P1 | 근거 콘텐츠와 sourceContextIds 확인 |
| AI10 | AI Feedback / Cost Panel | AI Console 내부 | Console | P2 | 사용자 피드백, token, latency, cost 추적 |

AI 화면 설계 원칙:

- AI 결과는 항상 참고용 고지를 포함한다.
- 관리자 검수본과 AI 원본을 분리한다.
- 근거 콘텐츠가 부족하면 확정적 설명처럼 보이지 않게 한다.
- Prompt, Context, Citation은 관리자와 고급 사용자에게 추적 가능해야 한다.

## 4. Ontology 화면 15개

| No | 화면 | 경로 | 상태 | 우선순위 | 설계 목적 |
| --- | --- | --- | --- | --- | --- |
| O01 | Ontology Console 홈 | `/admin/ontology` | Console | P0 | 전체 concept/alias/edge 상태 요약 |
| O02 | Concept 목록 | `/admin/ontology` 내부 | Console | P0 | 개념 검색, 필터, 검수 상태 확인 |
| O03 | Concept 상세 Inspector | `/admin/ontology` 내부 | Console | P0 | 정의, 연결, 상태, 액션 확인 |
| O04 | Alias 관리 | `/admin/ontology` 내부 | Console | P1 | 별칭, 동의어, 한글/영문 표현 관리 |
| O05 | Synonym 관리 | `/admin/ontology` 내부 | Console | P1 | 검색 확장을 위한 유의어 관리 |
| O06 | Parent/Child Tree | `/admin/ontology` 내부 | Console | P1 | 상하위 개념 계층 탐색 |
| O07 | Related Concept Graph | `/admin/ontology` 내부 | Advanced | P2 | 연관 개념 관계 시각화 |
| O08 | Cross-Course Mapping | `/admin/ontology` 내부 | Console | P1 | 여러 과정 간 공통 개념 매핑 |
| O09 | CurriculumNode Mapping | `/admin/curriculum` 연계 | Console | P0 | 공식 커리큘럼 노드와 개념 연결 |
| O10 | Question Mapping | `/admin/questions/[questionId]` 연계 | Console | P1 | 문제와 개념 연결 |
| O11 | Content Mapping | `/admin/shared-content` 연계 | Console | P1 | 콘텐츠와 개념 연결 |
| O12 | Ontology Coverage | `/admin/analytics` 또는 별도 Console | Console | P1 | 과정별 개념 커버리지 점검 |
| O13 | Gap Action Queue | Ontology/Coverage 내부 | Console | P1 | 누락 개념, 약한 연결, 보강 액션 |
| O14 | Ontology 기반 Retrieval Trace | AI Console 연계 | Advanced | P2 | AI 검색이 사용한 개념 경로 추적 |
| O15 | Ontology Change Review | Ontology Console 내부 | Advanced | P2 | 개념 변경 이력과 영향 범위 검토 |

Ontology 화면 설계 원칙:

- 개념명과 공식 용어를 첫 번째 시각 요소로 둔다.
- stable key와 내부 타입은 보조 텍스트로 낮춘다.
- Concept, CurriculumNode, Content, Question, AI Trace가 연결되어야 한다.
- Graph는 보조 시각화이며, table/tree/inspector가 기본 조작 모델이다.

## 5. 총 화면 수

| 영역 | 수량 |
| --- | ---: |
| 학생 화면 | 15 |
| 관리자 화면 | 20 |
| AI 화면 | 10 |
| Ontology 화면 | 15 |
| 합계 | 60 |

## 6. Figma 수준 설계 우선순위

### UX Sprint 1: Foundation

- Brand Foundation
- Design Principles
- Design Token
- Layout System
- Navigation
- Component Library
- Screen Inventory

### UX Sprint 2: Student Core

- S01 랜딩
- S02 과정 목록
- S03 과정 상세
- S04 로그인
- S06 내 학습 대시보드
- S07 내 과정
- S08 과정 학습 개요

### UX Sprint 3: Admin Core

- A01 관리자 운영 대시보드
- A07 커리큘럼 Console
- A08 공통 콘텐츠 관리
- A11 문제은행
- A17 콘텐츠 버전 관리
- A18 학습 분석 운영

### UX Sprint 4: AI + Ontology Core

- AI07 AI Explainability Console
- AI08 AI 검수 Queue
- O01 Ontology Console 홈
- O02 Concept 목록
- O03 Concept 상세 Inspector
- O09 CurriculumNode Mapping
- O12 Ontology Coverage

### UX Sprint 5: Advanced Workflows

- 모의고사 운영
- 특화 콘텐츠 운영
- 보안약점 코드 설명
- 위험 시나리오 검토
- 개인정보 영향평가 검토
- Ontology graph / change review

## 7. 화면 설계 체크리스트

각 화면은 설계 단계에서 다음 항목을 확인한다.

- 화면 목적이 한 문장으로 설명되는가?
- 첫 번째 시각 요소가 사용자에게 가장 중요한 정보인가?
- 기본/빈/로딩/오류 상태가 있는가?
- 모바일 360px에서 핵심 CTA가 보이는가?
- 키보드만으로 주요 조작이 가능한가?
- 공식 기준, AI 결과, 관리자 검수본이 구분되는가?
- 권한이 필요한 액션이 UI 숨김이 아니라 서버 검증과 연결되어 있는가?
- 과정별 데이터 분리가 화면에서도 드러나는가?
- 준비 중 기능이 실제 기능처럼 보이지 않는가?
- Inspector Panel 또는 Command Palette 등 기존 primitive를 재사용했는가?
