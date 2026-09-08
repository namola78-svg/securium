# Securium Canonical Ontology Legacy Dataset Worktree Authority Closure

Final Status: **SECURIUM_CANONICAL_ONTOLOGY_LEGACY_DATASET_WORKTREE_DEAUTHORITY_PASS_READY_FOR_REVIEW**
Decision: **PASS_READY_FOR_ARCHIVAL_REVIEW**

## Git Baseline

- Worktree: C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/securium-canonical-ontology-dataset
- Branch: architecture/canonical-ontology-dataset
- HEAD: 980ef6adb94d87a923d7a973edaf4419f03fff9d
- origin/main: 980ef6adb94d87a923d7a973edaf4419f03fff9d
- HEAD equals origin/main: true
- Dirty/untracked state preserved: 16 entries recorded

## Classification and ownership

- Worktree Classification: **HISTORICAL_DATASET_A**
- Dataset A Counts: **29 Concepts / 10 Aliases / 0 Edges**
- Current Dataset B Counts: **54 Concepts / 56 Aliases / 4 Edges**
- Canonical Owner: **securium-canonical-ontology-dataset-foundation**
- Canonical Owner Count: **1**
- Dataset A Manifest Classification: **ARCHIVED_EVIDENCE**
- Dataset A Shared Nonprod Write Capability: **NONE**
- Environment Guard: **PASS_FAIL_CLOSED_SHARED_NONPROD_AND_PRODUCTION**

## Dataset A writers and guards

- {"path":"lib/data/securium-canonical-concept-dataset-seed.mjs","capability":"renderSecuriumCanonicalConceptSeedSql","classification":"HISTORICAL_LOCAL_FIXTURE_RENDERER","canonicalWriterAuthority":"NONE","guard":"Explicit allowHistoricalFixture + LOCAL_HISTORICAL_TEST only; shared nonprod/production/Dataset B fail closed"}

- Downgrade Guard: **PASS**
- Cross-seed Guard: **PASS**
- Active Canonical Writer Count: **1**

## Mutation boundaries

- Dataset B Mutation: **0**
- Shared Nonprod Mutation: **0**
- Production Mutation: **0**
- SW Mapping Boundary: NO CHANGE / 0
- Secure Coding Boundary: NO CHANGE / 0
- Web Pentest Boundary: NO CHANGE / 0
- Skill / Role / Evidence / Mastery Mutation: **0 / 0 / 0 / 0**
- Schema / Migration Change: **0 / 0**

## Historical evidence

- Preservation: **PASS**
- Dataset A 29-concept/10-alias manifest
- Dataset A seed restore reports and semantic evidence
- Dataset A live-canonical hash fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009
- Dataset A manifest hash 16b6ba243e587fd1be021fd950deab56b82d670078be26b2c16c1bef18bf91d8
- Owner registry and Dataset B semantic-diff evidence in the owner worktree

## Duplicate authority scan

- {"worktree":"securium-canonical-ontology-dataset","artifacts":["lib/data/securium-canonical-concept-dataset-seed.mjs"],"classification":"HISTORICAL_SEED_EVIDENCE","canonicalWriterAuthority":"NONE"}
- {"worktree":"securium-canonical-ontology-dataset-foundation","artifacts":["scripts/canonical-ontology-seed.mjs","db/seeds/canonical-ontology/canonical-concept-manifest.json"],"classification":"ACTIVE_CANONICAL_WRITER","canonicalWriterAuthority":"OWNER_ONLY"}
- {"worktree":"securium-postgres-baseline-migration-repair/securium-content-sw-security-weakness","artifacts":["lib/data/securium-canonical-concept-dataset-seed.mjs"],"classification":"HISTORICAL_SEED_EVIDENCE","canonicalWriterAuthority":"NONE"}

## Verification gates

- Focused Tests: **PASS 10/10** (npm run test:canonical-ontology-legacy-closure)
- Unit: **PASS 448/448** (npm run test:unit)
- Typecheck: **PASS**
- Lint: **PASS**
- Build: **PASS**
- db:check: **PASS**
- git diff --check: **PASS**

## Reviews and disposition

- Security Critical/High: **0/0**
- Data Trust Critical/High: **0/0**
- Privacy Critical/High: **0/0**
- P0: none
- P1: none
- P2: Archive or remove this legacy worktree only after explicit archival review; do not delete automatically.
- Recommended Next Gate: **ARCHIVE_OR_REMOVE_SECURIUM_CANONICAL_ONTOLOGY_DATASET_LEGACY_WORKTREE_AFTER_REVIEW**

## Publication and database status

- Commit: NOT MADE
- Push: NOT MADE
- PR: NOT OPENED
- Deployment: NONE
- Production DB: NOT TOUCHED

SHA-256 values for this Markdown and JSON report are in the adjacent `.sha256` file.
