# Preview Beta Freeze

Date: 2026-08-05  
Frozen baseline: `b4c3961 Prepare UI preview beta readiness`  
Product: 시큐리움 | SECURIUM

This document records the Preview Beta Freeze baseline. After this point, changes should be limited to defects, accessibility fixes, copy corrections, and test/documentation updates that support beta validation.

## Freeze decision

Decision: GO

SECURIUM is ready to enter Preview Beta QA and guided user testing from the frozen baseline above.

## Frozen scope

The following areas are considered part of the Preview Beta baseline:

- Public landing page.
- Course directory and course detail pages.
- Login, authenticated header, mobile menu, and account menu.
- Learner dashboard.
- My courses.
- Course curriculum and CourseLesson learning path.
- Practice entry points.
- AI Tutor and AI explanation trust copy.
- Wrong notes and today's review.
- Learning analytics.
- Admin Console Shell.
- Admin Curriculum.
- Admin Coverage.
- Admin Ontology.
- Admin AI Explainability.
- Admin Content Revisions.
- Admin Question Reports.

## Allowed after freeze

- P0/P1 bug fixes.
- Authentication and logout correctness fixes.
- Accessibility fixes.
- Responsive layout fixes.
- Copy corrections.
- Empty/loading/error state fixes.
- Tests that lock current product behavior.
- Documentation updates.

## Not allowed after freeze without explicit owner approval

- New large features.
- New database tables.
- Production or Preview DB migrations.
- Seed changes.
- API contract changes.
- Repository/domain logic rewrites.
- Authentication provider changes.
- Secret or environment variable changes.
- Production deployment outside the release checklist.

## Verification already completed

| Area | Status |
| --- | --- |
| Local unit tests | Passed |
| Local E2E tests | Passed |
| Typecheck | Passed |
| Lint | Passed |
| Production build | Passed |
| Browser QA on production URL | Passed with minor manual follow-ups |

Detailed QA record: `docs/ui/preview-beta-qa-results.md`.

## Manual follow-ups before user testing

1. Confirm the latest Vercel deployment maps to the frozen baseline or a newer approved commit.
2. Confirm Google OAuth login using a real user account.
3. Confirm logout and protected-route redirect behavior after logout.
4. Confirm mobile menu Escape-key close behavior in a real browser.
5. Confirm no production DB, seed, migration, or secret change is pending.

## Beta issue policy

| Severity | Handling |
| --- | --- |
| P0 | Stop beta, fix immediately. |
| P1 | Fix before inviting additional testers. |
| P2 | Log, triage, and decide before Production Release. |
| P3 | Log as polish backlog unless it blocks trust or comprehension. |

## Exit from Preview Beta Freeze

The product can move from Preview Beta Freeze to user testing when:

- Manual follow-ups are completed or explicitly accepted.
- User testing participants and tasks are confirmed.
- Known limitations are listed in the test script.
- Owner accepts the frozen baseline as the beta candidate.

