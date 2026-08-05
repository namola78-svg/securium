# Production Release Candidate Review

Date: TBD  
Candidate commit: TBD  
Environment under review: `https://securium.vercel.app`  
Decision owner: TBD

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
| User Testing Round 1 | Yes | Pending | `docs/ui/preview-beta-user-testing-round-1.md` |
| Issue Triage | Yes | Pending update after testing | `docs/ui/preview-beta-issue-triage.md` |
| Production Readiness | Yes | Pending final owner approval | `docs/ui/production-release-readiness.md` |

## Release candidate checklist

### Product

- [ ] Landing page explains SECURIUM clearly.
- [ ] Course list supports comparison without internal code language.
- [ ] Course detail CTA state is clear for logged-out, logged-in, enrolled, and completed states.
- [ ] Learner dashboard provides a clear next action.
- [ ] Curriculum path shows official source metadata and course-scoped progress.
- [ ] Practice does not expose answers before submission.
- [ ] AI explanations are marked as reference-only.
- [ ] Wrong notes and review empty states are understandable.
- [ ] Analytics handles sparse data without confusion.

### Admin

- [ ] Admin Console Shell is consistent across core pages.
- [ ] Coverage, Ontology, AI Explainability, Content Revisions, and Analytics use the Inspector pattern.
- [ ] Question Reports has a clear report queue and inspector.
- [ ] No admin page exposes secrets, raw sensitive prompts, tokens, or private answer bodies.
- [ ] Admin-only routes remain protected server-side.

### Security and privacy

- [ ] Login works in the production domain.
- [ ] Logout clears the session and protected routes redirect after logout.
- [ ] Google OAuth redirect URLs are confirmed.
- [ ] Supabase Site URL is confirmed.
- [ ] Service role keys are not exposed to the client.
- [ ] No production secrets are written to docs, logs, or client-visible bundles.
- [ ] No user-specific data appears across accounts.

### Operations

- [ ] Vercel latest deployment matches the candidate commit.
- [ ] Environment variables are confirmed in provider UI without exposing values.
- [ ] Production DB migration decision is recorded.
- [ ] Production seed decision is recorded.
- [ ] Rollback owner is assigned.
- [ ] Monitoring owner is assigned.
- [ ] Release notes are prepared.

## Known candidate risks

| ID | Severity | Risk | Decision |
| --- | --- | --- | --- |
| BETA-001 | P3 | Some sparse-data pages show loading before final empty state. | Pending |
| BETA-002 | P3 | Mobile Escape close needs real-browser confirmation. | Pending |
| BETA-003 | P2 | Local Vercel CLI can fail due to TLS/network EACCES. | Pending |

## Decision

Choose one:

- GO: Production Release can proceed.
- CONDITIONAL GO: Release can proceed with explicitly accepted P2/P3 risks.
- NO-GO: Fix required before release.

Decision: TBD

Reason:

```text
TBD
```

## Release notes draft

```text
Release: SECURIUM Preview Beta to Production
Commit:
Date:
Owner:

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
- 

Verification:
- Typecheck:
- Lint:
- Unit:
- E2E:
- Production build:
- Preview smoke:
- Production smoke:
```

