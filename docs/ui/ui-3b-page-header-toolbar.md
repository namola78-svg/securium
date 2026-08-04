# UI-3B — Breadcrumb, Page Header, Toolbar Foundation

## Scope

UI-3B adds the common page orientation primitives used by SECURIUM console screens:

- Breadcrumb
- Page header
- Header action area
- Page toolbar

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Design intent

Console screens should answer three questions immediately:

1. Where am I?
2. What can I do on this page?
3. Which filters or view controls affect the current workspace?

Breadcrumbs answer location. Page headers define page identity. Toolbars contain workspace controls.

## Component contracts

### Breadcrumbs

Use for current location and parent navigation.

- Rendered as `nav` with `aria-label="현재 위치"`.
- The last item is treated as the current page by default.
- Current item uses `aria-current="page"`.
- Breadcrumb labels should be user-facing names, not internal route IDs.

### SectionHeader

Use once per page as the primary page heading area.

- Must contain one visible `h1`.
- May include breadcrumbs above the title.
- May include page-level actions on the right.
- Should not contain row-level actions or dense filters.

### PageToolbar

Use below the page header for search, filters, tabs, view switching, and bulk actions.

- Primary actions are visually separated from filters.
- Controls inside the toolbar must provide accessible labels.
- The toolbar wraps vertically on mobile instead of overflowing horizontally.

## Usage rules

| Pattern | Use when | Do not use when |
| --- | --- | --- |
| Breadcrumb | The page has a parent context or deep admin route. | The route is a top-level public marketing page. |
| Page Header | The page needs identity, description, and page-level actions. | The content is a card section inside another page. |
| Toolbar | The workspace needs filter/search/view controls. | The action affects only one table row or one card. |
| Header Actions | The action changes the whole page context. | The action is a destructive confirmation; use dialog flow. |

## Admin dashboard pilot

The admin dashboard now uses the shared `SectionHeader` breadcrumb slot:

`Admin / Dashboard`

This lets the shell pattern be validated on a low-risk overview page before applying it to higher-density screens such as Curriculum, Ontology, AI Trace, and Coverage.

## Accessibility

- Breadcrumbs use landmark navigation.
- The current page is announced with `aria-current="page"`.
- Focus-visible styling is inherited from global link/button focus rules.
- Toolbar controls should use labels or `aria-label`.
- Mobile layout stacks controls to avoid horizontal scrolling.

## Mobile behavior

At small widths:

- Header title and actions stack vertically.
- Toolbar groups become full width.
- Action groups align left.
- Filters and buttons remain tappable without requiring horizontal scrolling.

## Rollout plan

1. Admin Dashboard pilot.
2. Curriculum pages.
3. Ontology Explorer.
4. AI Trace and Coverage.
5. Audit and Settings.

## Validation checklist

- Page has exactly one primary `h1`.
- Breadcrumb text is user-facing.
- Current breadcrumb item is not a link.
- Toolbar controls do not overflow at 360px.
- Page-level primary CTA is not duplicated in row actions.
- No database, API, or repository change is introduced by layout adoption.
