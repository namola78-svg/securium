# Public discovery view-state reducer

This verification slice implements the state transition boundary described by
[`public-discovery-ux-contract.md`](../../docs/architecture/public-discovery-ux-contract.md).
The fixed implementation base for this work is `dfdf31bb9d1a2b0a955997210b0a1f0d2087e3e1`.
PR #198 (`b4f8789a4e342988fd54690456a3054bffc325be`) is an ancestor of that
base, so the referenced UX contract is present in the base. The reducer uses
the existing search adapter result and selection-service result types; it does
not change those services.

## State model

`PublicDiscoveryViewState` contains only the minimum view state:

| Area | Fields | Meaning |
| --- | --- | --- |
| Search | `conditions`, `status`, `activeRequestId`, `result`, `stale`, `error` | Current query/path, the active caller-issued request, and the last displayable adapter result. `OK` and `EMPTY` are separate statuses. |
| Selection | `courseId`, `courseSlug` | The selected public course identity, or `null`. This is a selection binding, not authorization or snapshot proof. |
| Outline | `status`, `activeRequestId`, `result`, `error` | The outline request/result for the current selection. An `OK` result with no subjects remains `SUCCESS`; service errors retain their actual discriminant. |

The reducer accepts these events:

| Event | Effect |
| --- | --- |
| `SEARCH_CONDITIONS_CHANGED` | Replaces conditions, clears results and selection, and invalidates all current requests. |
| `SEARCH_REQUEST_STARTED` | Starts a search and clears the selection. A retained result is marked `stale`. |
| `SEARCH_REFRESH_REQUESTED` | Explicitly starts the same search transition; it does not retry or navigate by itself. |
| `SEARCH_RESULT_RECEIVED` | Applies only when the request ID is active. Maps adapter `OK`/`EMPTY` to the corresponding view status. |
| `SEARCH_REQUEST_FAILED` | Applies only to the active ID. Keeps a retained result marked stale and stores a safe UI-owned failure classification. |
| `COURSE_SELECTED` | Replaces selection and resets the outline request/result. |
| `OUTLINE_REQUEST_STARTED` | Starts only when a selection exists. |
| `OUTLINE_RESULT_RECEIVED` | Applies only when both request ID and `(courseId, courseSlug)` match the current selection. |
| `OUTLINE_REQUEST_FAILED` | Applies only to the matching active outline request and selection. |
| `BACK_TO_RESULTS` / `COURSE_DESELECTED` | Clears selection and outline state while retaining search state. |

## Stale, duplicate, and identity handling

The caller issues a fresh, non-empty request ID for every search or outline
request and includes that ID in its start and completion events. The reducer
does not generate IDs, perform cancellation, retain unbounded request history,
or make a reused ID safe. A matching ID only means that the event corresponds
to the currently active request; it does not prove authorization, payload
authenticity, or database snapshot consistency.

When search request B supersedes A, B can complete and a later A completion is
ignored. The same applies to success and error events. A completion after the
active request has already completed is a no-op, so duplicate completion events
cannot overwrite a finished state. Changing conditions, starting a new search,
selecting another course, deselecting, or returning to results clears the
selection/outline state and invalidates the relevant old responses.

An explicit refresh keeps the previous search result while pending or after a
provider failure, but sets `stale: true` so the UI cannot present it as the new
request's result. A successful response replaces it. Changing conditions clears
the old result because it belongs to different search conditions. Pagination,
cache, and append-result policy are intentionally outside this reducer.

The reducer compares outline response identity with the current selection. A
successful outline whose course ID does not match is converted to the existing
redacted `SELECTION_ERROR/IDENTITY_MISMATCH` result. It never displays the
other course's outline. `NOT_FOUND`, `UNAVAILABLE` reasons, `INVALID_INPUT`,
and `IDENTITY_MISMATCH` remain distinct product result meanings. A normal empty
outline is a successful `OK` result with an empty `subjects` array.

## Trust boundary and caller responsibilities

This is an internal typed reducer, not a public endpoint and not a raw-payload
validator. TypeScript types do not validate runtime data. The reducer performs
small runtime checks for event envelopes, discriminants, request IDs, and the
selection identity needed for stale protection. It deliberately does not copy
the full search/outline projection validators.

The external caller remains responsible for:

- invoking the existing search adapter or selection service;
- validating raw provider payloads at the existing adapter boundary;
- mapping caught provider failures to `{ kind: "PROVIDER_ERROR" }` without
  reflecting raw messages, IDs, slugs, or queries;
- mapping malformed or unrecognized successful payloads to
  `{ kind: "UNKNOWN_RESULT" }`;
- issuing unique request IDs and ordering start/completion events;
- deciding when a request is actually started, cancelled, or retried;
- wiring inert guidance descriptors such as `EDIT_SEARCH`, `BACK_TO_RESULTS`,
  and `REFRESH_RESULTS` to UI event handlers.

No availability, login, enrollment, learning-access, source/disclosure, or
authorization policy is implemented here. Search exposure, outline metadata,
and learning access remain separate decisions.

## UI follow-up and known limits

React wiring, network execution, navigation, automatic retry, request
cancellation, focus movement/return, live-region announcements, keyboard
behavior, responsive layout, and browser accessibility checks remain to be
implemented and verified by the UI owner. In particular, the UI must decide how
to announce `PENDING` and `stale` without duplicate screen-reader output, bind
search input errors to their input, preserve heading/main reading order, and
return focus after the chosen screen transition. This reducer does not claim
that any of those behaviors are already present.

The focused tests replay event arrays synchronously to reproduce response races;
they do not execute asynchronous requests or establish cancellation, network,
database, public API, MCP, or snapshot guarantees.

## Local commands

From the worktree root:

```text
node --import tsx --test tests/public-discovery-view-state.test.ts
npm run typecheck
npx eslint lib/services/public-discovery-view-state.ts tests/public-discovery-view-state.test.ts
git diff --check
```

These commands are intentionally scoped. Full unit/build/E2E, database,
Docker, Wrangler, server, browser, live API, MCP, and LLM execution are not
part of this local implementation goal.
