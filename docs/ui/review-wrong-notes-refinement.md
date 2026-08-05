# Review and Wrong Notes Student UX Refinement

This document records the UI-only refinement for the learner review and wrong-note flow.

## Scope

- Target routes:
  - `/reviews`
  - `/wrong-notes`
- Target component:
  - `WrongNoteCard`
- Change type:
  - Student product UX refinement
  - Copy cleanup
  - Summary and inspector pattern alignment

## Boundaries

This step does not change:

- Production DB
- Preview DB
- Seed data
- Migrations
- API routes
- Repository logic
- Authentication logic
- Business rules
- Deployment settings

## Review Page Pattern

The Review page now presents:

1. A `SMART REVIEW` page header.
2. A `TODAY REVIEW PLAN` overview panel with:
   - due review count
   - overdue review count
   - estimated time
   - completed-today count
3. Existing completion progress.
4. Course-scoped review cards.
5. A priority review workspace.
6. A `REVIEW INSPECTOR` panel for the next recommended action.

## Wrong Notes Pattern

The Wrong Notes page now presents:

1. A `WRONG ANSWER REVIEW` page header.
2. A `WRONG NOTE INSIGHT` overview panel with:
   - total wrong notes
   - repeated wrong notes
   - unresolved notes
3. Course, subject, topic, difficulty, repeated, and mastered filters.
4. A current-filter summary card.
5. Wrong-note cards with memo, mastered status, retry, and bookmark actions.

## Accessibility Notes

- Overview panels use semantic `dl` summaries.
- Form controls keep labels and native inputs.
- Save/bookmark feedback uses `role="status"`.
- Buttons are disabled while async actions are pending.
- Mobile layouts collapse to one column without horizontal scrolling.

## Product Principle

Review and wrong-note screens should answer one learner question quickly:

> What should I review next, and why?

