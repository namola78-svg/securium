# SECURIUM Design System Direction

> Current standard: [SECURIUM Design System v2](./design-system-v2.md)
>
> Design System v2 is the product-level source of truth for learner action-first UX, admin Console + Inspector UX, semantic tokens, responsive rules, accessibility, CTA patterns, and terminology. This direction document remains as historical foundation material.

## 1. 목적

Foundation Sprint는 개별 화면을 예쁘게 고치는 작업이 아니라, SECURIUM 전체 화면이 같은 규칙으로 확장되도록 디자인 시스템의 뼈대를 만드는 작업이다.

SECURIUM은 학습 화면, 관리자 Console, AI Trace, Ontology, Coverage, Analytics가 함께 성장하는 제품이다. 화면별 임시 스타일을 계속 늘리기보다 다음 기반을 먼저 통일한다.

- Design token
- Layout primitive
- Button / Card / Badge / Panel
- Loading / Empty / Error state
- Console Shell
- Tree / Table / Inspector Panel pattern
- Accessibility baseline

## 2. 디자인 철학

> 복잡한 보안 지식을 가장 직관적으로 학습할 수 있는 AI 플랫폼

SECURIUM의 UI는 다음 질문에 답해야 한다.

- 이 정보가 공식 기준인지, AI 생성인지, 관리자 검수본인지 바로 구분되는가?
- 사용자가 다음 행동을 쉽게 고를 수 있는가?
- 관리자가 대량의 콘텐츠와 관계 데이터를 빠르게 점검할 수 있는가?
- 상태, 오류, 준비 중, 검수 필요가 같은 방식으로 보이는가?
- 모바일에서도 학습과 관리의 핵심 행동이 유지되는가?

## 3. Token Layer

기존 CSS 변수는 유지하되, 신규 컴포넌트가 공통 의미를 공유하도록 semantic alias를 사용한다.

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

Semantic alias:

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

## 4. Component Layer

### Button

버튼은 기존 class 체계를 유지하면서 의미를 명확히 한다.

- `button-dark`: primary action
- `button-lime`: public CTA
- `button-ghost`: secondary/tertiary action
- `button-disabled`: unavailable action

기준:

- 최소 높이 44px
- 명확한 `focus-visible`
- disabled는 opacity뿐 아니라 cursor와 색상으로도 구분
- 처리 중 상태는 `aria-busy`와 disabled를 함께 사용

### Badge

Badge는 상태와 분류를 짧게 표현한다.

권장 상태:

- Draft
- Review
- Active
- Published
- Archived
- Gap
- Ready
- AI
- Official

색상만으로 구분하지 않고 항상 텍스트를 포함한다.

### Card / Panel

Card는 학습자에게 의미 있는 정보 묶음에 사용한다.

Panel은 관리자 Console에서 작업 단위를 묶는 데 사용한다.

중첩 card가 많아지는 계층 데이터는 compact tree, table, split panel로 표현한다.

### Metric

숫자 요약은 같은 구조를 사용한다.

```text
Label
Value
Description
```

관리자 대시보드, Coverage, Analytics에서 같은 패턴을 재사용한다.

### Inspector Panel

Inspector Panel은 선택한 대상의 상세 정보를 화면 오른쪽 또는 하단에 모아 보여주는 공통 패턴이다.

사용 대상:

- CurriculumNode 상세
- CourseLesson 상세
- Shared Content 상세
- Ontology Concept 상세
- AI Trace 상세
- Coverage Gap 상세

포함 정보:

- 공식 명칭 또는 대표 제목
- 상태 badge
- stable key
- source page
- 연결 콘텐츠
- 연결 문제
- 연결 Concept
- 다음 액션

UI 기준:

- 데스크톱에서는 오른쪽 보조 패널 또는 sticky panel
- 모바일에서는 본문 아래로 자연스럽게 이동
- 반복되는 상태 문구 대신 작은 badge 사용
- 상세 정보는 `dl` 구조로 label/value를 명확히 표시
- 액션 버튼은 하단에 모아 배치

### Command Palette

SECURIUM은 화면과 Console이 빠르게 늘어나므로 전역 Command Palette를 navigation primitive로 둔다.

기준:

- `Ctrl/Cmd + K`로 열기
- 공개, 학습, 관리자, 운영 영역을 같은 검색 인터페이스로 이동
- 실제 존재하는 경로만 등록
- 결과는 제목, 설명, scope badge로 구성
- `↑`, `↓`, `Enter`, `Esc` 키보드 조작 지원
- 모바일에서는 bottom sheet에 가까운 형태로 표시
- 권한이 필요한 경로는 기존 서버 인증/권한 검증에 맡긴다

초기 Command Palette는 화면 이동 중심으로 시작하고, 이후 다음 액션으로 확장한다.

- 콘텐츠 생성
- 검색 대기 필터 열기
- Coverage gap 보기
- 최근 AI Trace 열기
- 특정 CurriculumNode 또는 Concept 검색

## 5. Layout Layer

### Public layout

- Hero
- Value cards
- Course entry
- CTA

### Learner layout

- Today action
- Continue learning
- Weakness / review
- Course progress

### Admin Console layout

```text
Admin Console
├─ Sidebar navigation
├─ Page header
├─ Metric summary
├─ Filter/action bar
├─ Work area
└─ Inspector Panel
```

관리자 화면은 일반 CRUD 페이지가 아니라, 운영자가 판단하고 조치하는 Console처럼 보여야 한다.

## 6. State Layer

공통 상태 컴포넌트는 다음 기준을 따른다.

| 상태 | 기본 문구 |
| --- | --- |
| Loading | 학습 정보를 불러오고 있습니다 |
| Empty | 아직 등록한 과정이 없습니다 |
| Error | 정보를 불러오지 못했습니다 |
| Retry | 다시 시도 |

원칙:

- 로딩 중 레이아웃 이동 최소화
- 빈 상태에는 다음 행동 CTA 제공
- 오류에는 내부 stack trace 노출 금지
- 콘솔 로그에는 민감정보 제외

## 7. Accessibility Layer

최소 기준:

- 주요 버튼 높이 44px 이상
- `:focus-visible` 명확히 표시
- 아이콘 버튼은 `aria-label` 제공
- 메뉴는 `aria-expanded` 반영
- 로딩은 `role="status"`와 `aria-live`
- 오류는 `role="alert"`
- drawer/modal은 ESC 닫기와 focus 관리
- 색상만으로 상태를 구분하지 않음

## 8. Implementation Plan

### Foundation 1

- Semantic CSS token alias 추가
- 관리자 문구 mojibake 복구
- Admin Console shell 시각 기반 정리
- Design System 문서 정리

### Foundation 2

- `StatusBadge`, `MetricCard`, `Panel`, `SectionHeader`, `InspectorPanel` primitive 추가
- Command Palette 추가
- Admin Overview에 Metric + Inspector Panel 패턴 적용
- Curriculum / Ontology / AI Trace 상세 패널을 같은 패턴으로 점진 통합

### Foundation 3

- Loading / Empty / Error 컴포넌트 재정리
- Table / Tree / Split view 기준 확정
- 모바일 drawer와 account menu 패턴 문서화
