# UI-4 Mock Exams Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the mock exam management list and creation page. It preserves the existing mock exam form, detail configuration flow, API routes, and repository contracts.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/mock-exams` | Create mock exams and review operational exam status | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Mock exams combine publishing, exam windows, attempt limits, result disclosure, and question assignment. The updated page separates:

1. **Header** — clarifies the operational scope and links to the learner exam surface and Question Bank.
2. **Metrics** — summarizes attempt count, submitted attempts, average score, public exams, open exams, and drafts.
3. **Toolbar** — highlights whether any exam is currently open to learners.
4. **Main Workspace** — keeps the existing `AdminMockExamForm` and registered exam list.
5. **Inspector** — summarizes the latest exam and links to its detailed configuration route.

## Compatibility

- Existing `AdminMockExamForm` remains unchanged.
- Existing `/api/admin/mock-exams` mutation route remains unchanged.
- Existing `listAdminMockExams()` and `getAdminOperationalStats()` repository functions remain unchanged.
- Existing authorization remains `requireCatalogManager("/admin/mock-exams")`.
- Mock exam detail configuration remains under `/admin/mock-exams/[mockExamId]`.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a course manager or admin account:

1. Creating a mock exam through the existing form still persists and reloads the page.
2. Registered exam cards link to the correct detail configuration route.
3. Inspector links to the latest exam detail page.
4. Empty state renders correctly when no exams exist.
5. Inspector stacks below the exam list on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
