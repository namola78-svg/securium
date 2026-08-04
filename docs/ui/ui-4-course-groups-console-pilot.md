# UI-4 Course Groups Console Pilot

## Scope

- Target route: `/admin/course-groups`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a `PageToolbar` with links to course management and the public course list.
- Added shared `MetricCard` summary cards for group and course publication health.
- Preserved the existing form action `/api/admin/course-groups`.
- Replaced broken/mojibake copy with Korean operational labels.
- Added per-group course counts and published course counts without changing repository behavior.
- Added `WorkspaceLayout` and `InspectorPanel` for the first display-order course group.
- Converted active/inactive text into compact `StatusBadge` elements.

## UX notes

- Course groups are treated as the top-level public course navigation structure.
- The main workspace remains create/edit focused.
- The inspector calls out stable IDs, display order, and the safe deactivation-first policy.
- Public-facing group exposure remains data-driven and not hardcoded in the UI.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
