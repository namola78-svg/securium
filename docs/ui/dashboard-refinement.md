# SECURIUM Learner Dashboard Refinement

## Scope

This refinement is UI-only. It does not change authentication, enrollment,
recommendation algorithms, repositories, APIs, database schema, seed data, or
deployment settings.

## Current screen

| Concern | Current file |
| --- | --- |
| Learner dashboard | `app/dashboard/page.tsx` |
| Enrollment summary | `lib/dashboard-enrollments.ts` |
| Today learning plan | `db/phase3-repositories.ts` |
| Progress display | `components/progress-bar.tsx` |
| Learning goal settings | `components/learning-settings-form.tsx` |
| Styling | `app/globals.css` |

## Product intent

The dashboard should answer one question before anything else:

> What should I study next?

Secondary information such as enrolled course count, total registrations, and
statistics should support that answer rather than compete with it.

## Information priority

1. Recommended next action
2. Current focus course
3. Due review count
4. Daily question goal progress
5. Active courses
6. Detailed course metrics

## UI decisions

- A "추천 다음 행동" card is shown inside the dashboard hero.
- The card uses the first existing recommendation when available.
- If there is no recommendation but reviews are due, it links to review.
- If there is an active course, it links to the course learning page.
- If there is no course, it links to course browsing.
- The existing "계속 학습하기" and "오늘의 복습 보기" actions remain as secondary actions.

## Empty state

When there is not enough data to create recommendations:

- Explain that more learning activity is needed.
- Offer course browsing as the safe next action.
- Do not present AI personalization as active if it is not backed by data.

## Mobile behavior

- The next action card collapses to a single column below 760px.
- CTA remains at least 44px high through existing button styles.
- The focus card remains readable as a compact summary.

## Regression expectations

- `/dashboard` remains protected by existing auth flow.
- The page still renders for development authenticated headers.
- Multi-course progress remains course-scoped.
- Existing dashboard links to `/learn/<courseSlug>` and `/practice/<courseSlug>` are preserved.
- No database or repository behavior is changed.

