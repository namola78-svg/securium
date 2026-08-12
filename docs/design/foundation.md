# SECURIUM Foundation

SECURIUM Foundation 문서는 제품 디자인과 화면 구현의 기준점이다.  
개별 화면을 만들 때마다 다시 판단하지 않도록, 브랜드·원칙·토큰·레이아웃·내비게이션·컴포넌트·IA를 하나의 흐름으로 정리한다.

```text
Brand Foundation
↓
Design Principles
↓
Design Token
↓
Layout System
↓
Navigation
↓
Component Library
↓
Screen Inventory
↓
Admin IA
↓
Student IA
```

## 1. Brand Foundation

### 공식 브랜드

- 한글명: 시큐리움
- 영문명: SECURIUM
- 공식 표기: 시큐리움 | SECURIUM
- 공식 설명: 정보보호·개인정보보호 전문가를 위한 AI 통합 학습 플랫폼

### 제품 정체성

SECURIUM은 단순한 자격증 문제풀이 사이트가 아니다.  
공식 커리큘럼, 이론 콘텐츠, 문제은행, 오답노트, AI 해설, 온톨로지, 학습 분석을 연결하여 정보보호 학습을 구조화하는 플랫폼이다.

### 브랜드 문장

> 복잡한 보안 지식을 가장 직관적으로 학습할 수 있는 AI 플랫폼

### 브랜드가 지켜야 할 감각

- 공식적인데 딱딱하지 않다.
- 기술적으로 깊지만 화면은 단순하다.
- AI를 강조하되 근거와 검수 가능성을 더 중요하게 보여준다.
- 학습자는 다음 행동을 쉽게 고르고, 관리자는 연결 상태를 빠르게 점검할 수 있어야 한다.

## 2. Design Principles

### 2.1 공식성

국가기술자격, ISMS-P, CPPG, 개인정보 영향평가 등 공식 기준과 출제기준을 학습 구조의 중심에 둔다.

화면 기준:

- 공식 명칭을 첫 번째 시각 요소로 표시한다.
- stable key, 내부 코드, source type은 보조 정보로 낮춘다.
- PDF 출처, 기준일, 버전, 검수 상태를 숨기지 않는다.

### 2.2 신뢰성

AI 해설과 추천은 참고 정보이며, 공식 정답·공식 채점·공식 법령 해석처럼 보이면 안 된다.

화면 기준:

- AI 생성 결과와 관리자 검수 콘텐츠를 명확히 분리한다.
- AI Trace, Citation, Retrieval Context를 확인할 수 있어야 한다.
- 근거가 부족한 경우 “근거 부족” 상태를 명확히 표시한다.

### 2.3 단순성

보안 지식은 복잡하지만 화면은 복잡하면 안 된다.

화면 기준:

- 한 화면의 주요 판단은 하나로 제한한다.
- 깊은 계층은 중첩 카드보다 compact tree, table, split view를 우선한다.
- 반복 문구는 badge, meta row, inspector panel로 압축한다.

### 2.4 연결성

SECURIUM의 핵심 가치는 연결이다.

연결 대상:

- 문제 ↔ 커리큘럼 노드
- 이론 ↔ 문제
- 문제 ↔ 오답노트
- 콘텐츠 ↔ 온톨로지 개념
- AI 해설 ↔ 근거 콘텐츠
- Coverage Gap ↔ 보강 액션

화면 기준:

- 사용자가 어디서든 관련 공식 기준, 문제, 콘텐츠, 개념으로 이동할 수 있어야 한다.
- 관리자 화면은 연결 누락을 즉시 발견하고 조치할 수 있어야 한다.

### 2.5 학습 중심

관리자 기능은 강력해야 하지만 제품의 최종 목적은 학습자의 이해와 성장이다.

화면 기준:

- 학습자 화면은 “오늘 무엇을 하면 되는가”를 가장 먼저 보여준다.
- 진도율보다 취약 영역, 복습 우선순위, 다음 추천 학습을 더 의미 있게 보여준다.
- 준비 중인 기능은 실제 기능처럼 보이지 않게 표시한다.

## 3. Design Token

### 3.1 Core Token

기존 CSS 변수는 유지하되 신규 화면은 의미 기반 alias를 함께 사용한다.

| Token | 역할 |
| --- | --- |
| `--ink` | 기본 텍스트 |
| `--ink-soft` | 보조 텍스트 |
| `--paper` | 기본 배경 |
| `--white` | 카드/패널 배경 |
| `--line` | 경계선 |
| `--muted` | 설명/메타 텍스트 |
| `--lime` | 브랜드 primary |
| `--aqua` | 정보/AI 보조 |
| `--danger` | 위험/오류 |

### 3.2 Semantic Token

| Alias | 의미 |
| --- | --- |
| `--text` | 본문 텍스트 |
| `--text-muted` | 보조 텍스트 |
| `--surface` | 카드 표면 |
| `--surface-soft` | 약한 강조 배경 |
| `--surface-dark` | 다크 패널 |
| `--accent` | 브랜드 액션 |
| `--accent-strong` | hover/focus accent |
| `--success` | 완료/승인 |
| `--warning` | 검토/주의 |
| `--error` | 실패/반려 |

### 3.3 상태 색상 원칙

- 성공: 완료, 활성, 게시, 승인
- 경고: 검토 필요, 근거 부족, 커버리지 부족
- 오류: 실패, 반려, 접근 불가
- 정보: AI, 운영 상태, 읽기 전용 정보
- 브랜드: 주요 CTA, 현재 위치, 선택 상태

색상만으로 상태를 구분하지 않고 반드시 텍스트를 함께 제공한다.

## 4. Layout System

### 4.1 Public Layout

대상:

- 랜딩페이지
- 과정 목록
- 과정 상세
- 학습 가이드
- 소개 페이지

구조:

```text
Header
Hero
Primary CTA
Value / Feature Section
Course Entry
Footer
```

원칙:

- 모바일에서는 제목과 CTA가 가장 먼저 보여야 한다.
- Hero는 제품 가치를 설명하고, 기능 목록으로 과도하게 늘리지 않는다.
- 공개 화면에서는 내부 개발 상태를 노출하지 않는다.

### 4.2 Learner Layout

대상:

- 대시보드
- 내 과정
- 학습 화면
- 문제풀이
- 오답노트
- 오늘의 복습
- AI 튜터
- 학습 분석

구조:

```text
Learner Header
Today Action
Continue Learning
Weakness / Review
Course Progress
Recommended Next Step
```

원칙:

- “다음에 무엇을 해야 하는가”가 화면 첫 부분에서 보여야 한다.
- 과정별 진도는 절대 섞이지 않아야 한다.
- 정보보안기사와 정보보안산업기사는 동일 그룹에 있어도 진도와 통계는 분리한다.

### 4.3 Admin Console Layout

대상:

- 관리자 대시보드
- 커리큘럼 Console
- 공통 콘텐츠 관리
- Ontology Console
- AI Trace Console
- Coverage Console
- 감사로그

구조:

```text
Admin Shell
├─ Sidebar
├─ Page Header
├─ Metric Summary
├─ Filter / Action Bar
├─ Work Area
└─ Inspector Panel
```

원칙:

- CRUD 목록이 아니라 운영 Console처럼 보이게 한다.
- 대량의 관계 데이터를 다루는 화면은 split view를 우선한다.
- 선택한 대상의 상세 정보는 Inspector Panel에서 일관되게 보여준다.

## 5. Navigation

### 5.1 공개 사용자

표시 메뉴:

- 과정
- 학습 가이드
- 시큐리움 소개
- 로그인
- 무료로 시작하기

### 5.2 로그인 사용자

표시 메뉴:

- 내 학습
- 문제풀이
- 오답노트
- AI 튜터
- 프로필 메뉴

프로필 메뉴:

- 프로필
- 학습 설정
- 관리자 화면: 관리자 권한이 있는 경우에만 표시
- 로그아웃

### 5.3 관리자

관리자는 학습자 내비게이션과 관리자 내비게이션이 섞이지 않도록 Admin Shell 안에서 전용 사이드바를 사용한다.

주요 관리자 메뉴:

- 운영 개요
- 과정군
- 과정
- 커리큘럼
- 공통 콘텐츠
- 이론 레슨
- 버전 관리
- 문제은행
- 문제 검수
- AI 검수
- AI Trace
- 모의고사
- 학습 분석
- 온톨로지
- 감사로그

### 5.4 Command Palette

Command Palette는 빠른 이동과 검색 기반 운영을 위한 전역 내비게이션이다.

기준:

- `Ctrl/Cmd + K`로 열기
- 공개, 학습, 관리자, 운영 영역을 함께 검색
- 실제 존재하는 경로만 등록
- 키보드 조작 지원
- 권한 검증은 기존 서버 인증/RBAC에 맡긴다.

## 6. Component Library

상세 컴포넌트 규격은 `docs/design/component-library.md`에서 관리한다.
상호작용 패턴의 선택 기준은 `docs/design/interaction-pattern-decisions.md`에서 관리한다.

Foundation 기준 핵심 컴포넌트는 다음 10개다.

```text
Button
Card
Table
Badge
Tree
Dialog
Drawer
Search
Toast
Tabs
```

### 6.1 현재 Foundation Primitive

현재 추가된 공통 primitive:

- `StatusBadge`
- `MetricCard`
- `Panel`
- `SectionHeader`
- `InspectorPanel`
- `CommandPalette`

### 6.2 Button

기준:

- 최소 높이 44px
- 명확한 focus-visible
- 처리 중 disabled
- 중복 클릭 방지
- 모바일 터치 영역 확보

### 6.3 StatusBadge

용도:

- Published
- Draft
- Review
- Active
- Archived
- Gap
- Ready
- AI
- Official

### 6.4 MetricCard

용도:

- 운영 요약
- 학습 분석
- 커버리지 현황
- AI Trace 통계

구조:

```text
Label
Value
Description
```

### 6.5 InspectorPanel

용도:

- 선택한 커리큘럼 노드 상세
- 선택한 콘텐츠 상세
- 선택한 온톨로지 개념 상세
- 선택한 AI Trace 상세
- 선택한 Coverage Gap 상세

포함 영역:

- 제목
- 상태 badge
- 메타 정보
- 설명
- 관련 액션

### 6.6 State UI

공통 상태:

- Loading
- Empty
- Error
- Retry

권장 문구:

- 로딩: 학습 정보를 불러오고 있습니다
- 빈 상태: 아직 등록한 과정이 없습니다
- 오류: 정보를 불러오지 못했습니다
- 버튼: 다시 시도

Implementation details:

- `PageLoading`: status role + polite aria-live + skeleton placeholders.
- `EmptyState`: title/description + action button row.
- `ErrorState`: alert role + optional retry CTA.
- `InlineError`: lightweight inline alert row.
- `RetryButton`: callback 기반 재시도, 미지정 시 reload.

Style 규칙:

- 공통 상태 블록은 `app/globals.css`의 `state-card`, `state-icon`, `card-skeleton`, `state-actions` 계열 클래스를 사용.
- `error-state-panel`은 경고 대비 색상, `state-loading`은 spin/placeholder 최소 동작을 유지한다.
- 모든 액션 CTA는 `ActionButton`으로 통일.

## 7. Screen Inventory

화면은 다음 기준으로 분류한다.

상세 설계 대상은 `docs/design/screen-inventory.md`에서 관리한다. 현재 기준 수량은 학생 화면 15개, 관리자 화면 20개, AI 화면 10개, Ontology 화면 15개, 총 60개다.

### 공개 화면

- `/`
- `/courses`
- `/courses/[courseSlug]`
- `/guide`
- `/about`
- `/login`
- `/signup`

### 학습자 화면

- `/dashboard`
- `/my-courses`
- `/learn/[courseSlug]`
- `/learn/[courseSlug]/course-lessons/[courseLessonId]`
- `/practice`
- `/practice/[courseSlug]`
- `/wrong-notes`
- `/reviews`
- `/mock-exams`
- `/analytics`
- `/ai-tutor`
- `/bookmarks`
- `/profile`
- `/settings`

### 관리자 화면

- `/admin`
- `/admin/courses`
- `/admin/course-groups`
- `/admin/curriculum`
- `/admin/shared-content`
- `/admin/lessons`
- `/admin/questions`
- `/admin/question-reports`
- `/admin/mock-exams`
- `/admin/ontology`
- `/admin/ai-explainability`
- `/admin/ai-reviews`
- `/admin/analytics`
- `/admin/content-revisions`
- `/admin/audit-logs`
- `/admin/practical-specializations`

### 운영 화면

- `/ops/health`
- `/ops/dashboard-performance`

## 8. Admin IA

관리자 IA는 일반적인 “목록 → 등록 → 수정” 구조를 넘어, 관계와 커버리지를 판단하는 Console 구조를 따른다.

학생/관리자 도메인별 화면 묶음은 `docs/design/domain-screen-map.md`에서 관리한다.

### 핵심 Console

| Console | 목적 |
| --- | --- |
| Operations Dashboard | 전체 운영 상태와 우선 액션 |
| Curriculum Console | 공식 출제기준 tree, node, mapping |
| Content Console | lesson, shared content, revision |
| Question Console | 문제 작성, 검수, 게시, 신고 |
| Ontology Console | concept, alias, relation, cross-course mapping |
| AI Trace Console | retrieval, prompt, citation, feedback |
| Coverage Console | curriculum-node별 content/question/concept coverage |
| Analytics Console | 학습, 문제, 오답, AI, coverage 분석 |
| Audit Console | 중요 작업 감사로그 |

### 관리자 화면의 기본 패턴

```text
Header
Metric Summary
Filter
Primary Work Area
Inspector Panel
Action Queue
```

## 9. Student IA

학습자 IA는 “많은 기능”보다 “다음 학습 행동”을 중심에 둔다.

### 핵심 흐름

```text
로그인
→ 내 학습 대시보드
→ 오늘의 학습
→ 이론 학습
→ 문제풀이
→ 자동 채점
→ 해설 확인
→ 오답노트
→ 복습
→ 학습 분석
```

### 학습자 화면의 기본 패턴

```text
Current Course Context
Today Action
Continue Learning
Weakness / Review
Recommended Next
Progress Evidence
```

### 학습자에게 우선 노출할 정보

1. 오늘 해야 할 학습
2. 이어서 볼 콘텐츠
3. 복습해야 할 오답
4. 취약한 주제
5. 추천 문제
6. 과정별 진행률
7. AI 설명과 근거

## 10. Foundation 적용 원칙

앞으로 화면을 수정하거나 새 기능을 만들 때 다음 순서를 따른다.

1. 해당 화면이 Public / Learner / Admin / Ops 중 어디에 속하는지 확인한다.
2. 필요한 layout pattern을 고른다.
3. 기존 primitive를 먼저 사용한다.
4. 새로운 컴포넌트가 필요하면 Foundation 문서에 역할을 정의한다.
5. 실제 존재하지 않는 기능은 링크하지 않는다.
6. 준비 중 기능은 실제 기능처럼 보이지 않게 표시한다.
7. AI 결과는 항상 근거와 고지를 포함한다.
8. 과정명, 과목명, 공식 기준명은 가능한 데이터에서 가져온다.
9. 모바일과 키보드 접근성을 함께 확인한다.
10. typecheck, lint, build를 통과한 뒤 다음 화면으로 넘어간다.

## 11. 다음 Foundation 작업

우선순위:

1. Table primitive
2. Tree primitive
3. Split View primitive
4. Loading / Empty / Error primitive 재정리
5. Admin Console의 InspectorPanel 통합
6. Learner Dashboard IA 정리
7. AI Trace / Ontology 화면의 정보 구조 통일
