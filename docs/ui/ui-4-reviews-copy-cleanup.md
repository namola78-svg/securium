# UI-4 Review Queue Copy Cleanup

## Scope

- Target route: `/admin/reviews`
- Change type: Admin review queue copy cleanup
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced broken/mojibake Korean copy across the question review queue screen.
- Preserved the existing `requireQuestionReviewer` server-side authorization check.
- Preserved the existing `listAdminQuestions` repository calls for `REVIEW_REQUESTED` and `IN_REVIEW`.
- Localized review workflow status, question type, and difficulty labels.
- Clarified that unapproved questions are not shown to general users.
- Kept the Console Shell structure with `SectionHeader`, `PageToolbar`, `MetricCard`, `WorkspaceLayout`, and `InspectorPanel`.
- Improved the empty state and inspector checklist wording.

## UX notes

- The screen now reads as a reviewer workflow instead of exposing damaged internal text.
- The latest review target remains visible in the inspector, with version, author, reviewer, and last updated metadata.
- No question approval, rejection, publishing, or workflow behavior was changed.

## Validation

- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run test:integration` — passed, 18 tests
- `npm.cmd run build` — passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
