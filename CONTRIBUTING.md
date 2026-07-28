# Contributing

## Before changing code

1. Read `README.md`, `SECURITY.md`, and the architecture documents under
   `docs/`.
2. Preserve the App Router, `app/api`, service, and `db` Repository boundaries.
3. Do not hardcode course or subject names.
4. Do not reset D1, rewrite migration history, or deploy production resources.
5. Mark sample and Mock behavior explicitly.

## Local workflow

Use the committed npm lockfile:

```bash
npm ci
npm run db:check
npm run db:setup
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

Run `npm run test:e2e` for changes affecting authentication, repositories,
learning flows, transactions, routing, Worker behavior, or deployment output.
All database setup commands above target the local Wrangler D1 configuration.

## Pull requests

- Keep the change focused and describe user-visible and data-model impact.
- Add tests for success, denial, ownership, empty, and retry/idempotency paths.
- Document new environment variable names in `.env.example`; never commit a
  value.
- Generate a new migration for schema changes. Never edit an applied migration.
- Identify destructive or long-running migrations and provide a staged plan.
- Include rollback and monitoring notes for operational changes.
- Do not combine an application release with an unapproved production
  migration.

See `docs/deployment-checklist.md` before requesting a release.
