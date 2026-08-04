# UI-3I — Audit Console Workspace Pilot

## Scope

UI-3I applies the SECURIUM console workspace pattern to the admin Audit Log screen.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Applied changes

- Replaced the audit page header with shared `SectionHeader`.
- Added breadcrumb orientation: `Admin / Audit`.
- Added summary metric cards for current audit query.
- Added `PageToolbar` for audit scope and export placement.
- Wrapped audit filters and event table in `WorkspaceLayout`.
- Moved selected audit detail from the bottom of the page into `InspectorPanel`.
- Kept existing audit query, filter schema, detail lookup, export URL, authorization, and repository calls unchanged.

## Audit console model

The Audit screen now follows the same operator pattern as Dashboard, Curriculum, Ontology, AI Trace, and Coverage:

1. Query summary
2. Scope toolbar
3. Filter and result workspace
4. Detail inspector

## Inspector behavior

When no event is selected, the inspector explains audit handling and shows current query totals.

When an event is selected, the inspector shows:

- Action
- Result
- Actor email
- Actor role
- Resource type
- Resource ID
- IP hash
- User agent summary
- Request ID
- Allowlisted metadata

The inspector remains read-only. It does not provide edit or delete controls.

## Export placement

CSV export is now treated as a page-level action in the toolbar. The existing export endpoint is unchanged and remains visible only to `SUPER_ADMIN`.

## Security principle

Audit UI must reinforce the storage policy:

- No raw password
- No session token
- No OAuth token
- No API key
- No full request body
- No full response body
- Only action-specific allowlisted metadata

## Responsive behavior

- On mobile, the inspector stacks above the event table.
- Metadata JSON wraps and scrolls safely inside the inspector.
- The table retains its existing responsive wrapper.

## Validation checklist

- Page has one `h1`.
- Breadcrumb uses user-facing labels.
- Export action remains role-gated.
- Detail lookup still uses `detailId`.
- No audit mutation UI exists.
- No business logic, repository, API, DB, seed, or migration changes are introduced.
