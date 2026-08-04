# UI-4 Question Bank Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the Question Bank list page. It preserves the existing question repository, filters, routes, status workflow, and detail/edit pages.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/questions` | Search, filter, and review question bank items | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Question Bank is an operational command center. The page now separates:

1. **Header** — explains the domain and gives quick access to new question creation and AI Trace.
2. **Metrics** — summarizes result count, published count, draft/archive count, and review queue.
3. **Toolbar** — shows active filter count and selected course scope.
4. **Main Workspace** — preserves existing filters and question rows.
5. **Inspector** — summarizes publishing, review, and safety posture.

## Compatibility

- Existing filter query parameters are preserved.
- Existing links to `/admin/questions/[questionId]` are preserved.
- Existing new-question route is preserved.
- Existing authorization remains `requireQuestionAdministrator("/admin/questions")`.
- No repository or API contract changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed — rendered HTML suite covers admin question workflows |
| Production build | Passed |

## Manual QA

Verify with an admin account:

1. Keyword, course, subject, topic, type, difficulty, status, author, and reviewer filters still submit correctly.
2. Question row links still open detail pages.
3. New question CTA still opens `/admin/questions/new`.
4. Inspector stacks below the list on mobile without horizontal scroll.
5. AI Trace and report-management shortcuts resolve to existing admin routes.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
