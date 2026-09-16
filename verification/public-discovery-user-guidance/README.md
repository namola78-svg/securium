# Public discovery user guidance formatter

This verification covers a pure formatter that converts already-produced
public discovery search and selection results into short Korean guidance. It
does not call the search adapter, outline adapter, repository, database,
network, UI, API, or navigation layer.

## Result to message mapping

| Actual result state | Guidance category and message | Descriptor actions |
| --- | --- | --- |
| Search `EMPTY` | `SEARCH_EMPTY`: “조건에 맞는 과정을 찾지 못했어요.” | `EDIT_SEARCH` |
| Search `OK` with results | `SEARCH_RESULTS`: “검색 결과를 확인하고 원하는 과정을 선택해 주세요.” | none |
| Selection outline `OK` with subjects | `OUTLINE_READY`: “선택한 과정의 개요를 확인해 주세요.” | none |
| Selection outline `OK` with no subjects | `OUTLINE_EMPTY`: “선택한 과정의 개요가 비어 있어요.” | `BACK_TO_RESULTS` |
| Selection `NOT_FOUND` | `COURSE_UNAVAILABLE`: “선택한 과정을 현재 확인할 수 없어요.” | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| Selection `IDENTITY_MISMATCH` | `IDENTITY_MISMATCH`: “선택한 과정 정보를 다시 확인해 주세요.” | `BACK_TO_RESULTS` |
| Invalid search or selection input | `INPUT_ERROR` with bounded request wording | `EDIT_SEARCH` or `BACK_TO_RESULTS` |
| Repository/provider failure | `PROVIDER_ERROR`: “과정 정보를 불러오지 못했어요.” | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| Malformed public projection | `PROJECTION_ERROR`: “과정 정보를 확인할 수 없어요.” | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| Outline size limit | `OUTLINE_LIMIT_EXCEEDED`: “과정 개요를 표시할 수 없어요.” | `BACK_TO_RESULTS` |
| Unknown or malformed result | `UNKNOWN_RESULT`: “과정 정보를 확인할 수 없어요.” | `BACK_TO_RESULTS` |

`NOT_FOUND` does not identify whether a course was deleted, unpublished, or
otherwise unavailable. The formatter does not infer that cause.

Actions are inert descriptors for a future UI. The formatter does not execute
search, retry, refresh, navigation, or a replacement-course selection, and it
does not claim that corresponding buttons already exist.
`BACK_TO_RESULTS` and `REFRESH_RESULTS` require the future UI to provide the
relevant result/history context; this formatter assumes neither context exists.

The formatter validates the result envelope and the structural relationships it
uses before emitting success guidance. Contradictory pagination fields or
outline identity relationships are treated as `UNKNOWN_RESULT`; this is not a
replacement for adapter validation or provenance/authenticity verification.

The identity mismatch message exposes no other course ID, slug, title, URL, or
internal error. The formatter does not authenticate search-result provenance,
authorize access, or verify publication/currentness; those boundaries remain
external to this function.

This formatter is separate from any future public-source-disclosure formatter.
It describes the search/selection state only; it does not describe official
references, source rights, or source currentness.

## Focused command

```sh
node --import tsx --test tests/public-discovery-user-guidance.test.ts
npm run typecheck
npx eslint lib/services/public-discovery-user-guidance.ts tests/public-discovery-user-guidance.test.ts
git diff --check
```

No public UI/API connection is made here. Before UI wiring, the future UI must
verify button behavior, focus movement, keyboard access, accessible naming,
layout, and error announcement behavior. Those browser and accessibility
checks are outside this verification.
