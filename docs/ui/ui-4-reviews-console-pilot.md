# UI-4 Reviews Console Pilot

## Scope

- Target route: `/admin/reviews`
- Change type: UI-only Console Shell alignment
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced the legacy header with shared `SectionHeader` and breadcrumbs.
- Added a review-oriented `PageToolbar` with links to all questions and question creation.
- Added shared `MetricCard` summary cards for review queue health.
- Converted raw workflow status text into localized compact `StatusBadge` elements.
- Preserved existing reviewer authorization via `requireQuestionReviewer("/admin/reviews")`.
- Preserved existing `listAdminQuestions` repository usage for `REVIEW_REQUESTED` and `IN_REVIEW`.
- Added a `WorkspaceLayout` with an `InspectorPanel` for the most recently updated review target.
- Replaced broken/mojibake copy with Korean operational copy.

## UX notes

- The page prioritizes review triage: requested, in-review, sample, and latest updated item.
- The inspector provides a fast path into the current highest-signal review target.
- Empty state now explains when items will appear and links back to the full question bank.

## Validation

- `npm.cmd run typecheck` — Passed
- `npm.cmd run lint` — Passed
- `npm.cmd run test:integration` — Passed, 18 tests
- `npm.cmd run build` — Passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
