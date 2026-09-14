# 공개 과정·과정 그룹 선택 조건 계약

상태: 설계·대조 문서. 제품 정책을 확정하거나 구현하지 않는다.

## 1. 문제와 검토 기준 SHA

공개 과정 목록과 병합된 outline provider는 활성·비삭제 `course_groups`를
요구한다. 반면 기존 `getPublicCourseBySlug`는 group row가 존재하기만 하면
비활성·삭제 group에 연결된 공개 course도 반환할 수 있다. 이 차이는 공개
metadata 선택 정책의 blocker다. 실제 권한 우회나 실제 데이터 존재를 뜻하지
않는다.

검토 기준은 다음과 같다.

- 기준 worktree/branch: `securium-public-course-group-policy-contract` /
  `docs/public-course-group-policy-contract`
- generation base: `4891e9652cec5fffe10dadc32fda49c412c2b39e`
- 최신 fetch 기준 `origin/main`: `00a58e083648b3d10ac27f969af5c0866c43e5aa`.
  관련 공개 course/group 선택 query, outline/search 경계, 직접 상세·caller·schema에는
  drift가 없고, D1 classifier 변경은 무관한 변경으로 기록만 한다.
- PR #189 squash merge: `b1d767edb6cd017842059493f990406a133c422c`
  는 위 main의 조상이다.
- provider candidate: `cff813b06f6d7b03c1d263e53e4aa72032e19552`
- 검토 범위: 실제 source의 정적 조건·호출 연결·projection. DB 실행,
  실제 data census, live API 요청은 하지 않았다.

기존 설계 문서도 현재 list/detail predicate가 완전히 같지 않음을 전제로
보수적인 public predicate를 제안하지만, 그것만으로 publication 정책이
확정되지는 않는다. [agent-learning-discovery-contract.md](./agent-learning-discovery-contract.md#L115-L139)의
검색·outline 제안과 [public-learning-graph-contract.md](./public-learning-graph-contract.md#L158-L217)의
공개 조회 원칙은 이 문서의 제안 근거로만 참조한다.

## 2. 현재 구현별 선택 조건

### Schema와 상태 표현

`course_groups`에는 `active`, `deletedAt`, `displayOrder`가 있고
`published`는 없다. `courses`에는 `active`, `published`, `deletedAt`가
있다. 두 boolean은 SQLite schema에서 integer boolean mode로 저장된다.
`courses.courseGroupId`는 non-null FK이고, `subjects.courseId`와
`topics.subjectId`도 non-null FK다. 따라서 group 없는 course나 subject
없는 topic은 정상적인 schema 상태의 사례가 아니다.

- [courseGroups/courses schema](../../db/schema.ts#L534-L583)
- [subjects/topics schema](../../db/schema.ts#L713-L758)

| 경로 | 서버 query의 현재 조건 | subject/topic 조건 및 정렬 | projection·연결 상태 |
| --- | --- | --- | --- |
| 목록 `listPublishedCourses` → `/courses` | course `active=true`, `published=true`, `deletedAt IS NULL`; inner join한 group `active=true`, `deletedAt IS NULL` | count subquery는 active·비삭제 subject/topic만 센다. 목록 순서는 group `displayOrder`, course `displayOrder` | `groupName`은 반환하지만 group 상태와 course `deletedAt`은 DTO에 없다. `/courses`의 q/path/status 필터는 이미 선택된 목록에 적용된다. [repository](../../db/repositories.ts#L97-L150), [route](../../app/courses/page.tsx#L25-L45) |
| 직접 공개 상세 `getPublicCourseBySlug` → `/courses/[courseSlug]` | course active/published/non-deleted만 검사한다. inner join은 group row 존재만 요구하며 group active/deleted 조건은 없다. `LIMIT 1` | projection의 counts는 active·비삭제 subject/topic 기준. 상세 curriculum은 별도 `listCurriculum` | cached wrapper는 조건을 바꾸지 않는다. group 상태와 course `deletedAt`은 projection에 없다. [repository](../../db/repositories.ts#L153-L208), [cache](../../lib/cached-catalog.ts#L1-L46), [route](<../../app/courses/[courseSlug]/page.tsx#L16-L31>) |
| 인증 과정 lookup `getLearnCourseAccessBySlug` → `/learn/[courseSlug]` | course active/published/non-deleted와 group row join; group active/deleted 조건 없음. enrollment를 left join | overview는 `listCurriculumForLearnOverview`를 별도 두 query로 호출하고 subject/topic active·비삭제만 선택 | course 조회와 enrollment/access는 별도 계약이다. [repository](../../db/repositories.ts#L210-L276), [route](<../../app/learn/[courseSlug]/page.tsx#L24-L38>) |
| 일반 curriculum `listCurriculum` | course ID만 받는다. subject SELECT는 해당 course·active·비삭제; topic SELECT는 해당 course의 subject와 join하고 topic active·비삭제를 고르며, 반환 시 선택된 subject에만 topic을 붙인다 | subject/topic 각각 `displayOrder`만 DB 정렬. 두 SELECT는 `Promise.all`이며 snapshot 보장은 없다 | 호출자가 course identity와 접근 정책을 이미 결정했다고 가정한다. [repository](../../db/repositories.ts#L278-L319) |
| outline provider `createPublicCourseOutlineProvider` | course active/published/non-deleted + inner join group active/non-deleted | subject `LIMIT 51`, topic은 과정 전체 `LIMIT 201`; 둘 다 `displayOrder, id` 정렬. 정상 course 1회 + curriculum 2회, course 미존재는 1회 조기 종료 | SQL이 group 상태를 검사하지만 반환 course row에는 group 상태가 없다. provider는 현재 app route에 연결되지 않았다. [provider](../../db/public-course-outline-provider.ts#L30-L101), [course SQL](../../db/public-course-outline-provider.ts#L111-L140), [bounded curriculum SQL](../../db/public-course-outline-provider.ts#L142-L198) |
| outline adapter `createPublicCourseOutlineAdapter` | 자체 DB query는 하지 않는다. course의 active/published/slug와 projection에 제공된 `deletedAt`의 null성을 검증하지만, 현재 strict provider와 generic detail projection에는 `deletedAt`이 없어 그 field로 독립 판정하지 못한다 | inactive/deleted subject/topic은 숨기고, course scope·중복·형식을 검사한다. 50 subjects/200 topics 초과는 `UNAVAILABLE/OUTLINE_LIMIT_EXCEEDED`; `displayOrder` 후 JavaScript ID 비교 | group active/deleted를 검사할 field가 없다. 현재 export된 `getPublicCourseOutline` helper는 strict provider가 아니라 기존 `getPublicCourseBySlug` + `listCurriculum`을 사용한다. [adapter](../../lib/services/public-course-outline-adapter.ts#L1-L138), [normalization](../../lib/services/public-course-outline-adapter.ts#L151-L329) |
| search adapter | server-owned repository가 public predicate를 먼저 적용해야 한다. adapter도 course public 상태와 `groupActive=true`, `groupDeletedAt=null`을 검증한다 | provider 결과는 bounded, query/path 일치, 중복 없음, group/course/id 순서를 만족해야 한다 | source record에는 group 상태와 group display order가 있지만 output DTO에는 숨긴다. reviewed main에는 이 interface를 구현하는 DB search provider가 없다: `NOT_IMPLEMENTED_ON_REVIEWED_MAIN`. [source contract](../../lib/services/public-course-search-adapter.ts#L58-L87), [predicate/order](../../lib/services/public-course-search-adapter.ts#L230-L374), [call boundary](../../lib/services/public-course-search-adapter.ts#L543-L577) |
| discovery selection | slug으로 outline을 조회한 뒤 반환 course ID와 선택 ID만 비교한다 | outline adapter/provider의 정책 결과를 재사용한다 | ID binding은 authorization이나 snapshot/revision 증명이 아니다. route·registry 호출자는 확인되지 않았다. [selection](../../lib/services/public-discovery-selection.ts#L21-L50) |
| availability | 전달받은 `courseIds`에 한해 availability query 자체의 outer `WHERE`가 course active/published/non-deleted + inner-joined group active/non-deleted를 검사한다. `/courses` caller는 먼저 `listPublishedCourses` 결과 ID를 넘기고, 상세 caller는 `getPublicCourseBySlug` 결과 ID를 넘긴다 | published question 또는 published lesson/content 존재 flag를 별도 계산 | 상위 caller의 ID 선택 전제와 query predicate를 혼동하지 않는다. 학습 콘텐츠 존재 여부를 publication 선택 조건으로 대체하지 않는다. [availability query](../../db/public-course-availability-repository.ts#L80-L107), [display decision](../../lib/services/course-availability-display.ts#L1-L9) |

현재 공개 route에서 search/outline/discovery adapter/provider는 사용되지 않는다.
`/courses`는 목록 query의 결과를 화면에서 필터링하고, 상세 page는 기존
cached detail query를 사용한다. outline provider는 전용 회귀 테스트와 내부
provider 경계에만 존재한다. local MCPA read service도 list에는 목록 query를,
단건 key lookup에는 기존 detail query를 사용한다. 다만 MCPA는 현재 공개 route의
caller가 아니며, public tool 활성화의 근거도 아니다. [MCPA read service](../../lib/mcp/mcpa-read-service.ts#L17-L84)

### Projection과 관계의 한계

현재 DTO는 대부분 `groupName`만 포함한다. group `active/deletedAt`와 course
`deletedAt`을 projection으로 독립 판정할 수 없고, provider/query의 WHERE가
서버 선택 근거다. `course_groups.published` 같은 필드는 schema에 없으므로
제안 조건에 넣지 않는다. `isSample`은 표시용 개설 예정 상태이지 publication
grant가 아니다.

## 3. 조건별 정적 결과 표

다음 표는 위 source와 schema에서 도출한 정적 결과다. 실제 DB row census나
live 요청 결과가 아니다. `N/I`는 reviewed main에 provider가 없어
`NOT_IMPLEMENTED_ON_REVIEWED_MAIN`임을 뜻한다.

| 합성 사례 | 목록 | 직접 slug 상세 | search adapter / provider | outline adapter(현재 generic helper) / strict provider | projection·응답 해석 |
| --- | --- | --- | --- | --- | --- |
| 공개·활성·비삭제 course + 활성·비삭제 group | INCLUDED | INCLUDED | 유효 source면 accept / N/I | `OK` 가능 / `OK` 가능 | group 상태는 목록/provider query가 확인하며 일반 DTO에는 없음 |
| 비활성 course | EXCLUDED (빈 목록) | `null` → page `NOT_FOUND` | 반환되면 `INVALID_SOURCE` / N/I | `NOT_FOUND` / `NOT_FOUND` | course public predicate가 동일 |
| 미게시 course | EXCLUDED (빈 목록) | `null` → `NOT_FOUND` | `INVALID_SOURCE` / N/I | `NOT_FOUND` / `NOT_FOUND` | schema의 course `published`만 사용 |
| 삭제된 course | EXCLUDED (빈 목록) | `null` → `NOT_FOUND` | `INVALID_SOURCE` / N/I | `NOT_FOUND` / `NOT_FOUND` | query는 `deletedAt IS NULL`이나 projection에는 field가 없음 |
| 공개 course + 비활성 group | EXCLUDED | INCLUDED (group row 존재) | source로 들어오면 `INVALID_SOURCE` / N/I | `OK` 가능 / `NOT_FOUND` | 현재 알려진 list/detail/outline 정책 차이. 권한 우회 결론은 아님 |
| 공개 course + 삭제된 group | EXCLUDED | INCLUDED (group row 존재) | source로 들어오면 `INVALID_SOURCE` / N/I | `OK` 가능 / `NOT_FOUND` | deleted group도 detail query가 제외하지 않음 |
| group 연결 부재 | `IMPOSSIBLE_BY_SCHEMA`; FK가 우회된 손상 상태라면 inner join 결과 없음 | 동일 | N/I | `NOT_FOUND` 가능 / `NOT_FOUND` 가능 | 실제 데이터가 있다고 주장하지 않는다. schema FK와 inner join의 정적 결과다 |
| 다른 유효 group으로 연결된 course | 참조된 group의 active/deleted 상태에 따라 선택 | group 상태와 무관하게 course 조건이면 선택 | source group field가 참조 group을 반영해야 함 / N/I | generic helper는 course 조건만, strict provider는 참조 group 조건 | “잘못된” 업무 의미는 schema/query만으로 판정하지 못한다 |
| active course/group + inactive/deleted subject/topic만 존재 | course INCLUDED, counts 0 가능 | course INCLUDED, curriculum 빈 결과 가능 | course metadata source면 accept / N/I | `OK` + 빈 outline 가능 / `OK` + 빈 outline 가능 | 빈 outline은 course 미존재가 아니다 |
| 공개 course/group + subject/topic은 있으나 published lesson/question 없음 | course INCLUDED; `status=available`은 아님 | metadata/curriculum INCLUDED, availability false 가능 | course metadata 기준 / N/I | `OK` 가능 / `OK` 가능 | availability는 콘텐츠 존재 표시이며 publication 선택과 독립 |
| subject/topic course scope 또는 projection이 잘못됨 | DB query가 scope 밖 row를 선택하지 않음 | 상세 course 자체와 별도 | malformed source는 `INVALID_SOURCE` / N/I | injected malformed projection은 `UNAVAILABLE/PUBLIC_RELATION_MISMATCH` 또는 `INVALID_PUBLIC_PROJECTION`; SQL provider는 제조하지 않음 | adapter가 관계·형식을 검사하지만 실제 group 상태를 복원하지는 않음 |

오류와 무결과도 같은 의미가 아니다. 현재 outline adapter는 repository 오류를
`UNAVAILABLE/PUBLIC_REPOSITORY_ERROR`, 유효 course의 빈 curriculum을 `OK` +
빈 outline, course 미존재를 `NOT_FOUND`로 구분한다. search adapter는 검증된
빈 page를 `EMPTY`로 만들지만 repository/provider 예외를 자체적으로
`EMPTY`로 은닉하지 않는다. 기존 page/repository의 일반 예외 envelope는 이
adapter 계약과 별도로 호출자가 처리한다.

상한도 “반환 행 수” 계약이다. outline provider의 51/201은 초과를 감지하기
위한 look-ahead 행이며 scan/sort 비용이나 절대 응답시간의 상한이 아니다.
subject가 50개로 제한된 결과를 보더라도 topic query는 과정 전체를 대상으로
201개를 읽는다. 따라서 제한된 subject 집합이 전체 topic 초과를 숨기지 않으며,
201개가 관찰되면 adapter는 부분 outline을 `OK`로 내지 않는다. provider는
subject별 query 반복이나 전체 목록 fallback을 사용하지 않는다.

## 4. 공개 조회와 학습 접근의 경계

다음 계약을 분리해야 한다.

1. **검색·목록 노출:** 로그인 여부와 무관하게 공개 metadata 조회 역할에서 발견 가능한
   course 집합이다. 로그인 사용자도 같은 공개 route를 방문할 수 있다.
   현재 목록은 course와 group의 active/non-deleted 및 course published를
   함께 요구한다.
2. **직접 URL metadata:** `/courses/[courseSlug]`는 slug로 metadata와
   curriculum을 조회한다. 현재는 목록과 group 조건이 다르므로 북마크·공유
   링크가 목록 밖 course를 보여줄 수 있다.
3. **subject/topic 개요:** active·비삭제 curriculum projection이다. 개요가
   있다고 lesson body, question answer, practical resource가 공개된다는 뜻은
   아니다.
4. **학습 콘텐츠:** lesson/content/question의 별도 published/status와
   course scope가 필요한 후속 조회다. course 공개나 outline 존재를 이 조건의
   대체 근거로 쓰지 않는다.
5. **로그인·등록·접근 권한:** `/learn`, lecture, practice, practical,
   specialized 경로의 인증·enrollment·content access 계약이다. course lookup의
   group gap이 실제 접근 허용을 증명하지 않는다.

여기서 “공개”는 세션이 없는 사용자를 뜻하는 route 분기명이 아니라 metadata 조회
역할을 뜻한다. 로그인 여부만으로 같은 공개 URL의 lookup 정책을 다르게 선택하지
않으며, 인증 학습 route의 접근 판정은 별도 계약으로 유지한다.

`getPublicCourseBySlug` 변경은 직접 사용하는 학습 호출자에 영향을 준다.
subject/lesson/level/course-lesson 학습 page, lecture 목록/상세, practice,
practical, specialized page는 course lookup 뒤에 enrollment 또는 content
access를 추가로 확인한다. `/learn/[courseSlug]` overview는 별도의
`getLearnCourseAccessBySlug`를 사용한다. 이 경로들은 목록에서 제외됐다는
사실만으로 권한 우회라고 판정할 수 없고, lookup 변경 시 `NOT_FOUND`와
enrollment redirect의 순서·호환성이 별도 평가 대상이다.

- [학습 subject caller](<../../app/learn/[courseSlug]/subjects/[subjectId]/page.tsx#L31-L45>)
- [학습 lesson caller](<../../app/learn/[courseSlug]/lessons/[lessonId]/page.tsx#L27-L38>)
- [lecture caller](<../../app/lectures/[courseSlug]/page.tsx#L15-L23>)
- [practice caller](<../../app/practice/[courseSlug]/page.tsx#L32-L52>)
- [practical caller](<../../app/practical/[courseSlug]/page.tsx#L14-L28>)
- [specialized caller](<../../app/specialized/[courseSlug]/page.tsx#L14-L24>) 및
  [specialized content caller](<../../app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx#L21-L28>)

## 5. 정책 후보와 영향

현재 코드나 architecture 문서에서 이 group 차이가 의도된 제품 정책이라는
근거는 확인하지 못했다: `INTENT_NOT_ESTABLISHED`.

| 후보 | 내용 | 장점 | 비용·위험 |
| --- | --- | --- | --- |
| A. public metadata 동일 조건 | 목록, search, 직접 public detail, outline course 선택에 course active/published/non-deleted와 group active/non-deleted를 모두 적용 | search → detail → outline 연결이 같은 공개 집합을 사용한다. 비활성/삭제 group이 직접 URL만으로 다시 노출되지 않는다. 기존 schema/inner join으로 구현 가능 | 기존 `getPublicCourseBySlug`를 그대로 바꾸면 인증 학습·강의·practice·specialized 호출자까지 `null/NOT_FOUND` 시점이 바뀐다. shared repository를 바꾸는 것만으로 authorization 정책이 확정되는 것은 아니다 |
| B. discovery와 direct lookup 명시적 분리 | 목록/search/outline은 group 상태를 검사하되 직접 상세 metadata는 기존 course-only lookup을 유지 | 기존 bookmark/share URL과 공용 호출자 동작을 보존하기 쉽다 | search에서 고른 course가 detail/outline과 다른 결과를 보일 수 있다. 이는 의도된 “direct metadata legacy” 정책을 문서·테스트·rollout으로 확정해야 하며 현재 근거가 없다 |

### 권고안

정책 선택으로는 **A**를 권고한다. 다만 구현은 공용 repository 함수를
무조건 수정하는 방식보다, public metadata 조회를 위한 명시적 query/seam을
두고 `/courses` 상세·향후 search·outline provider가 이를 재사용하는 방식이
안전하다. 인증 학습의 course/enrollment lookup은 별도 계약으로 유지한다.

이는 “가장 작은 diff”가 곧 “가장 작은 영향”이라는 가정이 아니다. shared
`getPublicCourseBySlug`에 predicate 두 개를 추가하면 query 수는 늘지 않지만,
현재 직접 호출자 모두의 not-found 경계가 바뀐다. 전용 public query는 작은
중복 또는 seam 추가 비용이 있지만 영향 범위를 공개 metadata로 고정한다.

후속 결정 전에는 B도 유효한 설계 후보로 보류할 수 있다. 그 경우 direct
lookup이 public discovery와 다른 가시성 정책임을 명시하고 search 선택 후
detail/outline 불일치, availability 표시, direct URL 회귀를 제품 계약으로
승인해야 한다. 현재는 그 의도를 승인된 것으로 표현하지 않는다.

## 6. 권고안의 최소 후속 변경 범위

아래는 구현 제안이며 이번 문서 작업에서는 수행하지 않는다.

| 영역 | 최소안 | 재사용/새 결정 |
| --- | --- | --- |
| query 조건 | 기존 필드로 public course predicate를 고정: course active/published/non-deleted + inner-joined group active/non-deleted. outline의 subject/topic은 active/non-deleted와 course/subject scope를 유지 | schema/migration 불필요. group `published`는 추가하지 않음. “public metadata에 A를 적용할지”는 정책 결정 필요 |
| projection | 내부 source record가 독립 검증해야 할 때만 group active/deleted/display order와 course deletedAt을 내부 allowlist로 공급. public DTO에는 노출하지 않음 | 목록/detail의 현재 DTO는 재사용 가능하지만 상태 독립 검증은 부족. search source contract는 이미 group 상태 field를 요구 |
| adapter/provider | outline provider의 strict group SQL과 3-query/조기 종료/51·201 계약을 유지. search provider가 생기면 같은 public predicate, query 전 filtering, bounded result, JS comparator를 구현 | outline adapter는 provider SQL의 group 판정을 신뢰하거나 내부 projection을 확장하는 선택이 필요. adapter가 누락된 group 상태를 추론해서는 안 됨 |
| 오류 호환성 | hidden group의 public direct lookup은 `NOT_FOUND`/기존 null 경계로 처리하고, provider/DB 오류는 `UNAVAILABLE` 계열로 유지. 유효 course의 빈 outline은 `OK` + 빈 결과 | 기존 page의 generic exception 처리와 adapter envelope를 섞지 않음 |
| 호출자 | `/courses/[courseSlug]`, public discovery/outline 경계만 먼저 전용 query로 이동. 인증 학습 경로는 `getLearnCourseAccessBySlug` 및 별도 access/content query를 유지 | child learn/lecture/practice/practical/specialized 호출자를 함께 바꿀지는 호환성 승인 필요 |
| 회귀 테스트 | 위 matrix의 active/inactive/deleted group, course 상태, FK/scope, empty outline, availability 독립성, provider error/not-found와 query count를 추가 | 기존 adapter/provider 테스트와 focused route contract를 재사용. 이 목표에서는 실행하지 않음 |
| D1/PostgreSQL | 동일 fixture와 parameter binding으로 A의 query 결과, 1/3 query count, 반환 상한, 정렬을 검증 | 실제 DB 실행은 후속 구현 목표. transaction/snapshot 정책은 별도 결정 |
| UI/HTTP | 목록 → 상세 → outline 연결, hidden group direct URL, availability notice와 enrollment redirect를 확인 | 공개 route/tool 활성화는 이 문서로 수행하지 않음 |

정렬은 provider 반환 순서와 adapter 재정렬을 나누어야 한다. outline adapter는
`displayOrder` 후 JavaScript `<`/`>` ID tie-breaker로 다시 정렬하고, provider도
`displayOrder, id`를 사용한다. 상한 이내에서는 같은 집합과 순서를 확인할 수
있지만, DB collation이 JavaScript UTF-16과 항상 같다고 주장하지 않는다.
search 계약은 group order → course order → JavaScript ID 순서를 명시하므로
후속 DB provider가 이를 재현해야 한다. 반환 순서 parity와 LIMIT 초과 시
선택 집합 문제를 하나의 “정렬 보장”으로 합치지 않는다.

여러 SELECT에는 transaction/snapshot 근거가 없다. course가 첫 query와
curriculum query 사이에 바뀌면 course는 이전 상태, subject/topic은 이후
상태의 조합이 될 수 있다. 응답 일관성을 위해 자동 재조회나 대체 선택을
추가하지 않으며, 이번 범위에서 transaction 정책이나 공용 repository 계약을
변경하지 않는다.

## 7. 후속 평가 시나리오

후속 구현 때 실행할 시나리오이며 이번 목표에서는 실행하지 않는다.

- 활성 group의 정상 공개 course: 목록·직접 상세·search·outline identity가 일치하는가.
- group 비활성/삭제 전후: 목록/search/outline과 직접 상세의 결과가 A 계약대로
  함께 `NOT_FOUND` 또는 제외되는가.
- course 비활성·미게시·삭제: 목록 제외, slug `NOT_FOUND`, outline/provider
  조기 종료를 확인하는가.
- group 연결 부재 또는 유효하지만 의도와 다른 연결: FK 제약과 참조 group
  상태를 구분하고, semantic “wrong”을 임의로 판단하지 않는가.
- subject/topic 비활성·삭제, 다른 course/subject 관계, malformed projection:
  빈 outline·관계 오류·projection 오류를 구분하는가.
- 검색 후 group 상태 변경: search 결과와 후속 detail/outline이 단일
  snapshot이 아님을 명시하고, 자동 재검색·대체 course를 사용하지 않는가.
- 인증 학습 route: lookup 변경이 enrollment, lesson/content access, progress,
  canonical Evidence 정책을 확장하거나 우회하지 않는가.
- availability: published question/lesson content가 없을 때도 metadata와
  outline publication을 임의로 제거하지 않고 availability notice만 별도로
  판단하는가.
- provider 오류와 미존재: `UNAVAILABLE`과 `NOT_FOUND`/`EMPTY`를 은닉 없이
  구분하는가.
- D1/PostgreSQL: 동일 predicate·parameter binding·1/3 query count·subject
  50/51·topic 200/201·정렬을 확인하는가.
- 기존 공개 목록의 filtering, outline 상한, cursor/pagination 계약을
  변경하지 않는가. search provider 도입 시 DB cost 상한을 반환 행 상한으로
  과장하지 않는가.

상태 변경 후 재조회 결과의 일관성과 단일 snapshot 보장은 별개다. 후속
구현이 snapshot을 요구한다면 별도 transaction/read-model 계약과 검증이
필요하다.

## 8. 검증 및 비실행 상태

이 작업에서 수행한 검증은 source 정독, `rg` 기반 직접 호출자 확인, schema와
기존 architecture 문서의 정적 대조뿐이다. 테스트, build, CI, DB, Docker,
Wrangler, browser/API/MCP/LLM은 실행하지 않았다.

- `PUBLIC_SELECTION_POLICY_IMPLEMENTATION: NOT_CHANGED`
- `PUBLIC_TOOL_ACTIVATION: NOT_ENABLED`
- `DATABASE_EXECUTION_THIS_GOAL: NOT_RUN`
- `LIVE_API_EVALUATION: NOT_RUN`
- `MULTI_QUERY_SNAPSHOT_CONSISTENCY: NOT_ESTABLISHED`
- `AUTHENTICATION_AND_ENROLLMENT_POLICY: UNCHANGED`
- `PERSONAL_EVIDENCE_ACCESS: OUT_OF_SCOPE`
- `CANONICAL_MUTATION: NONE`
- `REMOTE_MUTATION: NONE`

이 문서는 공개 활성화 blocker를 구현상 해소하지 않는다. 현재 차이와 권고안,
호출자 영향, 후속 검증 범위를 명확히 한 상태에서 제품 정책 승인 전까지
종료한다.
