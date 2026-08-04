# UI-4 Courses Console Pilot

## Scope

- Target route: `/admin/courses`
- Related reusable export: `CourseForm`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a `PageToolbar` with links to course groups and the public course list.
- Added shared `MetricCard` summary cards for course activation and publication health.
- Preserved the existing form action `/api/admin/courses`.
- Preserved `CourseForm` export for `/admin/courses/[courseId]`.
- Replaced broken/mojibake labels with Korean operational copy.
- Added course status badges for published/unpublished and active/inactive.
- Added `WorkspaceLayout` and `InspectorPanel` for the latest updated course.
- Added empty state guidance when no courses exist.

## UX notes

- The course list now emphasizes course name, group, code, slug, publication state, active state, difficulty, and edit actions.
- The inspector summarizes the latest changed course and links to course settings and subject management.
- The form keeps current server-side validation and submit behavior.
- Public-facing course exposure remains data-driven and uses existing DB fields.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
