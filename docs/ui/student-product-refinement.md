# SECURIUM Student Product Refinement

## Scope

This refinement track covers public and learner-facing product UX only.

Out of scope for this track:

- Production DB changes
- Preview DB changes
- Seed changes
- Migration execution
- Secret changes
- Vercel deployment
- API, Repository, or business logic changes

## Product direction

SECURIUM should feel like a focused learning cockpit for security professionals:

- Official curriculum and standard mapping are visible but not overwhelming.
- Learners always know what to do next.
- AI support is clearly separated from official explanations and always explains its basis.
- Progress, weak areas, reviews, and recommendations are course-scoped.

## Recommended rollout order

1. Landing page validation
2. Learner Dashboard
3. Curriculum learning overview
4. Question solving and AI explanation
5. Wrong notes and review
6. Learning analytics

This sequence keeps the first user impression stable before refining deeper authenticated learning flows.

## Current implementation baseline

| Area | Current state | Refinement focus |
| --- | --- | --- |
| Landing | Brand, hero, CTA, value cards, course preview are implemented. | Product hierarchy, responsive polish, copy consistency. |
| Header | Public and signed-in menus are separated. Mobile drawer and account menu exist. | Active state, focus flow, account actions, menu density. |
| Course catalog | Data-driven cards show status and course comparison fields. | Card scanability and fallback copy. |
| Dashboard | Authenticated dashboard exists. | Next-action clarity and course-scoped progress. |
| Curriculum | Official CurriculumTree and compact tree UI exist. | Learner overview and inspector-style detail continuity. |
| Question/AI | Practice, AI tutor, explanations, trace/admin tooling exist. | Learner-facing trust boundary and citation display. |
| Review/Wrong notes | Review and wrong-note flows exist. | Prioritization and empty states. |
| Analytics | Learner analytics exists; admin analytics is shell-aligned. | Learner insight hierarchy and zero-data states. |

## Student UX principles

1. Primary action first: every page should make the next learning action obvious.
2. Course scope always visible: progress and attempts must not feel mixed across courses.
3. Official vs AI separation: official content, AI explanation, and user notes must be visually distinct.
4. No dead ends: empty states should suggest a safe next step.
5. Mobile first for learning: lists, CTA, and readers must remain comfortable at 360px.

## Page-by-page refinement intent

### Landing

- Goal: explain the value of SECURIUM in less than 10 seconds.
- Primary action: start learning.
- Secondary action: browse courses.
- Risk: too much platform capability language can obscure learner benefit.

### Dashboard

- Goal: show today's plan and course progress.
- Primary action: continue the next recommended item before scanning metrics.
- Empty state: guide users to enroll in a course.
- Risk: showing aggregate numbers without clear next action.
- Current refinement: the dashboard hero now reserves a first-class "추천 다음 행동" area
  before secondary stats so that learners can immediately continue studying.

### Curriculum

- Goal: help learners understand official structure and where they are.
- Primary action: start or continue the selected node's linked content.
- Empty state: show curriculum preparation state without internal implementation terms.
- Risk: deep trees becoming admin-like rather than learning-oriented.

### Lesson / Theory

- Goal: readable content with progress continuity.
- Primary action: mark complete or continue to practice.
- Empty state: recommend adjacent curriculum or course overview.
- Risk: long formal text without summaries or checkpoints.

### Question / AI Explanation

- Goal: solve, understand, and connect mistakes to curriculum.
- Primary action: submit answer, then review explanation.
- AI boundary: display "AI 참고 설명" separately from official explanation.
- Risk: AI explanation looking like official grading.

### Review / Wrong Notes

- Goal: convert mistakes into a manageable review queue.
- Primary action: start due review.
- Empty state: celebrate no due reviews and suggest new practice.
- Risk: repeated wrong notes feeling punitive.

### Analytics

- Goal: convert data into learning decisions.
- Primary action: go to weakest course/topic or recommended review.
- Empty state: explain that analytics appears after learning activity.
- Risk: overly complex charts without action.

## Regression checklist

- Public pages do not require login.
- Protected pages redirect to `/login?return_to=<internal-path>` once.
- Logged-in users do not see the login form when navigating within protected pages.
- CTAs use existing auth and course-enrollment logic.
- No course names or subjects are hardcoded in new UI logic.
- Empty, loading, and error states use shared state components where practical.
