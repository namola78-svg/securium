# UI-4 Question Bank Copy Cleanup

## Scope

- Target route: `/admin/questions`
- Change type: UI copy and state-label cleanup inside existing Console Shell
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced broken/mojibake Korean copy across the question bank admin page.
- Preserved existing filters, search parameters, repository calls, and route behavior.
- Localized question statuses: draft, review requested, in review, approved, published, rejected, archived.
- Localized question types and difficulty labels.
- Added an empty state for no search results.
- Kept `SectionHeader`, `PageToolbar`, `WorkspaceLayout`, `MetricCard`, `StatusBadge`, and `InspectorPanel` usage.
- Clarified security notes around answer/explanation exposure and approval workflow.

## UX notes

- The page already had the correct Console Shell shape, so the sprint slice focused on trust-damaging broken text.
- Filters remain URL-query based for shareable and refresh-safe admin workflows.
- No current business-rule behavior was changed.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
