# UI-5 Core Inspector Unification

SECURIUM admin surfaces should feel like one analysis console instead of many separate management pages. The next convergence layer is the shared **Console Shell + Workspace + Inspector** pattern across the highest-density operational screens.

## Scope

This slice aligns the following existing pages without changing API, Repository, migration, seed, or production behavior.

| Area | Route | Primary workspace | Inspector role |
| --- | --- | --- | --- |
| Coverage | `/admin/coverage` | Priority queue and coverage gaps | Content, question, and operational gap summary |
| Ontology | `/admin/ontology` | Concept and edge explorer | Retrieval readiness, aliases, relations, and review context |
| AI Explainability | `/admin/ai-explainability` | Trace list and filters | Trace safety, context, citation, token, latency, cost, and review direction |
| Content Revision | `/admin/content-revisions` | Target picker, revisions, comparison, impact | Latest version, impact scope, draft/review/archive state, and safety reminders |
| Analytics | `/admin/analytics` | Metrics and drill-downs | Metric formula, source data, filter scope, and confidence notes |

## Common Inspector anatomy

Each dense admin page should use the same structure:

1. `InspectorPanel`
   - eyebrow
   - selected title
   - short description
   - status badges
   - key metadata
   - adjacent workflow actions
2. `InspectorSection`
   - focused context block
   - evidence, policy, or safety guidance
   - future selected-row expansion notes when selection is not yet interactive

## Interaction rule

The Inspector should answer: “What does the selected or first visible item mean, and what should an operator check next?”

It should not become a second editing form unless the screen specifically needs a review action. Mutating actions should stay in the main workspace or an explicit review form with server-side authorization.

## Rollout order

1. Coverage — simplest operational queue and gap model.
2. Ontology — concept/edge context and retrieval readiness.
3. AI Explainability — trust, prompt safety, citation, and feedback context.
4. Content Revision — version safety and impact scope.
5. Analytics — formula and drill-down inspector.

## Non-goals

- No DB change.
- No seed change.
- No API change.
- No Repository change.
- No deployment.
- No production data mutation.

## Validation checklist

- Inspector stacks safely on mobile.
- The same section spacing and heading hierarchy are used across the target pages.
- Actions point to adjacent workflows, not unrelated pages.
- Sensitive AI prompt or user answer content is not displayed in the inspector.
- Draft or unreviewed content is clearly labeled before use in retrieval or publishing.
