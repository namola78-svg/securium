# Console Shell Responsive Spec

This document defines how the SECURIUM Console Shell behaves across desktop, tablet, and mobile viewports.

## Breakpoints

| Breakpoint | Width | Shell Behavior |
| --- | --- | --- |
| Mobile | < 768px | top bar compact, sidebar drawer, inspector drawer |
| Tablet | 768~1279px | sidebar collapsed or drawer, inspector drawer/narrow |
| Desktop | >= 1280px | sidebar + main + inspector possible |
| Wide Desktop | >= 1440px | expanded sidebar + inspector open default |

## Desktop >= 1280px

```text
Top Bar: fixed 56px
Sidebar: expanded 248px by default
Main: fluid, min 640px
Inspector: 320px when object selected
```

Default behaviors:

- Dashboard: inspector closed
- Curriculum: inspector open after node selection
- Ontology: inspector open after concept selection
- AI Trace: inspector open after request selection
- Audit: inspector drawer or closed by default

## Tablet 768~1279px

```text
Top Bar: fixed 56px
Sidebar: collapsed 72px or drawer
Main: full available width
Inspector: drawer
Toolbar: one row + overflow
```

Rules:

- Do not show expanded sidebar and inspector at the same time.
- Main workspace owns the viewport.
- Inspector appears as right drawer.
- Tables may switch to horizontal scroll only when columns are essential.

## Mobile < 768px

```text
Top Bar:
  [Menu] [SECURIUM Admin] [Search] [Account]

Main:
  Breadcrumb compressed
  Page Header stacked
  Toolbar primary controls only
  Content single column

Drawers:
  Navigation drawer
  Inspector full-width drawer
  Action drawer
```

Rules:

- Sidebar is never permanently visible.
- Breadcrumb is shortened to Back + current parent.
- Toolbar secondary controls move to overflow.
- Inspector is full-width drawer or bottom sheet.
- Tree views use search-first interaction.
- Background scroll locks when drawer/dialog is open.

## Mobile Drawer Behaviors

| Drawer | Trigger | Width | Close |
| --- | --- | --- | --- |
| Navigation | Menu button | 100vw | close button, ESC, route change |
| Inspector | row/node/concept select | 100vw | close button, ESC |
| Action | edit/review action | 100vw | close button, ESC, unsaved warning |

## Table and Tree Conversion

| Pattern | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Data Table | full table | compact table | card rows or horizontal scroll |
| Curriculum Tree | tree + inspector | tree + drawer | compact list + detail drawer |
| Ontology Tree | tree + detail + inspector | tree/search + detail | search-first + detail |
| AI Trace | timeline + detail + inspector | timeline + drawer | step list + detail |

## Accessibility on Responsive Views

- Drawer trigger must have `aria-expanded`.
- Drawer title must match selected resource.
- Focus moves into drawer when opened and returns to trigger when closed.
- Active navigation remains available to screen readers.
- Mobile overflow menus must have accessible names.

## Reduced Motion

- Drawer and overlay transitions should respect `prefers-reduced-motion`.
- When reduced motion is on, use opacity changes without large sliding motion.

