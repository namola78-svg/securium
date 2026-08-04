# UI-4 Course Detail Console Pilot

## Scope

- Target route: `/admin/courses/[courseId]`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a `PageToolbar` with course list and subject management actions.
- Added shared `MetricCard` summary cards for subjects, levels, passing score, and difficulty.
- Preserved existing `CourseForm` reuse and `/api/admin/courses` submit behavior.
- Added `WorkspaceLayout` and `InspectorPanel` for current course metadata.
- Replaced broken/mojibake copy with Korean operational labels.
- Added explicit guidance for published vs active status semantics.

## UX notes

- The page now separates course identity, editable fields, curriculum structure, and operational metadata.
- The inspector provides quick links to the public detail page and learner view for the same course slug.
- Subject count is loaded through the existing repository to help managers understand setup completeness.
- Existing course data isolation and deactivation-first policy remain unchanged.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
