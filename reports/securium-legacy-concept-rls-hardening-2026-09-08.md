# Securium Legacy Concept RLS Hardening Report

## 1. Final status

`SECURIUM_LEGACY_CONCEPT_RLS_HARDENING_PASS_READY_FOR_REVIEW`

Decision: `PASS_READY_FOR_INDEPENDENT_REREVIEW`

Snapshot date: `2026-09-08` (`Asia/Seoul`)

This is a repository and disposable-PostgreSQL security gate. No production database, deployment, commit, push, or PR was performed.

## 2. Git baseline

| Field | Result |
|---|---|
| Worktree | `securium-legacy-concept-rls-hardening` |
| Branch | `security/legacy-concept-rls-hardening` |
| HEAD | `980ef6adb94d87a923d7a973edaf4419f03fff9d` |
| `origin/main` | `980ef6adb94d87a923d7a973edaf4419f03fff9d` |
| Ahead/behind | `0/0` |
| Fresh baseline | PASS; clean before task changes |
| Final worktree | Expected changes only: one PostgreSQL migration, one focused test, one package script, one guard count, and two reports |

## 3. Scope and authority

Target tables: `concepts`, `concept_versions`, `concept_labels`.

Canonical authority remains `ontology_concepts` plus `ontology_aliases`; canonical authority count is `1`. No canonical ontology table, seed, manifest, edge, ownership registry, mapping, Skill, Role, Evidence, CompetencyEvidence, Mastery, user skill state, credential, or twin data was changed.

Canonical Dataset Mutation: `0`.

The legacy tables are not promoted to canonical authority. They remain a server-only compatibility persistence path.

## 4. Legacy table purpose and decisions

| Table | Purpose classification | Intended read policy | Intended write policy | Decision |
|---|---|---|---|---|
| `concepts` | Historical/compatibility persistence; still read by a server-only compatibility query and exposed as a server-only write primitive | `SERVER_ONLY` | `SERVER_ONLY` | `KEEP_SERVER_ONLY` |
| `concept_versions` | Historical/compatibility version metadata for legacy `concepts`; server-only compatibility read | `SERVER_ONLY` | `SERVER_ONLY` | `KEEP_SERVER_ONLY` |
| `concept_labels` | Historical/compatibility labels used by the legacy server lookup; not canonical aliases | `SERVER_ONLY` | `SERVER_ONLY` | `KEEP_SERVER_ONLY` |

These are shared metadata tables, not learner-owned rows. No owner-based learner policy was invented.

## 5. Runtime usage inventory

| Path | Classification | Finding |
|---|---|---|
| `db/schema.ts` | Server/provider schema definition | Defines the three legacy tables and no client API |
| `db/concept-persistence-repositories.ts` | Server-only write primitive | `createConcept`, `createConceptVersion`, and `addConceptLabel`; no client route caller found |
| `db/ontology-repositories.ts` | Server-only export boundary | Exports the legacy CP-A primitives separately from canonical ontology repositories |
| `lib/services/server-knowledge-query-service.ts` | Server-only read / deprecated compatibility runtime | Reads the legacy tables for the retained compatibility query; this gate preserves the path rather than rewriting architecture |
| `db/ontology-repositories.ts` canonical functions | Server-only canonical path | Canonical reads/writes use `ontology_concepts` and `ontology_aliases` |
| tests and migrations | Test-only or migration-only | Direct legacy SQL is confined to CP-A tests and PostgreSQL migration `0020`; the new test is security-focused |
| Next.js/API/server action search | No direct legacy writer found | Unsafe client-callable API writer count: `0` |
| RPC/function search | No target-table RPC or `SECURITY DEFINER` writer found | Unsafe RPC writer count: `0` |

## 6. Grants, RLS, and PostgREST reachability

The repository has no configured remote PostgreSQL/Supabase credentials in this worktree. Exact effective state was verified on the repository’s disposable PostgreSQL 17.6 path by applying the fresh baseline, CP-A migration `0020`, and then the hardening migration.

Before repair, the fresh server-only default-privilege state had RLS disabled on all three target tables, no target policies, and no `anon`/`authenticated` table privileges. This was a latent RLS hardening gap even though the grant boundary already denied direct browser access.

After repair, exact table grants are:

| Grantee | `SELECT` | `INSERT` | `UPDATE` | `DELETE` |
|---|---:|---:|---:|---:|
| `PUBLIC` | 0 | 0 | 0 | 0 |
| `anon` | 0 | 0 | 0 | 0 |
| `authenticated` | 0 | 0 | 0 | 0 |
| `service_role` | 1 | 1 | 1 | 1 |
| privileged owner/server migration role | 1 | 1 | 1 | 1 |

PostgREST/API exposure after repair: no unintended table exposure; the tables remain in `public` but have no browser-role table grants and no client policies.

RLS after repair:

| Table | RLS enabled | FORCE RLS | Policies |
|---|---|---|---|
| `concepts` | yes | no | none |
| `concept_versions` | yes | no | none |
| `concept_labels` | yes | no | none |

Policy duplication: `0`. Policy fail-closed: `PASS`; no policy means a non-privileged role cannot read or write, and table grants are revoked. `FORCE RLS` decision: `NOT_REQUIRED`; the existing server-only model uses a privileged owner/service boundary, and enabling FORCE without a row policy could break a non-BYPASSRLS server connection.

## 7. Hardening change

Migration: `db/postgres/migrations/0041_legacy_concept_rls_hardening.sql`.

The single forward-only migration is limited to:

1. revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`;
2. grant table privileges to `service_role` for the existing server writer/reader boundary;
3. enable RLS on the three target tables;
4. register the migration in `app_schema_migrations`.

There is no structural schema redesign, policy creation, data copy, backfill, row deletion, historical migration mutation, canonical promotion, or D1 fake-RLS change.

Migration number `0041` was selected after a visible-worktree scan: PostgreSQL currently ends at `0029`, D1 has `0000`–`0040` in its separate namespace, and `0041` has zero visible numeric collision. Namespace guard passed with PostgreSQL `30`, D1 `41`, journal `41`.

Service Role Boundary: `service_role` retains table-scoped full access because the repository retains server-side CP-A compatibility writers and reads. Migration Boundary: the privileged migration role can still apply the migration and register it. App Runtime Boundary: the legacy compatibility reader remains server-only and is not exposed as a direct browser table path.

## 8. Focused security tests

`npm run test:legacy-concept-rls` PASS on disposable PostgreSQL 17.6.

The test verified, for each target table:

- anon SELECT/INSERT/UPDATE/DELETE: denied;
- authenticated SELECT/INSERT/UPDATE/DELETE: denied;
- no target policies and no duplicate policies;
- service-role read and insert/update compatibility: successful;
- RLS enabled and FORCE RLS disabled as intended;
- canonical `ontology_concepts`, `ontology_aliases`, and `ontology_edges` counts unchanged;
- no legacy row deletion.

Supabase-equivalent tests: PASS via disposable PostgreSQL role simulation (`anon`, `authenticated`, and BYPASSRLS `service_role`). Remote Supabase advisory execution was not available because no Supabase CLI/connection was configured; residual reason is operational verification only, not an identified code finding.

## 9. Regression and boundary results

| Required boundary | Result |
|---|---|
| Canonical Resolver Regression | PASS; canonical repository/preflight paths use `ontology_concepts`/`ontology_aliases`; legacy compatibility reader remains explicitly server-only |
| Secure Coding Regression | PASS; full unit and ontology/security tests pass |
| SW Mapping Boundary | Mutation `0` |
| Web Pentest Boundary | Mutation `0` |
| Digital Forensics Boundary | Mutation `0` |
| Skill Boundary | Mutation `0` |
| Role Boundary | Mutation `0` |
| Evidence Boundary | Mutation `0` |
| CompetencyEvidence Boundary | Mutation `0` |
| Mastery Boundary | Mutation `0` |
| `user_skill_state` | `ABSENT / UNCHANGED` |
| Credential/Twin | Mutation `0` |
| Legacy Data Deletion | `0` |
| Legacy to Canonical Promotion | `0` |
| Backfill | `NONE` |
| Audit logging | No new architecture; hardening migration has no application data writer |

## 10. Engineering gates

| Gate | Result |
|---|---|
| Focused RLS tests | PASS |
| PostgreSQL direct tests | PASS; disposable PostgreSQL 17.6 |
| Supabase-equivalent tests | PASS; role simulation |
| Unit | PASS; `448/448` |
| Integration | PASS; `59/59` plus migration guard `10/10` |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS_EXIT_0 |
| `db:check` | PASS |
| PostgreSQL validation | PASS; `files=30`, `tables=92` |
| Migration guard | PASS |
| Namespace guard | PASS |
| Global namespace scan | PASS; target collision `0` |
| `git diff --check` | PASS |
| New skip/only/TODO | `0/0/0` in added changes |

## 11. Risk summary and final decision

| Review | Result |
|---|---|
| Security Critical/High | `0/0` after repair |
| Data Trust Critical/High | `0/0` after repair |
| Privacy Critical/High | `0/0`; legacy metadata contains no learner-sensitive data in reviewed schema |
| Unsafe Legacy Writer Count | `0` client-callable/unsafe writers; server-only primitives remain bounded |
| Unauthorized Client Write Count | `0` |
| Unauthorized Client Read Count | `0` |
| Legacy RLS Finding | `CLOSED` for repository/disposable-PostgreSQL gate |
| P0 | `0` |
| P1 | `0` |
| P2 | `0` code findings; remote production/advisor verification remains a rereview/deployment prerequisite |

Final Decision: `PASS_READY_FOR_INDEPENDENT_REREVIEW`.

Recommended Next Gate: `FINAL_REREVIEW_SECURIUM_LEGACY_CONCEPT_RLS_HARDENING`.

Commit: `NOT PERFORMED`.

Push: `NOT PERFORMED`.

PR: `NOT CREATED`.

Deployment: `NOT PERFORMED`.

Production DB: `NOT TOUCHED`; remote production state remains to be independently verified before deployment.
