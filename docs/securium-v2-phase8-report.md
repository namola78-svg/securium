# SECURIUM V2 - PHASE 8 REVIEW + WRONG NOTES

## Scope

Phase 8 updates only `/reviews`, `/wrong-notes`, their shared presentation, retry actions, related tests, and this report. Practice Focus Mode and the learner shell are reused without redesign.

## Preconditions

- Branch: `agent/isms-p-theory-v1`
- Baseline HEAD: `e3d8293c20127940a9b3d49d912546623b774e77`
- Phase 7 QA evidence passed at 390, 768, 1024, and 1440px with no console errors, page errors, undersized mobile targets, or horizontal overflow.
- Phase 7 final screenshots at 390px and 1440px were visually inspected. No P0 or MAJOR Practice/Explanation regression was found.
- Existing uncommitted Phase 0-7 work and unrelated artifacts were preserved.

## Review UX

`/reviews` now answers whether anything is due today before presenting supporting information. One primary `복습 시작` action uses the existing `reviewOnly=1&count=50` contract. Summary values, item order, course grouping, dates, and consecutive-wrong counts come from the existing `getReviewSummary` result. No priority algorithm was added.

The page distinguishes a completed-today no-due state only when existing `completedToday` data supports it. Otherwise it uses a neutral no-due state and a Practice entry. Priority items are limited to five for presentation without reordering.

## Wrong Notes UX

`/wrong-notes` separates all-record summary values from the currently filtered list. Existing course, subject, topic, difficulty, repeated, and mastered filters remain available. Each row shows a three-line question preview, actual difficulty, latest update date, repeated-wrong count, and the existing mastered state.

The primary row action uses the existing Practice query contract: `wrongOnly=1`, `questionId`, and `count=1`. Memo, mastered-state editing, and bookmarking remain available in a native disclosure so the list stays scannable. No second explanation system was created because answer/explanation detail is handled by Phase 7 Practice.

## Logic and Data Safety

No review scheduling, spaced repetition, `nextReviewAt`, consecutive-wrong calculation, wrong-note persistence, attempt persistence, scoring, answer validation, question selection, randomization, analytics, schema, migration, seed, curriculum, content, taxonomy, ontology, SKOS, provenance, or source data was changed.

## Accessibility and Responsive Behavior

- One learner-facing H1 per page and ordered H2/H3 hierarchy.
- Native list, definition-list, form, select, checkbox, and details/summary semantics.
- Visible focus treatment and text labels in addition to semantic color.
- Controls retain the V2 minimum control size and mobile retry actions expand to full width.
- Mobile page padding preserves the Phase 4 bottom-navigation safe area.
- Layout breakpoints cover desktop, tablet, and compact mobile without introducing body-level horizontal scrolling.

## Validation

## Close-out Verification

### Stale assertion analysis

The two initial integration failures were stale rendered-HTML assertions, not functional regressions.

- Wrong Notes still rendered its summary, filters, repeated-wrong data, and Practice retry link, but the test expected the removed V1 copy `이 조건으로 다시 풀기` and `오답 우선순위 요약`.
- Review still rendered its due summary, priority list, course grouping, and `reviewOnly` Practice link, but the test expected the removed V1 copy `복습 계획` and `복습 인스펙터`.

The assertions were replaced with stable semantic contracts rather than removed. They now verify the Wrong Notes list, total summary, filter, exact `wrongOnly=1&questionId=...&count=1` link, Review summary, priority section, course grouping, and `reviewOnly=1&count=50` link.

### Integration

`npm run test:integration`: **PASS, 23/23**. The question-attempt to Wrong Note accumulation test and the due Review presentation test both pass with the Phase 8 contracts.

### Browser runtime recovery

Browser QA used the repository-supported Vinext/Vite Cloudflare runtime with `APP_BUILD_TARGET=cloudflare`, `AUTH_PROVIDER=sites`, `D1_TEST_MODE=1`, `DB_PROVIDER=d1`, and the existing authenticated D1 fixture. The server was started through the Vinext CLI on `localhost` with an explicit unique port.

The previous block had two environment causes. `npm run dev:cloudflare -- --port 33280` did not forward the port to Vinext and actually listened on port 3000, while a later direct probe used `127.0.0.1` against a server advertised on `localhost`. No production runtime or application architecture was changed.

### Responsive and visual QA

- **390 x 844: PASS.** Review status and the primary action are visible in the first viewport. Wrong Notes keeps one compact item, a three-line preview, visible repeated-wrong text, a full-width 48px retry action, disclosure, and bottom-navigation safe spacing. The Phase 4 bottom navigation is visually present and does not cover the action.
- **768 x 1024: PASS.** Both pages use the tablet header/drawer layout, keep compact vertical content, and avoid forced sidebar or bottom-navigation stacking.
- **1024 x 900: PASS.** The learner sidebar transition is correct, content width remains readable, summary and list rows do not clip, and filters remain contained.
- **1440 x 900: PASS.** Review uses the intended lead/summary hierarchy and compact priority/course rows. Wrong Notes keeps a compact summary, filter, and list rather than oversized marketing cards.

Eight full-page screenshots are stored under `reports/ui-v2/phase8` as `reviews-{viewport}.png` and `wrong-notes-{viewport}.png`.

### Review flow QA

**PASS.** Clicking the primary Review action navigated to `/practice/isms-p?reviewOnly=1&count=50`. The Phase 7 `data-practice-focus-v2` shell and `data-practice-session-v2` session rendered successfully. The Phase 7 dedicated browser harness also returned HTTP 200 for `reviewOnly`, showed the review mode, and recorded zero overflow.

### Wrong Notes retry flow QA

**PASS.** Clicking a row action navigated to `/practice/isms-p?wrongOnly=1&questionId=course-isms-p-question-01&count=1`. The exact question ID, `wrongOnly`, and count contracts were retained and Practice Focus Mode/session rendered successfully.

Browser inspection found one Phase 8 presentation regression during close-out: `review-v2.module.css` referenced the nonexistent `--v2-color-primary`, making white retry text transparent on white. The reference was minimally corrected to the existing Phase 1 token `--v2-color-action-primary`. The final computed retry background is `rgb(37, 99, 235)` and its mobile target height is approximately 48px.

### Horizontal overflow

**PASS.** `/reviews`, `/wrong-notes`, and both empty states reported `document.documentElement.scrollWidth - clientWidth = 0` at 390, 768, 1024, and 1440px.

### Accessibility

**PASS with no major issue.** Each page has one H1 and ordered section headings. Review and Wrong Notes use list and definition-list semantics. Filters retain native labels/selects/checkboxes. The native details/summary disclosure opened from the keyboard and retained focus; memo and mastered controls were exposed. Retry and primary actions are links with at least 44px targets. Repeated wrong and mastered states include text and are not conveyed by color alone. Focus-visible styling remains active.

### Console and regression

**PASS.** All eight Phase 8 route/viewport cases returned HTTP 200 with no console warning, console error, page error, hydration mismatch, or horizontal overflow. Dashboard, Learn, and Practice returned HTTP 200 in the authenticated browser fixture. Practice retained Focus Mode. The Phase 7 Practice/Explanation browser harness passed 4/4 viewport cases, including answer result, official explanation, review-only mode, overflow, and anonymous 307 protection.

### Final automated verification

- `git diff --check`: PASS; only existing LF-to-CRLF notices were emitted.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Phase 8 focused tests: PASS, 3/3.
- `npm run test:unit`: PASS, 342/342.
- `npm run test:integration`: PASS, 23/23.
- `npm run build`: PASS; 63 static-generation steps completed.
- `npm run build:cloudflare`: PASS; the existing Vinext static route-classification advisory remains non-fatal.
- Phase 7 Practice/Explanation browser regression: PASS, 4/4.
- Full E2E (`npm run test:e2e`): **ENVIRONMENT TIMEOUT after 360 seconds**. The command did not emit a specific failing test before the execution limit. This is recorded as unconfirmed rather than hidden or treated as a pass. The same integration suite and both production builds passed independently.

### Data and domain safety

No DB schema, migration, migration metadata, seed, question, answer, explanation, Content V3, taxonomy, ontology, SKOS, provenance, review scheduling, spaced repetition, wrong-answer persistence, scoring, or analytics implementation was changed during Phase 8 close-out.

### Remaining issues and final decision

- Full E2E completion remains unconfirmed because the repository command exceeded the 360-second execution window without a concrete failure.
- Vinext continues to print its existing non-fatal route-classification advisory during the Cloudflare build.

All mandatory Phase 8 functional, responsive, accessibility, integration, browser-flow, console, type, lint, unit, and build gates pass. Phase 8 close-out status: **PASS**. Phase 9 may begin only after a separate explicit request.
