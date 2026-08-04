# Sprint UI-2: Core Wireframe Sprint

Sprint UI-2의 목적은 SECURIUM의 핵심 화면을 구현 전에 텍스트 기반 와이어프레임으로 확정하는 것이다.

Sprint UI-1에서 구축한 Brand Foundation, Design Principles, Design Token, Navigation, Component Library 방향을 기준으로 학생·관리자·AI·Ontology 화면의 정보 우선순위와 상호작용 구조를 정리한다.

## Recommended Priority

SECURIUM은 관리자 Console, 온톨로지, AI Explainability, 커버리지 관리가 서로 강하게 연결되는 제품이다. 따라서 개별 화면보다 공통 골격을 먼저 확정한다.

우선순위:

1. Console Shell
2. 학생 학습 화면
3. Ontology Explorer
4. AI Explainability Console
5. Component Standard
6. Navigation Pattern
7. Interaction Pattern

이 순서는 공통 레이아웃을 먼저 확정해 이후에 설계하는 모든 화면의 일관성을 유지하기 위한 것이다.

## Scope

이번 Sprint의 1차 범위는 학생 핵심 화면이다.

| Area | Target Screens | Status |
| --- | ---: | --- |
| Console Shell | 1 shared shell | Drafted |
| Student Core | 10 | Drafted |
| Ontology Explorer | 1 explorer suite | Drafted |
| AI Console | 1 trace suite | Drafted |
| Component Standard | 16 components | Drafted |
| Navigation Pattern | 7 patterns | Drafted |
| Interaction Pattern | 10 patterns | Drafted |

## Student Core Screens

학생 화면은 “다음 학습 행동을 빠르게 결정하는 것”을 최우선으로 한다.

1. Dashboard
2. My Courses
3. Course Detail
4. Learn Overview
5. Lesson Detail
6. Question Practice
7. Review
8. AI Tutor
9. Analytics

상세 와이어프레임은 [Student Core Wireframes](../design/wireframes/student-core.md)에서 관리한다.

## Wireframe Rules

1. 화면의 첫 번째 정보는 사용자의 현재 맥락이어야 한다.
2. CTA는 하나의 Primary 행동과 제한된 Secondary 행동만 노출한다.
3. 학습 화면에서는 공식 출처, 기준일, AI 여부, 검수 여부를 숨기지 않는다.
4. 빈 상태는 사용자가 다음에 무엇을 해야 하는지 알려준다.
5. 오류 상태는 내부 오류 대신 사용자 언어로 표현한다.
6. 모바일에서는 요약 → CTA → 핵심 콘텐츠 → 보조 정보 순서를 유지한다.
7. 관리자적 메타데이터는 학습자 화면에서 과도하게 노출하지 않는다.

## Component Mapping

| Pattern | Preferred Components |
| --- | --- |
| 화면 제목과 설명 | `SectionHeader` |
| 주요 지표 | `MetricCard` |
| 선택한 학습 개체 상세 | `InspectorPanel` |
| 상태 표시 | `StatusBadge` |
| 빠른 이동 | `CommandPalette` |
| 빈 상태 | `EmptyState` |
| 오류 상태 | `ErrorState` |
| 로딩 상태 | `PageLoading`, `CardSkeleton` |

## Completion Criteria

Sprint UI-2는 다음 조건을 만족하면 완료로 간주한다.

- 학생 핵심 화면 와이어프레임 작성
- 관리자 핵심 화면 와이어프레임 작성
- AI Console 핵심 화면 와이어프레임 작성
- Ontology Console 핵심 화면 와이어프레임 작성
- 각 화면별 Primary CTA와 빈 상태 정의
- 각 화면별 모바일 우선순위 정의
- 이후 구현 Sprint에서 사용할 컴포넌트 매핑 정의

## Current Status

현재는 `docs/ui` 아래에 Console Shell, Student Core, Admin Core, AI Explainability, Ontology Explorer, Component Standard, Navigation Pattern, Interaction Pattern 초안을 작성했다.

Console Shell 상세 기준은 [Console Shell High-Fidelity Wireframe](../ui/console-shell-wireframe.md)에서 관리한다.

UI-2C 상세 산출물:

- [Console Shell High-Fidelity](../ui/console-shell-high-fidelity.md)
- [Console Shell Layout Spec](../ui/console-shell-layout-spec.md)
- [Console Shell Responsive Spec](../ui/console-shell-responsive.md)
- [Console Shell Screen Examples](../ui/console-shell-screen-examples.md)
- [Console Shell Implementation Plan](../ui/console-shell-implementation-plan.md)

UI-2D 상세 산출물:

- [Core Screen Review Package](../ui/core-screen-review-package.md)
- [Core Screen Review Checklist](../ui/core-screen-review-checklist.md)

UI-2E 상세 산출물:

- [Component Implementation Readiness](../ui/component-implementation-readiness.md)
- [Component Implementation Map](../ui/component-implementation-map.md)

UI-2F 상세 산출물:

- [UI-3A Implementation Scope Lock](../ui/ui-3a-scope-lock.md)
- [UI-3A Implementation Checklist](../ui/ui-3a-implementation-checklist.md)

## Review Gate

바로 React 구현 Sprint로 넘어가지 않는다.

다음 조건을 만족한 뒤 구현으로 이동한다.

1. 핵심 화면 15~20개를 Figma 수준의 정보 구조로 리뷰한다.
2. Console Shell의 Sidebar, Top Bar, Inspector Panel, Toolbar 규칙을 확정한다.
3. 학생 학습 화면의 Home, Course, Curriculum, Lesson, Question, Review, AI Tutor, Analytics 흐름을 확인한다.
4. Ontology Explorer와 AI Explainability Console의 관리자/일반 사용자 표시 범위를 확정한다.
5. Button, Card, Table, Tree, Drawer, Dialog의 우선 구현 범위를 정한다.

이 Review Gate를 통과하면 `UI-3: React Component Implementation Sprint`로 넘어간다.

## UI-3 Rollout Principle

UI-3에서는 전체 관리자 화면을 한 번에 바꾸지 않는다.

권장 순서:

1. Top Bar + Sidebar + Account Drawer
2. Breadcrumb + Page Header + Toolbar
3. Main Workspace + Inspector + Drawer
4. 관리자 Dashboard 시범 적용
5. Curriculum
6. Ontology
7. AI Trace·Coverage

Dashboard에서 Shell을 먼저 검증한 뒤 복잡한 Tree, Inspector, Trace, Coverage 화면으로 확장한다.
