# Public discovery offline evaluation

This evaluation exercises the real public course search and outline adapters
with a synthetic in-memory repository. It covers the user flow:

`public course search -> select a returned course -> fetch its outline`

Run it directly with:

```text
node --import tsx --test tests/public-discovery-offline-evaluation.test.ts
```

The fake repository is only a deterministic fixture. The test calls
`createPublicCourseSearchAdapter`, `createPublicCourseOutlineAdapter`, and the
internal `createPublicDiscoverySelectionService`; it does not manufacture
adapter responses. The evaluation-only selection helper rejects an empty
result or a course ID absent from the returned search page. That is a harness
check, not a product authorization feature.

The selection service is the connection boundary for the flow. It carries the
selected course ID and slug together, asks the outline adapter for the current
public result, and returns `SELECTION_ERROR / IDENTITY_MISMATCH` when the
returned public course ID differs. It does not establish authorization,
search-result authenticity, snapshot consistency, or revision identity. The
outline adapter's `NOT_FOUND` and `UNAVAILABLE` results pass through unchanged.

Scenarios:

- A: search-to-outline slug/ID binding, call order, sorting, fixture immutability
- B: empty search and invalid selection without an outline call
- C: deterministic unpublished, deleted, and missing state after search
- D: adapter slug rejection versus connection-layer ID mismatch rejection
- E: successful empty outline and the 50-subject / 200-topic response limits
- F: search provider error, outline provider error, and malformed projections
- G: search/outline output allowlists and internal/personal sentinel exclusion

The adapters expose no `source`, `revision`, or `asOf` fields; the evaluation
does not add them. Search provider errors currently propagate from the search
repository boundary, while outline repository errors are returned as the
adapter's `PUBLIC_REPOSITORY_ERROR`. The evaluation records those as observed
contracts and does not change the product modules.

This is not a real provider or database integration. It does not verify the
database public predicate, concurrent database snapshot consistency, query
cost, or provider behavior. It does not call an LLM, Agents API, MCP, route,
or public tool, and does not measure intent understanding, recommendation
quality, or learning effect. The instruction-like description is only a
string-processing and call-record fixture; no prompt-injection defense is
claimed.

The current public search/outline provider and query-cost blockers remain
outside this offline evaluation. Public tool activation is not enabled.
