# Sprint UI-5 Product Polish

SECURIUM is moving from feature accumulation to product refinement. UI-5 focuses on trust, clarity, and operational consistency without changing database, API, repository, domain, authentication, AI retrieval, ontology, seed, migration, secret, or deployment behavior.

## Product goal

Make SECURIUM feel like a coherent professional learning product:

- Learners should immediately know what to continue, review, and practice next.
- Administrators should inspect coverage, ontology, AI trace, revision, and analytics states through one console pattern.
- AI and ontology surfaces should expose evidence and scope without leaking sensitive prompt, answer, or credential data.
- Dense screens should use progressive disclosure: summary first, workspace second, inspector third.

## Current repository audit

| Area | Current state | Polish opportunity |
| --- | --- | --- |
| `app/admin` | Most admin pages use `SectionHeader`, `PageToolbar`, `WorkspaceLayout`, and `InspectorPanel`. | Continue removing page-local shell variants and add regression tests for shell markers. |
| `components` | Shared primitives exist in `components/design-system-primitives.tsx`; state UI exists in `components/state-ui.tsx`. | Promote repeated admin filters/tables/tree rows into named primitives after behavior stabilizes. |
| Learner routes | Dashboard, curriculum, practice, review, wrong notes, and analytics have product-oriented copy and summary cards. | Complete manual responsive QA and harmonize remaining course-specific empty/loading states. |
| Curriculum | Learner compact tree and admin curriculum manager have stable keys, copy actions, inspector/detail panels, and keyboard affordances. | Add final browser QA for deep official trees and mobile inspector behavior. |
| Coverage/Ontology/AI/Revision/Analytics | Core admin areas now share inspector contract. | Evolve each workspace independently while keeping the shell markers stable. |

## Non-goals

- No Production or Preview DB changes.
- No migration or seed changes.
- No API contract changes.
- No repository or domain logic changes.
- No AI retrieval or ontology logic changes.
- No authentication or RBAC changes.
- No secret, environment, or Vercel deployment changes.

## Product polish principles

1. Prefer action clarity over status density.
2. Keep official curriculum names visible before internal keys.
3. Use Inspector for meaning, metadata, evidence, and next checks.
4. Keep mutation actions in explicit forms or workflow controls, not hidden inspector side effects.
5. Use empty/loading/error states that tell the user what to do next.
6. Preserve course isolation, user isolation, and official/sample distinction in copy.

## UI-5 outcome

This slice locks the core admin inspector contract and documents the broader product polish direction. It intentionally avoids large visual redesign and keeps all backend behavior unchanged.

