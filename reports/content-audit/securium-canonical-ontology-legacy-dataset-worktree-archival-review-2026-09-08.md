# Securium Canonical Ontology Legacy Dataset Worktree Archival Review

Final Status: **ARCHIVAL_REVIEW_BLOCKED_PENDING_TRACKED_EVIDENCE**  
Decision: **PRESERVE_WORKTREE**  
Review scope: read-only archival safety review; no worktree, branch, stash, Dataset B, shared nonprod, or production mutation was performed.

## 1. Git Baseline

- Worktree: `C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/securium-canonical-ontology-dataset`
- Branch: `architecture/canonical-ontology-dataset`
- HEAD: `980ef6adb94d87a923d7a973edaf4419f03fff9d`
- `origin/main`: `980ef6adb94d87a923d7a973edaf4419f03fff9d`
- Ahead/behind: `0/0`
- HEAD equals `origin/main`: `true`
- Working tree: dirty; `package.json` modified
- Untracked entries: `15`
- Total dirty/untracked entries: `16`
- Baseline captured before this archival-review report set was created; the three new review outputs appear as additional untracked files afterward.

The branch has no commits not already in `origin/main`; its reflog only records creation from `origin/main`. The historical evidence is therefore not preserved by this branch's commit history.

## 2. Prior Hash Verification

The supplied authority-closure report hashes were recalculated and match:

- Markdown: `cab999e259d4ce3bb8478d8a38d0916180898f9f61bab36eebbf4d3bac20d348` — PASS
- JSON: `9722132b1446aa7d0ae2817a4a05c7c763bf6abb55d6e7beb5962b4f120a2161` — PASS
- Adjacent `.sha256` sidecar contents match both values — PASS

## 3. Historical Classification and Canonical Ownership

- Classification: **HISTORICAL_DATASET_A**
- Dataset A target: historical/local fixture only; not an active canonical writer
- Dataset A: **29 Concepts / 10 Aliases / 0 Edges**
- Dataset B: **54 Concepts / 56 Aliases / 4 Edges**
- Canonical owner: `securium-canonical-ontology-dataset-foundation`
- Owner count: **1**
- Dataset A shared nonprod authority: **NONE**
- Active canonical writer count: **1**, the owner-worktree canonical seed candidate (`scripts/canonical-ontology-seed.mjs`)
- The owner manifest and active writer candidate are present in the foundation worktree but are also currently untracked; the owner count is unique, but the owner evidence is not yet Git-history preserved.

The foundation owner manifest is the current 54/56/4 source. An older ownership-registry artifact records a stale 50/55/4 snapshot; it is historical evidence and must not be treated as the current owner manifest.

## 4. Unique Artifact Inventory

The following items have audit, provenance, regression, or reproducibility value that is not safely preserved in committed Git history. They are either unique to this worktree or have only non-identical, untracked copies elsewhere.

| Artifact | Value classification | Tracking state | Review result |
|---|---|---|---|
| `lib/data/securium-canonical-concept-dataset-seed.mjs` | MUST_PRESERVE | untracked | Historical Dataset A fixture renderer; non-identical copy exists in the SW worktree, but neither copy is tracked |
| `lib/data/securium-canonical-concept-dataset-archival-guard.mjs` | MUST_PRESERVE | untracked | Unique fail-closed guard for explicit `allowHistoricalFixture`, shared nonprod/production rejection, and Dataset B downgrade rejection |
| `tests/securium-canonical-concept-dataset-seed.test.mjs` | MUST_PRESERVE | untracked | Seed identity, alias, determinism, provenance binding, no-second-authority, and guard regression coverage; SW copy is non-identical and untracked |
| `tests/securium-canonical-ontology-legacy-authority.test.mjs` | MUST_PRESERVE | untracked | Unique Dataset A classification and owner-count regression coverage |
| `reports/content-audit/securium-canonical-ontology-concept-dataset-manifest-2026-09-08.json` | MUST_PRESERVE | untracked | 29/10/0 manifest and live-canonical hash evidence; SW copy is non-identical and untracked |
| `docs/content/securium-canonical-ontology-concept-dataset-seed-restore-2026-09-08.md` | MUST_PRESERVE | untracked | Seed restore/provenance narrative |
| `docs/content/securium-canonical-ontology-concept-dataset-seed-restore-final-review-2026-09-08.md` | MUST_PRESERVE | untracked | Final review and historical disposition narrative |
| `docs/content/securium-canonical-ontology-seed-evidence-restore-and-provenance-binding-repair-2026-09-08.md` | MUST_PRESERVE | untracked | Provenance-binding repair and evidence lineage narrative |
| `reports/content-audit/securium-canonical-ontology-concept-dataset-seed-restore-2026-09-08.json` | MUST_PRESERVE | untracked | Machine-readable restore evidence |
| `reports/content-audit/securium-canonical-ontology-concept-dataset-seed-restore-final-review-2026-09-08.json` | MUST_PRESERVE | untracked | Machine-readable final review evidence |
| `reports/content-audit/securium-canonical-ontology-seed-evidence-restore-and-provenance-binding-repair-2026-09-08.json` | MUST_PRESERVE | untracked | Machine-readable provenance-binding evidence |
| `scripts/build-securium-canonical-ontology-legacy-authority-closure-report.mjs` | MUST_PRESERVE | untracked | Reproducible authority-closure report builder |
| `reports/content-audit/securium-canonical-ontology-legacy-dataset-worktree-authority-closure-2026-09-08.md` | MUST_PRESERVE | untracked | Prior authority-closure report; supplied hash verified |
| `reports/content-audit/securium-canonical-ontology-legacy-dataset-worktree-authority-closure-2026-09-08.json` | MUST_PRESERVE | untracked | Prior machine-readable authority-closure report; supplied hash verified |
| `reports/content-audit/securium-canonical-ontology-legacy-dataset-worktree-authority-closure-2026-09-08.sha256` | MUST_PRESERVE | untracked | Integrity sidecar for the prior reports |
| `package.json` | NICE_TO_PRESERVE | tracked but dirty | Adds the focused historical-closure test command; removal would discard an uncommitted integration hook |

No item above is classified as `GENERATED_ONLY` because the generated reports contain historical provenance and integrity evidence. No item is safely discardable during this review.

## 5. Duplicate Artifact Inventory

- The foundation worktree contains `db/seeds/canonical-ontology/canonical-concept-manifest.json`, `scripts/canonical-ontology-seed.mjs`, `reports/content-audit/securium-canonical-ontology-dataset-semantic-diff-2026-09-08.json`, the owner registry, and reconciliation/integration reports. These are related authority evidence, not a byte-identical preservation of the Dataset A fixture. They are also untracked in that worktree.
- `securium-postgres-baseline-migration-repair/securium-content-sw-security-weakness` contains copies of the Dataset A seed, seed test, and 29/10/0 manifest, plus related restore documents/reports. Hash comparison shows the seed, test, and manifest differ from this worktree. Its worktree is dirty/untracked and therefore is not a safe archival destination.
- The foundation ownership registry explicitly records this path as `SUPERSEDED_HISTORICAL_READ_ONLY` and records the Dataset A manifest as `SUPERSEDED`; this preserves disposition knowledge but not the complete executable fixture or test evidence.
- `git log --all` and `git rev-list --objects --all` contain no committed object for the reviewed Dataset A paths or the authority-closure reports.
- The supplied prior reports and this review currently exist as worktree files, not as tracked history.

## 6. Unique Audit Value and Tracking State

- Tracked historical artifacts: none.
- Tracked dirty historical/integration state: `package.json` only.
- Untracked historical artifacts: 15.
- Stash-only historical artifacts: none found.
- Git-history-preserved historical artifacts: none found.
- Unique untracked/dirty evidence remains: **YES**.

This directly fails the removal preconditions requiring no unique untracked evidence and no dirty unique evidence.

## 7. Historical Fixture Usage

Dataset A remains used as a historical fixture by the focused tests in this worktree. The rerun passed **10/10** and covers:

- stable 29-concept/10-alias identities and exact aliases;
- deterministic SQL rendering;
- explicit local-fixture confirmation;
- shared nonprod and production fail-closed behavior;
- Dataset B downgrade rejection;
- repository/branch/manifest/live-dataset provenance binding;
- no second authority or learner-state mutation;
- unique active Dataset B owner and current owner counts.

The guard is also used by the seed renderer. Provenance comparisons remain represented by the Dataset A manifest, seed binding, restore/final-review reports, and the foundation semantic-diff/ownership reports. No active runtime path imports the reviewed worktree from another worktree.

## 8. Repository References

Read-only searches found references in the reviewed worktree's tests, seed, guard, docs, restore reports, and closure reports. The foundation worktree references Dataset A as superseded historical read-only evidence and records the foundation as the owner. The SW worktree references the foundation owner and retains historical review copies.

No repository script was found that requires the exact filesystem path of this worktree. References to the worktree path are report metadata only. The SW verifier resolves the foundation owner path, not this historical worktree.

## 9. External Worktree References and Path Dependencies

- Active runtime dependencies on files in this worktree: **0**
- Active test dependencies from other worktrees on this exact filesystem path: **0**
- Exact absolute-path script dependency: **0**
- Symlink/reparse dependency: **0**
- External worktree with non-identical historical copies: the SW content worktree
- Canonical owner worktree: the foundation worktree; it does not import Dataset A as an active writer

The only exact absolute-path matches found were the current worktree's own prior reports describing their source worktree.

## 10. Stash Review

Three repository stashes exist and were inspected by name and file list:

- `stash@{0}` `b7aae8edee2fd4cd9553dd2cf4265d17fdb59b9d`: practical repository/schema reconciliation files
- `stash@{1}` `36ce2a1b4caceb83f3e813a020b5172ed792d89b`: practical metadata reconciliation files
- `stash@{2}` `36f78822485790608906b474ae051080aac643da`: ISMS-P batch content/hotfix files

None contains Dataset A seed, manifest, archival guard, closure report, or related ontology paths. No stash deletion or modification was performed.

## 11. Archival Destination

Use the existing tracked-repository convention: `docs/content/` for narrative evidence and `reports/content-audit/` for machine-readable reports and hashes, committed through the canonical foundation/main review path. The executable seed, guard, and tests require an explicit historical-fixture archival decision and must not be placed in the active canonical writer path. No external storage destination is required or proposed.

## 12. Mutation and Guard Regression

- Dataset B mutation: **0**
- Shared nonprod mutation: **0**
- Production mutation: **0**
- Security/Data Trust/Privacy Critical/High: **0/0/0**
- Downgrade guard: **PASS**
- Cross-seed guard: **PASS**

The bounded guard probe produced:

- missing `allowHistoricalFixture`: rejected;
- shared nonprod target: rejected;
- production target: rejected;
- Dataset B-owned state: rejected;
- `LOCAL_HISTORICAL_TEST` with explicit `allowHistoricalFixture: true`: allowed.

The review itself performed no database connection, seed application, migration, production action, or shared nonprod mutation.

## 13. Worktree Removal Safety

**PRESERVE_FIRST**

The worktree is not safe to remove now because unique historical evidence is untracked/dirty and absent from Git history. The runtime/path gates pass, but the evidence-preservation gates do not.

Removal preconditions:

1. no unique untracked evidence — **FAIL**;
2. no dirty unique evidence — **FAIL** (`package.json`);
3. no active path dependency — **PASS**;
4. no runtime dependency — **PASS**;
5. Dataset A authority `NONE` — **PASS**;
6. active canonical writer count `1` — **PASS**;
7. archival guard preserved — **FAIL pending tracked archival commit**;
8. historical reports preserved — **FAIL pending tracked archival commit**;
9. no required stash loss — **PASS**.

## 14. Branch Decision

**DELETE_BRANCH_AFTER_MERGE**

The branch has no unique commits and is equal to `origin/main`. After a reviewed archival evidence commit is made on the appropriate canonical review path and merged/preserved, the worktree branch does not need to remain. Branch deletion is not executed here.

## 15. Findings and Disposition

- P0: none.
- P1: unique Dataset A audit/provenance/test evidence is still untracked or dirty; deleting the worktree now could lose it. This blocks removal until a bounded archival commit review completes.
- P2: foundation ownership artifacts include a stale 50/55/4 registry snapshot alongside the current 54/56/4 manifest; preserve it as historical evidence and keep current-authority interpretation tied to the owner manifest.

Archival commit requirement: **BOUNDED_ARCHIVAL_COMMIT_REVIEW_REQUIRED**

Recommended next gate: **COMMIT_REVIEW_SECURIUM_CANONICAL_ONTOLOGY_DATASET_A_ARCHIVAL_EVIDENCE**

## 16. Commit, Push, PR, and Database Status

- Commit: **NOT MADE**
- Push: **NOT MADE**
- PR: **NOT OPENED**
- Worktree removal: **NOT EXECUTED**
- Branch deletion: **NOT EXECUTED**
- Production DB: **NOT TOUCHED**

## Final Decision

**PRESERVE_WORKTREE**

The historical Dataset A worktree still contains unique audit/provenance/test value that has not been safely retained in tracked repository history. It may be reconsidered only after the archival evidence is reviewed, committed to the existing repository archival convention, and verified again against the removal preconditions.
