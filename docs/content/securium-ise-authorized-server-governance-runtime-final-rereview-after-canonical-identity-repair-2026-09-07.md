# ISE authorized server governance runtime final rereview

- Final Status: `SECURIUM_ISE_AUTHORIZED_SERVER_GOVERNANCE_RUNTIME_FINAL_REREVIEW_PASS`
- Review Decision: `APPROVE_FAIL_CLOSED_ISE_AUTHORIZED_SERVER_GOVERNANCE_RUNTIME`
- Readiness: `ISE_GOVERNANCE_SERVER_RUNTIME_APPROVED_CLEAN_PUBLICATION_AND_DEPLOYMENT_PREPARATION_MAY_PROCEED`
- Snapshot Date: `2026-09-07`
- Worktree: `securium-content-information-security-engineer`
- Branch: `content/information-security-engineer-authoring`
- HEAD: `d54154d8c9b97738d85b748d4ab6bc298a7fb1c8`
- Fresh `origin/main`: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`
- Ahead/behind: `0/15`

## Independent evidence and scope

The repair report was independently verified at Markdown SHA-256 `A08DC464BF13403512E772C789F9E8CE5C4EEFF822629614FA9DE201263DDCAC` and machine SHA-256 `7A5665FE203DF4216248230E475BE32BC5372DB8CF861BFB448FC197481A3667`. The original failed review remains unchanged at Markdown SHA-256 `0784182D161A65C27AFC328224BB33E4B56C78E1024F0506DF24F1062970EF28` and machine SHA-256 `D3FEAFE50AE268975310249C0FA4B971FDAD6774A848A638E3F9426330A37A13`. The implementation baseline evidence remains `EC23842D8B1B473E459551A34A9377C2B9CEB2101B8B0FF5FA283BA3C347EEA0` and `7F9DA1946AF9CA9A713EA3BF3EA85FC157F4A3A6AFDCDC4031B39304BD6FF907`.

This rereview inspected the actual route, route handler, canonical identity reader/aggregator, reviewed-input resolver, governance runtime, and focused tests. It did not modify implementation, schema, migrations, content, CURRENTNESS, or governance records.

## Route and identity boundary

The only public surface is `GET/POST /api/admin/ise-wave-a/governance`. GET is readiness-only. POST accepts a strict discriminated union containing only `owner-attest` and `review-domain`; unknown actions, authority, activate, publish, and arbitrary Generic Review commands are rejected. The route uses `requireApiUser`, derives actor identity and roles from the server `AppUser`, keys rate limiting by the authenticated actor ID, requires same-origin for POST, and delegates writes only to `saveIseWaveAOwnerAttestation` and `recordAuthenticatedIseWaveAReviewJudgment`. No route-level authority, ACTIVE, publication, SQL, or generic command path exists.

For ISE, `resolveReviewedInputContextByResourceType` dispatches the server-owned `CONTENT_REVISION_REGISTRATION` adapter. The adapter reconstructs the persisted `registration_semantic_identity`, exact 2/2 subjects, revisions and hashes, source/provenance bindings, `course-ise` qualification, the five required domains, and server-derived high-trust reviewer context. Unknown resource types fail closed; there is no Secure Coding fallback. Secure Coding continues to resolve through its existing `CONTENT_REVISION` adapter.

## Eight-predicate canonical identity model

`readCanonicalDatabaseIdentity` and `aggregateCanonicalIdentity` enforce exactly eight mandatory predicates, and `CANONICAL_VERIFIED` is returned only when all eight are `PASS`:

1. Provider identity: Supabase provider plus non-unknown PostgreSQL database, schema, search path, and server user.
2. Migration/baseline identity: complete approved post-baseline migration chain or the exact approved fresh-baseline receipt.
3. Required schema: required tables and required columns for audit, content, source, Generic Review, and ISE registration state.
4. Generic Review tables: all required Generic Review relations.
5. ISE tables: all required registration relations.
6. RLS: every expected table-level RLS flag.
7. FORCE RLS: every expected table-level FORCE RLS flag, including the intentionally non-forced approved tables.
8. Trusted privileges: required server SELECT/approved governance INSERT capabilities and denied `anon`/`authenticated` table privileges.

FAIL, UNKNOWN, missing, unavailable, or query-error evidence returns `CANONICAL_NOT_VERIFIED`; database read errors return a safe preflight failure classification. A wrong database with matching relation names, or ISE-like rows without the approved baseline/migration and security predicates, is denied. The disposable PostgreSQL fixture proves matching tables alone do not pass. GET and both POST service paths perform fresh canonical verification; a prior readiness response is not a write token.

The privilege contract is the repository-approved trusted-server contract: required server reads and governance inserts, with client roles denied. The implementation does not claim an environment-specific secret or connection-string fingerprint and does not expose connection details. It also does not widen the approved route to arbitrary SQL or arbitrary database operations.

## Governance semantics and regressions

ISE required domains remain exactly `TECHNICAL`, `SAFETY_SECURITY_CONTENT`, `COPYRIGHT_RIGHTS`, `CURRENTNESS`, and `SUPPORT_QUALIFICATION`. CURRENTNESS availability remains distinct from a judgment and never auto-passes. Required reviewer count remains server-derived as `2`; same-reviewer replay is insufficient and self-review denial remains delegated to the existing policy path. Active-slot, advisory-lock, append-only, audit-atomic, and RLS boundaries remain in the lower-level services.

Direct route tests cover anonymous and ordinary-user denial, eligible route delegation, identity/role/resource spoof resistance, unknown action/domain, same-origin, actor-keyed rate limiting, safe error redaction, and unsupported methods. Canonical tests cover valid identity, approved baseline, complete chain, wrong baseline, migration failure/unknown, schema failure, RLS drift, FORCE RLS drift, privilege failure, provider mismatch, database failure, and disposable PostgreSQL wrong-DB behavior.

The approved Secure Coding fixture suite was run read-only in its owning worktree: `12/12 PASS`, preserving `CONTENT_REVISION → Secure Coding adapter` behavior. Shared Generic Review policy/authority/CURRENTNESS tests in this worktree passed `23/23`; ISE adapter/execution tests passed `26/26`. Web Pentest shared compatibility tests passed `14/14` in its owning worktree; no Web Pentest files were modified and no direct Web Pentest route fixture was claimed.

## Validation and causality

- Canonical identity fixtures: `13/13 PASS`.
- Direct route tests: `8/8 PASS`.
- Disposable PostgreSQL identity and ISE registration integration: `2/2 PASS`.
- Migration guard: `10/10 PASS`.
- PostgreSQL migration validation: `POSTGRES_MIGRATIONS_VALID files=28 tables=91 checksum=7a19c1eadb8cdbff`.
- Typecheck: PASS.
- Lint: PASS, zero errors, eight unchanged pre-existing warnings.
- `db:check`: PASS.
- `git diff --check`: PASS.
- New skip/only/TODO bypasses in the reviewed scope: `0/0/0`.

The default Turbopack build still fails on the unrelated long report asset path. Webpack still fails on pre-existing CSS Module purity errors in untouched `components/v2` files. Neither failure involves the repaired route, canonical identity helper, or tests, so build causality is `PRE_EXISTING_NON_CAUSAL`, not an implementation regression.

No real owner attestations, review judgments, authority, ACTIVE transition, or publication occurred. Production DB use, deployment, commit, push, and PR are all `NO`. Repair-scope schema, migration, historical migration, content, and CURRENTNESS mutations are `0`. Security Critical/High and Data Trust Critical/High are `0/0` for this rereview scope.

## Decision and remaining gate

The runtime is sufficiently fail-closed for the bounded authenticated owner-attestation and review-domain operations, subject to the separate clean publication/deployment process. This rereview does not deploy or perform governance writes.

Primary Next Gate: `PREPARE_SECURIUM_ISE_GOVERNANCE_RUNTIME_CLEAN_PUBLICATION_WORKTREE`
