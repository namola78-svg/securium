# Public course availability HTTP contract

This verification uses the existing D1 test runner and Vinext local server. It
does not use a browser, a production URL, a managed database, or learner/auth
session fixtures. The runtime is Vinext's Cloudflare local development path;
this is not Native Next.js validation.

## Direct command

From the repository root:

```text
node verification/public-course-availability-http-contract/run.mjs
```

The launcher removes ambient `DATABASE_URL`, `DIRECT_URL`, and PostgreSQL seed,
migration, and verify URLs before invoking the existing
`scripts/run-d1-test-suite.mjs`. That runner applies the existing migrations and
seed to its own temporary D1 persistence. The test then adds only synthetic
course, group, question, lesson, content, subject, and topic rows.

The launcher forces `APP_ENV=test`, `AUTH_PROVIDER=sites`, `DB_PROVIDER=d1`,
and `D1_TEST_MODE=1`; it disables Cloudflare's dotenv loading. The app receives
the same `D1_TEST_PERSIST_PATH` through the existing Wrangler wrapper and
Vinext `persistState` configuration. No managed/shared database URL or
credential is selected automatically.

The app is started by the existing
`tests/support/vinext-test-server.mjs` on an OS-selected loopback port with
strict port binding. Readiness has a finite timeout, HTTP requests have a
finite timeout, and owned server shutdown verifies process exit and port
release. The D1 runner also bounds each migration, seed, and test subprocess;
the launcher removes its owned Wrangler/log registry root on success or
failure without changing an existing failure into success.

## Contract coverage

- `/courses` returns actual `text/html` and renders the five public fixture
  cards with scoped availability status and CTA/link assertions.
- `status=available` and `status=planned` are checked as server query
  parameters, not as client-side interaction.
- Public detail routes are checked for available versus planned CTA regions.
- Unpublished and inactive course detail routes are required to return 404.
- A supported impossible search is required to render the existing empty state.

The repository has no installed HTML parser dependency for this test. Assertions
therefore use narrowly scoped regex extraction of the course `article` and
detail CTA `aside`, rather than whole-document string presence or framework
serialization payloads.

Anonymous CTA hydration/redirect behavior is outside server-rendered HTML and is
recorded as `CLIENT_INTERACTION_VERIFICATION: NOT_RUN`. No safe owned fixture
exists for provider-failure injection, so
`ERROR_RESPONSE_VALIDATION: NOT_RUN` is recorded.
