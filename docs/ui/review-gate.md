# UI-2 Review Gate

Sprint UI-2가 끝난 뒤 곧바로 React 구현으로 넘어가지 않고, SECURIUM의 핵심 화면 구조를 제품 관점에서 먼저 검토하기 위한 게이트입니다.

SECURIUM은 일반 자격증 사이트보다 커리큘럼, 문제, 콘텐츠, 온톨로지, AI 근거 추적, 커버리지 분석이 깊게 연결되는 제품입니다. 따라서 구현 전에 화면 정보 구조와 공통 패턴을 확인해야 이후 재작업 비용을 줄일 수 있습니다.

## Review Goal

핵심 화면 15~20개를 제품 관점에서 검토하고, 이후 구현 Sprint에서 화면을 다시 크게 뜯어고치는 비용을 줄입니다.

## Review Order

1. Console Shell
2. 학생 학습 화면
3. Ontology Explorer
4. AI Explainability Console
5. Component Standard
6. Navigation Pattern
7. Interaction Pattern

## Implementation Rollout Gate

리뷰가 끝나도 전체 관리자 화면을 한 번에 교체하지 않습니다.

권장 구현 순서:

1. Top Bar + Sidebar + Account Drawer
2. Breadcrumb + Page Header + Toolbar
3. Main Workspace + Inspector + Drawer
4. 관리자 Dashboard 한 화면에 시범 적용
5. Curriculum
6. Ontology
7. AI Trace · Coverage

Dashboard에서 Shell을 먼저 검증한 뒤 복잡한 Tree · Inspector 화면으로 확장합니다. 이렇게 하면 인증, 권한, 반응형, 로딩, 오류 상태 회귀 위험을 줄일 수 있습니다.

## Core Screens to Review

### Console Shell

- Admin Dashboard
- Curriculum Console
- Content Mapping
- Coverage Console
- AI Trace
- Ontology Explorer
- Audit Log

### Student

- Home
- Course List
- Course Detail
- Learn Overview
- Lesson
- Question Practice
- Review
- AI Tutor
- Analytics

### Specialized

- AI Explainability Console
- Ontology Explorer
- Coverage Gap Detail
- Concept Inspector

The detailed review package is maintained in [UI-2D Core Screen Review Package](./core-screen-review-package.md).

Use [Core Screen Review Checklist](./core-screen-review-checklist.md) during review.

## Review Checklist

| Check | Description |
| --- | --- |
| Information Priority | 첫 화면에서 가장 중요한 정보가 먼저 보이는가 |
| Primary CTA | 사용자의 다음 행동이 명확한가 |
| Empty State | 데이터가 없을 때 다음 행동을 안내하는가 |
| Loading State | 레이아웃 이동을 줄이는가 |
| Error State | 내부 오류를 숨기고 복구 행동을 제공하는가 |
| Mobile | 360px/390px에서 핵심 CTA가 먼저 보이는가 |
| Accessibility | heading, label, focus, contrast 기준을 만족하는가 |
| Trust | 공식 출처, 기준일, AI 고지가 필요한 곳에 보이는가 |
| Consistency | Console Shell과 Component Standard를 따르는가 |

## Exit Criteria

- 15~20개 핵심 화면의 구조가 리뷰되었다.
- Console Shell 구조가 승인되었다.
- Student Learning Flow가 승인되었다.
- Ontology Explorer와 AI Explainability Console의 정보 공개 범위가 승인되었다.
- UI-3에서 구현할 컴포넌트 우선순위가 확정되었다.
