# PR #152 theory revision integrity repair

Date: 2026-09-11
Repository: `namola78-svg/securium`
Worktree: `securium-theory-revision-integrity-repair`
Branch: `fix/theory-revision-integrity`
Repair base/head before commit: `e0705c08e5475d304f7c91ff446f79b8637514f5`
Fresh `origin/main` observed at final review: `40089519e8642a44e8a2636e2db2426894aa8417` (it was `e67293d285ff913070af5fc1634ecfd5fc4e6405` during the first exact-head CI run)
Final local commits: `e213fc7629b53a97e6b917614bea7b3c0c1aecb6`, `4c52bf7bd29bd0322252ebf43908cd1c0c2e3f8e`
PR: #152, still Draft at the time of this report

## Finding and selected minimum repair

The review reproduced two independent identity failures:

1. `saveSharedContent` could mutate the learning payload while retaining the same `content_id/version`.
2. CourseLesson Theory Evidence used `content_version` without a server-owned `content_id` plus immutable snapshot binding.

The repair reuses the existing `content_revisions` table and its unique `(content_type, content_id, version)` contract. No new migration or backfill was added. Published shared content now writes a `SHARED_CONTENT_REVISION_V1` snapshot and SHA-256 semantic hash. A learning-payload mutation for an existing same-ID/same-version revision returns `409 SHARED_CONTENT_REVISION_CONFLICT`; metadata-only updates remain allowed. A new version creates a separate snapshot and supersedes the prior published revision. Same-payload replay remains idempotent.

The caller's content ID/version is used only for mismatch validation. Progress storage continues to use the server-resolved course lesson/content/version identity. The Evidence resolver now reads the server-owned content ID from CourseLesson progress, resolves the matching `LEARNING_UNIT` snapshot, verifies status, snapshot kind, content ID/version, and semantic hash, and includes a structured `contentRevisionBinding` in the source and candidate identity. Missing, malformed, or legacy identity is `LEGACY_INELIGIBLE` / `UNRESOLVED`; it is not attached to current content.

## Storage and behavior

- `contents`: current authoring row and current `version`; same-version learning payload changes are rejected once immutable revision state exists or the row is published.
- `content_revisions`: immutable snapshot JSON, `content_id`, `version`, `semantic_hash`, revision status, previous version ID, and latest/superseded state.
- CourseLesson progress/activity: existing server-resolved `content_id` and `content_version` binding remains in use; no duplicate progress store was introduced.
- Evidence source: CourseLesson sources now carry `{contentId, version, revisionId, semanticHash, binding}`. Candidate identity includes this object without relying on delimiter-concatenated strings.
- Existing question, mock, SW, and general source identity behavior is unchanged.

The current-revision overview behavior is preserved: after a new revision, only the current published revision is counted by the existing current-content aggregation. This can make current progress decrease while historical A activity/progress remains stored. Legacy NULL-version rows remain stored and are not promoted to the latest revision. Evidence projection/mastery/Skill State calculation was not run or expanded by this repair.

## Changed files

- `.github/workflows/ci.yml` — runs the dedicated revision-integrity suite in CI.
- `db/shared-content-repositories.ts` — immutable shared-content snapshots, conflict checks, version transition transaction ordering.
- `db/evidence-source-adapters.ts` — server-owned CourseLesson content-revision resolution and fail-closed legacy handling.
- `lib/services/content-revision-service.ts` — shared snapshot kind constant.
- `lib/services/evidence-projection.ts` — structured content-revision binding in Evidence identity and validation.
- `package.json` — dedicated D1/Evidence/PostgreSQL test script.
- `tests/evidence-source-adapters-course-lesson-revision.test.mjs` — resolver identity and missing/corrupt snapshot coverage.
- `tests/theory-revision-integrity-d1-e2e.test.mjs` — D1 app/admin/progress mutation, replay, concurrency, rollback, deletion, and legacy coverage.
- `tests/course-lesson-progress-revision-binding-postgres-disposable.test.mjs` — actual PostgreSQL app/repository authoring and deletion checks.
- `tests/migration-namespace-guard.test.mjs` — expected inventory 34 PostgreSQL / 45 D1 journal entries, matching PR #152's existing 0051/0044 migrations.
- This report.

No schema or migration file was added. PR #152's D1 0044 and PostgreSQL 0051 remain the prerequisite migrations; migration inventory, journal/snapshot, and namespace checks remain aligned. Existing migration rollback limitations and legacy NULL rows are unchanged; this repair does not reconstruct unknown historical snapshots.

## Verification

All checks were local/disposable only; Runtime/shared/production databases were not accessed.

- D1 CourseLesson revision-integrity E2E: PASS, 1/1.
- D1 Evidence resolver tests: PASS, 3/3.
- Disposable PostgreSQL app/repository test: PASS, 1/1.
- Existing D1 CourseLesson progress regression: PASS, 1/1.
- Targeted Evidence/general source regression: PASS, 20/20.
- Unit suite: PASS, 457/457.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS; five pre-existing warnings remained outside changed product files.
- `npm run db:check`: PASS.
- `npm run db:generate`: PASS; no schema changes generated.
- `npm run db:postgres:validate`: PASS; 34 migration files, 92 tables, checksum `4249410d1e5fbb41`.
- PostgreSQL migration guard: PASS, 16/16.
- Migration namespace guard: PASS, 2/2.
- `git diff --check`: PASS.
- Browser verification: NOT_RUN; it is not a prerequisite for this server-side repair.
- Exact-head CI for `e213fc7` initially failed at typecheck because the concurrently advanced main (`e67293d`) already exposed the optional Evidence resolution fields and the PR declared them a second time. The follow-up `4c52bf7` keeps that existing contract and adds only the revision-binding type through an intersection. As of this report, GitHub has not created a replacement check-run for `4c52bf7` (`NOT_RUN`); the local typecheck and focused resolver regression pass after the fix. The e213 producer CI `34573391939` was SUCCESS.

The disposable PostgreSQL fixture included legacy NULL-version progress, revision A activity, multiple users/courses/lessons, A completion, B completion, replay, concurrent completion, stale/forged/cross-course/auth guards, and activity-failure rollback. It confirmed A/B rows and activities remain distinct and failed authoring batches leave no partial content/revision state. Hard delete remains FK-restricted; soft delete preserves revision snapshots.

## Freshness and integration notes

`origin/main` advanced from the review baseline `04d2175d971b8b849c80a0510b462a8c7b328deb` to `b7f06e39919d92bac166a67aec274754ec21a2c7`, then to `e67293d285ff913070af5fc1634ecfd5fc4e6405` during the first CI run, and finally to `40089519e8642a44e8a2636e2db2426894aa8417` after unrelated #155 work. It is not an ancestor of the repair head, so no unrelated rebase was performed. The PR source branch was still at `e0705c08e5475d304f7c91ff446f79b8637514f5` before publication. The only follow-up compatibility adjustment reuses the resolution-field contract already present on the advanced main; it does not import unrelated main changes.

The #144 worktree/branch was preserved. The known file overlap is `db/shared-content-repositories.ts` and `package.json`; the repair changes are limited to immutable revision persistence and dedicated verification, and do not alter #144 availability/route behavior. The #144 branch was not modified and its unmerged changes were not included. The PR #152 progress identity contract, including stale screen mismatch rejection, remains the caller-validation boundary.

## Limits and deployment order

Apply PR #152's D1 0044 / PostgreSQL 0051 schema migrations before deploying the repaired repository and resolver code. Existing published rows without a snapshot are not silently backfilled; a successful non-DRAFT save can establish the first snapshot from the current row, while an attempted same-version payload mutation is rejected. Legacy progress without a revision identity remains ineligible for revision-bound Evidence. No historical backfill, approval, Evidence recomputation, mastery/Skill State calculation, publication, deployment, or merge was performed.
