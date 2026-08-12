# SECURIUM V2 - PHASE 4 LEARNER SHELL AND DASHBOARD

## Scope

Phase 4 introduces the opt-in V2 learner application shell and refines the authenticated dashboard. Learner data contracts, authentication resolution, database providers, course and practice routes, admin UI, and public/auth V2 presentations retain their existing behavior.

## Implementation

- `LearnerAppShell` activates only for authenticated learner routes.
- Desktop uses a persistent sidebar and page-context header.
- Tablet uses a modal navigation drawer with scroll locking, focus containment, Escape handling, and focus restoration.
- Mobile adds five app-like bottom navigation destinations while retaining the full drawer.
- Profile, settings, AI Tutor, review, analytics, and admin access remain available without duplicating primary navigation.
- The dashboard prioritizes the next recommended action, today's question goal, scheduled review, active courses, and summary metrics.
- Public pages, V2 landing/auth pages, and admin pages remain outside the learner shell.

## Accessibility and responsive behavior

- The learner content keeps a stable `#main-content` skip target.
- Active navigation is expressed with `aria-current="page"` and text in addition to color.
- The mobile drawer is rendered only while open, preventing hidden links from entering the tab order.
- Drawer close actions restore focus to the menu trigger.
- Drawer and profile controls expose expanded state and accessible names.
- Navigation targets preserve the V2 minimum control size and focus-visible treatment.
- Learner routes have no horizontal overflow at 390, 768, 1024, or 1440px.

## QA harness correction

The first Phase 4 run started a Next development server while forcing `DB_PROVIDER=d1`. Next does not provide the Cloudflare D1 binding, so authenticated pages rendered the application error boundary.

`reports/ui-v2/phase4/learner-shell-qa.mjs` now uses the repository's Vinext/Cloudflare test runtime with the persistent local D1 state. It also records route failures instead of timing out when an expected interaction control is missing, waits for the intentional drawer focus transition, and models the established V2 header behavior for landing and authentication routes.

## Validation results

| Check | Result |
| --- | --- |
| Learner route/viewport cases | PASS, 28/28 |
| Viewports | 390, 768, 1024, 1440 |
| HTTP responses | 200 for all learner cases |
| Horizontal overflow | 0 cases |
| Console warnings/errors | 0 learner cases |
| Drawer expanded state | PASS |
| Drawer focus entry and return | PASS |
| Profile expanded state and focus return | PASS |
| Public/auth learner-shell isolation | PASS, 6/6 |
| Admin learner-shell isolation | PASS |

Machine-readable evidence is stored in `reports/ui-v2/phase4/qa-results.json`. Dashboard screenshots for all four viewports are stored beside it.

The full unit suite, lint, typecheck, production build, and Cloudflare build were not rerun in this continuation.

## Phase boundary

Phase 4 is complete. Individual learning, practice, review, analytics, AI Tutor, profile, and admin content-surface V2 migrations remain outside this phase.
