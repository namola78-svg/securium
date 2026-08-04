# UI-4 Courses Copy Cleanup

## Scope

- Target route: `/admin/courses`
- Shared component touched: `design-system-primitives`
- Change type: Admin course management copy cleanup and accessibility label cleanup
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced broken/mojibake Korean copy across the course management screen.
- Preserved the existing `requireCatalogManager` server-side authorization check.
- Preserved the existing `listAllCourseGroups` and `listAllCourses` repository calls.
- Preserved the existing course form POST target and field names.
- Localized difficulty, status, metric, empty-state, and inspector labels.
- Clarified that courses use dynamic routes and shared templates instead of copied pages.
- Clarified that active/published state changes should be preferred over destructive deletion where learning records may exist.
- Replaced broken accessibility labels in shared design primitives:
  - Breadcrumb navigation
  - Drawer fallback label
  - Inspector panel label and status badge group label

## UX notes

- This screen is a central admin entry point, so clean Korean copy materially improves operator trust.
- No course creation, update, activation, publishing, sorting, or route behavior was changed.
- The small accessibility-label cleanup improves screen-reader output without changing layout.

## Validation

- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run test:integration` — passed, 18 tests
- `npm.cmd run build` — passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
