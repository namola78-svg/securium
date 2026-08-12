# SECURIUM V2 — PHASE 2 PUBLIC LANDING

## A. Scope

Phase 2 migrates only the signed-out `/` landing experience to the opt-in V2 design system. The login and signup screens, learner shell, learner routes, admin UI, authentication, APIs, database, curriculum, ontology, SKOS, and Content V3 remain outside this change.

## B. Previous State

The previous landing used the legacy production shell and legacy visual language. Phase 0–1 already provided the audit and an isolated V2 token namespace. The legacy `:root` production tokens were not edited for this migration.

## C. Public V2 Architecture

- `/` renders inside `V2Foundation` with `data-public-v2`.
- Landing styles are supplied by a CSS Module imported only by the landing page and its dedicated public header.
- The root legacy header, footer, and command trigger are suppressed only while a descendant with `data-public-v2` is present.
- `/courses`, `/guide`, `/about`, `/login`, learner routes, and admin routes retain the legacy shell.
- Shared V2 button behavior is additive; no legacy button variant was redefined.
- `V2Button` is an explicit Client Component because its disabled link behavior attaches an event handler. Playwright runtime QA detected and verified this React Server Component boundary.

## D. Desktop Header

The landing has a white sticky header with a thin border, compact brand treatment, real navigation routes (`/courses`, `/guide`, `/about`), and separate login and primary signup actions. No dark header or decorative color treatment is used.

## E. Mobile Header

The mobile header keeps the brand, a primary start action, and a menu trigger. The menu provides real navigation and authentication routes, a backdrop, focus containment, focus restoration, body scroll locking, `aria-expanded`, `aria-controls`, dialog semantics, Escape handling, and 44px minimum targets.

## F. Hero

The hero uses a responsive two-column layout, an educational qualification-learning proposition, and real `/signup` and `/courses` CTAs. Copy positions AI as an explanatory aid and does not claim that it replaces official answers.

## G. Product Preview

The preview demonstrates a representative learning path: theory, questions, wrong-answer review, evidence status, weak concepts, and AI-assisted explanation. It is explicitly labeled `학습 화면 예시` and `실제 계정 데이터 아님`; no personal progress or account statistics are implied.

## H. Learning Flow

The landing presents five concise steps: official scope, core theory, question practice, explanation/AI assistance, and wrong-answer review. Desktop uses a connected horizontal sequence and mobile collapses it to a vertical sequence.

## I. Course Spotlight

Course cards are populated from `listPublishedCoursesCached()`. The preferred order highlights the two information-security qualifications followed by available published catalog entries. Each card uses stored course group, name, description, difficulty, subject count, topic count, and question count. The fetch remains wrapped in the existing graceful fallback behavior.

## J. Trust / Evidence

The trust section uses qualitative, verifiable product principles: official-scope structure, review/source status, concept-to-question connections, and PC/mobile study. Internal ontology and SKOS terminology is not exposed to learners.

## K. Final CTA

The final CTA provides only two actions: free signup and course exploration. Marketing copy is deliberately short and avoids unsupported outcome claims.

## L. Footer

The V2 footer links only to existing routes: courses, guide, about, privacy policy, and terms. It is scoped to the landing and does not replace the legacy footer on other routes.

## M. Real Data Usage

- Published catalog data comes from the existing cached catalog repository.
- Course facts use existing display helpers and safe count normalization.
- Signed-in access to `/` still redirects to `/dashboard` through the existing authentication check.
- Catalog failure does not prevent the rest of the landing from rendering.

## N. Fake Data Check

- No learner progress percentage is shown to signed-out users.
- No learner count, pass rate, support availability, or unsupported total is claimed.
- Product-preview content is explicitly identified as non-account example content.

## O. Accessibility

- The existing root skip link is retained and receives a landing-scoped V2 focus treatment.
- The page has one primary `main`, one page H1, ordered H2/H3 section headings, semantic sections, articles, lists, description lists, header, nav, and footer.
- Links are used for navigation and buttons for dialog actions.
- Mobile menu keyboard focus, Escape, focus restoration, labels, expanded state, modal semantics, touch targets, focus-visible styling, contrast, and reduced motion are handled.
- Status is not communicated by color alone.

## P. Responsive QA

Responsive CSS explicitly covers desktop, tablet, mobile, and narrow mobile transitions at 1023px, 767px, and 389px. Layouts use `minmax(0, ...)`, wrapping actions, one-column mobile cards, constrained copy, and landing-level `overflow: clip` to prevent body overflow. Static tests confirm no new 10px or 11px text and 44px minimum controls.

The requested 320, 375, 390, 430, 640, 768, 1024, 1280, 1440, and 1920 layout intent is represented by these fluid ranges. Playwright pixel-level inspection was completed at the required minimum viewports of 390, 768, 1024, and 1440.

## Q. Visual QA

Local Playwright 1.62.1 with its installed Chromium runtime was used without adding a repository dependency. Full-page screenshots and machine-readable results are stored in `reports/ui-v2/phase2/`.

- 390, 768, 1024, and 1440: HTTP 200, one H1, V2 header/footer visible, legacy header/footer hidden, primary signup CTA visible, and four real course-detail links present.
- Horizontal overflow: zero at all four viewports (`htmlScrollWidth === htmlClientWidth` and `bodyScrollWidth === innerWidth`).
- Console errors, console warnings, and page errors: zero at all four viewports.
- 390 mobile menu: `aria-expanded` open/closed transitions, focus entry, Escape close, trigger focus restoration, and body overflow restoration all passed.
- `/courses`, `/guide`, `/about`, and `/login`: HTTP 200, no V2 activation, legacy header visible, no horizontal overflow, and no console/page error.

The first browser run exposed a real Vinext runtime error: `V2Button` passed a link event handler across a Server Component boundary. Declaring the interactive primitive as a Client Component fixed the runtime failure; the final Playwright run passed every check.

## R. Tests

- `git diff --check`: passed; Git reported only expected LF-to-CRLF working-copy notices.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 331/331 passed.
- `npm run test:integration`: 23/23 passed.
- Landing V2 focused contract tests: 12/12 passed.
- Playwright responsive/runtime QA: 4/4 viewport suites and 4/4 public-route regression checks passed.
- `npm run test:e2e`: two aggregate attempts each passed 75/80. In both runs, the same five AI E2E cases could not start their Vinext worker because of a shared internal runner error. The generated error reference changed between runs, while the failure site and behavior remained identical.
- Isolated retry of `tests/ai-e2e.test.mjs`: 5/5 passed. Across the aggregate run and isolated retry, every E2E scenario passed, but the aggregate command does not currently exit successfully because the AI Vinext worker fails during bundled-suite startup.

## S. Build

- `npm run build`: passed with Next.js 16.2.6.
- `npm run build:cloudflare`: passed with Vinext/Vite.
- Cloudflare build emitted its existing static-classification advisory for routes that static analysis cannot classify; compilation completed successfully.

## T. Files Changed

Phase 2 implementation:

- `app/page.tsx`
- `components/v2/public-landing-header.tsx`
- `components/v2/public-landing.module.css`
- `components/v2/v2-button.tsx`
- `components/v2/v2-button.module.css`
- `components/v2/v2-foundation.module.css`
- `components/v2/index.ts`
- `tests/landing-hero-card.test.ts`
- `tests/rendered-html.test.mjs`
- `tests/v2-design-system-foundation.test.ts`
- `docs/securium-v2-phase2-report.md`

Phase 0–1 files and pre-existing user artifacts remain uncommitted and preserved separately in the working tree.

## U. Intentionally Not Changed

- Login and signup presentation
- Learner app shell, sidebar, mobile bottom navigation, dashboard, learn, practice, mock exams, reviews, wrong notes, analytics, AI tutor, profile, and settings
- Admin UI
- Route URLs and route semantics
- Existing E2E infrastructure
- Legacy global production token values and legacy component visual contracts

## V. Global Regression Check

V2 activation is statically restricted to `app/page.tsx`; its isolation test passed. No landing stylesheet is imported by learner or admin routes. The integration suite continued to pass learner, authentication, and admin rendering/behavior contracts. Other public routes retain their existing shell.

Screenshot-based learner/admin comparison was not possible because the browser connection was unavailable.

## W. DB / Migration Status

No database schema, Drizzle schema, migration, migration metadata, D1 schema, PostgreSQL schema, seed semantics, production data, taxonomy, curriculum, ontology, SKOS, provenance, Content V3, auth, or API file was changed. Tests used their existing disposable local D1 setup only.

## X. Phase 3 Readiness

The Public Landing implementation is ready for Phase 3 from a code, test, integration, build, and visual-QA perspective. The required 390/768/1024/1440 screenshots, mobile-menu focus behavior, console state, and horizontal overflow checks are complete. Phase 3 was not started.
