# UI-4 Practical Forms Copy Cleanup

## Scope

- Target component: `AdminPracticalForms`
- Affected admin route: `/admin/practical-specializations`
- Change type: SW secure-coding and privacy impact assessment admin form copy cleanup
- Data/API changes: none
- Database changes: none
- Deployment: none

## What changed

- Replaced broken/mojibake Korean copy across practical-specialization admin forms.
- Preserved the existing `/api/admin/practical-specializations` POST endpoint.
- Preserved all existing entity names and payload field names:
  - `SECURE_WEAKNESS`
  - `SECURE_CODE_SAMPLE`
  - `SECURE_CODE_RULE`
  - `PRIVACY_ITEM`
  - `PRIVACY_SCENARIO`
  - `PRIVACY_NODE`
  - `PRIVACY_EDGE`
- Replaced visible development wording with operator-friendly copy:
  - `독립 작성 개발용 샘플` → `독립 작성 샘플 콘텐츠`
  - `DEV-1` defaults → `DRAFT-1` defaults
- Localized all labels for secure-coding weakness, code samples, grading rules, privacy assessment items, scenarios, flow nodes, and flow edges.
- Improved save success/failure messages.

## UX notes

- This component powers a dense admin data-entry area. Clean labels reduce operator error without changing business behavior.
- Code input fields remain plain text areas; no code execution, eval, shell, or dynamic import behavior was added.
- Flow node coordinates and edge metadata remain simple numeric/text inputs as originally designed.

## Validation

- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run test:integration` — passed, 18 tests
- `npm.cmd run build` — passed

## Production impact

- No production database, seed, API, repository, or secret changes.
- No deployment was performed in this sprint slice.
