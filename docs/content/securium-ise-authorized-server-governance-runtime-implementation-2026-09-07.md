# SECURIUM — ISE Authorized Server Governance Runtime Implementation

## Decision

Final Status: `SECURIUM_ISE_AUTHORIZED_SERVER_GOVERNANCE_RUNTIME_IMPLEMENTATION_PASS_READY_FOR_REVIEW`

Implementation Decision: `IMPLEMENT_BOUNDED_AUTHENTICATED_ISE_GOVERNANCE_SERVER_ENTRY_POINT`

Readiness: `ISE_GOVERNANCE_SERVER_RUNTIME_IMPLEMENTED_INDEPENDENT_REVIEW_AND_DEPLOYMENT_REQUIRED`

Primary Next Gate: `REVIEW_SECURIUM_ISE_AUTHORIZED_SERVER_GOVERNANCE_RUNTIME_IMPLEMENTATION`

Snapshot: 2026-09-07

## Worktree and approval evidence

- Worktree: `securium-content-information-security-engineer`
- Branch: `content/information-security-engineer-authoring`
- HEAD: `d54154d8c9b97738d85b748d4ab6bc298a7fb1c8`
- Fresh `origin/main`: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`
- Ahead/behind: `0/15`
- Previous blocker Markdown SHA: `6810277A4B55E83997E07DD6EEBD2AAEB490195C3241AF73D91D09647CC39F95` — verified
- Previous blocker machine SHA: `D58BE7B102CF34B6A3C028B18B9E86F3C9DC3191E38DCB9E9A1D1382F7BE825D` — verified
- Governance authorization Markdown SHA: `2E19E876D33688067FEC24C4038BEF8C2883DD60AFF339AD855AC6FBF8FD8012` — verified
- Governance authorization machine SHA: `20A96BE6FDF994746F7D1DC029DC6B55A3AF503354EA255DCB484B50D23546F3` — verified

No authorization policy was redesigned. No upstream CURRENTNESS evidence was regenerated or modified.

## Runtime architecture

The implementation reuses the existing Securium server architecture:

- Existing Supabase Auth / `requireApiUser()` server authentication.
- Existing `getDatabaseProvider()` server-only database provider.
- Existing ISE adapter `buildIseWaveAGovernanceContext()`.
- Existing `saveIseWaveAOwnerAttestation()` owner repository boundary.
- Existing `recordAuthenticatedIseWaveAReviewJudgment()` judgment boundary.
- Existing `assertSameOrigin()`, `errorResponse()`, `readRequestInput()`, and rate-limit helpers.

Added files:

- `lib/services/ise-wave-a-governance-runtime.ts`
- `app/api/admin/ise-wave-a/governance/route.ts`
- `tests/ise-wave-a-governance-runtime.test.ts`

The route is intentionally bounded. `GET` is read-only readiness. `POST` accepts only the discriminated actions `owner-attest` and `review-domain`. There is no authority, ACTIVE, publication, arbitrary SQL, arbitrary resource, or generic command action.

## Server-owned contract

The route never accepts resource type, resource ID, package, subject list, revision, hash, source, provenance, qualification, owner ID, reviewer ID, required domains, or reviewer count as authority. The ISE service reconstructs:

- resource type: `CONTENT_REVISION_REGISTRATION`;
- resource ID: persisted `registration_semantic_identity`;
- exact Wave A subject set: `2/2`;
- qualification: `course-ise`;
- required domains: `TECHNICAL`, `SAFETY_SECURITY_CONTENT`, `COPYRIGHT_RIGHTS`, `CURRENTNESS`, `SUPPORT_QUALIFICATION`;
- current registration/revision/hash/source/provenance state;
- currentness availability, without deriving a CURRENTNESS PASS.

The optional `expectedReviewedInputIdentity` is accepted only as a stale-client assertion by the existing judgment service. It is never used as canonical authority.

## Authentication and authorization

Actor identity comes from `requireApiUser()` and server-side role resolution. Request-body user IDs, roles, owner IDs, reviewer IDs, and adapter selections are not accepted. Governance roles are server-checked as `CONTENT_REVIEWER`, `ADMIN`, or `SUPER_ADMIN`; the existing reviewer-separation policy remains responsible for author/owner/editor and privileged self-review denial.

POST actions require existing same-origin protection and the existing bounded in-memory rate-limit helper. Runtime/database/auth/policy/source/registration failures return the existing redacted public error envelope; raw exceptions, SQL, cookies, tokens, database URLs, service-role keys, and unnecessary PII are not returned.

## Canonical runtime verification

Before ISE readiness or either action, the service requires:

1. provider kind `supabase`;
2. successful server-side health check;
3. the approved governance/ISE migration baseline, including `0023`, `0024`, `0025`, `0026`, `0028`, and `0029` in `app_schema_migrations`;
4. required canonical registration, revision, source, owner, judgment, and policy tables via PostgreSQL `to_regclass` checks.

Missing or wrong provider, unhealthy database, incomplete migration baseline, or incomplete schema fails closed without exposing configuration values.

## Governance boundaries

- CURRENTNESS available: capability only.
- CURRENTNESS auto-pass: `NONE`.
- Authority entry point: not exposed.
- ACTIVE entry point: not exposed.
- Publication entry point: not exposed.
- Real owner attestation writes during this gate: `0`.
- Real review judgment writes during this gate: `0`.
- Authority writes: `0`.
- ACTIVE: `0`.
- Publication: `NO`.
- Schema/migration/content/CURRENTNESS mutation: `0`.

The owner action delegates only to `saveIseWaveAOwnerAttestation`. The review action delegates only to `recordAuthenticatedIseWaveAReviewJudgment`. Both existing services reconstruct fresh state and preserve exact-state, active-slot, advisory-lock, audit, append-only, RLS, and FORCE RLS behavior.

## Validation

Passed:

- `npm run typecheck` — PASS.
- Focused governance/adapter/CURRENTNESS tests — `27/27 PASS`.
- ISE registration disposable PostgreSQL integration — `1/1 PASS`.
- PostgreSQL migration guard — `10/10 PASS`.
- PostgreSQL migration validation — `POSTGRES_MIGRATIONS_VALID files=28 tables=91`.
- `npm run db:check` — PASS.
- Full lint — `0 errors`, `8 existing warnings`.
- `git diff --check` — PASS.

Validation boundaries recorded, not falsely promoted to PASS:

- Default `npm run build` hit a pre-existing Turbopack filesystem path-length panic while copying an existing long report asset.
- `npx next build --webpack` reached pre-existing CSS Module purity errors in untouched `components/v2/*.module.css` files.
- Direct Generic judgment tests and disposable judgment PostgreSQL test could not load the Secure Coding fixture `content-drafts/secure-coding/curriculum-v1-manifest.json`, which is intentionally not copied into this ISE worktree. ISE-specific adapter, execution, separation, CURRENTNESS, registration, and runtime-contract coverage passed.

These validation gaps are outside the new runtime files and require separate repository/build-fixture ownership review; they were not repaired here.

## Safety results

- Production DB: `NO`.
- Production deployment: `NO`.
- Vercel account restriction: not evaluated; no deployment attempted.
- Secrets read or exposed: `NONE`.
- Cross-worktree writes: `0`.
- Security Critical/High: `0/0` for this implementation scope.
- Data Trust Critical/High: `0/0` for this implementation scope.
- Commit/push/PR: `NO/NO/NO`.

Next gate: independently review the new route/service and resolve deployment/build-fixture prerequisites before exposing it in an authorized runtime. Real owner/reviewer interaction remains separately gated.
