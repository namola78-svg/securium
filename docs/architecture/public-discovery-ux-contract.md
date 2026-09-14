# 공개 과정 Discovery UX 계약

상태: UX_CONTRACT_DESIGN · 현재 구현과 제안의 분리 문서

## 1. 목적과 범위

이 문서는 익명 또는 로그인 상태의 사용자가 다음 흐름을 이해하고 안전하게
수행할 수 있도록 화면 상태, 안내 문구, 사용자 행동, 접근성 계약을 설계한다.

```mermaid
flowchart LR
  A[검색 화면] -->|명시적 검색 제출| B[공개 결과]
  B -->|과정 선택| C[선택한 과정 개요]
  C -->|기존 상세 보기| D[/courses/courseSlug]
  D -->|기존 호출자 소유| E[로그인·등록·학습 진입]
  B -.->|EMPTY / 조회 실패| B
  C -.->|NOT_FOUND / IDENTITY_MISMATCH / UNAVAILABLE| B
```

범위는 공개 과정 metadata의 발견과 선택, subject/topic 개요 표시, 기존 과정
상세 및 학습 진입 CTA로의 연결이다. 제품 화면, route/API/MCP 등록, 공개 활성화,
인증·등록 정책 변경, DB·Docker·브라우저 실행은 이 목표에 포함하지 않는다.

검색 결과 노출, 과정 개요 존재, 실제 학습 콘텐츠 이용 가능, 로그인, 등록,
학습 접근 권한은 서로 다른 판단으로 유지한다. 내부 adapter 또는 selection
service가 존재한다는 사실만으로 공개 UI/API가 연결되었다고 표현하지 않는다.

## 2. 고정 기준과 현재 구현 근거

| 항목 | 값 |
| --- | --- |
| worktree | `securium-public-discovery-ux-contract` |
| branch | `docs/public-discovery-ux-contract` |
| generation base | `200e3db5a191eae2db82e8f4a426f0fcbf24f69e` |
| candidate | `30c3949c947a148308d4660a5d7e75c2405b6b6f` |
| reviewed `origin/main` | `c850db8e8cb18542993b3005c42200525cfcb6e2` |
| PR #192 | `MERGED`; head `367adf8e1449b102c3bdc19dd049ebe0f2281d86`, reviewed main squash commit `c850db8e8cb18542993b3005c42200525cfcb6e2` |
| 적용 `AGENTS.md` | 저장소·상위·2단계 상위 경로에서 확인되지 않음 |
| 검토 방식 | 고정 base의 관련 source·현재 문서·상대 링크 정적 대조 |
| 실행하지 않은 항목 | test, build, install, DB, Docker, Wrangler, server, browser, API, LLM |

고정 base의 공개 과정·그룹 선택 조건은 [공개 과정·과정 그룹 선택 조건 계약](./public-course-group-policy-contract.md#L47-L72)과 [공개 조회·학습 접근 경계](./public-course-group-policy-contract.md#L108-L139)를 함께 참조했다. 출처 문구는 [공개 페이지 출처·검수·최신성 표시 설계](../product/public-source-transparency.md#L20-L36)의 제한을 따른다.

### 2.1 현재 공개 route

현재 `/courses`는 `listPublishedCoursesCached()`로 공개 목록을 읽고,
`q`, `path`, `status`를 이미 읽은 목록에 적용한다. `path`는 `all`,
`certification`, `professional`이고, `status`는 `available`, `planned`다.
이 화면은 [과정 목록 page](../../app/courses/page.tsx#L27-L45)의 서버 component이며,
필터 form·empty copy·초기화 action은 [같은 page의 화면 부분](../../app/courses/page.tsx#L48-L93)에 있다.

카드는 `CourseCard`가 소유한다. 실제 CTA는 available일 때
`/courses/${course.slug}`의 `과정 상세 보기` link이고, 그 외에는 disabled
`개설 예정`이다([CourseCard](../../components/course-card.tsx#L7-L31)).

과정 상세는 `getPublicCourseBySlugCached()`와 `listCurriculumCached()`를
사용하고, `getOptionalCurrentAppUser()`와 `getEnrollmentForCourse()`를 별도로
읽는다([상세 page](../../app/courses/%5BcourseSlug%5D/page.tsx#L22-L34)).
따라서 현재 공개 상세는 내부 discovery outline adapter를 호출하지 않는다.

### 2.2 내부 adapter와 selection service

#### Search adapter

`createPublicCourseSearchAdapter()`는 자체 DB, route, API, registry를 열지 않고
server-owned `PublicCourseSearchRepository`를 주입받는다. repository 입력은
`query`, `path`, `limit`, `after`이며([입력 seam](../../lib/services/public-course-search-adapter.ts#L46-L88)),
출력은 `contractVersion`, `status: "OK" | "EMPTY"`, public summary 배열,
`page.limit`, `page.hasNext`, `page.nextCursor`다([출력 계약](../../lib/services/public-course-search-adapter.ts#L90-L115)).

현재 입력 검증은 query NFKC/trim/lowercase, UTF-8 48 byte 이하, limit 1–12,
path allowlist, cursor non-empty/2,048자 이하를 요구한다. 지원 입력은
`query`, `path`, `limit`, `cursor`뿐이다([입력 정규화](../../lib/services/public-course-search-adapter.ts#L162-L223)).
`status`는 이 adapter 입력이 아니므로 현재 `/courses`의 `status` filter와
동일하다고 표현하지 않는다.

검색 error code는 `INVALID_INPUT`, `INVALID_CURSOR`, `INVALID_SOURCE`다
([error type](../../lib/services/public-course-search-adapter.ts#L117-L129)).
provider exception을 adapter가 public error code로 변환하는 catch는 현재
없으므로, provider 오류 화면은 별도의 UI caller 경계가 필요하다
([호출 경계](../../lib/services/public-course-search-adapter.ts#L547-L592)).

adapter는 provider 결과가 공개 course인지, query/path와 일치하는지, 중복·순서·
cursor 조건을 지키는지, bounded limit을 넘지 않는지 검증한다
([provider row 검증](../../lib/services/public-course-search-adapter.ts#L303-L384)).
output projection에는 `id`, `groupName`, `code`, `slug`, `name`, `shortName`,
`description`, `thumbnailUrl`, `totalLevels`, `difficulty`, 선택적 `updatedAt`,
`subjectCount`, `topicCount`가 있고 `questionCount`는 포함되지 않는다
([projection](../../lib/services/public-course-search-adapter.ts#L391-L410)).

#### Outline adapter와 provider

`createPublicCourseOutlineAdapter()` 및 `getPublicCourseOutline()`의 결과는
다음 union이다.

- `OK`: `course`와 정렬된 `subjects`를 반환한다.
- `INVALID_INPUT` 또는 `NOT_FOUND`.
- `UNAVAILABLE`과 `OUTLINE_LIMIT_EXCEEDED`, `PUBLIC_RELATION_MISMATCH`,
  `INVALID_PUBLIC_PROJECTION`, `PUBLIC_REPOSITORY_ERROR` 중 하나의
  `reason`([결과·reason type](../../lib/services/public-course-outline-adapter.ts#L42-L65)).

course가 공개로 확인되고 active/non-deleted subject/topic이 남지 않으면
`OK`와 빈 `subjects`가 가능하다. 빈 개요는 `NOT_FOUND`나 오류가 아니다.
subject 50개 또는 topic 200개를 초과하면 부분 결과를 내지 않고
`UNAVAILABLE/OUTLINE_LIMIT_EXCEEDED`로 끝낸다([정규화·상한](../../lib/services/public-course-outline-adapter.ts#L197-L303)).
strict SQL provider는 초과 감지를 위해 subject 51개와 topic 201개를 읽지만,
이 provider도 현재 app route에 연결되었다는 뜻은 아니다
([strict provider](../../db/public-course-outline-provider.ts#L12-L39)).

현재 export된 `getPublicCourseOutline()` helper는 strict provider가 아니라
기존 `getPublicCourseBySlug`와 `listCurriculum`을 주입한다
([helper](../../lib/services/public-course-outline-adapter.ts#L83-L138)).
따라서 strict provider의 group 조건을 current public route의 전역 정책으로
확대하지 않는다.

#### Selection service

`createPublicDiscoverySelectionService()`는 `courseId`와 `courseSlug`를 받아
slug로 outline을 조회한 뒤 반환된 `outline.course.id`와 선택 ID를 비교한다.
불일치면 `status: "SELECTION_ERROR", code: "IDENTITY_MISMATCH"`를 반환한다
([selection contract](../../lib/services/public-discovery-selection.ts#L5-L50)).
이 ID binding은 authorization proof나 snapshot/revision 보장이 아니다.
현재 selection service를 호출하는 공개 route·UI handler는 확인되지 않았다.

### 2.3 Guidance/disclosure

고정 base에서 discovery 전용 guidance formatter는 확인되지 않았다.
검토 기준 `origin/main`에는 이후 병합된 PR #192의
`formatPublicDiscoveryUserGuidance()`가 추가되어 있다. 이 formatter는
현재 main의 내부 pure formatter이며 `/courses` route, public API/MCP, UI
handler에 연결되었다는 근거는 없다([PR #192 formatter](https://github.com/namola78-svg/securium/blob/c850db8e8cb18542993b3005c42200525cfcb6e2/lib/services/public-discovery-user-guidance.ts#L20-L43), [entry point](https://github.com/namola78-svg/securium/blob/c850db8e8cb18542993b3005c42200525cfcb6e2/lib/services/public-discovery-user-guidance.ts#L431-L452)).

실제 main formatter의 출력 계약은 { category, title, message, actions }이며,
formatter가 소유하는 category/title/message/actions는 다음과 같다. 아래는
화면 문구를 byte 단위로 강제하는 표가 아니라, 현재 main 구현과의 의미·오류
구분·허용 action 대조표다.

| category | title | message | actions |
| --- | --- | --- | --- |
| `SEARCH_EMPTY` | `검색 결과가 없어요` | `조건에 맞는 과정을 찾지 못했어요.` | `EDIT_SEARCH` |
| `SEARCH_RESULTS` | `검색 결과를 확인해 주세요` | `검색 결과를 확인하고 원하는 과정을 선택해 주세요.` | 없음 |
| `OUTLINE_READY` | `과정 개요를 확인했어요` | `선택한 과정의 개요를 확인해 주세요.` | 없음 |
| `OUTLINE_EMPTY` | `과정 개요가 비어 있어요` | `선택한 과정의 개요가 비어 있어요.` | `BACK_TO_RESULTS` |
| `COURSE_UNAVAILABLE` | `과정을 현재 확인할 수 없어요` | `선택한 과정을 현재 확인할 수 없어요.` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| `IDENTITY_MISMATCH` | `선택한 과정 정보를 다시 확인해 주세요` | `선택한 과정 정보를 다시 확인해 주세요.` | `BACK_TO_RESULTS` |
| `INPUT_ERROR` (검색) | `요청을 확인할 수 없어요` | `검색 요청을 확인할 수 없어요.` | `EDIT_SEARCH` |
| `INPUT_ERROR` (선택/개요) | `요청을 확인할 수 없어요` | `선택한 과정 정보를 확인할 수 없어요.` | `BACK_TO_RESULTS` |
| `PROVIDER_ERROR` | `과정 정보를 불러오지 못했어요` | `과정 정보를 불러오지 못했어요.` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| `PROJECTION_ERROR` | `과정 정보를 확인할 수 없어요` | `과정 정보를 확인할 수 없어요.` | `BACK_TO_RESULTS`, `REFRESH_RESULTS` |
| `OUTLINE_LIMIT_EXCEEDED` | `과정 개요를 표시할 수 없어요` | `과정 개요를 표시할 수 없어요.` | `BACK_TO_RESULTS` |
| `UNKNOWN_RESULT` | `결과를 확인할 수 없어요` | `과정 정보를 확인할 수 없어요.` | `BACK_TO_RESULTS` |

`SEARCH_RESULT`의 유효한 `EMPTY`와 `OK`를 구분하고, `SEARCH_ERROR`에서는
`INVALID_INPUT`/`INVALID_CURSOR`를 `INPUT_ERROR`, `INVALID_SOURCE`를
`PROJECTION_ERROR`, 그 밖의 throw/알 수 없는 오류를 `PROVIDER_ERROR`로
구분한다. outline의 `OK`와 빈 `subjects`, `NOT_FOUND`,
`IDENTITY_MISMATCH`, `UNAVAILABLE`의 provider/projection/limit reason도
각기 위 category로 보존한다. malformed 또는 모순된 성공 payload와 unknown
shape는 성공으로 승격하지 않고 `UNKNOWN_RESULT`로 fail closed한다. 이
formatter는 authorization, authenticity, publication, currentness를
검증하지 않는다([mapping and validation](https://github.com/namola78-svg/securium/blob/c850db8e8cb18542993b3005c42200525cfcb6e2/lib/services/public-discovery-user-guidance.ts#L308-L429)).

formatter가 제공하는 `EDIT_SEARCH`, `BACK_TO_RESULTS`, `REFRESH_RESULTS`는
복구·재조회에 대한 action descriptor일 뿐이다. 결과 선택, outline 열기,
기존 상세 link, 실제 retry/navigation의 event handler는 여전히 UI/caller의
책임이며, formatter의 `actions`가 그 handler의 존재나 연결을 보장하지
않는다.

현재 있는 `formatPublicSourceDisclosure()`는 I/O나 authorization을 수행하지
않는 display-only formatter다. projection marker가 없거나 input shape가
무효이면 `officialReference: null`, `independentExplanation: null`,
`notice: "출처 정보 확인 필요"`로 일반화한다. marker가 유효하지만 공식
reference가 불완전한 경우에는 official reference가 null 또는 부분 projection일
수 있고, 유효한 independent explanation은 별도로 남을 수 있으며 같은 notice를
표시한다
([source disclosure](../../lib/services/public-source-disclosure.ts#L1-L113)).
이 출력은 공개 정책을 승인하거나 최신성·권리·기관 보증을 증명하지 않는다.

`publicCopy()`도 표시용 문자열 정리 함수일 뿐 공개 publication policy가
아니다([publicCopy](../../lib/public-copy.ts#L1-L18)).
그러므로 discovery 화면에 공식 자료·검수 완료·최신이라는 새 의미를
formatter의 존재만으로 추가하지 않는다.

## 3. 현재 구현과 제안의 대응표

| 영역 | 고정 base에서 실제 확인한 현재 구현 | 이번 문서의 제안 | 상태 |
| --- | --- | --- | --- |
| 공개 검색 화면 | `/courses`의 GET form이 `q/path/status`를 받고, server component가 기존 목록을 in-memory filter한다 | search adapter를 server-owned caller에 연결하고, 명시적 submit·결과·선택 panel을 구성한다 | 현재 UI 있음 / 연결 제안 |
| 검색 provider | `PublicCourseSearchRepository` interface와 adapter validation만 있음. adapter를 구현한 DB search provider·route는 없음 | bounded provider와 public predicate의 owner를 구현 전에 확정한다 | 내부 계약만 |
| 검색 cursor | adapter는 opaque cursor, query/path fingerprint, `hasNext/nextCursor`를 제공한다 | 현재 `/courses`에 pagination이 있다고 말하지 않고, cursor 일치·중복/skip 방지를 UI 수용 기준으로 둔다 | 내부 계약만 |
| 과정 카드 | `CourseCard`가 subject/topic/question count, estimated weeks, availability label과 CTA를 표시한다 | search summary에 없는 availability를 count로 추론하지 않는다. availability를 표시하려면 별도 서버 read를 같은 scope로 조합한다 | 현재 구현 / 제안 제한 |
| 과정 상세·개요 | 상세 route가 cached detail + `listCurriculum`을 읽고 curriculum을 inline 표시한다 | 선택된 결과의 outline을 별도 상태로 보여준 뒤 기존 detail href로 넘긴다 | 현재 상세 / 연결 제안 |
| Outline adapter | `OK`·빈 개요·`NOT_FOUND`·`UNAVAILABLE/reason`·50/200 cap이 내부 계약에 있다 | UI가 exact status/reason을 generic copy로 매핑하되 raw reason은 노출하지 않는다 | 내부 계약만 |
| Selection binding | slug 조회 후 course ID를 비교하는 service가 있다 | 선택 결과의 ID와 현재 outline ID가 다르면 다른 과정 outline을 절대 표시하지 않는다 | 내부 계약만 |
| Guidance | 고정 base에는 formatter가 없었으나, reviewed main에는 PR #192의 `formatPublicDiscoveryUserGuidance()`가 있다. route/UI/MCP 호출자는 없음 | UI caller는 formatter의 bounded guidance를 사용할 수 있지만, 실제 selection/detail/retry handler와 공개 route 연결은 별도 구현·승인 사항이다 | 내부 formatter / 연결 제안 |
| Disclosure | source projection display formatter만 있음. `/courses`와 연결되지 않음 | 승인된 projection이 있을 때만 disclosure를 연결하고, 없으면 generic notice를 유지한다 | 내부 formatter / 연결 미정 |
| 학습 진입 | 상세의 `CourseEnrollAction`이 login, enrollment POST, `/learn`·review CTA를 소유한다 | discovery가 `/learn`으로 직접 우회하지 않고 기존 상세 CTA owner에게 넘긴다 | 현재 구현 보존 |

## 4. 화면 상태표

상태명과 code는 고정 base의 실제 union을 우선 사용한다. `검색 진행 중`,
`추가 결과 조회 중`처럼 화면 상호작용에만 필요한 상태는 **UI 제안 상태**로
표시한다. 사용자에게 내부 reason, raw ID, slug, query, provider exception을
출력하지 않는다.

| 상태 | 진입 조건과 근거 | 사용자에게 표시할 정보·안내 문구 | 허용 행동·실행 주체 | 다음 상태 | 접근성 처리 | 현재 구현 여부 |
| --- | --- | --- | --- | --- | --- | --- |
| 초기 검색 화면 | 공개 discovery 진입. 현재 근거는 `/courses` page의 search form이다 | 제목 `공개 과정 찾기`; 검색어 label, 탐색 경로, 검색 실행 설명 | `검색어 수정`은 input; `검색`은 명시적 submit; form/caller | 검색 진행 중 → 정상 결과/결과 없음/입력 오류/조회 실패 | `main`, `h1`, label 있는 search input; 초기에는 focus 이동 없음 | 부분 현재 구현 (`/courses`), discovery 연결은 제안 |
| 검색 진행 중 | 사용자가 검색을 제출한 뒤 응답 대기. 전용 UI 상태는 현재 없음 | `과정을 불러오는 중입니다.`; 기존 입력은 유지 | 중복 submit 잠금은 caller; 자동 retry/navigation 없음 | 정상 검색 결과, 검색 결과 없음, 검색 입력 오류, 검색 provider 오류 | 하나의 `role=status`만 사용; skeleton은 `aria-hidden`; 기존 결과가 있으면 stale 표시를 status로만 알림 | UI 제안 상태 |
| 정상 검색 결과 (`OK`) | adapter가 `status: "OK"`와 summary/page를 반환 | `검색 결과 N개`와 승인된 projection의 제목·분류·설명·subject/topic count. `N개`는 현재 page 수임을 분명히 함 | `과정 선택`은 discovery UI가 selection service 호출; `검색어 수정`은 form | 선택한 과정 개요 조회 중 또는 다시 검색 | 결과는 키보드로 접근 가능한 button/link; 결과 요약은 중복 낭독하지 않음 | adapter 내부만; 현재 `/courses`는 별도 목록 |
| 검색 결과 없음 (`EMPTY`) | 유효 query/path인데 page가 0개. adapter의 정상 empty | `검색 조건에 맞는 공개 과정이 없습니다.` `검색어 또는 탐색 경로를 바꿔 보세요.` | `검색어 수정`, `결과로 돌아가기`/조건 초기화; 새로고침은 사용자가 누른 경우만 caller가 실행 | 검색 진행 중 또는 초기 화면 | `role=status` 또는 empty region 중 하나만 live; input/query를 유지 | current `/courses`의 empty는 존재. adapter 연결은 미구현 |
| 추가 결과 조회 중 | `page.hasNext=true`이고 사용자가 `추가 결과 보기`를 누름. 현재 page에는 cursor UI가 없음 | `추가 과정을 불러오는 중입니다.`; 이미 보인 결과는 유지 | 추가 조회 button은 UI event handler; cursor는 server adapter가 소유 | append된 정상 결과 또는 추가 조회 실패 | 기존 결과와 button을 유지하고 `aria-busy`를 결과 region에만 지정; focus를 임의 이동하지 않음 | UI 제안 상태 |
| 추가 조회 실패 | cursor 요청 exception 또는 반환 검증 실패. public error code를 새로 만들지 않음 | `추가 과정을 불러오지 못했습니다. 이미 표시된 결과는 유지됩니다. 다시 시도해 주세요.` | `추가 결과 다시 시도`는 같은 current cursor로 명시적 재실행; 자동 retry 없음 | 추가 결과 조회 중, append 성공, 또는 현재 결과 유지 | inline `role=alert`; 기존 목록·검색어·선택되지 않은 상태 보존 | UI 제안 상태 |
| 검색 입력 오류 (`INVALID_INPUT` / `INVALID_CURSOR`) | adapter가 query/path/limit/cursor shape·length를 거부. `INVALID_CURSOR`는 cursor decode mismatch | `검색 조건을 확인해 주세요. 검색어를 줄이거나 탐색 경로를 다시 선택해 주세요.` cursor 자체는 언급하지 않음 | `검색어 수정`, `조건 초기화`; input/caller가 수정 후 재submit | 검색 진행 중 또는 초기 검색 화면 | 문제 input에 `aria-invalid=true`, 오류 id를 `aria-describedby`로 연결; 입력값은 보존 | code는 내부 adapter, 전용 UI는 미구현 |
| 검색 provider 오류 | adapter repository가 throw하거나 route caller가 transport failure를 받음. 현재 adapter에 provider error code 없음 | `과정 목록을 불러오는 중 문제가 발생했습니다. 검색어와 기존 결과는 유지했습니다. 다시 시도해 주세요.` 원인은 추정하지 않음 | `다시 시도`는 UI caller의 명시적 handler; 입력·기존 결과는 유지 | 검색 진행 중 또는 현재 결과 유지 | blocking이면 `role=alert`, 비차단 inline error면 기존 결과와 분리; focus 이동 없음 | 일반 app error boundary 외 전용 상태 없음 |
| 선택한 과정의 개요 조회 중 | 사용자가 결과에서 선택했고 selection service/outline adapter 응답 대기 | `선택한 과정의 개요를 불러오는 중입니다.` | 선택 event handler가 `courseId/courseSlug` binding을 전달; `결과로 돌아가기`는 UI | 정상 개요, 빈 개요, NOT_FOUND, IDENTITY_MISMATCH, UNAVAILABLE | 선택 button의 focus를 유지하거나 선택으로 열린 heading에만 명시적으로 이동; modal 전제 없음 | UI 제안 상태 |
| 정상 개요 (`OK`) | outline adapter가 공개 course와 subjects를 반환 | 과정명·groupName·description·subject/topic의 승인된 fields와 순서. `isSample`은 `개설 예정` 표시일 뿐 공개 허가가 아님 | `결과로 돌아가기`; `과정 상세 보기`는 `/courses/${course.slug}` link; 실제 학습 CTA는 상세 owner | 기존 과정 상세 | outline section에 heading; subject/topic은 읽기 순서대로, 긴 이름은 줄바꿈; CTA는 키보드 접근 | adapter 내부만; 현재 상세 curriculum은 별도 경로 |
| 정상 조회됐지만 subject/topic이 없는 개요 (`OK`, 빈 `subjects`) | 공개 course는 확인됐으나 visible curriculum이 0개. adapter의 empty semantics | `현재 공개된 과목과 주제 개요가 없습니다.` `과정 설명은 확인할 수 있으며, 학습 콘텐츠 제공 여부와는 별도입니다.` | `결과로 돌아가기`; 필요하면 `과정 상세 보기`; 자동으로 오류/콘텐츠 부재를 선언하지 않음 | 상세 또는 결과 | empty section을 한 번만 announce; CTA와 empty notice의 관계를 heading으로 명확히 함 | adapter 계약만. 현재 상세의 `커리큘럼을 준비하고 있습니다` copy는 별도 현재 UI |
| `NOT_FOUND` | slug 조회가 null이거나 course가 inactive/unpublished/deleted, 또는 strict public lookup 밖 | `이 과정의 공개 정보를 지금 확인할 수 없습니다.` 삭제·비공개·권한 부족 중 하나로 단정하지 않음 | `결과로 돌아가기`, `다시 검색`; 다른 과정 자동 선택 금지 | 초기 검색 화면 또는 검색 결과 | error/notice는 input과 기존 결과 옆에 배치; 원래 선택 control로 복귀 가능 | adapter 내부 code; 현재 상세는 framework `notFound()` |
| `IDENTITY_MISMATCH` | selection service의 선택 `courseId`와 outline 응답 `course.id` 불일치 | `선택한 과정 정보가 현재 결과와 일치하지 않습니다. 결과로 돌아가 다시 선택해 주세요.` 다른 과정 outline은 표시하지 않음 | `결과로 돌아가기`, `다시 검색`; selection service/UI caller가 책임짐 | 검색 결과 또는 초기 검색 | `role=alert`; 선택 control 또는 결과 heading으로 명시적 복귀 | selection service 내부만 |
| 검색 projection / outline provider·projection 오류 | search `INVALID_SOURCE` 또는 outline `UNAVAILABLE`의 `PUBLIC_REPOSITORY_ERROR`, `PUBLIC_RELATION_MISMATCH`, `INVALID_PUBLIC_PROJECTION` 중 하나 | `과정 정보를 확인할 수 없습니다. 결과로 돌아가 다시 선택해 주세요.` raw reason·내부 오류는 숨김 | `결과로 돌아가기`, 사용자가 명시한 `다시 시도`; adapter/caller가 실행 | 개요 조회 중 또는 검색 결과 | blocking alert와 retry action을 한 번만 announce; query/results는 보존 | adapter 내부만 |
| outline 응답 상한 초과 (`UNAVAILABLE/OUTLINE_LIMIT_EXCEEDED`) | subjects 50개 또는 topics 200개를 넘는 bounded contract 결과 | `과정 개요가 현재 표시 한도를 넘습니다. 결과로 돌아가 다른 과정을 선택해 주세요.` 전체 개요인 것처럼 부분 표시하지 않음 | 결과로 돌아가기; limit 자동 증가 금지 | 검색 결과 | alert가 상태를 설명하되 숫자를 정책 확정처럼 강조하지 않음; focus 임의 이동 없음 | adapter/provider 내부만 |
| malformed/unknown 결과 | expected result envelope를 벗어난 malformed/모순 payload 또는 미래의 미지원 shape. known error code와 unknown result를 새 public status로 만들지 않음 | `과정 정보를 표시할 수 없습니다. 결과로 돌아가 다시 선택해 주세요.` 원인·raw payload·다른 과정 정보는 표시하지 않음 | 결과로 돌아가기; 관찰·기록은 server owner, 사용자 retry는 명시적일 때만 | 검색 결과 또는 초기 화면 | alert와 결과 복귀 action; 입력과 안전한 기존 결과는 지움 없이 보존 | 내부 fail-closed 계약만 |

## 5. 정보 표현과 한국어 안내 문구

### 5.1 결과·개요·availability의 분리

현재 목록 repository의 `questionCount`는 `question_courses` 연결 수를 세며
`questions.status = PUBLISHED`를 조건으로 하지 않는다([목록 projection](../../db/repositories.ts#L97-L150)).
반면 availability query는 공개 course/group predicate를 적용하면서 published
question 또는 published lesson/content 존재 flag를 별도로 계산한다
([availability query](../../db/public-course-availability-repository.ts#L75-L107)).
화면의 `isPublicCourseAvailable()`는 두 flag 중 하나라도 true인 경우만
`true`로 판정한다([availability display](../../lib/services/course-availability-display.ts#L3-L9)).

따라서 다음을 서로 바꾸어 말하지 않는다.

| 판단 | 현재 근거 | 표시 가능한 의미 | 표시하면 안 되는 의미 |
| --- | --- | --- | --- |
| 검색 결과에 노출 | search `OK` 또는 현재 list의 공개 predicate | 공개 metadata 후보로 발견됨 | 학습 권한, 등록 완료 |
| 개요 존재 | outline `OK`; `subjects`가 비어 있을 수도 있음 | 공개된 course/subject/topic projection | lesson 본문·문제·정답 공개 |
| subject/topic count | active·비삭제 구조 count 또는 projection에 포함된 수 | 현재 projection의 과목·주제 수 | 학습 가능한 콘텐츠 수, 전체 과정 완전성 |
| `questionCount` | 현재 list/detail projection의 `question_courses` 연결 수 | 현재 repository가 계산한 연결 수 | published 문제 수, 학습 가능 |
| availability | published question 또는 published lesson/content flag | 현재 공개 콘텐츠 flag 기준의 `학습 가능`/`개설 예정` 표시 | 로그인·enrollment·권한, 공식 최신성 |

availability query의 실제 caller는 현재 `/courses` page의
`listPublicCourseAvailability(courses.map(...))`와 상세 page의
`getPublicCourseAvailability(course.id)`다. `CourseCard`와 상세 CTA는 그
결과를 `isPublicCourseAvailable()`로 표시용 상태에만 사용한다
([목록 caller](../../app/courses/page.tsx#L27-L43), [상세 caller](../../app/courses/%5BcourseSlug%5D/page.tsx#L22-L31), [display helper](../../lib/services/course-availability-display.ts#L3-L9)).

`CourseCard`의 현재 `학습 가능`/`개설 예정` 문구와 detail의 수치 표시는
기존 UI 계약으로 기록하되, 새 search summary에 availability나 `questionCount`가
없다는 이유로 값을 합성하지 않는다. availability filter를 discovery에 추가하는
것은 별도의 server composition과 정책 결정 사항이다.

### 5.2 안전한 문구 원칙

- 검색 결과 없음은 `검색 조건에 맞는 공개 과정이 없습니다.`로, 조회 실패는
  `과정 목록을 불러오는 중 문제가 발생했습니다.`로 구분한다.
- `NOT_FOUND`는 `이 과정의 공개 정보를 지금 확인할 수 없습니다.`로만 말한다.
  삭제·비공개·권한 부족 중 하나를 확인한 것처럼 쓰지 않는다.
- 빈 outline은 `현재 공개된 과목과 주제 개요가 없습니다.`로 표시할 수 있지만
  오류나 학습 콘텐츠 부재로 자동 번역하지 않는다.
- `학습 가능`은 availability의 기존 OR semantics에만 사용하며
  subject/topic/question count에서 추론하지 않는다.
- query, raw ID, slug, 내부 error/reason, 내부 sentinel, 다른 과정의 이름은
  오류 문구에 반사하지 않는다.
- 정상 projection의 공개 제목·설명·groupName만 표시한다. `updatedAt`은
  과정 정보 수정 시각이지 공식 자료 확인일이나 최신성 보장이 아니다.
- source disclosure가 연결되는 경우에도 `공식 자료`와 `Securium 설명`을
  별도 블록으로 표시한다. 출처 link는 권리 승인·기관 보증·최신성 보장이 아니다.

### 5.3 Action descriptor와 실제 handler

상태표의 `검색어 수정`, `결과로 돌아가기`, `다시 시도`, `과정 선택`,
`과정 상세 보기`는 **설계상의 action descriptor**다. reviewed main의
guidance formatter가 export하는 실제 descriptor는
`EDIT_SEARCH`, `BACK_TO_RESULTS`, `REFRESH_RESULTS` 세 가지뿐이며,
formatter에는 selection/detail handler가 없다. generic `StateAction`의
`href`/`onClick` shape([state UI action type](../../components/state-ui.tsx#L4-L15))를
discovery 계약으로 재명명하거나 확장하지 않는다.

실제 구현에서는 다음 책임을 분리한다.

- search form handler: query/path를 읽고 server caller를 실행한다. 자동 submit,
  debounce, 자동 retry는 기본값으로 넣지 않는다.
- result selection handler: 사용자가 고른 summary의 `courseId`와 `slug`를
  함께 전달하고, `IDENTITY_MISMATCH`이면 outline을 폐기한다.
- outline panel handler: loading/error/empty/OK를 렌더링하고 결과 목록 복귀를
  소유한다. 다른 과정 자동 선택은 하지 않는다.
- detail CTA: `/courses/${course.slug}` link를 사용한다. login/enrollment/
  learning navigation은 기존 상세 caller와 `CourseEnrollAction`의 책임이다.

## 6. 행동과 상태 전환 계약

### 6.1 명시적 행동

| 행동 | 표시 조건 | 실행 주체와 계약 |
| --- | --- | --- |
| 검색어 수정 | 초기·결과·입력 오류·조회 실패에서 항상 가능 | input/form. 오류 후에도 값과 현재 안전한 결과를 지우지 않는다 |
| 결과로 돌아가기 | outline panel이 열렸거나 outline 오류/identity mismatch일 때 | discovery UI가 selection/outline state를 닫고 결과 heading 또는 선택 control로 복귀 |
| 사용자가 명시적으로 결과 새로고침 | 결과 또는 empty 화면의 refresh control을 사용했을 때 | caller가 현재 query/path로 새 읽기를 실행. 자동 refresh/retry 없음 |
| 과정 선택 | 정상 result card에서 사용자가 선택했을 때 | UI event handler → selection service. courseId/slug binding 확인 전에는 outline을 열지 않음 |
| 기존 상세 보기 | outline `OK` 또는 empty outline에서도 course projection이 승인된 경우 | `/courses/${course.slug}` link. 상세의 availability/login/enrollment CTA로 책임을 넘김 |
| 학습 진입 | 기존 상세에서 identity/enrollment 상태가 확인된 뒤 | `CourseEnrollAction`이 login/add/learn/review를 소유. discovery는 `/learn` href를 새로 만들지 않음 |

현재 상세 CTA의 구체적 흐름은 anonymous이면
`authRedirectHref("/login", `/courses/${courseSlug}`)`, authenticated·미등록이면
`POST /api/enrollments`, ACTIVE/PAUSED 등록 상태면 `/learn/${courseSlug}`
link, COMPLETED 상태면 `/practice/${courseSlug}?mode=review` link다
([enrollment action](../../components/course-enroll-action.tsx#L127-L187),
[safe auth redirect](../../lib/auth-routing.ts#L74-L79),
[enrollment API](../../app/api/enrollments/route.ts#L13-L30)).
이 href가 존재한다는 사실과 anonymous hydration redirect의 실행 검증은
다르다.

### 6.2 비동기 일관성 수용 기준

후속 UI 구현은 다음을 만족해야 한다.

1. 검색 요청마다 client request sequence와 adapter의 query/path fingerprint를
   연결한다. 뒤늦게 도착한 응답은 현재 조건과 다르면 결과·outline을 덮어쓰지
   않는다.
2. 검색 조건이 바뀌면 기존 선택과 그 outline을 새 조건의 선택으로 재사용하지
   않는다. 새 결과를 기다리는 동안 query와 이미 표시된 안전한 결과는 보존할
   수 있지만, 기존 선택을 새 결과의 선택처럼 표시하지 않는다.
3. 추가 조회는 같은 query/path/limit에 맞는 `nextCursor`만 사용한다. 실패해도
   이미 append된 결과, 검색어, 이전 cursor 상태를 유지하고 명시적 retry만
   허용한다. 결과 전체를 지우거나 첫 페이지를 자동 재조회하지 않는다.
4. `IDENTITY_MISMATCH`나 unknown/malformed 응답을 받으면 다른 과정의 outline,
   이전 선택의 outline, 추정한 대체 과정을 표시하지 않는다.
5. 현재 adapter cursor는 서명·authorization proof·snapshot/revision 보장이
   아니므로, UI가 “같은 시점의 전체 목록” 또는 snapshot consistency를
   주장하지 않는다.

이 기준을 구현하지 않은 상태에서는 해당 동작을 현재 기능으로 표시하지 않고,
UI acceptance gap으로 남긴다. 현재 `/courses`에는 pagination, selection panel,
비동기 응답 역전 방어가 연결되어 있지 않다.

## 7. 공개 데이터·identity·인증 경계

### 7.1 공개 metadata

로그인 여부와 무관하게 public route의 metadata 정책을 적용한다. 로그인한
사용자가 `/courses`에 접근해도 공개 목록의 공개 predicate가 인증 사용자용
정책으로 바뀌지 않는다.

고정 base에서 list query는 course active/published/non-deleted와 group
active/non-deleted를 함께 검사하지만, `getPublicCourseBySlug` detail query는
group row 존재만 요구하고 group active/deleted 조건을 별도로 두지 않는다
([list/detail query 차이](../../db/repositories.ts#L97-L208)). 이 차이는
현재 문서의 구현 근거이지 의도된 제품 정책의 확정이 아니다
(`INTENT_NOT_ESTABLISHED`). discovery search·outline을 연결하기 전에
동일 public metadata predicate의 owner와 직접 상세의 호환성을 결정해야 한다.
이 문서는 어느 쪽으로도 정책을 변경하지 않는다.

### 7.2 identity와 개요

search summary의 `id`와 `slug`는 결과 선택을 위한 server-owned identity다.
selection service는 slug로 현재 public outline을 읽고 ID를 다시 대조한다.
이는 선택 binding이며 authorization, enrollment, snapshot/revision 보장이
아니다. `IDENTITY_MISMATCH`에서 다른 과정의 데이터를 보정 표시하지 않는다.

개요가 `OK`라는 것은 subject/topic public projection이 반환되었다는 뜻이다.
lesson body, question answer, practical resource, 개인 progress는 개요의
범위가 아니다. `isSample`은 표시용 개설 예정 상태이지 publication grant가
아니다.

### 7.3 인증·등록·학습 접근

과정이 검색되거나 개요가 보인다고 학습 권한이 부여되지 않는다. 현재
`/learn/[courseSlug]`는 `requireCurrentAppUser()`와 enrollment 확인을
수행하고, enrollment가 없으면 과정 상세로 redirect한다
([learn access](../../app/learn/%5BcourseSlug%5D/page.tsx#L22-L40)).

따라서 제안 discovery의 최종 CTA는 기존 `/courses/${slug}` 상세로 연결한다.
상세에서 `CourseEnrollAction`이 로그인·등록·`/learn` 또는 완료 후 review를
결정한다. 인증·enrollment policy, course/group 공개 조건, anonymous redirect
semantics는 이 문서에서 변경하거나 확정하지 않는다.

## 8. 1440px/390px 반응형 및 접근성 수용 기준

### 8.1 공통 읽기·구조

- 문서의 DOM 읽기 순서는 `main landmark → h1/검색 안내 → 검색 input과 filter
  → 결과 요약/status → 결과 card → 선택된 개요 → 기존 CTA`다. 시각적 grid
  배치가 이 순서를 바꾸지 않는다.
- root에는 현재 skip link와 `id="main-content"` wrapper가 있다
  ([root layout](../../app/layout.tsx#L86-L110)). discovery page는 별도의
  modal을 전제로 하지 않고 inline section 또는 route section으로 이 landmark
  안에 들어간다.
- 검색 input은 visible label을 갖고, 오류가 있을 때만 `aria-invalid`와
  오류 element id를 `aria-describedby`로 연결한다. placeholder를 label로
  대체하지 않는다.
- loading은 한 개의 polite status로만 알린다. 시각적 skeleton은
  `aria-hidden`이고, 같은 문구를 card·heading·live region에서 반복 낭독하지
  않는다. 사용자의 명시적 action으로 발생한 blocking 오류만 alert로 알린다.
- 결과 선택은 실제 keyboard-focusable button/link이며, card 전체를 임의의
  clickable overlay로 만들지 않는다. `결과로 돌아가기`도 실제 keyboard
  action이다.
- 검색 중 input focus를 임의로 옮기지 않는다. 명시적 선택 후에만 새 outline
  heading을 focus 대상으로 삼을 수 있고, 결과 복귀 시에는 사용자가 시작한
  selection control 또는 결과 heading으로 명확히 복귀한다.
- 상태는 색상만으로 구분하지 않는다. 문구와 role/label을 함께 제공하고,
  success/warning/danger는 semantic token의 보조 신호로만 사용한다.

### 8.2 1440px desktop

- 검색 input·path filter·submit은 한 행 또는 논리적 한 그룹으로 읽히고,
  결과 요약은 그 다음에 온다.
- 결과 card grid와 개요 panel이 나란히 배치되더라도 keyboard/DOM 순서는
  검색 → 요약 → 카드 → 개요 → CTA를 유지한다.
- 긴 과정명·groupName·오류 문구는 card 폭을 깨지 않고 줄바꿈한다. count와
  status badge는 본문 설명보다 보조 정보로 남긴다.
- focus ring은 배경 대비를 확보하고 hover만으로 선택 상태를 표현하지 않는다.

### 8.3 390px mobile

- 검색 controls, 결과 summary, card, outline, CTA는 한 열로 내려가며 수평
  scroll이나 잘린 CTA를 만들지 않는다.
- 작은 화면에서도 과정명·groupName·status/error copy가 줄바꿈된다. `nowrap`
  으로 긴 이름이나 오류를 숨기지 않는다.
- button/link는 기존 control minimum을 준수하고, `결과로 돌아가기`와
  `과정 상세 보기`가 화면 밖으로 밀리지 않는다.
- outline의 subject/topic 순서와 CTA가 먼저 읽히며, 시각적 접힘을 위해 새
  modal이나 별도 navigation drawer를 요구하지 않는다.

### 8.4 V2 White/Blue/Slate 원칙

제안 UI가 V2 scope로 구현될 때는 기존 [V2 semantic token 정의](../../components/v2/v2-foundation.module.css#L1-L49)를 사용한다.
white surface, slate text/border/background, blue primary action/focus와
success/warning/danger/info semantic role을 사용하며 raw palette를 각 상태
component에 새로 정의하지 않는다. focus width/offset과 control minimum도
기존 token([V2 interaction tokens](../../components/v2/v2-foundation.module.css#L126-L129))을 따른다.

현재 public `/courses`의 card CSS는 global `--color-*`와 일부 직접 지정 색을
사용하고, public page 자체가 `V2Foundation` component를 직접 호출하는
근거는 없다. 따라서 이 문서의 token 원칙을 현재 public route가 이미 V2
semantic implementation으로 검증됐다고 표현하지 않는다. 이번 목표에서는
CSS나 component를 변경하지 않는다.

## 9. 구현 전 미결 사항

| 미결 항목 | 현재 근거 | 결정 없이는 확정하지 않는 것 |
| --- | --- | --- |
| search provider owner와 route/API 연결 | adapter interface만 있고 current route call site 없음 | 익명 공개 endpoint, transport envelope, provider 오류 code |
| list/detail/group public predicate | list와 detail 조건이 다름 | 검색 선택 후 detail이 항상 같은 공개 집합이라는 보장 |
| search result availability composition | search summary에는 availability/questionCount 없음 | search card의 `학습 가능`/`개설 예정` 표시와 status filter |
| outline provider 선택 | strict provider와 generic helper가 모두 존재하나 app route 미연결 | group predicate, query count, empty/cap을 어느 호출자가 책임지는지 |
| cursor·비동기 policy | adapter cursor는 있으나 `/courses` UI는 full list/in-memory filter | snapshot semantics, stale result 허용 window, retry/cost budget |
| selection UI owner | service call site 없음 | same-page panel인지 route인지, URL에 selection을 반영할지 |
| empty outline copy | adapter는 `OK` empty, 기존 detail에는 준비 copy가 있음 | “개요 없음”과 “준비 중”의 제품 문구 구분 |
| source/disclosure authority | formatter는 projection 표시만 하고 registry·권한을 읽지 않음 | 공식 기관·자료·판·확인일·review 책임 주체를 화면에 표시할 수 있는지 |
| 인증·등록 복귀 | 상세 `CourseEnrollAction`과 safe return path가 있음 | discovery에서 login을 직접 시작할지, 상세 CTA만 사용할지의 최종 UX |
| course/group 정책 의도 | `INTENT_NOT_ESTABLISHED` | group inactive/deleted detail의 제품 처리 정책 |
| 실제 접근성 측정 | source에 정적 semantics만 있음 | screen reader, keyboard, 1440/390 실측 PASS |

이 항목들은 이번 문서가 인증 정책, source 권위, pagination cost, snapshot
일관성을 새로 승인하지 않도록 명시한 것이다.

## 10. 후속 구현과 브라우저 QA의 최소 범위

### 후속 구현 최소 범위

1. public predicate와 provider owner를 결정하고, search adapter·strict outline
   provider·selection service를 server-owned caller에 연결한다. route/API
   등록과 익명 공개 여부는 별도 승인 후 진행한다.
2. discovery UI/caller는 search/outline 상태를 exact internal result와 매핑하고,
   필요하면 reviewed main의 `formatPublicDiscoveryUserGuidance()`를 bounded
   Korean copy source로 사용한다. `EMPTY`, `NOT_FOUND`, `IDENTITY_MISMATCH`,
   `UNAVAILABLE`/reason을 구분하되 새 public status나 raw reason을 만들지
   않는다. formatter 사용 여부와 무관하게 UI event handler는 별도로 연결한다.
3. search request sequence, query/path cursor binding, selection invalidation,
   append failure preservation을 구현한다. 자동 retry·자동 navigation·자동
   대체 과정 선택은 넣지 않는다.
4. availability를 표시할 필요가 있으면 dedicated availability read와
   questionCount/subject/topic metadata를 별도 field로 조합하고, existing
   `isPublicCourseAvailable` semantics를 재사용한다.
5. 정상 projection·source disclosure가 같은 승인된 scope를 사용하는지와
   login/enrollment CTA owner가 변경되지 않는지 정적/단위 검증을 추가한다.

### 브라우저 QA 최소 범위

브라우저 QA는 이 목표에서 실행하지 않았다. 후속 구현 시 최소한 다음만
확인한다.

- 1440px desktop과 390px mobile에서 search → result → select → outline →
  detail CTA의 읽기 순서, 줄바꿈, horizontal overflow, focus ring.
- 키보드만으로 input submit, result 선택, 결과 복귀, 추가 결과 조회,
  outline CTA 수행 가능 여부.
- 입력 오류·`EMPTY`·provider 조회 실패·`NOT_FOUND`·`IDENTITY_MISMATCH`·빈
  outline·cap 오류에서 query와 안전한 기존 결과가 유지되는지, live region이
  중복 낭독되지 않는지.
- anonymous public metadata와 로그인 사용자의 public metadata가 동일 정책을
  따르는지, detail CTA에서만 login/enrollment/learning flow가 시작되는지.
- 카드 href 확인과 실제 anonymous hydration redirect를 별도 항목으로 보고,
  브라우저 관찰을 HTTP/API PASS로 확대하지 않는다.

## 11. 목표 종료 상태

- `UX_CONTRACT_DESIGN`: COMPLETE
- `CURRENT_IMPLEMENTATION_VS_PROPOSAL`: DOCUMENTED
- `STATE_AND_ACTION_COVERAGE`: DOCUMENTED
- `EMPTY_ERROR_AND_AVAILABILITY_DISTINCTION`: DOCUMENTED
- `IDENTITY_AND_DISCLOSURE_BOUNDARY`: DOCUMENTED
- `ACCESSIBILITY_ACCEPTANCE_CRITERIA`: DOCUMENTED
- `UNRESOLVED_POLICY_AND_IMPLEMENTATION_ITEMS`: DOCUMENTED
- `PUBLIC_UI_IMPLEMENTATION_THIS_GOAL`: NOT_STARTED
- `PUBLIC_TOOL_ACTIVATION`: NOT_ENABLED
- `AUTHENTICATION_AND_ENROLLMENT_POLICY`: UNCHANGED
- `DATABASE_EXECUTION_THIS_GOAL`: NOT_RUN
- `BROWSER_UX_VALIDATION`: NOT_RUN
- `LIVE_API_EVALUATION`: NOT_RUN
- `PERSONAL_EVIDENCE_ACCESS`: OUT_OF_SCOPE
- `CANONICAL_MUTATION`: NONE
- `REMOTE_MUTATION`: NONE
