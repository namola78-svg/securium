# UI-4 Course Subjects Console Pilot

## Scope

- Target route: `/admin/courses/[courseId]/subjects`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a `PageToolbar` with links back to course settings and curriculum management.
- Added shared `MetricCard` summary cards for subject health and next-step guidance.
- Preserved the existing form action `/api/admin/subjects`.
- Replaced broken/mojibake labels with Korean operational copy.
- Converted active/inactive text into compact `StatusBadge` elements.
- Added `WorkspaceLayout` and `InspectorPanel` for the first display-order subject.
- Added empty state guidance when no subjects exist.

## UX notes

- The screen now connects the course detail page to the topic-management workflow.
- The main workspace remains create/edit focused for low regression risk.
- Subject counts and active counts are shown without adding N+1 topic queries.
- Topic management remains a separate route and should be converted in the next slice.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
