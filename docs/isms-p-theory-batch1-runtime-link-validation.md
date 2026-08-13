# ISMS-P Theory Batch 1 Runtime Link Validation

## A. Implementation Scope

Branch `feature/isms-p-batch1-runtime-link` is based on main `fecebeca2b67da658d3aa72da7370f7b63bc3ad9`. The change adds a provider-neutral Batch 1 materializer, generic Learn overview lesson discovery, an explicit isolated-D1 CLI, an isolated D1 suite harness, and focused regression tests. It does not add a schema migration, global seed, question link, ontology/SKOS decision, or Production data operation.

## B. Materializer Design

`lib/data/isms-p-theory-batch1-materializer.mjs` derives all rows from the tracked Batch 1 registry. It validates the exact approved 12, excludes all three HOLD codes, validates approved body/summary hashes, creates deterministic IDs and official-code sort order, and maps both `lesson_id` and `curriculum_node_id` to `NULL`.

PLAN classifies Content, CourseLesson, and CourseLessonExtension as CREATE, NOOP, or CONFLICT. APPLY performs no blind upsert: it fails before writes when any conflict exists and sends only CREATE statements in dependency order. VERIFY requires 36 NOOP rows. ROLLBACK removes only explicitly recorded Batch-created IDs in reverse dependency order and refuses hard deletion when user progress exists.

## C. Production Guard

APPLY and ROLLBACK require all of: an isolated target kind, non-production environment, explicit confirmation token, and a provider/target match. `NODE_ENV`, `VERCEL_ENV`, `APP_ENV`, context environment, and explicit production identity are fail-closed. Production fresh verification used PLAN only inside an explicit PostgreSQL `BEGIN READ ONLY` transaction. Production write statements: 0.

## D. D1 Validation

An actual temporary Wrangler D1 database was migrated and seeded for each suite. The isolated materializer result was:

- PLAN: CREATE 36, NOOP 0, CONFLICT 0
- first APPLY: 36 rows created
- VERIFY: Content 12, CourseLesson 12, Extension 12
- second APPLY: CREATE 0, NOOP 36, CONFLICT 0; row count unchanged
- conflict fixture: CONFLICT detected before Batch writes; existing row unchanged
- pre-user rollback: 36 Batch-created rows removed; baseline restored
- post-user rollback: hard delete refused; archive plan returned; progress preserved
- published CourseLesson denominator: actual fixture delta +12

The test runner now creates a temporary D1, applies migrations and base seed, routes every nested Wrangler/Vinext operation to that path, and removes the temporary database. Existing `.wrangler/state` is not changed or cleaned.

## E. PostgreSQL Disposable Validation

GitHub Actions run `31666854624` used an ephemeral `postgres:17.6-alpine` service with test-only user `test`, database `securium_test`, a bounded `pg_isready` health check, and no repository secrets. The job applied tracked persistent schema migrations, prepared only the minimal Course/CourseGroup/User parents, and ran the same provider-neutral materializer through the real PostgreSQL provider. Unrelated data cleanup migration `0009_security_certification_taxonomy_cleanup.sql` was intentionally excluded because it requires the full security-certification seed and contains no persistent schema DDL. The regenerated `0002` RLS lockdown was applied last, after the tables it references.

- PLAN: Content CREATE 12, CourseLesson CREATE 12, Extension CREATE 12; total CREATE 36, NOOP 0, CONFLICT 0
- first APPLY: 36 created; exact read-back Content 12, CourseLesson 12, Extension 12
- read-back: deterministic IDs, slugs, official-code order, null policies, PUBLISHED state, and body/summary/example/exam-point hashes PASS
- reapply: CREATE 0, NOOP 36, CONFLICT 0; counts unchanged
- conflict: alternate-key conflict detected; APPLY failed closed; Batch writes 0
- pre-user rollback: Extension 12, CourseLesson 12, Content 12 removed; fixture unchanged
- post-user rollback: hard delete refused, progress preserved, 12-row archive proposal returned
- HOLD 2.8.1, 2.10.1, 2.12.2: operations 0
- D1/PostgreSQL logical parity: FULL PARITY PASS

The final successful run artifact is `postgres-runtime-link-parity-31666854624`, retained for 14 days. Earlier runs `31666401550`, `31666508120`, `31666653775`, and `31666758725` exposed and classified only CI identity/schema-bootstrap assumptions; materializer assertions were not weakened.

## F. Idempotency

Primary deterministic IDs, Content slug/canonical key, course/content/sort alternate keys, and extension CourseLesson relation are checked before APPLY. Equivalent rows are NOOP; incompatible primary or alternate keys are CONFLICT. The isolated reapply test proved 36 NOOP and zero row growth.

## G. Conflict Handling

A Content alternate-key conflict was injected in isolated D1. PLAN returned CONFLICT, APPLY refused before transaction submission, no CourseLesson rows were created, and the fixture remained unchanged. Silent ignore and overwrite paths are absent.

## H. Rollback

Before user activity, only the APPLY result's created operation IDs are eligible and removal order is Extension, CourseLesson, Content. After user progress exists, hard deletion is refused and a non-executed archive proposal is returned. The current schema does not provide a complete Batch ownership/archive contract for every dependent activity type, so post-user rollback remains a reviewed operational action.

## I. Learn Overview Wiring

`getPublishedCourseLessonProgressSummary()` now uses the existing generic `listPublishedCourseLessonsForUser()` result instead of returning `lessons: []`. There is no Batch-specific ID or official-code branch. Existing detail route code is unchanged.

## J. Denominator Impact

The isolated D1 query measured +12 published CourseLessons after APPLY. Existing progress rows were not updated or deleted. Fresh Production still contains 8 published ISMS-P CourseLessons; the fresh plan remains 12 CourseLesson CREATE, so expected post-materialization count is 20 and completion/analytics populations increase by 12 under the current published Content/CourseLesson filters.

## K. Progress / Analytics

Existing progress mutation operations are zero. New lessons begin without progress rows. The generic overview calculates progress over published CourseLessons, so existing user completion percentages can decrease after eventual Production materialization. Question relations and Practice content are unchanged; the full E2E suite passed.

## L. Tests

- Focused runtime-link tests: 6/6 PASS
- PostgreSQL parity CI: 1/1 PASS (`31666854624`)
- Unit: 358/358 PASS
- Integration: 23/23 PASS on a fresh temporary D1
- Full E2E: 80/80 PASS on a fresh temporary D1
- Typecheck: PASS
- Lint: PASS with one pre-existing warning in an untracked audit generator; new warnings 0
- Next.js build: PASS
- Cloudflare/Vinext build: PASS

The first integration attempts exposed pre-existing persistent `.wrangler/state` fixture accumulation (211 temporary Contents and 213 temporary CourseLessons). No cleanup was performed. The suite harness was corrected to use fresh temporary D1 state, after which integration and Full E2E passed.

## M. Browser QA

The in-app browser was unavailable, so the existing cached Playwright Chromium was used against a fresh isolated D1 materialized with the approved 12. The runtime was started with the same `APP_BUILD_TARGET=cloudflare`, `D1_TEST_MODE=1`, D1 persist path, and Sites auth contract used by the isolated suite.

- Desktop 1440: overview rendered 17 lessons including all approved 12; order, sidebar, CTA, main landmark, H1, and horizontal overflow 0 PASS.
- Mobile 390: overview rendered all approved 12, title wrapping and bottom navigation were visually usable, and horizontal overflow was 0.
- Detail: 1.1.1, 2.2.6, and 2.9.2 returned 200 and rendered title, body, example, exam-point text, and navigation without overflow.
- Favicon root cause: metadata protocol inference defaulted to HTTPS when local Vinext omitted `x-forwarded-proto`. Localhost, `127.0.0.1`, and `[::1]` now use HTTP only when no trusted forwarded protocol is present; non-local and Production defaults remain HTTPS. Both icon links resolved to `http://localhost:33130/favicon.svg` with failed requests and console errors 0.
- Touch target root cause: the mobile `SECURIUM 대시보드로 이동` brand link (`.mobileBrand`) measured 28.8px high. Only that link received `min-height: 44px`; final visible actionable elements below 44px: 0.
- Final desktop 1440 and mobile 390: approved Batch links 12, H1/main present, overflow 0, console warnings/errors 0, unexpected network failures 0.
- Final detail 1.1.1, 2.2.6, and 2.9.2: 200, content/example/exam-point rendering PASS, overflow 0, console/network 0.

## N. Production Final TOCTOU Read-only Diff

After PostgreSQL parity passed, the approved pooled Supabase PostgreSQL connection entered a single `REPEATABLE READ, READ ONLY` transaction. Its first SELECT verified `transaction_read_only=on`; the final pre-commit authoritative snapshot timestamp is `2026-08-13T04:33:19.441542Z`.

- Course: one active, published, non-deleted `course-isms-p` row
- Content: CREATE 12, NOOP 0, CONFLICT 0
- CourseLesson: CREATE 12, NOOP 0, CONFLICT 0
- Extension: CREATE 12, NOOP 0, CONFLICT 0
- Total: CREATE 36, NOOP 0, CONFLICT 0
- HOLD operations: 0
- Current published CourseLessons: 8
- Expected after a separately approved materialization: 20
- Completion denominator delta: +12
- Analytics denominator delta: +12
- Conflict gate: PASS
- Production mutations: 0
- Production write statements: 0

## O. Production Write Readiness

PostgreSQL parity, D1/PostgreSQL logical parity, local browser/test/build evidence, and the fresh Production TOCTOU diff all pass. The branch contains temporary validation commits through `96c1af33a57a9449f89506a3dc48de8ed6926e25` and was pushed without force. No PR, Production APPLY, Production migration, seed, or Production data mutation was performed.

Final status: **RUNTIME LINK FINAL QA PASS — COMMIT READY**. This is not Production write authorization; Production materialization remains prohibited pending the separately approved PR/review and write phase.
