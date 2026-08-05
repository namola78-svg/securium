# SECURIUM Landing Page Refinement

## Current file map

| Concern | File |
| --- | --- |
| Landing page | `app/page.tsx` |
| Global layout and metadata | `app/layout.tsx` |
| Header shell | `components/site-header.tsx` |
| Header controls and mobile drawer | `components/header-controls.tsx` |
| Course card | `components/course-card.tsx` |
| Course display fallbacks | `lib/course-display.ts` |
| Global responsive styles | `app/globals.css` |
| Server-render regression tests | `tests/rendered-html.test.mjs` |

## Landing IA

1. Hero
   - Eyebrow: `AI-POWERED SECURITY LEARNING`
   - Main heading: information security capability in one learning system
   - Supporting copy: certification, practice cases, AI tutor, and review loop
   - Primary CTA: free learning start
   - Secondary CTA: course browsing
2. Product preview card
   - SECURIUM learning experience
   - Published course count
   - Official standards, evidence-based AI explanation, and learning loop
   - Course catalog CTA
3. Value section
   - Course-scoped progress
   - Problem and review-centered learning
   - AI learning support
4. Course preview
   - Data-driven top courses
   - Database unavailable fallback
   - Empty course state

## What is already good

- The hero is value-led instead of implementation-led.
- The right-side panel shows a product scenario rather than pure decoration.
- CTAs point to existing routes and do not introduce new auth behavior.
- Course cards are data-driven through the catalog repository/cache path.
- Mobile-specific CSS exists for hero text, CTA stacking, course grid, and header drawer.

## Refinement guardrails

- Do not introduce new routes just for decorative links.
- Do not add static course names beyond illustrative text already present in the hero card.
- Do not change redirect, login, enrollment, or repository behavior from the landing UI.
- If a feature is not ready, use "개설 예정" or a helpful empty state rather than internal stage names.
- Keep the dark SECURIUM atmosphere, but maintain WCAG-oriented contrast and visible focus rings.

## Recommended acceptance criteria

| Area | Acceptance criteria |
| --- | --- |
| Brand | `시큐리움`, `SECURIUM`, and official description remain consistent. |
| Hero | Heading wraps naturally at 360px, 390px, 768px, and desktop widths. |
| CTA | Primary and secondary buttons are at least 44px high and keyboard-focusable. |
| Product card | Public visitors see platform value rather than personal progress or detailed curriculum node metadata. |
| Course preview | Empty and database-unavailable states are user-readable. |
| Accessibility | Main heading is unique; decorative effects are not required for understanding. |
| Regression | Server-rendered HTML includes the hero message, CTA, values, and no development-stage labels. |

## Next refinements after landing

1. Learner Dashboard: define a daily plan hierarchy and course-scoped next action.
2. Curriculum: make official hierarchy readable for learners, not only admins.
3. Question + AI Explanation: separate official explanation, AI note, citation, and next review action.
4. Wrong Notes + Review: reduce anxiety with priority, due date, and mastery status.
5. Analytics: translate metrics into recommended learning actions.
