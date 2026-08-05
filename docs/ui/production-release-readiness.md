# Production Release Readiness

Production Release begins only after Preview Beta Freeze, QA, and user testing are complete.

## Production release gate

- [x] Preview Beta Freeze completed.
- [x] QA completed.
- [ ] User testing completed or explicitly deferred by owner.
- [ ] Known issues triaged.
- [ ] Release owner assigned.
- [ ] Rollback owner assigned.
- [ ] Monitoring owner assigned.
- [ ] Exact commit recorded.
- [ ] No uncommitted local changes.
- [ ] Production environment values verified in provider UI without exposing secrets.
- [ ] Production DB migration approval recorded separately if needed.
- [ ] Production seed approval recorded separately if needed.

Freeze record: `docs/ui/preview-beta-freeze.md`.
QA record: `docs/ui/preview-beta-qa-results.md`.
Issue triage: `docs/ui/preview-beta-issue-triage.md`.
Release candidate review: `docs/ui/production-release-candidate.md`.
Production release notes: `docs/ui/production-release-notes.md`.
Production release gate: `docs/ui/production-release-gate.md`.
Production manual QA checksheet: `docs/ui/production-manual-qa-checksheet.md`.
Production smoke runbook: `docs/ui/production-smoke-test-runbook.md`.
Production release evidence log: `docs/ui/production-release-evidence-log.md`.
Production rollback drill: `docs/ui/production-rollback-drill.md`.
Production monitoring checklist: `docs/ui/production-monitoring-checklist.md`.

## Smoke tests after release

1. Public home page.
2. Course list.
3. Login.
4. Dashboard.
5. Course detail CTA.
6. Curriculum.
7. Practice submit.
8. AI explanation request.
9. Wrong notes/review.
10. Analytics.
11. Admin dashboard.
12. Admin Coverage.
13. Admin Ontology.
14. Admin AI Explainability.
15. Admin Audit Logs.
16. Logout.

## Rollback triggers

- Login or logout fails for normal users.
- Protected routes expose private content after logout.
- Course enrollment creates duplicates.
- Practice submission corrupts score/statistics.
- Admin pages expose sensitive AI prompt, secret, or answer raw data.
- Production error rate spikes.
- Database writes fail broadly.

## Release notes template

```text
Release:
Commit:
Date:
Owner:

Included:
- 

Not included:
- 

Known limitations:
- 

Verification:
- Typecheck:
- Lint:
- Rendered integration:
- Build:
- Preview smoke:
- Production smoke:
```
