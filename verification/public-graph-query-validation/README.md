# Public graph query input validation

This verification package covers only the runtime shape of the existing
`skill-graph-query` input. It does not activate `get_learning_graph`, create a
public caller, or decide anonymous publication policy.

## Fixed basis and duplicate-implementation check

The worktree was created from the fetched `origin/main` commit
`9198b56360b389243eeca6750779668f85d43b48`. No applicable `AGENTS.md` was
present in the repository or its parent directories.

The repository search found:

| Found item | Role | Reused or kept separate |
| --- | --- | --- |
| `lib/services/skill-graph-query.ts:364-399` | Existing internal query validation for typed `SkillGraphQueryInput`; checks query type, root type, identity fields, depth, cursor, and limit | Reused as the implementation reference, not called by the pure validator |
| `lib/services/skill-graph-query.ts:607-647` | Existing cursor decoding, version, fingerprint, and integrity checks | Kept with the service/provider boundary; not duplicated in this synchronous validator |
| `lib/services/skill-graph-query.ts:314-320` | Existing service callers for the seven graph query kinds | Used as the query-kind and root-family inventory |
| `db/skill-graph-query-repository.ts` | Resolver and provider traversal | Not called; existence, lifecycle, database, and traversal are out of scope |
| `lib/services/public-graph-response-validation.ts` | Final response shape, node/edge limits, response metadata, and response page validation | Not reused as request validation |
| `docs/architecture/public-learning-graph-contract.md:316-380` | Conditional public graph proposal and existing graph-service input evidence | Used for the evidence table below; unresolved public policy remains unresolved |

No existing `validatePublicGraphQuery` or equivalent public query-input
validator was found. The response validator is not a duplicate: it validates a
final response and must not be used to validate a request.

## Input-contract evidence table

The validator accepts the existing internal graph query shape, not an assumed
public HTTP/MCP schema. `get_concept`'s separate `publicId` proposal is not
silently applied to graph queries.

| Contract item | Observed implementation | Documented proposal | Alignment / classification used here |
| --- | --- | --- | --- |
| Supported query kinds | Seven fixed values in `SkillGraphQueryType`, service methods, and `validateInput` | Same seven values in the public graph table | **Confirmed by existing implementation**; all seven are accepted |
| Required/optional fields | `queryType` and `root` are required by the type and runtime path; `depth`, `limit`, and `cursor` are optional | JSON object plus allowlist; same query fields in the graph example | **Confirmed shape**, with a new strict unknown-field check |
| Field types | Query type is an enum; root/reference are objects; identity values are non-empty strings; depth/limit are numbers; cursor is a non-empty string | Exact identity, fixed depth, positive integer limit, and cursor rules | **Confirmed for the internal shape**; `null`, arrays, primitives, fractional, `NaN`, and `Infinity` are rejected |
| Target identity | Role: `id`, `roleKey`, `alias`; Skill: `id`, `skillKey`, `alias`; Concept: `id`, `key`, `stableKey`, `alias` | Same identity families are listed; public adapter may later prefer `publicId` | **Confirmed for existing service references**; graph `publicId` is not enabled because the service type/caller does not accept it |
| Identity format | Existing graph service checks string presence only; individual resolvers own lookup semantics | Exact identity, no fuzzy/arbitrary predicate; document discusses normalization at provider time | **Validator boundary**: type and non-blank presence only; no existence, alias ambiguity, format conversion, or normalization |
| Depth | Query-specific fixed depth: direct queries 1, `ROLE_GRAPH`/`CONCEPT_GRAPH` 2; omitted depth defaults to that value; values above 2 use `DEPTH_LIMIT_EXCEEDED` | Same fixed depth and maximum 2 | **Confirmed**, including default; explicit `null` is rejected as a type mismatch even though existing `??` code treats it as omitted |
| Limit | Omitted limit defaults to `SKILL_GRAPH_LIMITS.perHopDefault` (200); positive integer over `perHopHardMax` (500) fails | Same 200/500 convention, explicitly per-hop rather than total response size | **Confirmed request bound**; no response node/edge or search/outline cap is imported |
| Cursor | Existing service allows cursor only for `ROLE_SKILLS`, `SKILL_ROLES`, `SKILL_CONCEPTS`, and `CONCEPT_SKILLS`; encoded length is checked at 4096 and decoder checks base64url/protocol/integrity | Same direct-query restriction, 4096 encoded length, and binding requirements | **Split responsibility**: this validator checks query eligibility, non-blank base64url syntax, and encoded length; service/provider verifies decode, version, fingerprint, and integrity |
| Additional fields | Existing top-level `validateInput` does not reject arbitrary top-level fields; `assertReference` rejects unknown identity fields | JSON object and explicit allowlist; caller policy fields do not alter public scope | **Document/code mismatch**; this validator fails closed on unknown fields at query, root, and reference levels |
| Defaults and omission | Service materializes default depth and limit; cursor is omitted when absent | Same default/omission meaning is proposed | **Confirmed**; `undefined` is treated as omitted for runtime compatibility, while JSON `null` is not a default |
| Error result | Existing service throws internal `SkillGraphError` (`INVALID_QUERY`, `DEPTH_LIMIT_EXCEEDED`, `FAN_OUT_LIMIT_EXCEEDED`, etc.) | Public envelope and public status mapping are proposed, not wired | **Not a public error protocol**; the pure validator returns stable diagnostic code arrays and no raw input or partial query |

The response validator's total node/edge limits, response `depth` metadata, and
response `page`/cursor shape are response rules. They are not copied into this
request validator. Search/outline adapter limits are also unrelated and are not
applied to graph query input.

## Implemented validator scope

`validatePublicGraphQuery(input: unknown)` in
`lib/services/public-graph-query-validation.ts` is a synchronous pure
function. It has:

- runtime object checks and explicit allowlists for query, root, and identity;
- all seven existing query kinds and query/root compatibility;
- the existing target-specific identity field sets;
- fixed depth and per-hop limit defaults/bounds;
- direct-query-only cursor eligibility, existing base64url character syntax,
  and the documented encoded-length bound;
- fresh output objects with materialized defaults, no input mutation, stable
  error ordering, and no raw value in errors.

Success means only that the input structure is acceptable to the defined
boundary. It does not mean that a target exists, an alias is unambiguous, a
node or relation is public, a mapping is approved, a source/revision/as-of
value matches, or that provider traversal will honor cost, limit, or snapshot
semantics.

The result shape is:

```ts
{ ok: true, query: { queryType, root, depth, limit, cursor? } }
{ ok: false, errorCodes: ["..."] }
```

For example, this synthetic internal-service-shaped input succeeds and
materializes the documented defaults:

```json
{
  "queryType": "ROLE_GRAPH",
  "root": {
    "type": "ROLE",
    "reference": { "roleKey": "role:security:application-security" }
  }
}
```

```json
{
  "ok": true,
  "query": {
    "queryType": "ROLE_GRAPH",
    "root": {
      "type": "ROLE",
      "reference": { "roleKey": "role:security:application-security" }
    },
    "depth": 2,
    "limit": 200
  }
}
```

An input such as `{ "queryType": "ROLE_SKILLS", "root": ..., "userId":
"private-user-sentinel" }` returns only `{ "ok": false,
"errorCodes": ["UNKNOWN_FIELD"] }`. Unknown fields are rejected rather than
used to alter public scope. Failure never returns a partially validated query.

## Responsibility boundaries

The boundaries intentionally remain separate:

- Caller: supplies a query in the accepted structural shape. There is no
  public graph caller in this goal.
- Request validator: checks shape, allowlist, identity field type/presence,
  query/root pairing, fixed depth, per-hop limit, and cursor admission/size.
- Resolver/provider: checks identity existence, lifecycle, alias ambiguity,
  cursor protocol/fingerprint/integrity, database reads, public node/relation
  predicates, traversal direction, and actual enforcement of read limits.
- Publication/policy owner: decides anonymous publication/access, mapping
  approval, source/revision/as-of visibility, and public response fields.
- Response validator: checks the final response DTO and its response metadata;
  it does not validate the request that produced it.

Validator success therefore does not establish traversal correctness, private
intermediate-node protection, query cost, database query count, execution time,
or snapshot consistency. A checked `limit` is only an input bound; provider
enforcement remains a separate implementation concern.

## Unresolved contract items

These are recorded rather than guessed or hidden in skipped tests:

- graph public identity selection: `publicId` versus raw/opaque/stable key;
- whether anonymous graph input exposes aliases and whether exactly one
  identity is required;
- public publication/access and relation approval rules for Role, Skill,
  Concept, and typed relations;
- source/revision/as-of definition and snapshot ownership;
- depth-2 continuation/partial-result policy and public cursor ownership;
- response byte cap, rate/concurrency budget, and query-cost policy;
- Concept-to-resource mapping/publication contract;
- `get_concept` public implementation and graph public API/MCP registration.

No test is skipped for these items. They remain `UNRESOLVED` and outside the
implemented structural validator.

## Local verification

Focused test:

```text
node --import tsx --test tests/public-graph-query-validation.test.ts
```

The focused suite is an independent unit suite with manually authored expected
results. It covers minimal inputs for all seven queries, optional fields,
missing and wrong types, primitives/null/arrays, unknown fields, target-family
identity boundaries, fixed depth, limit boundaries, cursor size and query
eligibility, defaults, immutability, determinism, redaction, and absence of a
partial query on failure.

The validator is not connected to an API route, MCP registry, public tool, or
provider caller. The repository unit runner was not expanded; the focused
command above is the intended local runner for this change.
