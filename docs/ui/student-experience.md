# Student Experience Polish

The learner experience should lead with the next useful action, not a dashboard full of raw statistics.

## Priority hierarchy

1. Continue Learning
2. Today's Review
3. Weak Concepts
4. Recommended Study
5. Recent Questions
6. Progress

## Current surfaces

| Surface | Current state | Next polish |
| --- | --- | --- |
| Home | Brand and value proposition are aligned to SECURIUM. | Final responsive hero QA and CTA tracking. |
| Course list | Cards compare course title, description, difficulty, amount, state, and CTA. | Verify long course names at 390px and 768px. |
| Course detail | CTA states distinguish unauthenticated, enrolled, unenrolled, processing, error, and completed paths. | Browser QA for Supabase-authenticated CTA refresh. |
| Dashboard | Shows next learning action, review shortcut, and learner summary. | Reduce metric density if future data grows. |
| Curriculum | Compact path tree, stable key copy, official labels, inspector, linked lesson/question actions. | Verify deep tree keyboard navigation and mobile detail behavior. |
| Practice / AI explanation | Practice summary and AI trust strip separate generated explanation from reviewed content. | Add browser QA for AI panel empty/error states. |
| Review / Wrong notes | Today's review plan, course cards, priority area, and wrong-note action cards. | Confirm repeated wrong-note actions do not visually duplicate state. |
| Analytics | Integrated and course analytics show signals, next action, and safe zero-denominator handling. | Add visual QA for sparse data and many enrolled courses. |

## Empty/loading/error guidance

- Loading should preserve layout with skeletons when possible.
- Empty states should include an action such as course browsing or practice start.
- Error states should avoid server internals and provide retry or navigation.
- Long-running authentication checks should not show indefinite text-only loading.

## Responsive checkpoints

- 390px: one-column cards, full-width primary CTAs, no horizontal scroll.
- 768px: two-column summaries where appropriate, inspector should stack below.
- 1024px: learner workspace can show side cards but should not crowd content.
- 1280px and above: split layouts and inspector panels can appear side-by-side.

## Accessibility checkpoints

- Maintain heading order per page.
- Preserve label/input connections in auth and forms.
- Ensure selected tree rows and active navigation are not color-only.
- Keep touch targets at least 44px for primary mobile actions.
- Use `aria-live` for status changes that matter to learners.

