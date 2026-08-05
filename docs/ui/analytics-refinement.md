# Student Analytics UX Refinement

This document records the UI-only refinement for learner analytics.

## Scope

- Target routes:
  - `/analytics`
  - `/analytics/[courseId]`
- Change type:
  - Student product UX refinement
  - Copy cleanup
  - Next-action hierarchy

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

## Integrated Analytics Pattern

The integrated analytics page now presents:

1. A `LEARNING ANALYTICS` page header.
2. A `LEARNING SIGNALS` overview panel with total courses, study days, questions, and streak.
3. A `NEXT ANALYTIC ACTION` panel that points to the most useful course-level action.
4. Course-scoped rows with accuracy, level completion, theory progress, and practice CTA.
5. Empty state that routes learners back to course discovery.

## Course Analytics Pattern

The course analytics page now presents:

1. A `COURSE ANALYTICS` page header.
2. A `COURSE SIGNALS` overview panel with accuracy, recent activity, repeated wrong answers, and level completion.
3. A `PRIORITY AREA` panel for the weakest topic or fallback practice action.
4. Breakdown panels for difficulty, question type, subject, and topic.
5. Secondary metrics for 30-day activity, response time, review success, and mock exam average.

## Accessibility Notes

- Summary values use semantic `dl` structures.
- Action panels keep a clear heading and one primary route.
- Zero-data states explain when analytics will appear.
- Mobile layouts collapse to one column and keep CTA buttons touch-friendly.

## Product Principle

Analytics should answer one learner question quickly:

> Which area should I study next?

