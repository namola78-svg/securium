# Component Implementation Map

이 문서는 UI-3에서 실제 구현할 컴포넌트를 어떤 순서로 나눌지 정의한다.

## UI-3A: Shell Navigation Components

UI-3A scope is locked in [UI-3A Implementation Scope Lock](./ui-3a-scope-lock.md).

| Component | Type | Reuse Candidate | Candidate File |
| --- | --- | --- | --- |
| ConsoleTopBar | New | CommandPalette, HeaderControls | `components/admin-console-top-bar.tsx` |
| AdminSidebar | Extend | AdminNav | `components/admin-nav.tsx` |
| AccountDrawer | Extend/New | HeaderControls | `components/account-drawer.tsx` |
| EnvironmentBadge | New | StatusBadge | `components/design-system-primitives.tsx` or shell file |
| NotificationTrigger | New | none confirmed | later, optional |

### UI-3A Exit Criteria

- Admin layout still requires server-side admin permission.
- Sidebar active state is visible and accessible.
- Account drawer supports keyboard and logout state.
- Command Palette remains usable.

## UI-3B: Page Structure Components

| Component | Type | Reuse Candidate | Candidate File |
| --- | --- | --- | --- |
| AdminBreadcrumb | New | none confirmed | `components/admin-breadcrumb.tsx` |
| AdminPageHeader | Extend | SectionHeader | `components/admin-page-header.tsx` |
| AdminToolbar | New | page-local filters | `components/admin-toolbar.tsx` |
| MainWorkspace | New | Panel/CSS | `components/admin-workspace.tsx` |

### UI-3B Exit Criteria

- Page Header owns primary CTA.
- Toolbar owns filters/search/view controls.
- Breadcrumb and active sidebar do not conflict.
- Mobile toolbar overflow exists.

## UI-3C: Overlay and Detail Components

| Component | Type | Reuse Candidate | Candidate File |
| --- | --- | --- | --- |
| InspectorPanel | Extend | existing InspectorPanel | `components/design-system-primitives.tsx` |
| Drawer | New | HeaderControls patterns | `components/drawer.tsx` |
| Dialog | New | unknown/page-local | `components/dialog.tsx` |
| ToastLayer | New | unknown | `components/toast.tsx` |
| OverlayProvider | Decide | none confirmed | optional |

### UI-3C Exit Criteria

- Drawer and Dialog have focus trap.
- ESC closes overlay.
- Background scroll locks.
- Focus returns to trigger.
- Reduced motion is respected.

## UI-3D: Data Workspace Components

| Component | Type | Reuse Candidate | Candidate File |
| --- | --- | --- | --- |
| AdminTable | New/Standardize | admin table CSS | `components/admin-table.tsx` |
| CompactTree | New/Standardize | LearnCurriculumPathTree | `components/compact-tree.tsx` |
| ExplorerTree | New | AdminCurriculum/Ontology patterns | `components/explorer-tree.tsx` |
| CoverageMatrix | New | none confirmed | `components/coverage-matrix.tsx` |
| TraceTimeline | New | AI explainability page patterns | `components/trace-timeline.tsx` |

### UI-3D Exit Criteria

- Dashboard pilot passes first.
- Curriculum uses CompactTree after pilot.
- Ontology uses ExplorerTree only after Shell/Inspector are stable.
- AI Trace and Coverage wait until Timeline/Matrix patterns are reviewed.

## Shared State Components

| Component | Type | Reuse Candidate | Rule |
| --- | --- | --- | --- |
| EmptyState | Extend | State UI | must include next action |
| ErrorState | Extend | State UI | safe message + retry |
| PageLoading | Extend | State UI | role status |
| CardSkeleton | Extend/New | State UI / CSS | actual card dimensions |
| TableSkeleton | New | none confirmed | table/list pages |

## Component Dependency Order

```text
Button / Badge / Panel
↓
Top Bar / Sidebar / Account Drawer
↓
Breadcrumb / Page Header / Toolbar
↓
Drawer / Dialog / Inspector
↓
Admin Dashboard Pilot
↓
Admin Table / Compact Tree
↓
Ontology Explorer / AI Trace / Coverage Matrix
```

## Risk Notes

- Tree, Timeline, Matrix components should not be implemented before Dashboard pilot.
- Generic Drawer/Dialog must not break existing mobile header behavior.
- Account Drawer must preserve existing Supabase logout flow.
- Command Palette z-index must not conflict with Dialog/Drawer.
