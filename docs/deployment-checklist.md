# Deployment checklist

## Change approval

- [ ] Release scope and owner are identified
- [ ] Target is explicit: Sites, future Vercel Preview, or future Vercel Production
- [ ] Mock and sample behavior is documented
- [ ] Destructive migration risk is absent or separately approved
- [ ] Rollback/forward-fix plan is reviewed

## Source and CI

- [ ] No unreviewed files or generated artifacts are included
- [ ] Secret and personal-data scans are clean
- [ ] `package-lock.json` matches `package.json`
- [ ] Drizzle generation produces no uncommitted migration drift
- [ ] Schema validation, typecheck, lint, unit, integration, and build pass
- [ ] Full E2E passes for authentication, data, routing, or runtime changes
- [ ] Branch protection requirements are satisfied

## Data

- [ ] Backup and restore point are verified
- [ ] Migration was tested against a disposable copy
- [ ] Migration is backward-compatible with the previous application version
- [ ] Migration is run by a separate approved operation, not the build command
- [ ] Seed data cannot run against Production
- [ ] User/course ownership and unique constraints are preserved
- [ ] `DB_PROVIDER` target is explicit and no automatic fallback is possible
- [ ] Supabase runtime uses pooled `DATABASE_URL`; `DIRECT_URL` is absent from Build
- [ ] D1 export/import row counts and foreign-key checks pass when cutting over
- [ ] PostgreSQL driver and Repository dialect integration pass in Preview

## Environment and security

- [ ] Preview and Production values are isolated
- [ ] No `DEV_AUTH_EMAIL` exists in Production
- [ ] Secrets are server-only and strong
- [ ] Callback, media, frame, image, and audio origins match the target
- [ ] CSP, CSRF, RBAC, audit logging, rate limiting, and safe errors are verified
- [ ] Storage signed URLs and ownership checks are verified when enabled

## Release

- [ ] Exact commit is recorded
- [ ] Release notes and known limitations are recorded
- [ ] Database operation approval is recorded separately
- [ ] Health checks cover public, authenticated, administrator, and API routes
- [ ] Monitoring owner and observation window are assigned
- [ ] Rollback trigger and decision owner are named

## Post-release

- [ ] Login, enrollment, lesson, question, mock-exam, and admin smoke tests pass
- [ ] Error rate, latency, database failures, and audit events are reviewed
- [ ] No secrets or internal stack traces appear in logs
- [ ] Rollback or forward-fix decision is recorded
