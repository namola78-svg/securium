# UI-4 Mock Exam Detail Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the mock exam detail configuration page. It preserves existing section creation, question assignment, API routes, and repository contracts.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/mock-exams/[mockExamId]` | Configure mock exam sections and assign supported auto-graded questions | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Mock exam configuration is an operational checklist. The updated page separates:

1. **Header** — identifies the exam and links back to the exam list and learner-facing surface.
2. **Metrics** — summarizes assigned question count, section count, score total, and assignment coverage.
3. **Toolbar** — surfaces publication/status state and links to the course-scoped Question Bank.
4. **Main Workspace** — preserves `AdminExamConfiguration` and the assigned question list.
5. **Inspector** — shows exam timing, passing score, max attempts, supported question count, and publication readiness cues.

## Compatibility

- Existing `AdminExamConfiguration` remains unchanged.
- Existing `/api/admin/mock-exam-sections` and `/api/admin/mock-exam-questions` mutation routes remain unchanged.
- Existing `getAdminMockExamConfiguration()` repository function remains unchanged.
- Existing authorization remains `requireCatalogManager("/admin/mock-exams")`.
- Only currently supported auto-graded question types are shown for assignment, as before.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a course manager or admin account:

1. Creating a section still persists and reloads the page.
2. Assigning a question still persists and reloads the page.
3. Empty assignment state renders correctly.
4. The Question Bank link remains course-scoped.
5. Inspector stacks below the configuration forms on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
