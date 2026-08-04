# UI-4 Question Reports Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the question report queue page. It keeps the existing report update action, authorization, API route, and repository contract unchanged.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/question-reports` | Review user-submitted question reports and update report handling status | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Question reports are a trust and content-quality workflow. The updated page separates:

1. **Header** — positions the page as a review queue and links to Question Bank and Audit Logs.
2. **Metrics** — summarizes active reports, completed reports, rejected reports, and distinct report reasons.
3. **Toolbar** — highlights whether active review work is pending.
4. **Main Workspace** — preserves the existing report list and `ReportAdminActions` form.
5. **Inspector** — surfaces the latest report and connects it to the related question detail page.

## Compatibility

- Existing `listQuestionReports()` repository query remains unchanged.
- Existing `ReportAdminActions` mutation flow remains unchanged.
- Existing `/api/admin/question-reports` contract remains unchanged.
- Existing authorization remains `requireQuestionAdministrator("/admin/question-reports")`.
- No report status semantics changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with an admin account:

1. Report status updates still persist through the existing action form.
2. Empty report state renders without layout shift.
3. Latest report inspector opens the correct question detail route.
4. Audit Logs and Question Bank links remain accessible.
5. Inspector stacks below the report list on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
