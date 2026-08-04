# UI-4 Question Detail Console Pilot

## Scope

- Target route: `/admin/questions/[questionId]`
- Related component: `QuestionWorkflowActions`
- Change type: UI-only Console Shell alignment and copy cleanup
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy question detail header with shared `SectionHeader` and breadcrumbs.
- Added `PageToolbar` actions back to the question list and review queue.
- Added shared `MetricCard` summary cards for choices, course links, subject links, and versions.
- Added `WorkspaceLayout` and `InspectorPanel` for review metadata and safety guidance.
- Preserved existing `AdminQuestionForm` and mutation behavior.
- Preserved existing `QuestionWorkflowActions` fetch endpoints and workflow transitions.
- Replaced broken/mojibake copy in both the detail page and workflow action component.
- Localized question status, type, difficulty, version, and review labels.
- Added empty states for no choices or missing version history.

## UX notes

- The page now separates workflow actions, preview/editor, version history, and review inspector.
- The inspector emphasizes pre-publication answer/explanation exposure controls.
- Workflow actions remain status-driven and use the same API routes.
- No question status contract or transition rule was changed.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
