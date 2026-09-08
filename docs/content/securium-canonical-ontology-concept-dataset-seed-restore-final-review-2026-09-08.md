# Canonical Ontology Concept Dataset Seed/Restore — Independent Final Review

## Final Status

`SECURIUM_CANONICAL_ONTOLOGY_CONCEPT_DATASET_SEED_RESTORE_FINAL_REVIEW_FAIL`

Review decision: `FAIL`.

The nonproduction database currently reads back 29 DRAFT Concepts, 10 aliases, and 0 edges. However, the claimed implementation, manifest, dataset report, and seed test are absent from the exact target worktree and branch under review. Matching files exist only as untracked artifacts in the separate SW content worktree. Runtime rows therefore cannot be attributed to `architecture/canonical-ontology-dataset` or reproduced from it.

## Git Baseline and Evidence

| Item | Result |
|---|---|
| Worktree / branch | `securium-canonical-ontology-dataset` / `architecture/canonical-ontology-dataset` |
| HEAD / fresh `origin/main` | `980ef6adb94d87a923d7a973edaf4419f03fff9d` / same |
| Ahead / behind | `0 / 0` |
| Dirty / changed / untracked | clean / none / none |
| Target manifest, Markdown, JSON | all absent; expected hashes cannot be reproduced on target |
| Out-of-branch matching artifact hashes | manifest `7E4F...7564`; Markdown `377E5...D51B`; JSON `6C731...69F6` |

The target branch contains ontology schema and generic repository code, but no repository-controlled 29-Concept seed package. The live database has only the CP-A application migration record, not an ontology seed migration record. This is a provenance/evidence failure, not proof that the live rows are malformed.

## Canonical Authority and Runtime Readback

Canonical authority remains exactly one: `public.ontology_concepts` for identity and `public.ontology_aliases` for exact aliases. Legacy `public.concepts`, `concept_versions`, and `concept_labels` remain reference-only; CP-A, metadata, labels, UI constants, and JSON are not identity authority.

Observed Supabase nonprod (`securium-governance-nonprod`, `ppvawotvswcrdadwmyed`, PostgreSQL 17.6):

| Readback | Count/result |
|---|---:|
| Concepts / aliases / edges | `29 / 10 / 0` |
| Question/content mappings | `0 / 0` |
| Duplicate IDs / keys | `0 / 0` |
| Ambiguous / orphan aliases | `0 / 0` |
| DRAFT / ACTIVE | `29 / 0` |
| Anon/authenticated direct grants | `0` |

The observed rows all carry `source_id=SECURIUM_CANONICAL_CONCEPT_DATASET_V1_2026_09_08` and bounded independent-authoring metadata. Because the seed source is not present on the target branch, this is recorded as runtime evidence only, not target-branch approval.

## Concept Inventory

All observed rows use `concept:securium:<slug>` IDs and `ontology:securium:<slug>` keys, are DRAFT, and report `SECURIUM_INDEPENDENT_AUTHORING` provenance.

| ID suffix | Preferred label | Aliases | Domains |
|---|---|---:|---|
| api-security | API Security | 0 | SC, WP |
| attack-surface-analysis | Attack Surface Analysis | 0 | WP |
| authentication | Authentication | 1 | SC, WP |
| authorization | Authorization | 1 | SC, WP |
| code-injection | Code Injection | 0 | SC, SW, WP |
| cross-site-request-forgery | Cross-Site Request Forgery | 1 | SC, WP |
| cross-site-scripting | Cross-Site Scripting | 1 | SC, SW, WP |
| cryptography | Cryptography | 0 | SC |
| data-minimization | Data Minimization | 0 | SC |
| dependency-security | Dependency Security | 0 | SC |
| encryption | Encryption | 0 | SC |
| error-information-exposure | Error Information Exposure | 0 | SC, SW, WP |
| file-upload-security | File Upload Security | 0 | SC, SW, WP |
| http-response-splitting | HTTP Response Splitting | 0 | SW, WP |
| idor-bola | IDOR / BOLA | 2 | SC, WP |
| injection | Injection | 0 | SC, SW, WP |
| input-validation | Input Validation | 0 | SC, SW, WP |
| os-command-injection | OS Command Injection | 1 | SC, SW, WP |
| output-encoding | Output Encoding | 0 | SC, SW, WP |
| password-hashing | Password Hashing | 0 | SC |
| path-traversal | Path Traversal | 1 | SC, SW, WP |
| secure-code-review | Secure Code Review | 0 | SC, SW |
| security-logging | Security Logging | 0 | SC, WP |
| sensitive-data-exposure | Sensitive Data Exposure | 0 | SC, SW |
| server-side-request-forgery | Server-Side Request Forgery | 1 | SC, WP |
| session-management | Session Management | 0 | SC, WP |
| sql-injection | SQL Injection | 1 | SC, SW, WP |
| trust-boundary | Trust Boundary | 0 | SC, SW, WP |
| vulnerability-validation | Vulnerability Validation | 0 | SW, WP |

The inventory preserves distinctions such as Injection versus SQL/OS Command/Code Injection, Authentication versus Authorization, Authorization versus IDOR/BOLA, and Cryptography versus Encryption/Password Hashing. No course-local IDs or label-as-identity behavior was observed in the live data.

Aliases: `AuthN→Authentication`, `AuthZ→Authorization`, `Broken Object Level Authorization→IDOR/BOLA`, `Command Injection→OS Command Injection`, `CSRF→Cross-Site Request Forgery`, `Directory Traversal→Path Traversal`, `Insecure Direct Object Reference→IDOR/BOLA`, `SQLi→SQL Injection`, `SSRF→Server-Side Request Forgery`, `XSS→Cross-Site Scripting`. All 10 resolved exactly; ambiguity and orphan counts were zero. Label-only and unknown resolution remain unresolved; ambiguity must fail closed.

## Compatibility and Cross-Worktree Review

- SW Security Weakness topic/objective/question probes cannot be executed against the target branch because its course/question artifacts and target seed package are absent. SW closure readiness is `BLOCKED`, not `40/40`.
- Secure Coding’s current inspected v2 report has `18` Concept candidates. The reported “36” is not supported as a 36-Concept identity set; inspected occurrences are `SCW-36` and 36-slot/operation semantics. Classification: `COUNT_SEMANTICS_DIFFER`; no second 36-ID canonical authority was found. Cross-worktree risk: `MEDIUM` until a governed shared mapping inventory is reconciled.
- Web Pentest has draft/plan candidates and known future gaps (CSRF, CORS, business logic, race condition), but no persisted canonical mapping writes. Compatibility is `PARTIAL`, not closure.
- No Skill, Role, Evidence, CompetencyEvidence, Mastery, learner-state, lab, publication, or production mutation occurred.

## Engineering and Security Gates

| Gate | Result |
|---|---|
| Generic ontology focused tests | `27/28 PASS`; one failure: missing pre-existing CSV fixture |
| Dataset-specific seed/manifest tests | not runnable: target artifacts absent |
| Full unit | `448/448 PASS` |
| Typecheck / lint / build | `PASS / PASS / PASS_EXIT_0` |
| `db:check` / PostgreSQL validation | `PASS / PASS (29 files, 92 tables)` |
| Migration guard | `10/10 PASS` |
| D1 local migration validation | `PASS`; local only |
| `git diff --check` / skip-only-todo scan | `PASS / 0/0/0` |
| Production DB / deployment | `NO / NO` |

Security Critical/High: `0/0`. Data Trust Critical/High: `1 P1 blocking target artifact/provenance evidence`. Privacy Critical/High: `0/0`. Legacy RLS disabled state is a separate `P2` hardening advisory; no public client grants or canonical resolver fallback were observed.

## Findings

### P1 — CODO-REV-P1-001: target branch lacks the claimed seed evidence

Evidence: target HEAD is clean/equal to `origin/main`; manifest, implementation report, machine report, seed module, and seed test are absent. Impact: the 29 identities, alias semantics, provenance, determinism, and idempotency cannot be independently verified for the claimed branch. Required repair: integrate the governed seed package and evidence on the target branch, then rerun this review. Verification: target `git ls-tree`, exact hashes, clean-environment seed/readback, resolver, alias, duplicate, and idempotency tests.

### P1 — CODO-REV-P1-002: runtime rows are not branch-bound

Evidence: nonprod reads 29/10/0, but matching seed artifacts are only out-of-branch untracked files and the live application migration history has no ontology seed record. Impact: another worktree remains the effective seed source and reproducibility from the target branch is unproven. Required repair: provide governed integration or an immutable seed receipt tied to target HEAD and nonprod readback; rerun independently.

P2 findings are the legacy RLS/exposure advisory and one missing pre-existing generic ontology CSV fixture. No P0 finding was identified.

## Decision and Remaining Gates

Dataset decision: `FAIL`. It is not classified as `CANONICAL_ONTOLOGY_CONCEPT_DATASET_FOUNDATION_APPROVED`, and SW Concept Mapping Closure must not be rerun yet.

Recommended next gate: `BOUNDED_CANONICAL_ONTOLOGY_DATASET_ARTIFACT_INTEGRATION_REPAIR` followed by a fresh independent `REVIEW_SECURIUM_CANONICAL_ONTOLOGY_CONCEPT_DATASET_SEED_RESTORE`. Only after that should SW Concept Mapping Closure proceed, followed by separate Skill, Evidence, lab, governance, rights, and publication gates.

Commit / Push / PR / Deployment / Production DB: `NO / NO / NO / NO / NO`.
