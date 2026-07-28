## Summary

- What changed:
- Why:

## Scope and risk

- [ ] No course or subject name was hardcoded
- [ ] User and course data isolation was considered
- [ ] Authorization is enforced on the server
- [ ] No secret, personal data, answer body, or production export is included
- [ ] Existing migration history was not rewritten
- [ ] Mock/sample behavior is visibly identified

## Database and deployment

- Schema change: none / additive / destructive-risk
- Migration approval required: yes / no
- Environment variable names added:
- Rollback or forward-fix plan:

## Verification

- [ ] `npm run db:check`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:integration`
- [ ] `npm run build`
- [ ] Full E2E run when required
