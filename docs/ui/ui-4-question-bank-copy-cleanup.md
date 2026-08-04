# UI-4 Question Bank Copy Cleanup

## Scope

- Target routes: `/admin/questions`, `/admin/questions/new`, `/admin/questions/[questionId]`
- Shared component: `AdminQuestionForm`
- Change type: UI copy and state-label cleanup inside the existing Console Shell
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced broken/mojibake Korean copy across the question bank admin page.
- Replaced broken Korean labels in the shared `AdminQuestionForm` used by question creation and editing.
- Preserved existing filters, search parameters, repository calls, and route behavior.
- Localized question statuses: draft, review requested, in review, approved, published, rejected, archived.
- Localized question types and difficulty labels.
- Added an empty state for no search results.
- Kept `SectionHeader`, `PageToolbar`, `WorkspaceLayout`, `MetricCard`, `StatusBadge`, and `InspectorPanel` usage.
- Clarified security notes around answer/explanation exposure and approval workflow.

## UX notes

- The question list already had the correct Console Shell shape, so this slice focused on trust-damaging broken text.
- The shared question form now uses readable labels for title, content, type, difficulty, course/subject/topic links, answer choices, explanations, source, and save states.
- Filters remain URL-query based for shareable and refresh-safe admin workflows.
- No current business-rule behavior was changed.

## Validation

- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run test:integration` — passed, 18 tests
- `npm.cmd run build` — passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
