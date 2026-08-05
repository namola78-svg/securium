# Console Shell Audit

UI-5 audits the admin console for consistent use of the SECURIUM shell pattern.

## Shell contract

Every dense admin page should expose:

1. `SectionHeader`
2. `PageToolbar`
3. `WorkspaceLayout`
4. `InspectorPanel`
5. Adjacent workflow actions
6. Responsive stacking without horizontal scroll

## Audited routes

| Route | Shell status | Inspector role |
| --- | --- | --- |
| `/admin` | Applied | Operational summary and priority navigation. |
| `/admin/curriculum` | Applied | Selected curriculum tree/node readiness and coverage context. |
| `/admin/coverage` | Applied | Content, question, and operational gap summary. |
| `/admin/ontology` | Applied | Concept/edge state, retrieval readiness, aliases, and review context. |
| `/admin/ai-explainability` | Applied | Trace safety, context, citation, token, latency, cost, and review direction. |
| `/admin/ai-reviews` | Applied | Latest AI review queue item and safety constraints. |
| `/admin/analytics` | Applied | Metric formula, source data, scope, and confidence notes. |
| `/admin/audit-logs` | Applied | Latest audit record and export constraints. |
| `/admin/content-revisions` | Applied | Version state, impact scope, and revision safety. |
| `/admin/questions` | Applied | Publishing/review safety and question bank scope. |
| `/admin/mock-exams` | Applied | Latest exam readiness and configuration link. |
| `/admin/course-groups` | Applied | Course group metadata and navigation context. |
| `/admin/courses` | Applied | Course metadata and publishing readiness. |
| `/admin/lessons` | Applied | Latest lesson, hierarchy, and progress preservation guidance. |
| `/admin/reviews` | Applied | Review target and workflow state. |
| `/admin/specialized` | Applied | Specialized content readiness and adjacent review tasks. |
| `/admin/question-reports` | Applied in UI-5 | Latest report, question link, and handling guidance. |

## Regression lock

`tests/rendered-html.test.mjs` includes a core admin operations test for:

- Coverage
- Ontology
- AI Explainability
- Content Revisions
- Analytics

The test checks for shell markers and route-specific inspector headings. This protects the highest-density admin screens from drifting back into isolated page layouts.

## Remaining audit recommendations

1. Add browser QA for mobile inspector stacking on 390px and 768px widths.
2. Add route-level smoke tests for `/admin/question-reports` now that it uses `WorkspaceLayout`.
3. Avoid introducing new admin pages without the shell contract.
4. Keep mutation workflows server-authorized and outside passive inspector summaries.

