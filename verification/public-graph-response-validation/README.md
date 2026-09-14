# Public graph response validation

This directory contains a test-only, offline validation boundary for the
`public-learning-graph.v1` response candidate described in
`docs/architecture/public-learning-graph-contract.md`.

## What is validated

`validatePublicGraphResponse` is a pure runtime validator. It does not use a
database, network, file, environment variable, clock, global mutable state, or
the existing graph provider. It does not mutate or return a partial graph.

The runtime allowlist is deliberately narrow:

- response: `schemaVersion`, `status`, `data`, `page`
- graph data: `schemaVersion`, `queryType`, `depth`, `root`, `nodes`, `edges`, `page`
- node: `type`, `publicId`, `key`, `label`, `aliases`
- edge: `type`, `source`, `target`
- reference: `type`, `publicId`
- page: `limit`, `hasMore`, `nextCursor`

The validator checks the documented canonical relation directions:

- `ROLE_REQUIRES_SKILL`: `ROLE -> SKILL`
- `SKILL_REQUIRES_CONCEPT`: `SKILL -> CONCEPT`

It also checks query/root compatibility, public ID syntax and size, malformed
entries, duplicate node identity, duplicate logical edge identity, dangling
references, root-reachable topology within the query depth, total node/edge
hard limits, and the documented depth/page shape. The graph payload always
contains `page`: non-paged queries use `null`, while paged queries use the
bounded page object. Cycles and self-loops are not rejected as a blanket graph
rule; a self-loop fails only when it violates a relation's documented endpoint
types.

## What this does not prove

The `PUBLIC`/`PRIVATE` labels in `fixtures.ts` are synthetic source-fixture
labels only. They are not interpretations of `ACTIVE`, `canonical`, `reviewed`,
`published`, or any existing internal state.

The pure validator cannot infer a hidden source node or a private relation from
an otherwise well-formed response. The tests therefore keep a manually authored
expected public projection separate from the source fixture and use that
projection as an independent disclosure oracle. This catches private node,
private edge, and hidden-intermediate bypass leakage without claiming that the
response-only validator can discover source omissions on its own.

`description`, `source`, `revision`, `asOf`, edge IDs, relation versions,
provenance, reviewer data, operational fields, personal evidence/mastery/
progress, answers, and resource mappings are not approved by this validator.
They are rejected as unknown fields where they appear in the response. Whether
any candidate field becomes public remains an unresolved publication policy.

Free text is only checked for presence/type. This validator does not perform PII
detection, sanitization, prompt-injection detection, or content safety review.

## Limit scope

The response validator applies these documented final-response limits:

- depth: query-specific depth 1 or 2, never above 2
- total nodes: 1000
- total edges: 2000
- page limit: positive integer up to the existing 500 per-hop hard maximum
- cursor: at most 4096 UTF-8 bytes when a page is present

Per-hop query enforcement, provider read cost, database query count, latency,
rate/concurrency budgets, and response byte size are not provable from a final
response alone. They remain outside this focused validator:

- `QUERY_LIMIT_VALIDATION: OUT_OF_SCOPE`
- `QUERY_COST_VALIDATION: OUT_OF_SCOPE`
- `RESPONSE_BYTES: NOT_SPECIFIED`

No smaller product limit is invented here, and no response is truncated to fit a
byte cap.

## Policy and implementation status

This work validates a synthetic response contract only. It does not implement a
public graph provider, publication/access policy, source/revision resolver,
HTTP/API/MCP route, registry entry, authorization decision, or live evaluation.

The absence of a provider and the unresolved source/publication mapping remain
visible follow-up conditions rather than being filled with synthetic dates,
hashes, source URLs, or approval claims.
