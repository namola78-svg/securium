# Vercel compatibility review

> Reviewed 2026-07-28. No Vercel project was created or linked, and no Preview
> or Production deployment was performed.

## Current verdict

The application now has a **native Next.js Node build path for Vercel**.
`npm run build` emits the standard Next.js application, while
`npm run build:cloudflare` preserves the existing Vinext/Worker rollback path.
The Node build aliases the Cloudflare environment binding to server-only
environment variables and uses the Supabase PostgreSQL provider.

Both build targets pass locally. A safe `/api/health` endpoint is available for
Preview database smoke checks. End-user authentication now has a Vercel-oriented
Supabase Auth path behind `AUTH_PROVIDER=supabase`; the retained
Sites/Cloudflare path still uses SIWC headers. Protected routes can be declared
Preview-ready only after Supabase Auth environment values, email settings, and
Preview smoke tests are completed in the Vercel project.

`vercel.json` remains intentionally absent because the Next.js preset, install
command, and build command can be detected without overrides. Project linking,
environment configuration, and deployment still require an existing Vercel
account/project decision.

## Compatibility matrix

| Item | Current state | Vercel implication |
| --- | --- | --- |
| Framework | Native Next.js plus preserved Vinext target | `npm run build` is Vercel-compatible |
| Node | `>=22.13.0` | Select and verify a supported 22.x runtime when linking |
| Package manager | npm + `package-lock.json` | Use locked install; recommend `npm ci` |
| Build | `npm run build` for Next.js; `build:cloudflare` for Worker | Targets remain explicit and separate |
| Database | Supabase PostgreSQL provider on Node | Use pooled `DATABASE_URL` at runtime |
| Authentication | Provider switch: Sites/SIWC or Supabase Auth | Set `AUTH_PROVIDER=supabase` on Vercel and verify email/password flow |
| API runtime | App Router routes compile for Node | Preview database/API smoke remains required |
| API timeout | No Vercel `maxDuration` | Define per-route limits after runtime port |
| Filesystem | Build-time filesystem only; local storage is memory-only | No durable runtime filesystem is assumed |
| Migrations | Explicit Wrangler command | Must remain outside Vercel Build Command |

## Required work before a Vercel Preview

1. Configure `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and
   `SUPABASE_ANON_KEY` in the Vercel Preview environment.
2. Configure Supabase Auth email/password settings and allowed site/redirect
   URLs for the Preview deployment.
3. Configure Preview and Production environments separately.
4. Link an existing Vercel project or explicitly approve creation of one.
5. Run `/api/health` and public/authenticated/admin smoke tests in Preview.
6. Set route durations after measuring AI, export, mock-exam, and upload routes.
7. Revalidate CSP, signed URLs, IP handling, audit logs, CSRF, and rate limiting
   behind Vercel proxies.
8. Run migrations as a separately approved release job, never as
   `npm run build`.

The current implementation uses Supabase Auth REST endpoints through a small
server-side provider. The `@supabase/ssr` and `@supabase/supabase-js` packages
are installed and can replace the provider internals later, but the current
runtime does not depend on direct SDK imports.

Do not set `dist` as a Vercel static output: it belongs only to the preserved
Cloudflare Worker target.

## Environment separation

Preview and Production must use distinct databases, storage buckets, callback
URLs, signing secrets, audit salts, and provider keys. `DEV_AUTH_EMAIL` is
development-only. Production must never receive Mock/local credentials or
`NEXT_PUBLIC_` service keys.

The environment names are documented in `.env.example`; actual values belong
in the deployment control plane. Preview must not point to the Production
database, direct migration URL, or Production Storage buckets.

## Existing Sites configuration

`.openai/hosting.json` currently contains an opaque Sites project ID, logical
D1 binding `DB`, and `r2: null`. It is imported by `vite.config.ts`; the build
plugin also copies it and the Drizzle migrations into the deployable Worker
artifact. It was not changed.

Sites and Vercel can consume the same Git repository in parallel, but the
current runtime cannot be deployed unchanged to both providers. Important
conflicts are:

- two providers can auto-deploy the same branch at different times;
- the same custom domain cannot safely target both without an explicit traffic
  and rollback plan;
- Sites injects D1 and SIWC behavior that Vercel does not provide;
- environment variables, callback URLs, IP/proxy behavior, and storage URLs
  can diverge;
- writes can split across different databases during an uncontrolled cutover.

Do not delete `.openai/hosting.json`: doing so breaks the established Sites
resource association, D1 binding declaration, migration packaging, and safe
rollback path. A future transition requires manual runtime porting, Preview
verification, data migration approval, authentication changes, DNS cutover,
monitoring, and only then a separately approved retirement of Sites.

The stored Sites project ID returned `project_not_found` when inspected through
the current connector. This may indicate a deleted project or inaccessible
account context. No replacement project was created, because substituting a new
ID without owner approval would break resource provenance.

## Official references

- [Vercel project configuration](https://vercel.com/docs/project-configuration)
- [Configuring a build](https://vercel.com/docs/builds/configure-a-build)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
