# UI-4 Practical Specializations Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the practical specialization management page. It preserves existing practical content forms, API routes, repository contracts, audit insertion behavior, and course/question linking behavior.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/practical-specializations` | Manage secure coding weaknesses, code samples, grading rules, privacy impact assessment items, scenarios, flow nodes, and flow edges | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Practical specializations combine security code analysis and privacy impact assessment workflows. The updated page separates:

1. **Header** — identifies practical content as course-specialized operational content.
2. **Metrics** — summarizes weaknesses, code samples, grading rules, privacy items, scenarios, and flow graph size.
3. **Toolbar** — surfaces safety constraints, especially the no-code-execution policy.
4. **Main Workspace** — preserves the existing `AdminPracticalForms` component.
5. **Inspector** — summarizes the latest privacy scenario or fallback weakness and links to Coverage and AI Review workflows.

## Compatibility

- Existing `AdminPracticalForms` remains unchanged.
- Existing `/api/admin/practical-specializations` route remains unchanged.
- Existing `getAdminPracticalData()` repository function remains unchanged.
- Existing audit insertion from practical specialized saves remains unchanged.
- Existing authorization remains `requireQuestionAdministrator("/admin/practical-specializations")`.
- No code execution provider, sandbox, or external service is introduced.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a question administrator account:

1. Each existing practical content form still submits to the same API route.
2. Secure code samples remain stored/displayed as text and are not executed.
3. Privacy scenario node and edge creation still uses existing selectors.
4. Coverage and AI Review links remain accessible.
5. Inspector stacks below the practical forms on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
