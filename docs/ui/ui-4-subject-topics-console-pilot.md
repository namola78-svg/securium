# UI-4 Subject Topics Console Pilot

## Scope

- Target route: `/admin/subjects/[subjectId]/topics`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a `PageToolbar` with links back to the subject list and CurriculumTree.
- Added shared `MetricCard` summary cards for total, active, root, and child topics.
- Preserved the existing form action `/api/admin/topics`.
- Replaced broken/mojibake labels with Korean operational copy.
- Converted active/inactive text into compact `StatusBadge` elements.
- Added parent topic labels in the topic list without adding extra queries.
- Added `WorkspaceLayout` and `InspectorPanel` for the first display-order topic.
- Added empty state guidance when no topics exist.

## UX notes

- The screen now completes the course management chain: course group → course → subject → topic.
- Parent topic selection remains optional and uses the existing `parentTopicId` relationship.
- The inspector explains how topics drive question, lesson, curriculum, progress, analytics, and weak-area grouping.
- Existing server-side validation and API behavior remain unchanged.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
