# Preview Beta QA Plan

This plan turns UI-6 into a concrete QA pass before user testing.

## Preconditions

- [ ] Latest intended commit is pushed.
- [ ] Preview deployment is ready.
- [ ] Preview environment variables are confirmed without exposing values.
- [ ] Supabase Site URL and Redirect URLs include the Preview/Production targets under test.
- [ ] Test account exists.
- [ ] Admin account exists.
- [ ] No production migration or seed is pending.

## Automated checks

Run locally before Preview QA:

```powershell
npm.cmd run typecheck
npm.cmd run lint
node scripts/run-d1-test-suite.mjs --test --test-concurrency=1 tests/rendered-html.test.mjs
npm.cmd run build
```

If a command is unavailable or blocked, record the blocker instead of marking it passed.

## Learner smoke test

| Step | Expected result |
| --- | --- |
| Visit `/` | SECURIUM branding, learner value proposition, and course CTA are visible. |
| Visit `/courses` | Course cards compare title, audience, difficulty, amount, state, and CTA. |
| Open course detail | Course introduction, curriculum, and enrollment CTA render without login-loop confusion. |
| Login | Successful login lands on `/dashboard` or safe internal `return_to`. |
| Enroll or continue | CTA updates without duplicate enrollment. |
| Open `/learn/[courseSlug]` | Curriculum path, progress, and inspector are readable. |
| Open a course lesson | Progress action and lesson body render. |
| Open practice | Question session does not expose answers before submission. |
| Request AI explanation | AI generated content is marked as reference-only. |
| Open wrong notes/reviews | Empty or populated states are understandable. |
| Open analytics | Zero-denominator and sparse states do not break layout. |
| Logout | Session clears and protected routes redirect to login. |

## Admin smoke test

| Route | Expected result |
| --- | --- |
| `/admin` | Dashboard shell, top bar, sidebar, account drawer, and inspector render. |
| `/admin/curriculum` | Official title, stable key, source metadata, tree, and inspector render. |
| `/admin/coverage` | Summary, gap queue, and coverage inspector render. |
| `/admin/ontology` | Concept/edge lists and ontology inspector render. |
| `/admin/ai-explainability` | Trace list, filters, safety note, and inspector render without prompt leakage. |
| `/admin/content-revisions` | Target picker, revision history, impact, and inspector render. |
| `/admin/analytics` | Metric formula, source data, and inspector render. |
| `/admin/question-reports` | Report queue and report inspector render. |
| `/admin/audit-logs` | Audit filters, records, and inspector render; no delete/edit log route is exposed. |

## Accessibility pass

- [ ] Keyboard can open and close mobile navigation.
- [ ] Escape closes drawers/menus where applicable.
- [ ] Focus ring is visible on primary actions.
- [ ] Heading order is logical.
- [ ] Form labels are connected.
- [ ] Status changes use `role=status`, `role=alert`, or `aria-live` where needed.
- [ ] Tree items expose expanded/selected state.
- [ ] Color is not the only state indicator.

## Responsive pass

- [ ] 390px has no horizontal scroll.
- [ ] 768px stacks inspector below main content.
- [ ] 1024px keeps admin controls usable.
- [ ] 1280px displays workspace and inspector comfortably.
- [ ] 1440px does not over-stretch text lines.

## Exit criteria

Preview Beta QA is complete when:

- All P0/P1 issues are fixed or explicitly accepted.
- P2/P3 issues are logged with route, reproduction, and severity.
- User-testing script is ready.
- Release notes include known limitations.

