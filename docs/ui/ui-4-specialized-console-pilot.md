# UI-4 Specialized Content Console Pilot

## Scope

- Target route: `/admin/specialized`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy standalone header with `SectionHeader` and breadcrumb context.
- Added `PageToolbar` actions for adjacent review tasks: content versions and coverage.
- Replaced custom stat cards with shared `MetricCard` primitives.
- Kept `AdminSpecializedForms` intact so existing repository and mutation paths remain unchanged.
- Added a two-column `WorkspaceLayout` with an `InspectorPanel` for the latest specialized record.
- Converted repeated text status into compact `StatusBadge` elements.
- Added a clearer empty state for missing cross-course content links.

## UX notes

- The main workspace remains form-first because this page is primarily an operations input screen.
- The inspector summarizes the latest risk scenario when present, otherwise the first ISMS-P standard.
- Content links are capped to the first 100 visible records to keep the page scannable.
- Official/source-sensitive content continues to rely on existing version and repository fields.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
