# ISE governance runtime canonical DB identity and route security repair

- Final Status: `SECURIUM_ISE_GOVERNANCE_RUNTIME_CANONICAL_DB_IDENTITY_AND_SECURITY_TEST_REPAIR_PASS_READY_FOR_REREVIEW`
- Repair Decision: `REQUIRE_FULL_FAIL_CLOSED_CANONICAL_DB_IDENTITY_AND_ROUTE_SECURITY_COVERAGE`
- Snapshot Date: `2026-09-07`
- Worktree: `securium-content-information-security-engineer`
- Branch: `content/information-security-engineer-authoring`
- HEAD: `d54154d8c9b97738d85b748d4ab6bc298a7fb1c8`

## Evidence and scope

The failed final-review evidence was independently verified: Markdown SHA-256 `0784182D161A65C27AFC328224BB33E4B56C78E1024F0506DF24F1062970EF28`; machine SHA-256 `D3FEAFE50AE268975310249C0FA4B971FDAD6774A848A638E3F9426330A37A13`. The prior implementation evidence remains unchanged: `EC23842D8B1B473E459551A34A9377C2B9CEB2101B8B0FF5FA283BA3C347EEA0` and `7F9DA1946AF9CA9A713EA3BF3EA85FC157F4A3A6AFDCDC4031B39304BD6FF907`.

The repair is limited to the server runtime identity gate, extraction of the existing bounded route handler for direct HTTP testing, and focused tests. The public route remains `GET/POST /api/admin/ise-wave-a/governance`; POST accepts only `owner-attest` and `review-domain`. No authority, ACTIVE, publication, arbitrary SQL, or generic command operation was added.

## Canonical identity repair

`lib/services/canonical-database-identity.ts` provides `readCanonicalDatabaseIdentity` and the all-pass `aggregateCanonicalIdentity` contract. Canonical verification requires every predicate to be `PASS`:

1. Supabase provider and non-unknown PostgreSQL identity (`current_database`, `public` schema, search path, server user).
2. The complete approved post-baseline migration chain or the exact approved fresh-baseline receipt.
3. Required tables and required columns for audit, content, source, Generic Review, and ISE registration state.
4. Generic Review table presence.
5. ISE registration table presence.
6. Expected table-level RLS state.
7. Expected table-level FORCE RLS state.
8. Trusted server SELECT/required INSERT privileges plus denied `anon`/`authenticated` table access.

The approved baseline receipt is checked byte-for-byte by its stored digest fields. A wrong database with matching names, a partial/unknown migration state, missing columns, RLS/FORCE RLS drift, privilege drift, failed queries, or unknown values cannot produce `CANONICAL_VERIFIED`. GET readiness and both POST operations call the same fresh canonical runtime gate; readiness is not a write token.

The readiness response now reports `SERVER_POSTGRES_CANONICAL_VERIFIED`, and CURRENTNESS availability remains separate from a CURRENTNESS judgment or PASS.

## Security and regression coverage

- Canonical identity fixtures: `13/13` pass, including valid canonical state, approved baseline-only state, complete migration-chain state, wrong baseline plus partial migrations, schema/RLS/FORCE RLS/privilege drift, provider mismatch, database-read failure, and disposable PostgreSQL matching-tables-only rejection.
- Direct route tests: `8/8` pass, covering bounded GET, anonymous/ordinary denial, only two allowed POST actions, identity/resource spoof rejection, unknown action/domain, same-origin and actor-keyed rate limiting, safe error redaction, and unsupported methods.
- ISE adapter/runtime and Generic policy/authority regression selected for this worktree: `31/31` pass; ISE adapter/generic execution subset: `26/26` pass.
- Approved Secure Coding shared Generic Review fixture suite was run read-only in its owning worktree: `12/12` pass. The ISE worktree intentionally does not copy that fixture. This resolves the prior material cross-domain evidence gap without changing Secure Coding content or source authority.
- Disposable PostgreSQL identity and registration validation: `2/2` pass. The Generic judgment disposable test in ISE remains fixture-dependent and was not counted as a local pass; its approved Secure Coding equivalent passed in the owning worktree.
- PostgreSQL migration guard: `10/10` pass. PostgreSQL migration validation: `POSTGRES_MIGRATIONS_VALID files=28 tables=91`.
- Typecheck: PASS. Lint: PASS with eight pre-existing warnings and zero errors. `db:check`: PASS. `git diff --check`: PASS. New `.skip/.only/TODO` in the repaired files: `0/0/0`.

## Build and mutation boundaries

`npm run build` remains blocked by the pre-existing Turbopack filesystem path-length panic for an unrelated long report asset. `npx next build --webpack` remains blocked by pre-existing CSS Module purity errors in `components/v2/*.module.css`; no repaired route, identity helper, or test file is a CSS Module and neither failure is caused by this repair. Build causality is therefore `PRE_EXISTING_NON_CAUSAL`.

Schema change: `0`. Migration change: `0`. Historical migration mutation: `0`. ISE content mutation: `0`. CURRENTNESS mutation: `0`. Owner-attestation writes: `0`. Review writes: `0`. Authority: `0`. ACTIVE: `0`. Publication: `NO`. Production DB and deployment: `NO`. Security Critical/High: `0/0`. Data Trust Critical/High: `0/0` for the repaired scope.

No other worktree was modified, and no commit, push, or PR was created. Existing unrelated dirty state was preserved.

## Primary next gate

`REREVIEW_SECURIUM_ISE_AUTHORIZED_SERVER_GOVERNANCE_RUNTIME_AFTER_CANONICAL_IDENTITY_REPAIR`
