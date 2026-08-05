# Preview Beta Issue Triage

This board translates Preview Beta QA and user testing findings into release decisions. It should be updated after every tester session and before any Production Release decision.

## Triage principles

1. Protect trust first: authentication, data isolation, official-source labeling, and AI disclaimers outrank polish.
2. Fix only what supports the frozen beta scope unless the owner explicitly expands scope.
3. Do not hide known issues by changing tests without also updating product behavior or documenting the accepted limitation.
4. Keep production DB, seed, migration, secret, and deployment decisions separate from UI issue triage.
5. Prefer small, reversible fixes over large rewrites during beta.

## Severity rubric

| Severity | Definition | Release action |
| --- | --- | --- |
| P0 | Blocks login, logout, protected route safety, course access, or exposes sensitive data. | Stop beta or release immediately. Fix before continuing. |
| P1 | Blocks a core learner/admin task without a clear workaround. | Fix before expanding beta or releasing. |
| P2 | Causes confusion, delay, or trust loss but has a workaround. | Triage before release; fix or explicitly accept. |
| P3 | Polish, copy, spacing, minor responsiveness, or low-risk comprehension issue. | Track in post-beta backlog unless very cheap. |

## Issue intake

| ID | Source | Severity | Role | Route | Summary | Reproducible | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BETA-001 | QA | P3 | Learner | `/analytics` | Initial loading state can remain visible for a few seconds before sparse analytics content appears. | Yes | TBD | Accepted for beta |
| BETA-002 | QA | P3 | Mobile | Global | Mobile menu Escape close needs real-browser keyboard confirmation. | Needs manual check | TBD | Open |
| BETA-003 | Ops | P2 | Operator | Local CLI | Vercel CLI status check can fail locally because of network/TLS `EACCES`. | Yes | TBD | Workaround: use Vercel dashboard |
| PROD-QA-001 | Browser QA | P1 | Admin | `/admin/curriculum` | Production renders the global error state and logs `SECURIUM_PAGE_ERROR`; likely production data, schema, or runtime mismatch needs server log confirmation. | Yes | TBD | Open |
| PROD-QA-002 | Browser QA | P1 | Admin | `/admin/audit-logs` | Production renders the global error state and logs `SECURIUM_PAGE_ERROR`; audit repository or production audit table availability should be checked. | Yes | TBD | Open |

## Decision matrix

| Condition | Decision |
| --- | --- |
| Any open P0 | No release. |
| Any open P1 | No release unless owner explicitly accepts a temporary workaround. |
| Open P2 only | Conditional release possible with documented owner acceptance. |
| Open P3 only | Release possible; move to polish backlog. |
| No open issues | Release candidate can proceed to final smoke test. |

## Fix workflow

1. Reproduce and assign severity.
2. Decide whether the issue is in frozen scope.
3. If P0/P1, create a focused fix branch or local change.
4. Add or update a regression test where practical.
5. Run the relevant focused tests first.
6. Run typecheck, lint, and build before release decision.
7. Update this triage board and `docs/ui/production-release-readiness.md`.

## Beta backlog

| ID | Priority | Area | Work item | Target |
| --- | --- | --- | --- | --- |
| BACKLOG-001 | Medium | Mobile UX | Confirm and, if needed, improve Escape close behavior for mobile menu and drawers. | Before Production Release |
| BACKLOG-002 | Medium | Performance perception | Review slow-loading learner/admin pages and consider skeleton tuning. | Before or shortly after Production Release |
| BACKLOG-003 | Low | Local ops | Clean local `NODE_EXTRA_CA_CERTS` configuration to reduce noisy warnings. | Local environment cleanup |

## Release handoff summary

Before release, record:

```text
Open P0:
Open P1:
Open P2:
Open P3:
Accepted risks:
Owner approval:
Release commit:
```
