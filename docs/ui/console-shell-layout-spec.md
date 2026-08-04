# Console Shell Layout Spec

This spec converts the Console Shell wireframe into measurable layout rules. It is design documentation only.

## Slot Contract

| Slot | Required | Can Be Empty | Owner | Notes |
| --- | --- | --- | --- | --- |
| `topBar` | Yes | No | Shell | global search, account, environment |
| `primarySidebar` | Yes | No | Shell | grouped admin navigation |
| `breadcrumb` | No | Yes | Page | required for detail/deep screens |
| `pageHeader` | Yes | No | Page | title, description, badges, CTA |
| `toolbar` | No | Yes | Page | list/tree/table controls |
| `mainContent` | Yes | No | Page | primary workspace |
| `inspector` | No | Yes | Page + Shell | object detail |
| `mobileDrawer` | No | Yes | Shell | nav/inspector/action on small screens |
| `overlayLayer` | Yes | Empty by default | Shell | dialog/popover/dropdown |
| `toastLayer` | Yes | Empty by default | Shell | feedback/status |

## Grid Tokens

| Token | Value | Reason |
| --- | --- | --- |
| `--console-topbar-h` | 56px | compact but touchable |
| `--console-sidebar-w` | 248px | grouped menu labels fit |
| `--console-sidebar-collapsed-w` | 72px | icon-only rail |
| `--console-inspector-w` | 320px | readable metadata panel |
| `--console-inspector-min-w` | 280px | smallest useful inspector |
| `--console-inspector-max-w` | 440px | prevents main starvation |
| `--console-main-min-w` | 640px | table/tree minimum |
| `--console-page-px` | 24px | desktop horizontal padding |
| `--console-gap` | 16px / 24px | compact/dense layouts |
| `--console-toolbar-h` | 48~56px | filter row height |

## Desktop Grid Formula

```text
viewport width
- sidebar width
- inspector width when open
- page padding * 2
- gaps
= main workspace width
```

If main workspace would fall below 640px, prefer one of:

1. collapse sidebar
2. close inspector
3. switch inspector to drawer
4. use focus mode

## Layout State Matrix

| State | Sidebar | Inspector | Main | Recommended Screens |
| --- | --- | --- | --- | --- |
| A | 248px | 320px | fluid, min 640px | Curriculum, Ontology |
| B | 72px | 320px | wider | AI Trace, Content Mapping |
| C | 248px | closed | wide | Dashboard, Settings |
| D | 72px | closed | maximum | Review, long forms |
| E | 72px | drawer | maximum data width | Audit, Coverage matrix |

## Page Header Size

| Element | Size |
| --- | --- |
| Eyebrow | 11~12px uppercase |
| H1 | 28~36px desktop, 24~28px mobile |
| Description | max 720px |
| Metadata row | wraps below title on mobile |
| Primary CTA | right aligned desktop, full width optional mobile |

## Toolbar Size

| Mode | Height | Notes |
| --- | --- | --- |
| Compact | 48px | dense admin list |
| Comfortable | 56px | forms, learner-adjacent admin |
| Two-row | 96~112px | many filters, avoid if possible |
| Mobile | content based | primary filters first, overflow menu |

## Main Content Patterns

### Dashboard

```text
Metric cards: 4 columns desktop / 2 tablet / 1 mobile
Queue panels: 2 columns desktop / 1 mobile
Recent activity: table or timeline
```

### List/Table

```text
Toolbar sticky
Table body scrolls with main
Pagination bottom
Inspector opens on row selection
```

### Explorer

```text
Left internal pane: 280~360px
Center detail: min 480px
Right shell inspector: 320px
```

### Trace

```text
Timeline column: 240~320px
Detail area: fluid
Inspector: request summary
```

## Implementation Notes for UI-3

- Existing `admin-shell`, `admin-layout`, `admin-sidebar`, `admin-content` can be reused as the first migration point.
- Existing `InspectorPanel` can become the shell-level inspector content primitive.
- Existing `CommandPalette` can be mounted in Top Bar or remain global until Top Bar exists.
- Breadcrumb and Toolbar should become optional page slots, not repeated ad-hoc blocks.

