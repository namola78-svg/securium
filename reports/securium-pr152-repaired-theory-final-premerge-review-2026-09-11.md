# PR #152 Repaired Theory Revision — Final Pre-merge Review

- Review date: 2026-09-11 (Asia/Seoul)
- Repository: `namola78-svg/securium`
- Worktree: `securium-theory-revision-integrity-repair`
- Local branch: `fix/theory-revision-integrity`
- PR branch: `feat/theory-progress-revision-binding`
- Reviewed candidate: `e2b30b07e0d538b61b20cc57e345041ae7d860e4`
- Local repair: `f738a6d518e4907e1f40fdaeb034714a20c35523` (not pushed)
- PR base: `8eff7f1a366941d2076e3e1ddb9dc233ebc22886`
- Fresh `origin/main` after final fetch: `7fe6a3511ea96103387a5824f89e8de38db7296b`
- PR state: `OPEN / Draft`; remote head remains `e2b30b0`

## Decision

`CODE_MERGE_DECISION: HOLD`

The candidate's main revision-binding behavior is valid, but a normal authoring flow is broken. Publishing a new payload after saving it as a draft leaves the old revision marked latest and returns `500 INTERNAL_ERROR` from the unique-latest constraint. A minimal local repair and D1/PostgreSQL regressions pass, but that repair is not in the remote PR head; therefore the candidate is not merge-ready.

## Freshness and integration

- `origin/main` advanced after the stated `8eff7f1` baseline through unrelated PR #161 forensic-timeline documentation only. The five changed paths are outside the PR's code, schema, migration, runner, and evidence paths.
- `git merge-tree --write-tree origin/main e2b30b0` and the same check with local repair `f738a6d` both completed with exit 0.
- Candidate vs `8eff7f1`: 26 paths, 20,360 additions, 19 deletions. The large addition is the generated D1 snapshot (`drizzle/meta/0044_snapshot.json`), not an unreviewed product-data import.
- The prior conflict in `lib/services/evidence-projection.ts` retains both main's `resolutionStatus`/`unresolvedReason` and PR #152's `contentRevisionBinding` contract.
- Existing implementation, review, #144, SW, executor, mock worktrees, preservation refs, and prior reports were not modified. No rebase, force push, PR edit, merge, or runtime DB operation was performed.

### Candidate file groups

- Progress/UI/API: `app/api/course-lessons/progress/route.ts`, the CourseLesson page/actions, `db/shared-content-repositories.ts`, `db/repositories.ts`, `db/curriculum-repositories.ts`, `db/lesson-repositories.ts`, `db/phase3-repositories.ts`, `lib/validation.ts`.
- Revision/Evidence: `db/evidence-source-adapters.ts`, `lib/services/evidence-projection.ts`, `lib/services/content-revision-service.ts`, `db/schema.ts`.
- Schema/migrations: D1 `drizzle/0044_course_lesson_progress_revision_binding.sql` plus journal/snapshot; PostgreSQL `db/postgres/migrations/0051_course_lesson_progress_revision_binding.sql`.
- CI/tests: `.github/workflows/ci.yml`, `package.json`, revision-binding/Evidence/D1/PG tests, and migration guards.
- Record: the existing repair investigation report. This report is new and does not overwrite it.

## Identity and storage review

The normal CourseLesson path is:

`CourseLesson page` → `CourseLessonActions` sends `contentId` and `contentVersion` → authenticated progress API → `requireAccessibleCourseLesson` resolves the current server row → repository compares supplied hints and persists the resolved `contentId`/`contentVersion` → progress and activity rows → overview joins on both identity fields.

The stored identity is separated as follows:

- `contents`: current authoring row and current version.
- `content_revisions`: immutable snapshot identity (`id`, `content_id`, `version`, `snapshot_json`, `semantic_hash`, status/latest/previous revision).
- `user_course_lesson_progress`: user/course/CourseLesson plus nullable legacy or server-owned `content_id` and `content_version`, status, completion and time fields.
- `learning_activities`: idempotent activity ID includes user, CourseLesson, content ID and version; metadata repeats the server-resolved identity.

For candidate `e2b30b0`, A-v1 completion remains A-v1 after B is current; B completion creates a separate B row/activity; replay is idempotent; stale screen and forged content/version are rejected with `COURSE_LESSON_REVISION_MISMATCH`; legacy NULL identity remains separate. The server never uses a caller value as the stored authority.

The input fields remain optional optimistic hints. The UI supplies both. A supplied stale or partial conflicting field is rejected; omitted fields are accepted and the current server identity is stored. This preserves the existing compatibility contract but means an omitted hint cannot prove which screen revision was open.

## Authoring and snapshot integrity

`saveSharedContent` guards the admin API path. Same content ID/version with the same learning payload is replayable; metadata changes such as slug/canonical key are allowed; a learning-payload change at an existing immutable/published version returns `409 SHARED_CONTENT_REVISION_CONFLICT`. The snapshot payload includes title, summary, body, body format, objectives, concepts, examples, diagrams and media. The content update, revision operations and audit insert are in one database batch.

The candidate regression is:

1. Publish content at v1; v1 snapshot is latest.
2. Save the same content at v2/DRAFT; no v2 snapshot is created and v1 remains latest.
3. Publish v2; candidate tries to insert v2 as latest without superseding v1, so `content_revisions_single_latest_unique` fails. The API returns 500 and leaves `contents` at v2/DRAFT.

This was reproduced through the D1 admin API. The local repair commit `f738a6d` finds the existing latest revision, marks it superseded, sets `previous_version_id`, and inserts the new snapshot in the same batch. The added D1 and disposable PostgreSQL regressions both pass. Because `f738a6d` is local-only, the remote candidate remains HOLD.

The repair does not change version syntax, auto-increment versions, historical rows, or existing immutable snapshots. Same-version payload mutation remains a 409. Snapshot/hash mismatch remains fail-closed.

One remaining system-wide limitation was identified: `lib/data/security-content-upgrade-v3.mjs` generates direct `contents` `ON CONFLICT (id) DO UPDATE` SQL for title/body/learning fields without invoking `saveSharedContent` or creating a revision snapshot. It is a controlled seed/materialization path and was not changed in this bounded review, but if run against an existing published ID it can bypass this API guard. A future authoring/provisioning decision must either scope that path to draft-only identities or bind it to the same immutable revision contract.

## Evidence identity

`DatabaseEvidenceSourceResolver` resolves CourseLesson progress from the server-owned event row and then loads `content_revisions` by `(LEARNING_UNIT, content_id, content_version)`. It verifies revision status, snapshot kind, snapshot content ID/version, and SHA-256 semantic hash. Missing, corrupt, or legacy identity returns `UNRESOLVED`/`LEGACY_INELIGIBLE`; it does not attach the current CourseLesson content.

`contentRevisionBinding` carries server-resolved `contentId`, version, revision ID and semantic hash. Candidate identity/semantic hashes include the binding, so different contents using the same version string do not collide. Existing question, mock, SW identity/correction, and main's resolution-status contracts were preserved. No Evidence, mastery, Skill State, or historical backfill was performed.

## Migration and data safety

- D1 0044 and PostgreSQL 0051 add nullable progress `content_id`, add the content FK with `RESTRICT`, replace the old progress uniqueness with `(user_id, course_id, course_lesson_id, content_id, content_version)`, and preserve NULL legacy rows without backfill.
- PostgreSQL and D1 nullable unique-index behavior permits legacy NULL rows to coexist; new bound rows are separated by content identity and version.
- `content_revisions` and progress/content foreign keys use restrictive delete behavior. Hard deletion is rejected in disposable tests; soft delete preserves progress, activities and snapshots.
- Current branch inventory/guards: D1 namespace/journal guard `2/2`, PostgreSQL migration guard `16/16`, `db:check` PASS. Existing expected inventory is D1 journal 45 entries / PostgreSQL 34 migration files.
- No migration was added by local repair. Rollback to pre-0044/0051 application code is not a clean semantic rollback: old code cannot interpret the new content-bound rows, and dropping populated binding columns would lose identity. Deployment order remains migration first, then code; no runtime migration was run.

## Verification

### Remote exact candidate

- PR CI `34576157681`: SUCCESS, `pull_request`, head SHA `e2b30b0`; the job checked out synthetic merge `e642385` (`e2b30b0` into `8eff7f1`) and passed schema, typecheck, lint, unit/integration, Theory revision integrity step and build.
- PostgreSQL producer `34576157683`: SUCCESS, exact PR-head checkout/bind, but it is the question-attempt producer and is not evidence that the Theory runner passed.
- Evidence executor `34576157682`: SUCCESS; ISRM validator `34576157694`: SUCCESS.
- Vercel is `FAILURE / Account is blocked`. Main branch protection returned 404 and repository rulesets were empty, so no required protected-branch check was identified; the PR remains Draft and has no reviews or review requests. No gate was bypassed.
- No CI run exists for local repair `f738a6d`, because it was intentionally not pushed.

### Local candidate/repaired path

- Evidence CourseLesson resolver: 3/3 PASS.
- D1 revision-integrity E2E: 1/1 PASS after local repair, including draft→publish, A/B preservation, replay, stale/forged identity, legacy NULL, rollback and soft-delete checks.
- Disposable PostgreSQL app/repository revision test: 1/1 PASS after local repair, including the same draft→publish regression, A/B/replay/concurrency/failure rollback and legacy behavior.
- `npm run typecheck`: PASS.
- Related ESLint, `git diff --check`, `npm run db:check`: PASS.
- Migration guard/namespace guard: PASS as above.
- Browser validation: `NOT_RUN`; it was not a prerequisite for this server review.

## Final status

- `REVISION_INTEGRITY: CANDIDATE progress/Evidence binding PASS; candidate authoring draft→publish regression REPRODUCED; local repair PASS but unpushed`
- `MIGRATION_VALIDATION: D1/PG disposable apply and repository validation PASS; no local repair migration`
- `MANAGED_RUNTIME_VALIDATION: NOT_RUN`
- `HISTORICAL_BACKFILL: NOT_EXECUTED`
- `LOCAL_REPAIR_COMMIT: f738a6d518e4907e1f40fdaeb034714a20c35523`
- `REMOTE_MUTATION: none after candidate e2b30b0; no push/PR edit/comment/review/merge`

Required next step before merge: review and push the bounded local repair (or an equivalent fix) and obtain exact-head CI for the repaired head. Separately decide whether the direct security-content upgrade seed is inside the immutable authoring boundary.
