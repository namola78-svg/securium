# Canonical Ontology Seed Evidence Restore and Provenance Binding Repair

Final Status: SECURIUM_CANONICAL_ONTOLOGY_SEED_EVIDENCE_RESTORE_AND_PROVENANCE_BINDING_REPAIR_BLOCKED

## Decision

Repair decision: BLOCKED

CODO-REV-P1-001: CLOSED. The canonical ontology branch now contains the deterministic seed implementation, manifest, semantic tests, and current repair evidence.

CODO-REV-P1-002: NOT_CLOSED. A current read-only query of the same nonprod project now returns 50 concepts, 55 aliases, and 4 edges, with foundation manifest cf8b59d94e55328c5a074ecf1d4e8368bcab94e0570edff554a88084b671dc96 and 41 ACTIVE rows. This does not match the target 29-concept/10-alias/0-edge binding. No destructive deletion or cross-worktree overwrite was performed.

## Baseline and ownership

- Target: securium-canonical-ontology-dataset / architecture/canonical-ontology-dataset
- HEAD and origin/main: 980ef6adb94d87a923d7a973edaf4419f03fff9d; ahead/behind 0/0
- Ownership: CANONICAL_ONTOLOGY_BRANCH_IS_RIGHTFUL_OWNER
- No commit, push, PR, deployment, production DB mutation, activation, or course mapping write was performed.
- The SW worktree artifacts remain untracked duplicate/stale reference evidence and were not treated as authority. The foundation worktree candidate was classified DIFFERENT_PURPOSE.

## Cryptographic linkage

- Live nonprod project: securium-governance-nonprod (ppvawotvswcrdadwmyed)
- Previously verified target live canonical dataset SHA-256: fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009
- Current live state: 50 concepts / 55 aliases / 4 edges; not equal to the target bound hash
- Repository manifest SHA-256: 16B6BA243E587FD1BE021FD950DEAB56B82D670078BE26B2C16C1BEF18BF91D8
- Seed module SHA-256: B526DFE09A13FD078BABBB671E10A76ACF128D42ECCCF3F8C6204D9654B0C0DD
- Seed test SHA-256: 788AEAEA7C0C1B27B9416B3A5B169EDACD30B01D87682127D4129E66EC050981
- Rendered SQL SHA-256: A3744BAE60AD45678193E267F774B080DED39E3F03DE7EEA228999C737C781D3

## Evidence

- Earlier independent comparison: 29/29 concepts exact, 10/10 aliases exact, 0 missing/extra; lifecycle 29 DRAFT / 0 ACTIVE; edges 0.
- Current nonprod readback is 50/55/4 and carries the different foundation manifest; target-to-live linkage is therefore not currently reproducible.
- Repository seed renderer was applied twice to the earlier target state and was idempotent; the current shared state requires explicit ownership reconciliation before another apply.
- Current target seed provenance binding remains repository-controlled, but no longer binds the current live rows.
- Resolver behavior: exact ID 29/29, concept_key 29/29, alias 10/10, unknown/ambiguous/label-only fail closed.
- Focused seed tests: 6/6 PASS. Unit: 448/448 PASS. Typecheck, lint, build, db:check, PostgreSQL validation, migration guard, and diff checks PASS.
- PostgreSQL status probe was unavailable because DIRECT_URL_REQUIRED; no mutation was attempted.

## Scope and boundaries

- New concepts: 0; course/question/content mappings: 0; schema change: 0; migration change: 0; historical migration mutation: 0.
- Skill, Role, Evidence, CompetencyEvidence, Mastery, and learner-state mutation: 0.
- Legacy concept tables remain reference-only and the RLS advisory remains a separate P2 hardening item. The missing pre-existing ontology CSV fixture remains a separate P2.
- The Secure Coding reported 36 count is treated as COUNT_SEMANTICS_DIFFER, not as evidence for seven extra canonical concepts. No authority collision was found.
- SW candidate probe resolves 8/8 topics and 40/40 question keys against the target seed read-only, but mapping closure remains blocked until the shared nonprod authority is reconciled.

## Next gate

RECONCILE_SHARED_NONPROD_CANONICAL_DATASET_OWNERSHIP_AND_REBIND_OR_RESTORE_WITH_EXPLICIT_AUTHORITY
