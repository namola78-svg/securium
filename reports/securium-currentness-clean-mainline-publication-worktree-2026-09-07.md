# Securium CURRENTNESS Clean Mainline Publication Worktree

Snapshot: 2026-09-07 (Asia/Seoul)

## Decision

- Final Status: `SECURIUM_CURRENTNESS_CLEAN_MAINLINE_PUBLICATION_WORKTREE_PASS_READY_FOR_BOUNDED_PR`
- Decision: `APPROVE_CLEAN_MAIN_BASED_CURRENTNESS_GLOBAL_INTEGRATION_PUBLICATION_CANDIDATE`
- Readiness: `CURRENTNESS_GLOBAL_INTEGRATION_ISOLATED_JOURNAL_SYNCHRONIZED_PR_CREATION_MAY_PROCEED`
- Primary Next Gate: `CREATE_SECURIUM_CURRENTNESS_GLOBAL_INTEGRATION_BOUNDED_PR`

## Worktrees and evidence

- Coordinator: `securium-migration-integration`, branch `integration/migration-reconciliation`, HEAD `a17d4702061250d8b4d3fce8bbbd500dcc2442b2`; unchanged by this preparation.
- Fresh `origin/main`: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`.
- The fresh-main delta from the prior closure baseline is the unrelated SW Security Weakness canonicalization-preflight change; no migration, journal, Generic Review, or CURRENTNESS conflict was found.
- Approved source: `securium-secure-coding-content-v1`, branch `content/secure-coding-v1`, HEAD `1855f9818b473a2aa752d004da45a27f056b4838`; source remained dirty and untouched.
- Candidate: `securium-currentness-mainline-publication-clean`, branch `integration/currentness-mainline-publication-clean`, based directly on fresh `origin/main`. Initial status was clean; the final dirty state consists only of the 19-file bounded package below.

Closure Markdown SHA: `b372f357a77d724eb6e37d139e88a2c6a376684b9365912b33fd3a4b51573d29`

Closure machine SHA: `442387412ad9a688fff23481e1ee5fd355f17a4386888fde8a6f6153497cda8c`

Stable manifest SHA (`RAW_FINAL_FILE_SHA256_V1`): `cc735f10e9407d8fa425e297ddd4778952438d0b524d93ff0d4b95227f56adad`

## Publication package and provenance

The bounded implementation package contains exactly 19 changed files. The two preparation reports below are the only additional candidate files, for 21 total changed files:

- Runtime/domain: `db/schema.ts`, `lib/policy/content-review-judgment.ts`.
- PostgreSQL prerequisites and CURRENTNESS migration: `db/postgres/migrations/0023` through `0029`.
- D1 prerequisites and CURRENTNESS migration: `drizzle/0035` through `0040`.
- Journal: `drizzle/meta/_journal.json`, composed from fresh-main entries 0–34 plus approved entries 35–39 and exactly one new entry 40.
- Guard: `scripts/migration-namespace-guard.mjs`.
- Focused validation: `tests/currentness-domain.test.ts`, `tests/migration-namespace-guard.test.mjs`.
- Preparation reports: this Markdown report and its JSON companion.

The migration prerequisites are included because fresh `origin/main` ends at PostgreSQL 0022/D1 0034; they are the approved global chain required to apply the candidate through 0029/0040. No Secure Coding course content, ISE content, Web Pentest implementation, SW Security Weakness files, or unrelated reports were copied.

Source byte identity:

- PostgreSQL 0029 source/candidate: `594c1dcf17997169ab185b02310576bae020035fe1d8c8a0a4d7c8a8bd165f5b`.
- D1 0040 source/candidate: `2415c499bb19c088e060cee868d866184b5c32d904ba08be76b18323550e6472`.
- `lib/policy/content-review-judgment.ts` source/candidate: `36ccfd8832d3c2d063695d1ff58fe7de5d595341cfbb8fd315ae0590aa8e5d2a`.
- The schema’s Generic Review block is source-equivalent and was merged additively into the fresh-main schema. This was necessary to preserve current-main CS1A declarations; the source schema was not copied wholesale.

## Namespace and journal

- PostgreSQL namespace: 0022 baseline, 0023–0028 approved prerequisites, 0029 CURRENTNESS; duplicate IDs 0.
- D1 namespace: 0034 baseline, 0035–0039 approved prerequisites, 0040 CURRENTNESS; duplicate IDs 0.
- Next candidates: PostgreSQL 0030 and D1 0041, both `UNRESERVED`; no allocation was made.
- Historical migration mutation: 0.
- Journal before candidate: fresh-main 0–34.
- Journal after candidate: 0–40, with idx 40 count 1 and tag `0040_generic_review_currentness_domain` count 1, ordered immediately after idx 39. Journal authority is `MAINLINE_JOURNAL_AUTHORITY_RESOLVED`.

## Domain safety

The Generic Review domain model contains exactly:

`TECHNICAL`, `SAFETY_SECURITY_CONTENT`, `COPYRIGHT_RIGHTS`, `CURRENTNESS`, `SUPPORT_QUALIFICATION`.

CURRENTNESS occurs once. There is no default CURRENTNESS PASS, no backfill, and no grandfathering. The approved migrations are additive; they do not update historical rows or add a concurrency mechanism. Web Pentest remains policy-compatible with CURRENTNESS not required; ISE remains feature-specific and may require it; SW Security Weakness remains migration-neutral.

## Validation

- PostgreSQL Run A: PASS on disposable PostgreSQL 17.6; existing row preserved, CURRENTNESS accepted, unknown domain rejected, exactly one 0029 ledger entry, exact five-domain check.
- PostgreSQL Run B: PASS on an independent disposable PostgreSQL 17.6; equivalent readback and checks.
- PostgreSQL determinism: PASS for migration order and catalog/readback checks.
- D1 Run A: PASS on an isolated local Wrangler store through 0040; 116 tables, judgment table present, idx 40 applied, no foreign-key violations.
- D1 Run B: PASS on an independent local Wrangler store with identical structural readback.
- D1 determinism: PASS; both stores reported the same structural counts and CURRENTNESS schema metadata.
- D1 CURRENTNESS acceptance: PASS in both disposable stores after valid local fixture rows were inserted.
- D1 unknown-domain rejection: PASS with the `content_review_judgments_domain_check` constraint.
- Existing-row compatibility: PASS in PostgreSQL; D1 0040 is the approved compatibility-preserving table rebuild and the candidate chain applied cleanly.
- PostgreSQL/D1 parity: PASS for intended domain/check compatibility; engine-specific security details are not conflated.
- CURRENTNESS focused tests: 2/2 PASS.
- Migration namespace guard: PASS (`postgres=29`, `d1=41`, `journal=41`).
- PostgreSQL migration validation: PASS (`POSTGRES_MIGRATIONS_VALID files=29 tables=92`).
- PostgreSQL migration guard: 10/10 PASS.
- Drizzle check: PASS.
- Typecheck: PASS.
- Lint: PASS.
- Build: PASS; Next.js 16.2.6/Turbopack generated 63/63 pages.
- `git diff --check`: PASS.
- New skips/only/TODO bypasses: 0/0/0.

RLS/FORCE RLS, client lockdown, append-only triggers, FKs, indexes, advisory-lock behavior, reviewer separation, and caller-trust behavior remain those of the approved prerequisite migrations; 0029/0040 introduce only the authorized domain extension/rebuild compatibility. No new concurrency mechanism was introduced.

## Safety and publication boundary

- Security Critical/High: 0/0.
- Data Trust Critical/High: 0/0.
- Production DB: NO.
- Production migration: NO.
- Deployment: NO.
- Commit: NO.
- Push: NO.
- PR: NO.
- Main merge: NO.
- Coordinator mutation: NO; existing coordinator state/reports/migrations were not edited.
- Source mutation: NO; dirty source worktree remained untouched.
- Feature-worktree mutation: 0.

The candidate is an isolated, uncommitted publication worktree. The bounded PR gate may now review this exact 19-file package and its provenance.
