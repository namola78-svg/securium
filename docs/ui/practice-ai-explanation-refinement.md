# Practice and AI Explanation Refinement

This note records the UI-only refinement applied to the learner-facing practice session and AI explanation area.

## Goal

Make the question-solving flow clearer before and after grading while keeping AI output visibly separate from official grading.

## Pattern

- A Practice Guide appears at the top of the question card.
- The guide explains when grading and AI explanation become available.
- Progress facts show completed items, remaining items, and whether AI explanation can be requested.
- AI explanation panels expose compact trust metadata:
  - provider;
  - source count;
  - latency;
  - review state.

## Boundaries

- Correct answers are still not exposed before submission.
- AI explanations remain available only after a graded attempt.
- AI output is framed as reference material, not an official score or official interpretation.
- Existing idempotency, grading, wrong-note, bookmark, and report flows are unchanged.

## Accessibility

- The practice guide uses an explicit `aria-label`.
- The AI metadata strip uses a definition list with an explicit `aria-label`.
- Buttons retain existing disabled states and keyboard behavior.

## Scope

This was a UI and documentation refinement only.

- No DB changes.
- No seed changes.
- No migration execution.
- No API changes.
- No repository changes.
- No business logic changes.
