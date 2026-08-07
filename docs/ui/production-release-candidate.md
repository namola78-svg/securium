# Production Release Candidate Review

Date: 2026-08-07  
Candidate commit: `c12f26b`  
Evidence documentation commit: `99fd68a`  
Environment under review: `https://securium.vercel.app`  
Decision owner: Owner approval pending

This document is used after Preview Beta user testing to decide whether SECURIUM can move to Production Release.

## Candidate rule

A release candidate can be declared only when:

- Preview Beta Freeze is complete.
- Preview QA is complete.
- User testing Round 1 is complete or explicitly deferred by the owner.
- Open issues are triaged by severity.
- No open P0 or P1 issue remains.
- P2 issues are either fixed or explicitly accepted.
- Production DB, seed, migration, secret, and deployment decisions are separately approved.

## Required records

| Record | Required | Status | Link |
| --- | --- | --- | --- |
| Preview Beta Freeze | Yes | Complete | `docs/ui/preview-beta-freeze.md` |
| Preview Beta QA Results | Yes | Complete | `docs/ui/preview-beta-qa-results.md` |
| User Testing Round 1 | Yes | Deferred / owner confirmation pending | `docs/ui/preview-beta-user-testing-round-1.md` |
| Issue Triage | Yes | Updated after 2026-08-07 production smoke | `docs/ui/preview-beta-issue-triage.md` |
| Production Readiness | Yes | Conditional GO pending final owner approval | `docs/ui/production-release-readiness.md` |

## Release candidate checklist

### Product

- [x] Landing page explains SECURIUM clearly.
- [x] Course list supports comparison without internal code language.
- [x] Course detail CTA state is clear for logged-out, logged-in, enrolled, and completed states.
- [x] Learner dashboard provides a clear next action.
- [x] Curriculum path shows official source metadata and course-scoped progress.
- [x] Practice does not expose answers before submission.
- [x] AI explanations are marked as reference-only.
- [x] Wrong notes and review empty states are understandable.
- [x] Analytics handles sparse data without confusion.

### Admin

- [x] Admin Console Shell is consistent across core pages.
- [x] Coverage, Ontology, AI Explainability, Content Revisions, and Analytics use the Inspector pattern.
- [x] Question Reports has a clear report queue and inspector.
- [x] No admin page exposes secrets, raw sensitive prompts, tokens, or private answer bodies.
- [x] Admin-only routes remain protected server-side.

### Security and privacy

- [x] Login works in the production domain.
- [x] Logout clears the session and protected routes redirect after logout.
- [x] Google OAuth redirect URLs are confirmed.
- [x] Supabase Site URL is confirmed.
- [x] Service role keys are not exposed to the client.
- [x] No production secrets are written to docs, logs, or client-visible bundles.
- [x] No user-specific data appears across accounts.

### Operations

- [x] Vercel latest deployment matches the candidate commit.
- [x] Environment variables are confirmed in provider UI without exposing values.
- [x] Production DB migration decision is recorded.
- [x] Production seed decision is recorded.
- [ ] Rollback owner is assigned.
- [ ] Monitoring owner is assigned.
- [x] Release notes are prepared.

## Known candidate risks

| ID | Severity | Risk | Decision |
| --- | --- | --- | --- |
| BETA-001 | P3 | Some sparse-data pages show loading before final empty state. | Accepted for beta |
| BETA-002 | P3 | Mobile Escape close needs real-browser confirmation. | Accepted for beta; verify during owner QA |
| BETA-003 | P2 | Local Vercel CLI can fail due to TLS/network EACCES. | Accepted with CLI workaround or Vercel dashboard |

## Decision

Choose one:

- GO: Production Release can proceed.
- CONDITIONAL GO: Release can proceed with explicitly accepted P2/P3 risks.
- NO-GO: Fix required before release.

Decision: CONDITIONAL GO

Reason:

```text
No open P0/P1 remains after the 2026-08-07 production smoke on commit c12f26b.
Typecheck, lint, unit tests, E2E tests, production build, Vercel deployment, learner
smoke, admin smoke, and mobile smoke passed. Release still needs owner assignment
for rollback and monitoring, plus final owner approval. Documentation-only evidence
commit 99fd68a was also deployed and verified without changing application behavior.
```

## Release notes draft

```text
Release: SECURIUM Preview Beta to Production
Commit: c12f26b
Date: 2026-08-07
Owner: Pending owner approval

Included:
- SECURIUM brand and public learning experience.
- Course directory and course detail UX.
- Learner dashboard, curriculum, practice, review, and analytics paths.
- Admin Console Shell and Inspector-based core operations.
- Preview Beta QA and user testing documentation.

Not included:
- New production DB migration unless separately approved.
- New production seed unless separately approved.
- New large feature development after Preview Beta Freeze.

Known limitations:
- BETA-001: sparse-data pages may briefly show a loading state before the final empty state.
- BETA-002: mobile Escape close behavior should be reconfirmed by owner QA in a real browser.
- BETA-003: local Vercel CLI may require the documented TLS workaround in this workstation.

Verification:
- Typecheck: PASS
- Lint: PASS
- Unit: PASS, 307 tests
- E2E: PASS, 80 tests
- Production build: PASS
- Preview smoke: superseded by production smoke on c12f26b
- Production smoke: PASS
```
