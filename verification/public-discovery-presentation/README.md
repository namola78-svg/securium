# Public discovery presentation

## Scope

`composePublicDiscoveryPresentation()` is a pure internal composer for already-produced public discovery results. The fixed base is `origin/main` at
`b652f90b37f4c508fde9bc8160b2cf0b35088cdd`.

The composer reuses the existing `PublicCourseSearchResult`,
`PublicDiscoverySelectionResult`, `formatPublicDiscoveryUserGuidance()`, and
`formatPublicSourceDisclosure()` contracts. It does not copy the offline
evaluation harness's selection helper. The reusable failure rule implemented
here is: every non-success selection result exposes guidance only; `outline`
and `disclosure` are both `null`, and disclosure formatting is not called.

## Input and output contract

The input is a discriminated union with one independent envelope at a time:

- `SEARCH_RESULT` accepts the existing public search result DTO.
- `SEARCH_ERROR` accepts the caller's unknown provider/transport error value.
- `SELECTION_RESULT` accepts the existing selection result union and an optional
  caller-provided `sourceProjection`.

The output is an explicit allowlist:

```text
{
  kind: "SEARCH_RESULT" | "SEARCH_ERROR" | "SELECTION_RESULT" | "UNKNOWN",
  search: PublicCourseSearchResult | null,
  outline: successful PublicCourseOutlineResult | null,
  guidance: PublicDiscoveryUserGuidance,
  disclosure: PublicSourceDisclosure | null,
}
```

Search and outline values are rebuilt from their existing public fields. Raw
provider errors, internal metadata, private fields, and arbitrary input fields
are not spread into the output. Normal public IDs, slugs, titles, descriptions,
and outline fields remain available.

## Result composition

- A valid search `OK` or `EMPTY` result is returned as `search`; its existing
  status is preserved and guidance is produced by the guidance formatter.
- A search provider error has no search DTO and receives the formatter's
  `PROVIDER_ERROR`/other bounded error guidance.
- A successful selection returns the public outline, including an empty
  `subjects` array. It always calls the disclosure formatter, including when
  `sourceProjection` is absent or partial, so the formatter's generic missing
  notice and independent-explanation rules remain in force.
- `NOT_FOUND`, `IDENTITY_MISMATCH`, `UNAVAILABLE`, selection input failures,
  provider/projection failures, and outline-limit failures return no outline or
  disclosure. The existing guidance category is preserved without inventing a
  new service error code.

Action descriptors in guidance are data only; this function does not execute
actions.

## Source projection trust boundary

The caller supplies the optional projection for the currently selected target.
The caller remains responsible for canonical source binding, target matching,
public policy and authorization, allowed free text, source rights, and
currentness/publication decisions. The composer and disclosure formatter do not
verify those claims, and no binding token or approval protocol is created here.

## Reducer and caller responsibilities

- The view-state reducer owns request ordering, selection changes, and ignoring
  stale responses.
- The presentation function composes the current result values supplied by its
  caller and has no previous-state input or storage.
- UI/caller code owns request execution, latest-result selection, action
  handling, and source-projection preparation.

The A-success → failure → B-success test checks call independence only; it is
not a stale-response or reducer test.

## Malformed input

Null, arrays, primitives, unsupported envelopes, missing required result/error
fields, invalid direct structures, contradictory successful results, and
unsupported formatter shapes fail closed to the existing `UNKNOWN_RESULT`
guidance. No malformed value is promoted to display success. The function
performs no I/O, database/file/network access, time or randomness reads,
environment reads, or mutation of caller input.

## Verification

Focused test:

```text
node --import tsx --test tests/public-discovery-presentation.test.ts
```

Additional checks:

```text
npm run typecheck
npx eslint lib/services/public-discovery-presentation.ts tests/public-discovery-presentation.test.ts
git diff --check
git diff --cached --check
```

The tests cover normal/empty/error search, successful and empty outlines,
selection failures, identity mismatch redaction, provider/projection/limit
failures, absent/partial/malformed projections, malformed envelopes,
determinism, input immutability, and sentinel non-disclosure. They do not
connect UI, routes, APIs, MCP, source resolvers, databases, browsers, servers,
LLMs, or live providers. Reducer stale-response behavior and snapshot
consistency remain unverified.
