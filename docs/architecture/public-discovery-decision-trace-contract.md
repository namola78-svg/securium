# 공개 과정 탐색 결정 근거 기록 계약

상태: 설계 전용. 이 문서는 공개 과정 탐색에서 관찰 가능한 결과와 향후
결정 근거 trace가 기록할 최소 구조를 구분한다. 실제 로그 수집·저장·LLM·
Neo4j·GraphRAG·공개 route/API 연결은 구현하지 않는다.

기준 base는 `b4f8789a4e342988fd54690456a3054bffc325be`이다. 이 문서에서
`[관찰]`은 기준 main의 코드·문서·테스트 harness에서 확인한 사실,
`[제안]`은 후속 기록 계층이 채택할 수 있는 설계, `[합성]`은 테스트가 만든
fixture 연결 또는 문서 예시를 뜻한다. `[제안]`의 필드와 값은 현재 실행에서
수집된 값이 아니다.

## 1. 목적과 비목적

### 1.1 목적

최소 trace는 다음 질문에 답하기 위한 내부 기록이다.

- 검색·선택·개요·안내 중 어느 단계가 실행되었고 어떤 결과를 반환했는가?
- 결과와 사용자 안내가 어떤 제한된 상태 매핑에서 나왔는가?
- 같은 요청에 속한 단계들을 어떻게 연결할 수 있는가?
- 오류와 오프라인 평가를 조사할 때 원래 제품 결과와 기록 실패를 어떻게 분리할 것인가?
- 향후 추천 또는 Context Graph 방향의 판단을 기록하더라도 검증 가능한 입력, 도구 결과, 적용 규칙, 결과만 어떻게 남길 것인가?

기록은 결과의 근거를 제한된 형태로 설명하는 관찰 자료다. 결과를 다시
계산하거나 canonical 사실을 대체하는 판정 저장소가 아니다.

### 1.2 비목적

다음은 이 계약의 목적이 아니다.

- 사용자 행동 전체, raw query, raw cursor, 모든 화면 이벤트를 수집하는 것
- 모델의 내부 사고 과정, chain-of-thought, 프롬프트 원문을 저장하는 것
- 공개 권한·source 공식성·권리·최신성을 증명하는 것
- 학습 성취, 추천 효과, 개인화 품질을 증명하는 것
- canonical 원본, source/revision registry, 공개 정책을 대체하는 것
- 과거 판단을 자동 재실행하거나 현재 추천으로 승격하는 것
- 개인 Learner Twin, 개인 Evidence graph, Neo4j 또는 GraphRAG를 도입하는 것

현재 search·selection·outline·guidance primitive는 입력과 결과를
결정적으로 처리한다. 이를 AI 추론, 개인화 추천, 의도 이해, 학습 판단으로
표현하지 않는다. 향후 모델이 별도 단계에 참여하더라도 trace는 모델의
내부 사고가 아니라 검증 가능한 입력 분류·도구 결과·적용 규칙·결과·안전한
설명 요약만 기록한다.

## 2. 현재 구현과 관찰 가능한 사실

### 2.1 공개 search adapter

근거: [`public-course-search-adapter.ts`](../../lib/services/public-course-search-adapter.ts#L12-L21),
[`검색 입력과 오류`](../../lib/services/public-course-search-adapter.ts#L110-L141),
[`호출 경계`](../../lib/services/public-course-search-adapter.ts#L546-L596).

| 항목 | [관찰] 기준 main에서 확인되는 사실 | [관찰] trace로 이미 수집되는가? | 해석 경계 |
| --- | --- | --- | --- |
| 입력 | `unknown` 입력은 기본 `{}`로 바뀔 수 있고 허용 key는 `query`, `path`, `limit`, `cursor`뿐이다. query는 NFKC·trim·`toLocaleLowerCase("ko-KR")` 후 UTF-8 48 byte를 검사한다. limit 기본값은 8, 최대 12이고 path는 `all`·`certification`·`professional`이다. | 아니오. 함수 반환에 입력 검증 결과를 별도 field로 넣지 않는다. | 정규화된 query를 기록한다고 raw query를 안전하게 보존하는 것은 아니다. |
| 버전 | 결과에는 `contractVersion: "public-course-search.v1"`가 있다. cursor는 `public-course-search.cursor.v1`, 정렬은 `group-display-order.course-display-order.id.v1` 상수로 관리된다. | 결과의 search contract version과 cursor 생성 시 적용된 내부 규칙은 함수 안에 존재한다. 별도 trace record는 없다. | 이 값은 search/cursor/order 계약 version이지 공개 정책 version이나 snapshot version이 아니다. |
| 호출 순서 | 입력 정규화 → query fingerprint 계산 → cursor decode(있을 때) → repository에 `limit + 1` bounded query → source row 검증 → page projection/cursor 생성 순서다. | 호출 순서를 제품 로그로 수집하지 않는다. | 아래 offline test의 call list는 test fixture가 만든 관찰이고 제품 trace가 아니다. |
| 반환 | 정상 결과는 `status: "OK"` 또는 `"EMPTY"`, `results`, `page.limit`, `page.hasNext`, `page.nextCursor`를 가진다. `OK`는 page에 하나 이상, `EMPTY`는 결과·next cursor가 없다. | 반환 object는 존재한다. operation ID·timestamp·policy version은 없다. | `OK`는 공개 권한, 학습 가능, 최신성, 전체 결과 완전성을 증명하지 않는다. |
| 오류 | 입력/커서는 `PublicCourseSearchError`의 `INVALID_INPUT`, `INVALID_CURSOR`가 될 수 있다. provider exception은 이 adapter에서 public error code로 catch하지 않고 그대로 전파된다. source row 위반은 `INVALID_SOURCE`다. | 예외 code는 호출자가 관찰할 수 있으나 trace로 저장되지 않는다. | provider throw에 현재 제품의 표준 status/code가 있다고 만들지 않는다. |
| 선택 대상 | `PublicCourseSummary`에는 `id`, `slug`, 이름·설명·분류용 display 값과 선택적인 `updatedAt`, subject/topic count가 있다. | 결과에 course ID/slug가 있을 수 있다. trace correlation ID나 source/revision/asOf는 없다. | ID·slug의 반환은 공개 탐색 결과의 allowlist이지 source 공식성이나 권한 증명이 아니다. |
| source 근거 | search 결과에는 `source`, `revision`, `asOf`가 없다. | 미수집. | `updatedAt`을 source/revision/asOf로 바꾸지 않는다. |

adapter는 자체 DB·route·API·registry가 없고 server-owned repository를 주입받는
unregistered internal adapter다. 기준 main에는 이 interface를 구현하는 public
search DB provider나 discovery route call site가 없다.

### 2.2 공개 outline adapter

근거: [`public-course-outline-adapter.ts`](../../lib/services/public-course-outline-adapter.ts#L42-L65),
[`outline 실행 경계`](../../lib/services/public-course-outline-adapter.ts#L83-L138),
[`정규화와 상한`](../../lib/services/public-course-outline-adapter.ts#L197-L303).

| 항목 | [관찰] 기준 main에서 확인되는 사실 | [관찰] trace로 이미 수집되는가? | 해석 경계 |
| --- | --- | --- | --- |
| 입력 검증 | 입력은 `{ courseSlug }`이고 slug는 빈 문자열·trim 불일치·slash/backslash·control char·query/fragment·128자 초과를 거부한다. | 아니오. 실패 시 `{ status: "INVALID_INPUT" }`만 반환한다. | 오류 원인 상세나 raw slug를 외부 안내에 넣지 않는다. |
| 조회 순서 | 먼저 `getPublicCourseBySlug(slug)`를 호출하고, 유효한 course가 나온 경우에만 `listCurriculum(course.id)`를 호출한다. repository throw는 `UNAVAILABLE/PUBLIC_REPOSITORY_ERROR`다. | 호출 관계를 제품 trace로 수집하지 않는다. | 두 read가 하나의 DB snapshot이나 transaction이라고 말할 수 없다. |
| course 결과 | null 또는 inactive/unpublished/deleted course는 `NOT_FOUND`; shape·identity·publication projection이 malformed면 `UNAVAILABLE/INVALID_PUBLIC_PROJECTION`이다. | result status는 caller가 받는다. | `NOT_FOUND` 원인을 삭제·비공개·권한 부족으로 추정하지 않는다. |
| curriculum 결과 | inactive/unpublished/deleted child는 숨기고, course/subject/topic 관계 불일치·중복은 `UNAVAILABLE/PUBLIC_RELATION_MISMATCH`, malformed 값은 `UNAVAILABLE/INVALID_PUBLIC_PROJECTION`이다. | 별도 trace 없음. | 숨겨진 row의 존재·개수·ID는 외부에 공개하지 않는다. |
| 상한 | subject 50개 초과 또는 topic 200개 초과는 `UNAVAILABLE/OUTLINE_LIMIT_EXCEEDED`이며 부분 결과를 성공으로 줄이지 않는다. | 반환 reason만 존재한다. | 숫자는 현재 adapter 상한이지 공개 학습 가능성이나 전체 curriculum 완전성 증명이 아니다. |
| 정상/빈 outline | 정상은 `status: "OK"`와 course·subjects를 반환하고, `subjects: []`도 `OK`다. | 결과 object는 존재한다. timestamp·policy/source/revision/asOf는 없다. | 빈 outline을 학습 불가·콘텐츠 부재·provider 장애로 단정하지 않는다. |

`getPublicCourseOutline()` helper는 repository 모듈을 읽지만, 현재 `/courses`
상세 route의 generic `getPublicCourseBySlug()` + `listCurriculum()` 경로와
동일한 runtime orchestration이라고 할 수 없다. strict outline provider가
존재한다는 사실도 현재 route 연결·공개 정책 승인·snapshot을 뜻하지 않는다.

### 2.3 discovery selection service

근거: [`public-discovery-selection.ts`](../../lib/services/public-discovery-selection.ts#L5-L50).

| 항목 | [관찰] 기준 main에서 확인되는 사실 | trace 경계 |
| --- | --- | --- |
| 입력 | exact key `{ courseId, courseSlug }`만 허용한다. `courseId`는 trim 후 비어 있지 않아야 하고 slug는 trim 일치해야 한다. 실패는 `SELECTION_ERROR/INVALID_INPUT`이다. | 현재 search result에 그 ID가 실제 포함되었는지 제품 service가 검사하지 않는다. |
| 호출 | 유효한 입력이면 `outlineAdapter({ courseSlug })` 하나를 호출한다. outline의 non-OK result는 그대로 통과한다. | search 호출, 선택 event, UI handler를 이 service가 기록하지 않는다. |
| identity 비교 | outline이 `OK`인 경우 `outline.course.id !== input.courseId`면 `SELECTION_ERROR/IDENTITY_MISMATCH`; 같으면 outline을 반환한다. | 이것은 ID binding check다. authorization, search authenticity, snapshot/revision 증명이 아니다. |
| 현재 version/source | selection 전용 version, operation ID, timestamp, source/revision/asOf가 없다. | trace에는 미래의 stage/result reference로만 제안한다. |

### 2.4 user guidance formatter

근거: [`guidance 타입`](../../lib/services/public-discovery-user-guidance.ts#L20-L57),
[`guidance entry point`](../../lib/services/public-discovery-user-guidance.ts#L426-L452),
기존 [`user-guidance 평가 설명`](../../verification/public-discovery-user-guidance/README.md).

`formatPublicDiscoveryUserGuidance()`는 이미 만들어진 search 또는 selection
결과를 받아 `{ category, title, message, actions }`를 반환하는 pure formatter다.
search adapter·outline adapter·repository·DB·network·UI를 호출하지 않는다.

| 입력 사실 [관찰] | 현재 category | actions | 설명의 한계 |
| --- | --- | --- | --- |
| search `EMPTY` | `SEARCH_EMPTY` | `EDIT_SEARCH` | 조건에 맞는 결과를 찾지 못했다는 의미만 말한다. |
| search `OK` | `SEARCH_RESULTS` | 없음 | 결과를 확인하고 선택하라는 정적 안내다. |
| search error `INVALID_INPUT`/`INVALID_CURSOR` | `INPUT_ERROR` | `EDIT_SEARCH` | cursor 자체나 내부 오류를 외부에 말하지 않는다. |
| search error `INVALID_SOURCE` | `PROJECTION_ERROR` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` | repository row 위반의 상세는 숨긴다. |
| 그 밖의 search throw/unknown error | `PROVIDER_ERROR` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` | 현재 search adapter가 이 상태를 직접 반환하는 것은 아니며 caller가 `SEARCH_ERROR`로 전달할 때의 formatter mapping이다. |
| outline `OK`, subjects 있음 | `OUTLINE_READY` | 없음 | 개요가 반환됐다는 뜻이지 학습 권한·효과가 아니다. |
| outline `OK`, subjects 없음 | `OUTLINE_EMPTY` | `BACK_TO_RESULTS` | 빈 개요를 장애나 학습 불가로 확대하지 않는다. |
| outline/selection `NOT_FOUND` | `COURSE_UNAVAILABLE` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` | 삭제·미게시·권한 부족 원인을 추정하지 않는다. |
| selection `IDENTITY_MISMATCH` | `IDENTITY_MISMATCH` | `BACK_TO_RESULTS` | 다른 course ID·slug·title을 설명에 넣지 않는다. |
| outline `INVALID_INPUT` 또는 selection `INVALID_INPUT` | `INPUT_ERROR` | 입력에 따라 `EDIT_SEARCH` 또는 `BACK_TO_RESULTS` | 제품 결과와 안내 category를 구분한다. |
| outline `UNAVAILABLE/PUBLIC_REPOSITORY_ERROR` | `PROVIDER_ERROR` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` | exception·SQL·row를 표시하지 않는다. |
| outline `UNAVAILABLE/OUTLINE_LIMIT_EXCEEDED` | `OUTLINE_LIMIT_EXCEEDED` | `BACK_TO_RESULTS` | 일부만 성공 outline으로 가장하지 않는다. |
| outline `UNAVAILABLE/PUBLIC_RELATION_MISMATCH` 또는 `INVALID_PUBLIC_PROJECTION` | `PROJECTION_ERROR` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` | 내부 relation/shape를 설명하지 않는다. |
| malformed/unknown result | `UNKNOWN_RESULT` | `BACK_TO_RESULTS` | unknown을 성공·NOT_FOUND·provider error로 임의 승격하지 않는다. |

actions는 현재 UI handler, retry, navigation의 실행이 아니라 inert descriptor다.
guidance formatter에는 search/selection orchestration, operation ID, timestamp,
policy version, source/revision/asOf가 없다.

### 2.5 source disclosure formatter

근거: [`public-source-projection-contract.md`](./public-source-projection-contract.md),
[`public-source-disclosure.ts`](../../lib/services/public-source-disclosure.ts#L1-L113).

`formatPublicSourceDisclosure()`는 별도의 pure display formatter다. discovery
search·selection·outline·guidance에 연결된 call site는 기준 main에서 확인되지
않는다. marker가 없거나 projection input이 malformed이면
`officialReference: null`, `independentExplanation: null`,
`notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE`를 반환한다. 이 함수에는
discovery status/code가 없다.

유효한 source projection이 전달됐다는 사실도 공식 승인·권리·최신성·SSRF
안전을 증명하지 않는다. source/revision/asOf를 discovery trace에 채우려면
후속 server-owned canonical read와 별도 public policy가 실제로 제공해야 한다.

### 2.6 제품 orchestration과 평가 harness의 구분

현재 main의 app/components/db에서 네 primitive를 함께 호출하는 public discovery
route·UI handler·API·MCP registry call site는 확인되지 않았다. 현재 `/courses`
목록과 상세는 별도의 repository/page 경로를 사용하며, 이를 search adapter와
selection service의 실행 기록으로 대체하지 않는다. 관련 UX 경계는
[`public-discovery-ux-contract.md`](./public-discovery-ux-contract.md), 공개
group predicate는 [`public-course-group-policy-contract.md`](./public-course-group-policy-contract.md),
search 정합성은 [`public-course-search-comparison-contract.md`](./public-course-search-comparison-contract.md)에
있다. 이 문서는 그 문서의 내용을 복제하지 않고 기록 경계만 참조한다.

offline 평가 [`public-discovery-offline-evaluation.test.ts`](../../tests/public-discovery-offline-evaluation.test.ts#L28-L58)는
실제 search adapter·outline adapter·selection service에 합성 in-memory
repository를 주입한다. test-only `selectCourseFromSearch()`가 빈 결과 또는
search page에 없는 ID를 거부하고, fixture가 `search`, `course`, `curriculum`
호출을 기록한다. 정상 합성 연결에서 관찰되는 call order는
`search → course → curriculum`이다.

그러나 이 연결은 제품 orchestration이 아니다.

- 합성 repository와 fixture state mutation이 만든 연결이다.
- 실제 DB, public endpoint, route, MCP, caller authorization, search result authenticity를 검증하지 않는다.
- 별도 조회가 동일 snapshot이라는 보장이 없고, source/revision/asOf를 추가하지 않는다.
- search provider 오류는 현재 exception으로 전파되고, outline provider 오류는 `UNAVAILABLE/PUBLIC_REPOSITORY_ERROR`로 매핑된다는 사실을 fixture가 구분한다.
- guidance 평가는 이미 만들어진 결과를 formatter에 넣을 뿐 adapter 호출 순서를 만들지 않는다.

이 목표에서는 test/build/DB/Docker/server/browser/API/LLM을 실행하지 않았다. 위
내용은 정적 코드·문서·기존 평가 harness의 읽기 결과다.

## 3. 기록 목적과 최소 trace 구조

### 3.1 trace의 의미

`trace`는 한 요청 또는 한 평가 실행에서 기록 계층이 관찰한 stage 결과의
연결이다. 향후 stage edge를 Context Graph 형태로 표현할 수 있지만, edge가
있다는 사실은 인과성·동일 snapshot·동일 권한·동일 사용자라는 증명이 아니다.

제안하는 최소 stage 흐름은 다음과 같다.

```text
SEARCH
  -> SELECTION
  -> OUTLINE
  -> GUIDANCE

DISCLOSURE는 현재 흐름에 연결되지 않은 별도 선택적 branch다.
SOURCE/REVISION 참조는 canonical read와 public policy가 실제로 반환할 때만 연결한다.
```

현재 이 orchestration은 존재하지 않는다. 따라서 기준 main의 실행에 대해
하나의 trace, 하나의 operation ID, 네 stage의 timestamp를 이미 수집한다고
말하지 않는다.

### 3.2 제안 envelope

다음은 TypeScript module이나 DB schema가 아니라 후속 설계용 합성 shape다.
`<...>` 값은 현재 실행에서 생성되지 않으며, `traceContractVersion`은 승인 전
실제 version이 없다.

```json
{
  "traceId": "<synthetic-only-trace-id>",
  "requestCorrelationId": "<not-currently-collected>",
  "traceContractVersion": "<not-assigned>",
  "stages": [
    {
      "stageExecutionId": "<synthetic-search-stage>",
      "stage": "SEARCH",
      "predecessorStageExecutionIds": [],
      "executionState": "COMPLETED",
      "resultState": "RECEIVED",
      "recordingState": "RECORDED",
      "contractRefs": [
        { "component": "search", "value": "public-course-search.v1", "observed": true },
        { "component": "cursor", "value": "public-course-search.cursor.v1", "observed": true },
        { "component": "order", "value": "group-display-order.course-display-order.id.v1", "observed": true },
        { "component": "policy", "value": null, "observed": false }
      ],
      "inputValidation": { "state": "PASSED", "productCode": null },
      "result": { "status": "OK", "resultCount": "<bounded-count>" },
      "explanation": { "category": "SEARCH_RESULTS", "actions": [] }
    }
  ]
}
```

위 `SEARCH_RESULTS`와 count는 합성 예시다. 현재 search result의 `OK`와
guidance category는 관찰된 product contract지만, trace envelope 자체는
구현되지 않았다. `resultCount`를 저장하더라도 page count와 전체 과정 수를
혼동하지 않는다.

### 3.3 실행·결과·기록 상태

세 상태는 한 field로 합치지 않는다.

| 제안 field | 제안 값 | 의미 |
| --- | --- | --- |
| `executionState` | `NOT_STARTED`, `STARTED`, `COMPLETED`, `UNKNOWN`, `ABORTED_EXTERNAL_CONDITION`, `HARNESS_SYNTHETIC` | stage가 호출되었는지에 대한 기록 계층의 실행 관찰. `UNKNOWN`은 실행 여부를 확인할 관찰이 없는 상태이며, 기록 부재를 `NOT_STARTED`로 축소하지 않는다. `HARNESS_SYNTHETIC`은 제품 실행과 분리한다. |
| `resultState` | `NOT_AVAILABLE`, `RECEIVED`, `UNKNOWN` | 결과를 받았는지. timeout·connection loss로 실행 시도 후 결과가 없으면 `UNKNOWN`이지 `NOT_STARTED`가 아니다. |
| `recordingState` | `NOT_ATTEMPTED`, `RECORDED`, `FAILED`, `UNKNOWN` | 결과와 별도로 trace write가 성공했는지. `FAILED`가 primary result를 바꾸지 않는다. |

기록 시각이 있더라도 시각의 선후는 관찰된 ordering hint일 뿐 인과관계의
증명이 아니다. `predecessorStageExecutionIds`는 기록 계층이 선언한 연결이고,
실제 caller의 data dependency나 같은 snapshot을 보장하지 않는다.

### 3.4 단계 연결과 중복

후속 orchestration이 연결을 만들 때만 다음을 요구한다.

- `stageExecutionId`는 한 stage 시도에 새로 부여되는 내부 식별자여야 한다.
- `predecessorStageExecutionIds`는 실제 전달된 결과 또는 명시적인 caller 관계만 가리킨다. 단순히 시간이 빠르다는 이유로 연결하지 않는다.
- retry/중복 수집을 지원하려면 `attemptKey`와 범위가 정해진 `dedupeKey`를 별도 정책으로 정의한다. 현재 자동 retry, idempotency, dedupe는 도입하지 않는다.
- 한 stage의 결과가 늦게 도착하거나 기록 순서가 뒤집혀도 기존 결과를 덮어쓰지 않고 stage attempt를 분리한다.
- 검색과 outline이 서로 다른 read라면 `snapshotId`를 만들지 않는다. 동일 transaction/read snapshot을 실제로 제공하는 계층이 없으면 snapshot은 `NOT_AVAILABLE`이다.

`traceId`, `requestCorrelationId`, `stageExecutionId`, `attemptKey`는 단계 연결
수단일 뿐이다. 어느 것도 identity, authentication, authorization, durability,
causality, canonical authority의 독립 증명이 아니다.

## 4. 최소 trace field 계약

아래는 후속 기록 계층의 최소 후보이다. `현재 존재 여부`는 기준 main에 실제
수집 코드가 있는지에 대한 판정이며, `[제안]` field를 현재 기능으로 승격하지
않는다.

| field | 목적 | 값의 생산 주체 | 현재 존재 여부 | 신뢰 수준과 누락/실패 의미 | 필수/선택/미수집 | 내부/외부 | 보존·삭제 고려 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `traceId` | 요청 또는 평가 실행의 stage 묶음 | [제안] server-owned trace layer | 미수집 | 연결 ID일 뿐 identity·causality 증명이 아님. 없으면 trace 연결 불가이지 동작 미실행 증명이 아님 | trace record에는 필수 후보; 현재 미수집 | 내부 전용 | cross-request linkability와 삭제 전파를 정책으로 정한다. |
| `requestCorrelationId` | transport/request 경계와 trace 연결 | [제안] trusted server boundary | 미수집 | caller가 보낸 값이면 신뢰하지 않으며, trace ID와 동일시하지 않음 | 선택 후보; 미수집 | 내부 전용 | header·로그·trace 간 연계 범위와 접근권한을 정한다. |
| `stageExecutionId` / `stage` | stage별 실행과 중복 분리 | [제안] orchestration | 미수집 | stage ID가 없다고 실행되지 않았다고 단정하지 않음 | stage record에 필수 후보; 미수집 | 내부 전용 | retry/duplicate를 분리할 retention과 삭제를 정한다. |
| `predecessorStageExecutionIds` | 의도된 단계 연결 | [제안] orchestration | 미수집 | 연결 선언이지 시간순서·인과·snapshot 증명이 아님 | 선택 후보; 미수집 | 내부 전용 | 삭제된 선행 record를 가리킬 때 redaction/garbage policy가 필요하다. |
| `executionState`, `resultState`, `recordingState` | 실행, 결과 수신, trace write를 구분 | [제안] stage runner와 trace writer | 미수집 | `UNKNOWN`은 결과 불명을 보존하며 `NOT_STARTED`로 축소하지 않음. `recordingState=FAILED`는 primary result와 별개 | stage record에 필수 후보; 미수집 | 내부 전용 | 실패 사유는 최소화하고 raw exception fallback을 금지한다. |
| `contractRefs` | 실제 적용된 함수 계약과 규칙 연결 | 각 component owner | search contract/cursor/order만 현재 결과·상수로 존재; trace field는 미수집 | search의 세 version은 관찰 가능. selection/outline/guidance/policy version을 만들지 않음 | 적용된 값만 선택; 없는 값은 미관찰 | 내부 전용, 외부에는 원칙적으로 미표시 | version 변경 시 old record 해석과 삭제/보존 정책을 정한다. |
| `inputValidation` | 입력이 어느 경계에서 통과/거부됐는지 제한적으로 기록 | 해당 adapter | 결과 code는 현재 존재, trace summary는 미수집 | raw input 대신 `PASSED`와 현재 product code만 남김. query hash도 익명화 보장이 아님 | 선택 후보; 미수집 | 내부 전용 | raw query/cursor를 기본 저장하지 않고 hash도 linkability 검토 후 결정한다. |
| `lookupStatus` / `resultStatus` | provider/adapter 결과를 설명 | adapter 또는 caller | search·outline·selection result shape는 현재 존재, trace는 미수집 | `OK`, `EMPTY`, `NOT_FOUND`, `UNAVAILABLE`, `SELECTION_ERROR` 등 실제 상태만 사용. provider throw는 현재 search status가 아님 | stage에 있으면 필수 후보; 미수집 | 내부 전용; 외부는 별도 copy | raw row/SQL/error를 보존하지 않고 reason taxonomy를 별도 승인한다. |
| `identityBinding` | 선택 ID와 현재 outline course ID 비교 결과 연결 | selection service | 비교와 `IDENTITY_MISMATCH` code는 현재 존재, trace field는 미수집 | `MATCH`는 두 값이 비교상 같다는 뜻만, authorization·snapshot·revision은 아님. `UNKNOWN`은 비교 불가 | selection에 선택 후보; 미수집 | 내부 전용; 외부는 mismatch category만 | raw IDs의 보존·삭제·교차 trace 연결을 별도 결정한다. |
| `finalResult` / `reasonCode` | 최종 관찰 상태와 내부 분류 연결 | stage/caller trace owner | product status/code와 guidance category는 존재, 공통 trace reasonCode는 미수집 | reason code가 authoritative 상태이고 사용자 문구는 설명 projection이다. 없는 code를 구현된 것처럼 추가하지 않음 | 결과 stage에 필수 후보; 미수집 | reason은 내부, 안전한 category만 외부 후보 | policy/version 변경 시 과거 reason의 해석을 보존할지 정한다. |
| `safeExplanationSummary` | 어떤 제한된 안내 category/action이 사용됐는지 조사 | guidance formatter 또는 caller | `{category,title,message,actions}` 출력은 현재 존재; trace summary는 미수집 | raw message를 parse해 상태를 복원하지 않는다. category와 실제 result를 함께 보존해야 함 | 선택 후보; 미수집 | 외부 projection은 별도 생성; trace는 내부 | 사용자 copy의 보존·삭제와 trace 보존을 분리한다. |
| `sourceRef`, `revisionRef`, `asOf` | source/revision 근거를 연결 | [제안] canonical source/revision/policy layer | 현재 search/outline/selection/guidance에 없음. source disclosure도 discovery에 연결되지 않음 | canonical read가 정확한 target relation과 policy를 반환할 때만 기록. `updatedAt`, hash, validator success로 대체하지 않음 | 모두 선택 후보; 현재 미수집 | 내부 전용; 외부 disclosure는 별도 승인 | 철회·삭제·접근 제한된 근거를 과거 trace에서 재노출하지 않도록 삭제 전파가 필요하다. |
| `occurredAt` / `recordedAt` | 관찰 시각과 trace 저장 시각 구분 | [제안] trusted clock/trace writer | 미수집 | 시각은 ordering hint이며 인과·동일 snapshot을 보장하지 않음 | 선택 후보; 미수집 | 내부 전용 | clock skew, timezone, 보존 기간을 정책으로 정한다. 숫자 기간은 이 문서에서 정하지 않는다. |
| `entityRefs` | course 등 stage 대상 연결 | [제안] server-owned allowlisted reference | search/outline 결과에는 course ID/slug가 있으나 trace field는 미수집 | raw internal ID는 필요할 때만 좁은 내부 접근으로 저장. hash도 연결 가능한 식별자일 수 있음 | 선택 후보; 기본 미수집 | 내부 전용 | 개인·source ID와 cross-context linkability, 삭제 전파를 검토한다. |
| `errorSummary` | 장애 조사의 최소 분류 | [제안] adapter/trace boundary | outline reason은 현재 존재; raw exception/stack은 trace에 없음 | exception·SQL·row·credential·운영 메모 전체를 저장하지 않음. 불명은 `UNKNOWN`으로 보존 | 선택 후보; 미수집 | 내부 전용 | 민감 payload fallback 로그를 금지하고 접근/보존 정책을 정한다. |

`required`는 후속 trace schema가 승인될 때의 요구이고 현재 함수 호출의
요구가 아니다. 현재 코드가 반환하는 값을 future trace가 읽을 수 있다는
것과 현재 trace가 실제로 저장된다는 것은 별개의 주장이다.

### 4.1 version과 policy 경계

현재 관찰 가능한 version은 다음 세 종류뿐이다.

- `public-course-search.v1`: search result contract
- `public-course-search.cursor.v1`: cursor payload contract
- `group-display-order.course-display-order.id.v1`: search ordering contract

이들은 search adapter가 실제로 정의한 계약 version이다. policy version,
authority decision version, source revision, as-of time, operation ID가 아니다.
outline·selection·guidance에는 기준 main에서 대응하는 runtime version 상수가
없다. trace 계층이 나중에 전역 `traceContractVersion` 또는 policy reference를
도입할 수 있지만, 승인 전에는 `<not-assigned>`로만 문서화하고 실행에 사용된
값처럼 기록하지 않는다.

## 5. 단계 연결과 불완전 기록

### 5.1 제안된 연결

후속 server-owned orchestration이 생기면 다음처럼 연결할 수 있다.

1. `SEARCH`가 normalized input 검증 후 `OK` 또는 `EMPTY`, 또는 현재 search error code/exception을 관찰한다.
2. caller가 결과에서 course ID/slug를 선택하고 `SELECTION`에 전달한다. 현재 selection service 자체는 search page membership를 검사하지 않으며, test-only helper의 membership 검사는 제품 계약이 아니다.
3. `SELECTION`은 slug로 `OUTLINE`을 조회하고 outline course ID와 선택 ID를 비교한다.
4. `OUTLINE` 결과를 받은 뒤 `GUIDANCE`가 실제 status/code를 bounded category/action으로 변환한다.
5. source disclosure가 명시적으로 호출되는 경우에만 별도 stage로 기록한다. 현재 discovery 흐름에는 연결하지 않는다.

이 순서는 제안된 data dependency다. 기준 main에는 이를 수행하는 하나의
orchestrator, operation ID, stage timestamp가 없다. offline test가 기록한
`search → course → curriculum` 순서와 test-only `selectCourseFromSearch()`는
`HARNESS_SYNTHETIC` stage로 분류해야 한다.

### 5.2 불완전 기록 상태

향후 trace는 다음을 구분해야 한다.

| 상황 | 기록 | 금지할 결론 |
| --- | --- | --- |
| 함수가 호출되지 않음 | `executionState=NOT_STARTED`, 결과 없음 | trace record가 없다는 이유로 제품 동작이 실행되지 않았다고 과거 전체에 단정하지 않음 |
| 호출 시작 후 응답 소실 | `executionState=STARTED`, `resultState=UNKNOWN` | `NOT_FOUND`, `EMPTY`, provider error 중 하나로 추정하지 않음 |
| 실행 여부 미확인 | `executionState=UNKNOWN`, `resultState=UNKNOWN` | 기록이 없다는 이유로 호출되지 않았거나 특정 결과를 반환했다고 추정하지 않음 |
| 결과를 받음 | `resultState=RECEIVED`, 실제 product status/code 보존 | timestamp만으로 선행 stage의 원인이라고 단정하지 않음 |
| 결과는 받았지만 trace write 실패 | primary result는 보존하고 `recordingState=FAILED` | 성공을 실패로, 실패를 성공으로 바꾸지 않음 |
| 외부 조건으로 중단 | `executionState=ABORTED_EXTERNAL_CONDITION` | 사용자가 취소했는지 provider 장애인지 추정하지 않음 |
| 평가 harness가 만든 연결 | `executionState=HARNESS_SYNTHETIC` | 합성 repository·call list를 production orchestration으로 승격하지 않음 |
| stage trace 자체가 없음 | 기록 부재 | 함수가 실행되지 않았다는 증명으로 취급하지 않음 |
| 일부 stage만 기록된 부분 기록 | 확인된 stage의 상태만 보존하고 누락 stage는 미관찰로 남김 | 누락 stage를 `NOT_STARTED`로 채우거나 전체 trace가 완전하다고 주장하지 않음 |

`NOT_FOUND`, `EMPTY`, `UNAVAILABLE`, `UNKNOWN`은 제품 결과의 의미이고,
`UNKNOWN` execution/result state는 기록 계층이 결과를 알 수 없다는 의미다.
같은 단어를 두 층에서 섞지 않는다.

### 5.3 retry와 중복

현재 automatic retry는 없다. 후속 retry를 도입하려면 다음 결정이 먼저다.

- 동일한 logical request인지, 새로운 attempt인지 구분하는 server-owned key
- stage별 idempotency와 trace write의 중복 허용 범위
- 늦은 결과가 최신 결과를 덮어쓸 수 있는지 여부
- 원래 primary result와 재시도 result를 어떻게 함께 보존할지

`attemptKey`는 한 stage 실행 시도에 귀속되고 재시도마다 새 값이어야 한다.
`dedupeKey`는 명시된 producer·attempt·scope 안에서 동일 write 전달을 식별하는
수단으로만 사용한다. key 충돌이 서로 다른 시도나 결과를 합치게 해서는 안 되며,
namespace·scope·보존 기간은 후속 정책으로 정한다. trace writer의 idempotency는
중복 write의 처리 방식만 정의할 뿐 실제 실행, 인과성, exactly-once 수집을
증명하지 않는다.

trace 설계만으로 retry를 도입하지 않으며, `REFRESH_RESULTS` action도 현재
formatter가 실행하는 retry가 아니라 inert UI descriptor다.

## 6. 결과와 설명 근거의 합성 예시

다음 표의 예시는 실제 실행 log가 아니라 `[합성]` trace proposal이다. 각
제품 상태와 code/category는 기준 main의 실제 계약에 대응시키고, 현재 없는
trace field는 `<synthetic>` 또는 `NOT_OBSERVED`로 표시한다.

| 예시 | 관찰된 실제 상태/code | [제안] stage 기록 | guidance/disclosure | 설명하지 않는 것 |
| --- | --- | --- | --- | --- |
| 정상 검색과 동일 과정 선택 | search `OK`; outline `OK`; `outline.course.id === selected.courseId` | SEARCH `RECEIVED/OK` → SELECTION `RECEIVED`; binding `MATCH` → OUTLINE `OK` | `SEARCH_RESULTS` 후 `OUTLINE_READY`; actions는 각각 현재 formatter 계약대로 | 검색 결과가 공식 추천, 권한, 동일 snapshot이라는 주장 |
| 검색 결과 없음 | search `EMPTY`, results empty, no next cursor | SEARCH `RECEIVED/EMPTY`; selection/outline은 `NOT_STARTED` | `SEARCH_EMPTY`, `EDIT_SEARCH` | 과정이 존재하지 않거나 삭제됐다는 추정 |
| 검색 입력 오류 | `PublicCourseSearchError.code=INVALID_INPUT` 또는 `INVALID_CURSOR` | SEARCH `RECEIVED/ERROR_CODE`; raw query/cursor는 기록하지 않음 | `INPUT_ERROR`, search context의 `EDIT_SEARCH` | cursor 상세, 사용자 의도, provider 장애 |
| outline provider 오류 | outline `UNAVAILABLE`, reason `PUBLIC_REPOSITORY_ERROR` | OUTLINE `RECEIVED/UNAVAILABLE/PUBLIC_REPOSITORY_ERROR` | `PROVIDER_ERROR`, `BACK_TO_RESULTS`, `REFRESH_RESULTS` | SQL·stack·row·삭제/권한 원인 |
| 선택 뒤 현재 outline NOT_FOUND | outline/selection result `NOT_FOUND`가 selection에서 pass-through | SELECTION `RECEIVED/NOT_FOUND` → OUTLINE terminal | `COURSE_UNAVAILABLE`, `BACK_TO_RESULTS`, `REFRESH_RESULTS` | 삭제·비공개·권한 부족 중 하나라는 원인 |
| ID 불일치 | `SELECTION_ERROR/IDENTITY_MISMATCH` | binding `MISMATCH`; 두 raw ID는 기본 외부 projection에 넣지 않음 | `IDENTITY_MISMATCH`, `BACK_TO_RESULTS` | 다른 course의 ID·slug·title·outline |
| 빈 outline | outline `OK`와 `subjects: []` | OUTLINE `RECEIVED/OK`, `outlineEmpty=true` | `OUTLINE_EMPTY`, `BACK_TO_RESULTS` | 학습 불가, provider failure, curriculum 전체 부재 |
| source projection 부재 | discovery에는 source stage call site가 없음. 별도로 formatter에 input 부재가 전달되면 `officialReference=null`, `independentExplanation=null`, `notice=PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE` | discovery trace에는 source stage를 만들지 않음. 명시적 future call이 없으면 `NOT_STARTED`; formatter 결과에는 현재 status/code가 없음 | 안내는 source formatter의 generic notice일 뿐 discovery result가 아님 | source가 private/삭제/미승인/최신 아님이라는 원인 |
| malformed/unknown 결과 | search source row 위반은 `INVALID_SOURCE`; outline malformed projection은 `UNAVAILABLE/INVALID_PUBLIC_PROJECTION`; guidance unknown shape는 `UNKNOWN_RESULT` | 실제 stage code를 보존하고 `resultState=RECEIVED`; invalid shape를 성공으로 보정하지 않음 | search `PROJECTION_ERROR`, outline `PROJECTION_ERROR`, 또는 guidance `UNKNOWN_RESULT` | raw payload, unknown을 `NOT_FOUND`로 재분류, 다른 과정 정보 |
| selection 입력 오류 | selection `SELECTION_ERROR/INVALID_INPUT` 또는 outline `INVALID_INPUT` | SELECTION/OUTLINE의 실제 code를 분리 기록 | `INPUT_ERROR`, selection context의 `BACK_TO_RESULTS` | caller identity·권한 부족이라는 추정 |

### 6.1 최소 합성 정상 예시

```json
{
  "traceId": "synthetic-trace-normal-01",
  "traceContractVersion": "<not-assigned>",
  "stages": [
    {
      "stageExecutionId": "synthetic-search-01",
      "stage": "SEARCH",
      "executionState": "HARNESS_SYNTHETIC",
      "resultState": "RECEIVED",
      "recordingState": "RECORDED",
      "result": { "status": "OK", "contractVersion": "public-course-search.v1" },
      "entityRefs": "<omitted-by-default>"
    },
    {
      "stageExecutionId": "synthetic-selection-01",
      "stage": "SELECTION",
      "predecessorStageExecutionIds": ["synthetic-search-01"],
      "executionState": "HARNESS_SYNTHETIC",
      "resultState": "RECEIVED",
      "recordingState": "RECORDED",
      "identityBinding": "MATCH",
      "result": { "status": "OK" }
    },
    {
      "stageExecutionId": "synthetic-guidance-01",
      "stage": "GUIDANCE",
      "predecessorStageExecutionIds": ["synthetic-selection-01"],
      "executionState": "HARNESS_SYNTHETIC",
      "resultState": "RECEIVED",
      "recordingState": "RECORDED",
      "explanation": { "category": "OUTLINE_READY", "actions": [] }
    }
  ]
}
```

이 예시는 fixture가 만든 연결을 보여줄 뿐이다. 실제 main 실행에서
`synthetic-trace-normal-01`이나 stage ID가 생성됐다는 뜻이 아니며, `OK`가
추천·공개 권한·학습 효과를 증명하지 않는다.

### 6.2 reason code와 사용자 설명

내부 `resultStatus`·`reasonCode`와 외부 `title`·`message`·`actions`는 별도
필드다. 외부 문구를 다시 parsing하여 authoritative status를 복원하지 않는다.

- `NOT_FOUND`는 `COURSE_UNAVAILABLE`로 안내할 수 있지만 삭제·미게시·권한 부족 원인은 보존하지 않는다.
- `EMPTY`는 `SEARCH_EMPTY`이며 provider 장애가 아니다.
- `OK + subjects=[]`는 `OUTLINE_EMPTY`이며 학습 불가가 아니다.
- `IDENTITY_MISMATCH`는 `IDENTITY_MISMATCH` category로만 설명하고 비교된 다른 course 정보를 넣지 않는다.
- source projection absence는 `PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE`의 표시 결과이지 source authority 판단이 아니다.
- reason code가 새로 필요하면 product status를 먼저 변경하지 않고 trace taxonomy와 public mapping을 별도로 검토한다.

## 7. 민감 정보와 공개 경계

### 7.1 최소 수집

기본 trace에는 다음을 저장하지 않는다.

- raw query, raw cursor, 전체 request body, 자유 형식 prompt
- course/source 내부 ID, 개인 learner ID, Evidence ID, session/token/cookie
- exception·stack trace·SQL·row 전체·credential·운영 메모
- URL query/path/fragment의 민감 값
- source private note, reviewer ID/email, raw provenance payload

현재 search/outline 결과 자체에는 course ID·slug가 필요할 수 있으나, 그것은
public result DTO의 계약이고 trace 보존 허가가 아니다. 후속 조사에 raw ID가
꼭 필요하면 server-owned 내부 reference를 별도 정책으로 허용하고 접근·삭제
전파를 정한다. 기본은 `entityRefs` 미수집이다.

### 7.2 hash와 연결 가능성

raw query의 hash도 자동 익명화가 아니다. 짧거나 알려진 query는 사전 대입이
가능하고, 동일 hash를 여러 요청에 재사용하면 사용자의 검색 행동을 연결할 수
있다. course ID, source ID, cursor, trace ID, correlation ID를 hash하거나
opaque로 바꾸어도 다음 조건이면 연결 가능한 식별자다.

- 여러 요청·사용자·환경에서 같은 값이 반복된다.
- 다른 로그나 DB의 값과 join할 수 있다.
- 시간·경로·실패 패턴과 결합해 개인 또는 내부 row를 추론할 수 있다.
- 삭제 요청이 모든 복사본·derived key·offline export에 전파되지 않는다.

따라서 pseudonymization은 access control·retention·deletion policy를
대체하지 않는다.

### 7.3 내부 trace와 외부 설명 projection

내부 trace는 제한된 결과·code·stage 연결을 보관할 수 있는 별도 접근 경계다.
외부 설명 projection은 필요할 때 current result를 기준으로 새로 만든다.
외부 projection에는 원칙적으로 trace ID, request/correlation ID, raw query,
raw cursor, internal course/source ID, exception, SQL, row count, private source
존재, source/revision reference, reviewer 정보가 없다.

guidance formatter의 현재 `{ category, title, message, actions }`는 bounded
presentation 결과다. 이를 trace의 authoritative state로 재사용하거나 trace를
읽을 수 있다는 이유로 source를 공개할 수 있다고 해석하지 않는다. public
source projection은 [`public-source-projection-contract.md`](./public-source-projection-contract.md)의
별도 authority boundary를 따른다.

### 7.4 보존·접근·삭제 미결

보존 기간 숫자, 접근 role, tenant 경계, 삭제 전파 SLA, legal hold, offline
export 삭제 여부는 이 문서에서 확정하지 않는다. 최소한 다음을 별도 정책으로
결정해야 한다.

- trace를 누가 읽을 수 있는가와 source disclosure 권한의 분리
- learner 요청의 삭제가 trace·backup·derived hash·export에 전파되는가
- 오류 조사 목적과 제품 분석 목적의 retention이 같은가
- source/revision이 철회·삭제·접근 제한된 뒤 과거 trace를 어떻게 redact하는가
- correlation 값의 cross-request 연결을 어느 범위까지 허용하는가

## 8. 기록 실패와 제품 결과 보존

현재 제품에는 trace writer가 연결되지 않는다. 후속 구현 시 primary operation과
trace 기록은 별도의 실패 경계를 가져야 한다.

| 상황 | primary 제품 결과 | trace 결과 | 금지할 fallback |
| --- | --- | --- | --- |
| search가 `OK`를 반환하고 trace write 실패 | `OK`를 유지 | `recordingState=FAILED`를 별도 내부 metric/상태로 남길 수 있음 | 성공을 `PROVIDER_ERROR`로 변경하거나 raw result 전체를 fallback log로 저장 |
| outline이 `NOT_FOUND`를 반환하고 trace write 실패 | `NOT_FOUND` 유지 | 결과 미기록을 `NOT_STARTED`로 바꾸지 않음 | 삭제·비공개 원인 추정 |
| provider throw 후 guidance caller가 `PROVIDER_ERROR`를 표시 | caller의 기존 안전 오류/안내 유지 | exception 세부 없이 최소 error summary | stack/SQL/row를 저장해 기록 실패를 보충 |
| cleanup이 실패 | 원래 search/outline/guidance 결과 유지 | cleanup trace는 별도 failure | primary result를 성공/실패로 재분류 |
| future 권한 변경·학습 기록 mutation의 trace write 실패 | mutation transaction/rollback은 별도 정책 | 공개 read trace와 동일하게 처리하지 않음 | 조회와 mutation을 같은 logging failure policy로 묶음 |

필수 감사가 필요한 미래 mutation은 별도 durable audit 정책을 가져야 한다.
이 문서는 공개 조회 trace가 그 요구를 자동 충족한다고 말하지 않는다.

## 9. Context Graph와 canonical 경계

### 9.1 canonical authority

Supabase PostgreSQL을 canonical authority로 유지한다는 Context Graph 방향은
[`agent-learning-discovery-contract.md`](./agent-learning-discovery-contract.md)의
설계 방향과 호환된다. 이 문서는 저장 엔진, migration, 새 DB, event bus를
결정하지 않는다.

trace는 다음을 기록할 수 있는 파생 관찰 자료다.

```text
stage execution
  -> observed input classification
  -> applied existing contract reference
  -> adapter/provider result
  -> identity binding result
  -> bounded explanation summary
```

이 edge가 Supabase row, Neo4j edge, GraphRAG context, canonical relation이 되는
것은 후속 저장·권한·정합성 결정 사항이다. 과거 trace의 `OK`, guidance,
source reference, 추천 판단을 canonical course/source/revision 사실로 자동
승격하지 않는다.

### 9.2 source/revision 변경과 과거 판단

향후 source/revision 또는 public policy가 변경되면 다음을 분리한다.

- 판단 당시 trace가 참조한 입력·결과·규칙과 현재 권한/유효성
- 현재 철회·삭제·접근 제한된 근거의 재노출 여부
- 현재 요청자가 과거 reference를 읽을 권한이 있는지
- 과거 explanation을 현재 recommendation으로 자동 재실행할 수 있는지

과거 trace를 다시 읽는 것만으로 현재 source officiality, currentness,
publication, learner permission을 복원하지 않는다. 현재 권한을 다시 확인하고,
필요하면 reference를 제거하거나 접근 불가 상태로 표시해야 한다.
과거 trace는 당시 관찰·적용 근거·결과의 기록일 뿐, 현재 사실이나 접근 권한,
source 유효성, 당시 판단의 정확성, 같은 결정을 다시 실행해도 된다는 승인을
확정하지 않는다.

### 9.3 모델과 Context Graph

모델이 후속 단계에 참여해도 trace에는 모델 내부 사고 전체를 기록하지 않는다.
허용 후보는 검증 가능한 input class, 사용한 tool result, 적용한 승인된 rule
reference, result status, bounded explanation summary다. model name·prompt·raw
completion·confidence가 곧 authority라는 주장은 하지 않는다.

Neo4j, GraphRAG, 개인 Evidence 연결, 추천 엔진, public tool activation은
후속 범위다. 이 문서는 그 구현이나 compliance 보장을 선언하지 않는다.

## 10. 미결 정책과 후속 최소 범위

### 10.1 미결 정책

- trace 저장 owner와 Supabase canonical data의 관계
- `traceContractVersion` 발급 주체와 backward interpretation
- global policy version과 component contract version의 분리
- raw/opaque entity reference 허용 여부와 pseudonymization threat model
- raw query/cursor를 저장할 예외가 존재하는지
- retention, deletion propagation, export, legal hold, 접근 role
- stage retry·dedupe·late result·idempotency semantics
- clock source, timestamp precision, clock skew 처리
- search와 outline read의 snapshot 의미와 `asOf` 생산 주체
- source/revision reference의 target binding·current access 재검증
- trace write 장애 시 관찰성·감사 요구의 우선순위
- public explanation projection과 내부 trace의 분리된 policy
- future mutation audit와 public read trace의 서로 다른 durability 요구

### 10.2 후속 최소 구현·검증

후속 범위가 승인될 때만 다음 순서로 좁게 진행한다.

1. server-owned orchestration이 실제로 존재하는 caller를 먼저 만든다. 현재 primitive의 존재만으로 trace를 연결하지 않는다.
2. typed internal trace envelope와 stage/result/recording state를 구현하되 product result type을 변경하지 않는다.
3. 현재 실제 contract version만 `contractRefs`에 연결하고, 없는 outline/selection/guidance/policy version은 추가하지 않는다.
4. synthetic repository에서 normal, empty, invalid, provider error, NOT_FOUND, IDENTITY_MISMATCH, empty outline, malformed/unknown 결과를 재현하는 focused tests를 만든다.
5. 결과 성공 후 trace write failure, 결과 불명, 중복, 늦은 결과, cleanup failure를 주입해 primary 결과 보존을 검증한다.
6. 내부 trace와 public explanation projection에 raw query/cursor/ID/exception/source-private fields가 누출되지 않는지 검증한다.
7. source/revision/asOf가 실제 canonical read와 policy에서 생산되기 전에는 `NOT_AVAILABLE`로 유지한다.
8. storage·retention·deletion·access policy가 결정된 뒤에만 Supabase migration 또는 다른 저장 연결을 별도로 검토한다.

이 문서 자체는 위 구현·검증을 수행하지 않는다.

## 11. 문서 검증과 상태

### 11.1 확인한 실제 링크와 근거

- search: [`public-course-search-adapter.ts`](../../lib/services/public-course-search-adapter.ts)
- outline: [`public-course-outline-adapter.ts`](../../lib/services/public-course-outline-adapter.ts)
- selection: [`public-discovery-selection.ts`](../../lib/services/public-discovery-selection.ts)
- guidance: [`public-discovery-user-guidance.ts`](../../lib/services/public-discovery-user-guidance.ts)
- source disclosure: [`public-source-disclosure.ts`](../../lib/services/public-source-disclosure.ts)
- offline evaluation: [`public-discovery-offline-evaluation.test.ts`](../../tests/public-discovery-offline-evaluation.test.ts) 및 [`evaluation README`](../../verification/public-discovery-offline-evaluation/README.md)
- guidance evaluation: [`user-guidance README`](../../verification/public-discovery-user-guidance/README.md)
- UX/policy/source 설계: [`public-discovery-ux-contract.md`](./public-discovery-ux-contract.md), [`public-course-group-policy-contract.md`](./public-course-group-policy-contract.md), [`public-source-projection-contract.md`](./public-source-projection-contract.md)
- search comparison: [`public-course-search-comparison-contract.md`](./public-course-search-comparison-contract.md)
- graph response validation 경계: [`public-graph-response-validation README`](../../verification/public-graph-response-validation/README.md)

상대 링크는 기준 worktree의 실제 파일을 가리킨다. 본 문서는 기존 UX/source
projection 문서를 복제하지 않고 현재 구현·trace 경계만 참조한다.

### 11.2 유지 상태

```text
DECISION_TRACE_IMPLEMENTATION: NOT_STARTED
TRACE_PERSISTENCE: NOT_IMPLEMENTED
PERSONAL_EVIDENCE_INTEGRATION: OUT_OF_SCOPE
SOURCE_RESOLVER_INTEGRATION_THIS_GOAL: NOT_IMPLEMENTED
PUBLIC_TOOL_ACTIVATION: NOT_ENABLED
DATABASE_EXECUTION_THIS_GOAL: NOT_RUN
LIVE_API_EVALUATION: NOT_RUN
LLM_REASONING_CAPTURE: NOT_IMPLEMENTED
CANONICAL_MUTATION: NONE
REMOTE_MUTATION: NONE
```

제품 코드·테스트·package.json·workflow·schema/migration·DB·로그 수집 설정은
변경하지 않았다. Context Graph trace 수집, 저장, 개인화, source resolver,
공개 연결로 범위를 확장하지 않는다.
