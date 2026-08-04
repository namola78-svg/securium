# Console Shell High-Fidelity Wireframe

UI-2C 산출물이다. 이 문서는 SECURIUM 관리자 화면의 공통 골격을 실제 구현자가 그대로 사용할 수 있는 수준으로 구체화한다.

이번 단계는 설계 문서 작업이며 Production DB, Preview DB, Seed, Migration, Secret, API, Repository, 비즈니스 로직, 배포를 변경하지 않는다.

## 0. Current Structure Analysis

### Confirmed Code

| Area | Current File | Current State |
| --- | --- | --- |
| Admin root layout | `app/admin/layout.tsx` | `admin-shell` 안에 sidebar와 content를 배치 |
| Sidebar navigation | `components/admin-nav.tsx` | 단일 `adminNavigation` 배열 기반 링크 목록 |
| Inspector primitive | `components/design-system-primitives.tsx` | `InspectorPanel`, `SectionHeader`, `MetricCard`, `StatusBadge` 존재 |
| Admin overview | `app/admin/page.tsx` | Foundation 스타일 일부 적용 |
| CSS tokens / shell styles | `app/globals.css` | `admin-shell`, `admin-layout`, `admin-sidebar`, `admin-content`, `ds-inspector-panel` 존재 |
| Command entry | `components/command-palette.tsx` | 전역 Command Palette 초기 구현 |

### Current Gaps

| Gap | Observation | Design Response |
| --- | --- | --- |
| Top Bar 없음 | 관리자 root layout은 sidebar 중심 | Console Shell에 `topBar` slot 정의 |
| Breadcrumb 공통화 없음 | 페이지별 개별 처리 가능성 | `breadcrumb` slot 정의 |
| Toolbar 공통화 없음 | 페이지별 filter/search가 흩어질 가능성 | `toolbar` slot 정의 |
| Inspector 적용 제한 | Primitive는 있으나 전체 관리자 화면에 확산 전 | `inspector` slot과 responsive drawer 규칙 정의 |
| Overlay 체계 미정 | Command Palette z-index는 있으나 dialog/drawer 표준 필요 | `overlayLayer`, `toastLayer` 정의 |
| 텍스트 인코딩 표시 문제 | 일부 관리자 label이 콘솔 출력에서 깨져 보임 | 구현 Sprint에서 실제 UI 문자열 점검 필요 |

## 1. Console Shell Slots

```text
ConsoleShell
├─ topBar
├─ primarySidebar
├─ breadcrumb
├─ pageHeader
├─ toolbar
├─ mainContent
├─ inspector
├─ mobileDrawer
├─ overlayLayer
└─ toastLayer
```

| Slot | Purpose | Position | Default Size | Scroll | Boundary | z-index Role | Responsive | Landmark | Server/Client Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `topBar` | 전역 이동, 검색, 알림, 계정 | viewport top | 56px height | fixed, no internal scroll | bottom border | shell navigation | mobile compact | `banner` | Server shell + client controls |
| `primarySidebar` | 관리자 도메인 이동 | left | 248px expanded / 72px collapsed | internal vertical | right border | shell navigation | drawer under 768px | `navigation` | Server links + client collapse |
| `breadcrumb` | 현재 위치 표시 | main top | 24~32px | follows main scroll or sticky by page | none | content context | compressed on mobile | `nav` with label | Server |
| `pageHeader` | 화면 목적, metadata, primary CTA | main below breadcrumb | content based | optional sticky by page type | bottom spacing | content hierarchy | stack on mobile | heading region | Server |
| `toolbar` | search/filter/view/density | main below header | 48~56px | sticky inside main when needed | top/bottom border | workspace controls | overflow on mobile | region | Client when filter state exists |
| `mainContent` | table/tree/detail/timeline | center | min 640px desktop | primary vertical scroll | content surface | base content | single column mobile | `main` | Server or Client by screen |
| `inspector` | selected object detail | right | 320px default, 280~440px range | internal vertical | left border | contextual detail | drawer under 1024px | complementary | Client when selection state exists |
| `mobileDrawer` | mobile nav/inspector/action | overlay | 100vw mobile | internal vertical | overlay backdrop | overlay | mobile/tablet only | dialog | Client |
| `overlayLayer` | dialog, popover, dropdown | root overlay | content based | locked background | backdrop | above shell | all viewports | dialog/menu | Client |
| `toastLayer` | transient feedback | fixed edge | content based | none | floating | topmost notice except critical | all viewports | status | Client |

## 2. Desktop Grid

Default design token proposal:

| Token | Value |
| --- | --- |
| Viewport reference | 1440px |
| Top Bar | 56px |
| Sidebar expanded | 248px |
| Sidebar collapsed | 72px |
| Inspector default | 320px |
| Inspector resize range | 280~440px |
| Main minimum | 640px |
| Toolbar | 48~56px |
| Page horizontal padding | 24px |
| Content gap | 16px or 24px |

### Layout States

#### A. Sidebar expanded + Inspector open

```text
Width 1440
┌────────────────────────────────────────────── Top Bar 56 ──────────────────────────────────────────────┐
├─ Sidebar 248 ─┬─ Main min 640 / fluid ──────────────────────────────┬─ Inspector 320 ─────────────────┤
```

Use for: Curriculum, Ontology, AI Trace, Coverage detail.

#### B. Sidebar collapsed + Inspector open

```text
├─ Sidebar 72 ─┬─ Main fluid ─────────────────────────────────────────┬─ Inspector 320 ─────────────────┤
```

Use for: dense tables, trace review, content mapping.

#### C. Sidebar expanded + Inspector closed

```text
├─ Sidebar 248 ─┬─ Main wide ────────────────────────────────────────────────────────────────────────────┤
```

Use for: Dashboard, large analytics, settings overview.

#### D. Focus mode

```text
├─ Sidebar 72 ─┬─ Main maximum width ────────────────────────────────────────────────────────────────────┤
```

Use for: long review, content editing, question authoring.

#### E. Wide data mode

```text
├─ Sidebar 72 ─┬─ Main wide table/tree ──────────────────────────────────────────────────────────────────┤
                            Inspector opens as Drawer
```

Use for: Audit log, large coverage matrix, bulk review table.

## 3. Scroll Policy

| Region | Scroll Behavior |
| --- | --- |
| Top Bar | fixed at viewport top |
| Sidebar | independent vertical scroll |
| Main Workspace | independent vertical scroll |
| Inspector | independent vertical scroll |
| Toolbar | sticky inside Main when list/tree/table view |
| Page Header | sticky only for long review/detail screens |
| Drawer/Dialog | background scroll locked |

Nested scroll should be limited to three vertical zones at most: Sidebar, Main, Inspector.

## 4. Top Bar Wireframe

### Default

```text
[SECURIUM Admin] [☰] [Current product area]      [⌘K Search...]      [Preview] [Alerts] [Account]
```

### Search Active

```text
[SECURIUM Admin] [Search overlay active: Command Palette] [Esc closes]
```

### Notification Exists

```text
[Alerts badge: 3]
 - Coverage gap requires owner
 - AI feedback pending review
 - Failed export job
```

### Operation Warning

```text
[Environment: Production] [System warning: AI provider degraded]
```

### Mobile

```text
[Menu] [SECURIUM Admin] [Search] [Account]
```

Rules:

- Page-specific primary CTA never goes in Top Bar.
- Secret, DB URL, token, internal connection details are never displayed.
- Environment Badge must distinguish Production, Preview, Local.

## 5. Sidebar IA

Recommended groups:

```text
Overview
  Dashboard

Learning Operations
  Courses
  Curriculum
  Content
  Questions
  Coverage

Knowledge & AI
  Ontology
  AI Trace
  AI Feedback
  Improvement Queue

Administration
  Users & Roles
  Audit Log
  Settings
```

Current code has many routes already. UI-3 should map current links into these groups without deleting existing routes.

Rules:

- Collapsed state shows icon + tooltip.
- Active state must use more than color.
- Badge/count is allowed for pending review, gaps, alerts.
- Do not nest beyond two levels.
- Active menu and breadcrumb must agree.

## 6. Breadcrumb and Page Header

### Breadcrumb Role

Breadcrumb is for location and hierarchy, not primary navigation.

Example:

```text
Admin > Ontology > AES
```

Mobile:

```text
← Ontology
```

### Page Header Structure

```text
[Eyebrow]
H1 Title                                      [Secondary Action] [Primary CTA]
Description
[Status Badge] [Version] [Content Date] [Scope]
```

Rules:

- One primary CTA maximum.
- Risky state transitions should not be visually promoted as ordinary primary actions.
- ACTIVE / ARCHIVED / PUBLISHED states appear as badges, not repeated sentences.

## 7. Toolbar

```text
[Search current list] [Filters] [View: Table/Tree/Graph] [Scope]      [Sort] [Density] [Columns] [Export]
```

Toolbar variants:

- List Toolbar
- Tree Toolbar
- Detail Toolbar
- Selection Toolbar
- Read-only Toolbar

Rules:

- Page Header CTA and Toolbar action must not duplicate.
- Applied filter count appears as a badge.
- Query state should be reflected in URL when shareable.
- Narrow screens move secondary controls into overflow.
- Risk actions are not exposed in the default Toolbar.

## 8. Main Content Types

| Type | Use | Full Width | Card Use | Inspector Link |
| --- | --- | --- | --- | --- |
| Dashboard | summary and queue | yes | metric cards | optional |
| List/Table | questions, audit, feedback | yes | no for every row | selected row |
| Explorer | curriculum/ontology | split | minimal | selected node/concept |
| Detail | resource detail | constrained | sections | current object |
| Review | evidence/diff/action | constrained | evidence panels | reviewer object |
| Trace | timeline/context/feedback | yes | grouped panels | selected trace step |

Rule: do not wrap every piece of information in cards. Dense workspaces should prefer table, tree, trace, and split panes.

## 9. Inspector Panel

Default width: 320px. Resize range: 280~440px.

```text
[Inspector Header]
  Object title
  Status Badge
  Stable key [Copy]

[Summary]
[Metadata]
[Relations]
[Coverage]
[AI Usage]
[Audit]
[History]
[Contextual Actions]
```

States:

- Closed
- Loading
- Object selected
- No selection
- Error
- Permission restricted
- Pinned
- Mobile Drawer

Rules:

- Inspector is not the main editing surface for complex forms.
- Only changed content should update when selection changes.
- Mobile uses Drawer or Bottom Sheet.
- Read-only summary and contextual actions are central.

## 10. Drawer

Drawer types:

- Navigation Drawer: mobile sidebar.
- Inspector Drawer: mobile/tablet detail panel.
- Action Drawer: longer review or edit workflow.

Rules:

- Desktop default width: 420~560px for action drawers.
- Tablet width: 70vw.
- Mobile width: 100vw.
- ESC closes.
- Focus trap required.
- Background scroll lock required.
- Unsaved changes warning required for editable drawers.
- Nested drawers should be avoided.

## 11. Dialog

Dialog types:

- Confirmation
- Destructive confirmation
- Small form
- Conflict resolution
- Permission notice

Rules:

- Title names the action.
- Body explains impact scope.
- Primary and Cancel order is consistent.
- Destructive action button uses explicit wording.
- Long forms move to Drawer or route.

## 12. Z-Index

Recommended layer order:

| Layer | Role |
| --- | --- |
| 0 | base content |
| 10 | sticky toolbar |
| 20 | sidebar / top bar |
| 30 | inspector |
| 40 | dropdown / popover |
| 50 | drawer overlay |
| 60 | dialog |
| 70 | toast |
| 80 | critical system notice / command palette |

Numbers should be implemented through tokens in UI-3, not hardcoded per component.

## 13. Responsive

| Breakpoint | Behavior |
| --- | --- |
| Desktop >= 1280px | Sidebar + Main + Inspector possible |
| Tablet 768~1279px | Sidebar collapsed or drawer, Inspector drawer |
| Mobile < 768px | Simplified Top Bar, Navigation Drawer, one-column Main, Inspector full-width Drawer |

## 14. Density and Accessibility

Admin Console defaults to Compact density, but click targets and keyboard access must remain accessible.

Requirements:

- visible focus ring
- semantic landmarks
- heading hierarchy
- state not conveyed by color alone
- minimum interactive target size
- dialog/drawer focus management
- screen reader announcement for loading/error/selection changes
- reduced motion support
- high contrast review

## 15. Known Limitations

- Current admin labels should be reviewed in the browser/editor because terminal output shows mojibake for several Korean strings.
- Current admin root layout does not yet include a true Top Bar slot.
- Current Toolbar and Breadcrumb patterns are page-local rather than Shell-managed.
- Current Inspector primitive exists but is not yet widely applied.

## 16. Final Decision

**GO for documentation and review. CONDITIONAL GO for implementation.**

Implementation should wait until the 6 representative screen examples and component mapping are reviewed.

