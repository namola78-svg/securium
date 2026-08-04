# UI-2E Component Implementation Readiness

UI-2E의 목적은 React 구현 Sprint 전에 SECURIUM 공통 컴포넌트를 재사용, 확장, 신규 구현 대상으로 분리하는 것이다.

이번 문서는 설계 산출물이며 Production DB, Preview DB, Seed, Migration, Secret, API, Repository, 비즈니스 로직, 배포를 변경하지 않는다.

## Current Component Inventory

확인된 주요 컴포넌트:

| Component | File | Current Use |
| --- | --- | --- |
| AdminNav | `components/admin-nav.tsx` | 관리자 sidebar navigation |
| CommandPalette | `components/command-palette.tsx` | 전역 빠른 이동 |
| StatusBadge | `components/design-system-primitives.tsx` | 상태 badge |
| MetricCard | `components/design-system-primitives.tsx` | 지표 card |
| Panel | `components/design-system-primitives.tsx` | 관리자 panel surface |
| SectionHeader | `components/design-system-primitives.tsx` | page/section header |
| InspectorPanel | `components/design-system-primitives.tsx` | 선택 리소스 상세 |
| State UI | `components/state-ui.tsx` | loading/empty/error 계열 |
| HeaderControls | `components/header-controls.tsx` | header/account/mobile controls |
| SiteHeader / SiteNav | `components/site-header.tsx`, `components/site-nav.tsx` | 공개/공통 navigation |
| CourseCard | `components/course-card.tsx` | 과정 card |
| LearnCurriculumPathTree | `components/learn-curriculum-path-tree.tsx` | 학습자 curriculum tree |
| AdminCurriculumManager | `components/admin-curriculum-manager.tsx` | 관리자 curriculum 관리 |
| PracticeSession | `components/practice-session.tsx` | 문제풀이 |
| SafeLessonContent | `components/safe-lesson-content.tsx` | 이론 본문 렌더링 |

## Readiness Categories

| Category | Meaning |
| --- | --- |
| Reuse | 현재 컴포넌트를 그대로 사용 가능 |
| Extend | 현재 컴포넌트를 API/스타일만 확장 |
| Standardize | 여러 구현을 하나의 표준으로 정리 |
| New | 신규 공통 컴포넌트 필요 |
| Decide | 구현 전 제품/UX 결정 필요 |

## Component Readiness Matrix

| Component | Category | Existing Candidate | Needed Work | Accessibility Requirement | Priority |
| --- | --- | --- | --- | --- | --- |
| Button | Standardize | existing `.button` styles | Primary/Secondary/Danger/Ghost/Icon/FAB API 확정 | 44px target, focus-visible, disabled state | P0 |
| Card | Standardize | CourseCard, Panel | comparison card와 dense admin panel 구분 | heading structure, clickable card semantics | P0 |
| Badge | Extend | StatusBadge | tone/size/icon/count API 확정 | color + text, not color-only | P0 |
| Table | New/Standardize | admin table CSS classes | AdminTable primitive, sorting/filter/pagination slots | semantic table, keyboard row action | P0 |
| Tree | New/Standardize | LearnCurriculumPathTree, AdminCurriculumManager | CompactTree, ExplorerTree, OntologyTree 분리 | aria-expanded, keyboard navigation | P0 |
| Drawer | New | HeaderControls mobile drawer patterns | generic Drawer primitive | focus trap, ESC close, scroll lock | P0 |
| Dialog | New/Standardize | existing unknown/page-local | ConfirmDialog, DestructiveDialog | role dialog, labelled title, focus return | P0 |
| Tabs | Decide | existing/page-local unknown | tabs vs section navigation 기준 확정 | roving tabindex or native buttons | P1 |
| Search | Extend | CommandPalette, page inputs | SearchField, GlobalSearch, PageSearch 구분 | label, clear button, keyboard | P0 |
| Filter | New/Standardize | page-local filters | FilterBar and FilterChip | screen-reader active filter count | P0 |
| Toast | New/Standardize | current unknown | ToastLayer, ToastItem | aria-live polite/assertive policy | P1 |
| Pagination | New/Standardize | page-local unknown | Pagination primitive | nav label, current page state | P1 |
| Empty State | Reuse/Extend | State UI | EmptyState variants | heading + next action | P0 |
| Loading Skeleton | Reuse/Extend | State UI / CSS | PageLoading, CardSkeleton, TableSkeleton | role status, reduced motion | P0 |
| Error State | Reuse/Extend | State UI | ErrorState variants | retry button, safe message | P0 |
| Inspector Panel | Extend | InspectorPanel | responsive drawer mode, copy rows, action slots | complementary landmark, heading | P0 |
| Command Palette | Extend | CommandPalette | Top Bar trigger, permission-aware commands | combobox/listbox pattern review | P1 |
| Breadcrumb | New | page-local possible | AdminBreadcrumb primitive | nav label, compressed mobile form | P0 |
| Toolbar | New | page-local filters | AdminToolbar primitive | grouping, overflow menu | P0 |
| Account Drawer | Extend/New | HeaderControls | admin account drawer variant | focus trap, sign-out state | P0 |

## P0 Implementation Candidates

UI-3A/3B 전에 우선 정의해야 하는 컴포넌트:

1. Button variants
2. StatusBadge API
3. AdminBreadcrumb
4. AdminToolbar
5. Drawer
6. Dialog
7. InspectorPanel responsive behavior
8. AdminTable
9. CompactTree / ExplorerTree split
10. Empty / Loading / Error state variants

## Reuse First Policy

새 컴포넌트를 만들기 전 다음을 확인한다.

1. 기존 컴포넌트가 같은 책임을 이미 수행하는가?
2. CSS class만 표준화하면 재사용 가능한가?
3. API를 작게 확장하면 해결되는가?
4. 같은 UI가 학생/관리자에서 서로 다른 이름으로 중복 구현되어 있는가?
5. 접근성 요구를 기존 컴포넌트가 만족하는가?

## Do Not Implement Yet

아직 구현하지 않는다.

- Production DB 변경
- Preview DB 변경
- Seed 변경
- Migration 실행
- Secret 변경
- Vercel 배포
- API 변경
- Repository 변경
- 비즈니스 로직 변경

## Readiness Verdict

**CONDITIONAL GO**

컴포넌트 구현 Sprint로 갈 수 있지만, 전체 컴포넌트를 한 번에 구현하지 않는다.

권장 시작 범위:

1. Button / Badge / Panel API 정리
2. AdminBreadcrumb
3. AdminToolbar
4. Drawer / Dialog foundation
5. Dashboard pilot 적용

