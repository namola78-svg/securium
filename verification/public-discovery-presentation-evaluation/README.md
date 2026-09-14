# Public discovery presentation offline evaluation

This is a DB-less, network-free composition harness. Its generation base is
`c850db8e8cb18542993b3005c42200525cfcb6e2`. That is not the reviewed
`origin/main` ref for this review; the reviewed main SHA and final branch HEAD
are recorded in the review report. The harness calls the actual implementations
present in the checkout, not copies of these functions:

- `createPublicCourseSearchAdapter` from
  `lib/services/public-course-search-adapter.ts`
- `createPublicCourseOutlineAdapter` from
  `lib/services/public-course-outline-adapter.ts`
- `createPublicDiscoverySelectionService` from
  `lib/services/public-discovery-selection.ts`
- `formatPublicDiscoveryUserGuidance` from
  `lib/services/public-discovery-user-guidance.ts`
- `formatPublicSourceDisclosure` from
  `lib/services/public-source-disclosure.ts`

The repository in `fixtures.ts` is an in-memory deterministic dependency
fixture. It supplies two synthetic public courses, A and B, with different
IDs and the same slug, normal and empty curriculum, explicit missing and
partial source projections, provider failures, and internal/personal/error
sentinels. It records calls and supports explicit course/curriculum state
changes for the post-search `NOT_FOUND` and sequential-evaluation cases.
It has no database, network, file, clock, or shared mutable product state.
Course/source relationships in this fixture are test-supplied assumptions, not
canonical bindings or public approval evidence.

## What is new versus existing coverage

The existing public discovery offline evaluation covers the individual search
and outline adapters plus the selection ID binding. The existing guidance and
disclosure tests cover their input branches and output allowlists. This
evaluation adds the composition boundary: it calls the real functions in
sequence and checks that the proposed user-visible result does not combine a
failure with an old success, another course, or an unrelated source.

The presentation object is deliberately local to the test. It is a proposed
harness composition rule, not a production presentation service. Search output
forms the selection input; a selection presentation contains only a current
successful outline and a source projection explicitly supplied for that same
success. The helper does not resolve the source or verify a course/source
binding. A `SELECTION_ERROR`, `NOT_FOUND`, provider error, or formatter
rejection produces no outline and no selection disclosure; the disclosure
formatter is not called for those failure results. This harness-side removal
does not claim that the product already performs that wiring.

## Ownership of the assertions

- Actual search, outline, and selection functions guarantee their observed
  result contracts: `EMPTY` versus thrown search-provider error, successful
  empty outline, `NOT_FOUND`/provider states, and `IDENTITY_MISMATCH` when the
  current outline ID differs from the selected ID.
- The actual guidance formatter guarantees the bounded category/action mapping
  and does not reflect raw errors or mismatch payloads. The actual disclosure
  formatter guarantees its output allowlist, generic missing notice, and
  syntactic HTTPS URL filtering; it does not validate rights or currentness.
- Harness-only rules are the sequential composition, discarding outline/source
  on non-displayable selection results, removing prior presentation data after a
  failure, and passing a manually selected source projection only for the
  current successful outline. These are proposed executable acceptance criteria,
  not product presentation guarantees.
- Synthetic-only checks cover fixture immutability, call order, synthetic
  sentinels, and explicit A/B state changes. They do not establish database
  predicates, resolver binding, authorization, or source approval.
- The current scope does not verify UI/resolver wiring, asynchronous request
  cancellation or reordering, snapshot consistency, slug reuse, user/browser
  state, free-text PII detection, source rights, or source currentness.

## Scenarios and manual oracle

- A: actual search -> returned-course selection -> outline -> guidance ->
  disclosure; course ID/slug agree, public fields remain bounded, and fixture
  data is unchanged.
- B: actual `EMPTY` search becomes `SEARCH_EMPTY` with `EDIT_SEARCH`; there is
  no outline call and no newly presented outline or source.
- C: the same slug resolves to another ID; the actual selection service returns
  `SELECTION_ERROR / IDENTITY_MISMATCH`, and the proposed final presentation
  contains no other-course title, ID, subject, topic, or source disclosure.
- D: after a successful A result, an explicit repository mutation produces
  actual `NOT_FOUND`; the guidance does not guess deleted, unpublished, or
  authorization causes and the old A outline/source is not reused.
- E: search and outline repository failures stay provider errors. The harness
  does not turn them into empty search, retry, or choose another course, and
  raw exception text is not displayed.
- F: an empty curriculum remains `OK` and becomes `OUTLINE_EMPTY`; content
  availability is not inferred from the source projection.
- G: absent and partial source projections remain disclosure-only changes;
  they do not change successful outline guidance or invent official approval,
  review completion, or currentness.
- H: A -> failure -> B, followed by a repeated B evaluation, has independent
  output and deterministic results. Calls do not mutate fixture data.
- The malformed-input case verifies that a formatter-rejected outline is not
  forwarded by the harness composition rule.

The expected categories, action descriptors, absence of fields, and state
independence are hand-written assertions. They are not generated by calling
the implementation under test. Action values are compared with the current
allowlist: `EDIT_SEARCH`, `BACK_TO_RESULTS`, and `REFRESH_RESULTS`; no action
is executed.

Source projections are explicitly selected synthetic inputs. The formatter is
tested as a display boundary only. There is no source resolver, registry,
public authorization decision, source-rights/currentness check, availability
proof, snapshot/revision check, or UI/CTA/browser validation. A formatted
official reference is not evidence that the course is authorized, enrolled,
learnable, or current. Free-text PII detection is not assumed; assertions
cover only allowlist behavior using synthetic sentinels. HTTPS checks are URL
shape checks, not URL fetches or rights/currentness checks.

## Run

Focused evaluation:

```text
node --import tsx --test tests/public-discovery-presentation-evaluation.test.ts
```

Repository checks for this change:

```text
npm run typecheck
npx eslint tests/public-discovery-presentation-evaluation.test.ts verification/public-discovery-presentation-evaluation/fixtures.ts
git diff --check
```

The test is registered exactly once in the existing `package.json`
`test:unit` command. Product presentation wiring, source-resolver integration,
public tool activation, database execution, live API evaluation, browser UX
validation, snapshot consistency, and operational recovery remain
unimplemented or out of scope.

Observed follow-up scope is limited to a future product composition contract
that would define how a real UI/API supplies current-result identity and a
resolved source projection. This change adds no production service, resolver,
registry, persistence, retry, recovery, or authorization behavior.
