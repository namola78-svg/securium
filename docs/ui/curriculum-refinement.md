# Curriculum Learner Refinement

This note records the UI-only refinement applied to the learner-facing curriculum overview.

## Goal

Make official CurriculumTree content readable for learners without exposing an admin-like nested card structure.

## Pattern

- Compact tree list instead of deeply nested cards.
- Official title appears before internal identifiers.
- Stable Key remains visible as secondary metadata with copy support.
- Default expansion remains shallow so learners see the course structure before details.
- Each selected node opens a Curriculum Inspector panel.
- The inspector recommends the next action:
  - open the linked lesson when available;
  - start scoped practice when questions are connected;
  - show a prepared-but-not-yet-linked state otherwise.

## Learner-facing hierarchy

Internal node types are still sourced from the existing CurriculumTree data model, but the UI prioritizes learner-friendly labels from the existing service layer.

## States

- Loading: handled by the existing page shell and state components.
- Empty: the page should explain that curriculum content is being prepared, not expose seed or migration terms.
- Error: use the shared error state and avoid internal details.

## Accessibility

- The tree list uses `role="tree"` and each row uses `role="treeitem"`.
- Rows are keyboard selectable with Enter or Space.
- Expand/collapse buttons expose node-specific labels.
- Copy buttons have explicit `aria-label` text.

## Scope

This was a UI and documentation refinement only.

- No DB changes.
- No seed changes.
- No migration execution.
- No API changes.
- No repository changes.
- No business logic changes.
