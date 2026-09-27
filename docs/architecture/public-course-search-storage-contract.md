# 공개 과정 검색 저장 계약

상태: 저장 구조와 전환을 위한 설계 계약. 이 문서는 schema/migration, writer, provider, cursor를 구현하지 않는다.

검토 기준:

- Repository: `namola78-svg/securium`
- 고정 base: `c850db8e8cb18542993b3005c42200525cfcb6e2` (`origin/main`, 2026-09-14 14:50:17 +09:00)
- 이 문서의 local branch: `docs/public-search-storage-contract`
- 비교 계약 PR: [#193](https://github.com/namola78-svg/securium/pull/193), reviewed head `651fc17ba8d39b17237a51e1f72a9f1c0b3e5be0`. fixed base에는 미병합이었고, 작업 중 관찰한 later `origin/main` head commit은 `00a467321b42e5cf86f7d83747e2f55949130fe0`이다. 이 SHA는 단일 부모의 일반 commit이며 merge commit으로 취급하지 않는다.
- 원본 provider 참고 head: `cc03e6b8757df683e31b7348dd67ff4d5f5f339b` (main 기능으로 간주하지 않음)

## 1. 목적과 범위

현재 main adapter에서 query는 `NFKC → trim → toLocaleLowerCase("ko-KR")` 순서로
정규화되고, assembled search text는 `NFKC → toLocaleLowerCase("ko-KR")` 뒤
`includes`로 비교된다. 저장 helper의 projection은 최종 `trim`까지 포함한다.
정렬은 `(groupDisplayOrder, displayOrder, id)`이며 마지막 ID 비교는 JavaScript 문자열 비교다.
이 계약의 현재 main 근거는 [public-course-search-adapter.ts](../../lib/services/public-course-search-adapter.ts#L8)와
[course-display.ts](../../lib/course-display.ts#L37)이다.

기존 비교 관찰에서 raw D1/PG provider의 raw text 검색은 full-width, 분해형, 호환문자
query를 놓쳤고, JS UTF-16 ID 순서와 DB 기본 정렬도 달랐다. literal `%, _, \` query는
기존 fixture에서 통과했지만, 그것만으로 저장 projection의 Unicode/DB parity가 입증되지는 않는다.

비교 계약의 pure helper와 문서는 fixed base tree에는 없었지만, pinned #193 head의 helper와
[comparison contract](https://github.com/namola78-svg/securium/blob/651fc17ba8d39b17237a51e1f72a9f1c0b3e5be0/docs/architecture/public-course-search-comparison-contract.md),
[comparison helper](https://github.com/namola78-svg/securium/blob/651fc17ba8d39b17237a51e1f72a9f1c0b3e5be0/lib/services/public-course-search-comparison.ts)를
검토 근거로 재사용한다. fixed base에는 helper가 없었으나 작업 중 `origin/main`이 `00a467321b42e5cf86f7d83747e2f55949130fe0`로 이동하며 #193을 포함한 것을 관찰했다. 이 branch는 fixed base에서 자동 merge/rebase하지 않았으므로, 여기서 사용하는 pinned helper/doc은 `651fc17ba8d39b17237a51e1f72a9f1c0b3e5be0` 기준의 안정적인 검토 참조다.

이번 문서가 결정하는 것은 다음이다.

- canonical 과정/그룹 row와 파생 검색 projection의 경계
- 저장할 파생 값, version binding, 누락/stale/실패 상태
- D1/PostgreSQL에서의 ID order key 비교와 keyset 조건
- course/group 변경을 projection으로 전파하는 writer 책임
- 기존 데이터 backfill, 동시 변경, provider/cursor 전환의 선행 조건
- 향후 migration과 구현이 받아야 할 검증 기준

이번 문서가 하지 않는 것은 다음이다.

- 실제 migration, schema journal/snapshot, writer, provider, adapter, cursor 변경
- 기존 canonical 필드의 projection 대체
- DB, backfill, 서버, API, Wrangler, Docker, test, build 실행
- 공개 선택 정책의 적용, public tool 활성화, 인증/enrollment 정책 변경

## 2. 현재 구현과 근거 경계

### 2.1 canonical source

현재 schema에서 `course_groups`는 `id`, `code`, `name`, `description`, `display_order`,
`active`, `is_sample`, `deleted_at` 및 timestamp를 가진다. `published` 필드는 group에 없다.
`courses`는 `course_group_id`, `name`, `short_name`, `description`, `difficulty`,
`active`, `published`, `display_order`, `deleted_at` 등을 가진다. 과정의 group FK는
현재 `ON DELETE RESTRICT`다. 근거는 [db/schema.ts](../../db/schema.ts#L534) 및
PostgreSQL 호환 baseline [0001_d1_compatibility_schema.sql](../../db/postgres/migrations/0001_d1_compatibility_schema.sql#L1)이다.

공개 predicate의 authority는 다음 원본 값이다.

```text
course.active = true
course.published = true
course.deleted_at IS NULL
group.active = true
group.deleted_at IS NULL
course.course_group_id = group.id
```

이는 저장된 검색 text, path, version 또는 state가 대신할 수 없다. group 공개용 별도
`published` 필드는 이 schema에 없으므로 제안하지 않는다.

현재 adapter는 repository가 이미 위 조건을 반영하고 bounded read를 했다고 전제한 뒤
source row를 다시 검증한다. 검색 query와 adapter의 검색 text 조립은
[adapter query normalization](../../lib/services/public-course-search-adapter.ts#L162),
[searchableText](../../lib/services/public-course-search-adapter.ts#L311),
[repository boundary](../../lib/services/public-course-search-adapter.ts#L550)에 있다.
fixed review base에는 이 adapter를 연결한 DB provider가 없다. later `origin/main` drift에서도
provider 구현은 확인하지 못했다. 원본 provider branch의
raw SQL은 참고용이며 [cc03e6b provider](https://github.com/namola78-svg/securium/blob/cc03e6b8757df683e31b7348dd67ff4d5f5f339b/db/public-course-search-provider.ts)는
이번 branch에서 복사하거나 구현하지 않는다.

### 2.2 파생 값의 source

pure helper가 받는 다섯 값의 의미는 다음과 같다.

| helper 입력 | canonical 또는 표시 helper 근거 | 저장 시 의미 |
| --- | --- | --- |
| `name` | `courses.name` | 과정명 원본을 문자열 그대로 전달 |
| `shortName` | `courses.short_name` | 짧은 과정명 원본을 문자열 그대로 전달 |
| `groupName` | `course_groups.name` | FK로 연결된 group의 현재 이름 |
| `publicDescription` | `courseDescription(courses.description)` | [courseDescription](../../lib/course-display.ts#L70)의 public copy/fallback 결과 |
| `audienceLabel` | `courseAudienceLabel(course)` | [courseAudienceLabel](../../lib/course-display.ts#L37)의 현재 규칙 결과 |

`publicDescription`과 `audienceLabel`은 DB의 raw `description` 또는 `difficulty`를
그대로 저장한다는 뜻이 아니다. writer가 동일한 표시 helper와 그 버전 계약을 사용해
먼저 표시 값을 만들고 pure projection helper에 전달해야 한다. SQL에서 임의로
`COALESCE`, trim, case 변환을 추가하면 helper의 계약과 달라질 수 있다.

`courseDescription`은 `null`/`undefined`를 빈 문자열로 취급한 뒤 public copy가 비면
fallback 문구를 선택한다. 그러나 현재 canonical schema의 `courses.description`은
`NOT NULL DEFAULT ''`이다. writer 입력이 schema와 다른 `null`이면 저장 편의를 위해
coerce하지 말고 source incompatibility로 다룬다. `name`, `shortName`, `groupName`도
schema상 non-null 문자열이다. 관리자 validation은 name/shortName 및 display order에
더 좁은 범위를 적용하지만 seed, migration, runtime SQL writer가 같은 validation을
모두 거친다고 가정하지 않는다.

현재 main adapter의 [searchableText](../../lib/services/public-course-search-adapter.ts#L311)는
join 후 NFKC와 locale lower를 적용하지만 저장 helper는 다섯 값을 join한 뒤
`normalizePublicCourseSearchText`의 최종 `trim`까지 적용한다. 정상화된 관리자 입력에서는
차이가 드러나지 않을 수 있으나, legacy/raw writer가 field 양끝 공백을 가진다면 결과가
달라질 수 있다. 저장 projection 전환은 helper의 exact output을 기준으로 하고,
adapter/query/provider도 같은 contract version으로 함께 전환해야 한다.

## 3. 기존 비교 계약과 이번 저장 계약

### 3.1 그대로 유지하는 값

helper의 다음 상수와 동작을 저장 계약의 입력으로 고정한다.

```text
normalizerVersion = public-course-search.normalizer.nfkc-trim-ko-lower.v1
idOrderKeyVersion = public-course-search.id-order.utf16-code-unit-hex.v1
comparisonVersion = public-course-search.comparison.v2
query maximum = 48 UTF-8 bytes, normalized query only
```

`normalizePublicCourseSearchText`는 string이고 well-formed Unicode인 입력만 받아
`value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR")`를 반환한다.
`normalizePublicCourseSearchQuery`만 결과의 UTF-8 byte length를 48로 제한한다.
`buildPublicCourseSearchProjection`은 다음 고정 순서로 다섯 문자열을 하나의 ASCII
space로 연결한 뒤 한 번 정규화한다.

```text
name + " " + shortName + " " + groupName + " " + publicDescription + " " + audienceLabel
```

저장 projection에는 query의 48-byte limit을 적용하지 않는다. 각 field를 먼저 trim하거나
빈 field를 제거하지 않는다. 따라서 field 내부 공백은 보존되고, 빈 중간 field가 있어도
join separator는 보존된다. 마지막에 한 번 적용하는 `trim`은 전체 결과의 양 끝만
다룬다. 검색은 field token 경계가 아니라 이 하나의 문자열에 대한 substring 검색이며,
separator를 가로지르는 match도 현재 `includes` 의미에 포함된다.

원본 display 값을 수정하거나 canonical authority를 `search_text`로 옮기지 않는다.
저장 text는 read model이고, display 응답은 canonical row와 기존 표시 helper에서
구성한다.

### 3.2 추가로 도입해야 할 version binding

이번 문서에서 제안하는 저장 row의 `search_projection_version`은 다음처럼 helper와
표시 helper 조합을 묶는다.

```text
public-course-search.projection.five-fields.v1
```

이 값은 구현된 상수가 아니다. 실제 writer가 도입될 때 다음을 함께 승인해야 한다.

- 다섯 field의 source mapping
- `courseDescription`/`publicCopy`/`courseAudienceLabel` 규칙 version
- join, trim, NFKC, locale lower의 정확한 순서
- source digest 직렬화 규칙
- `course_public_path`를 materialize할 경우 그 분류 규칙과 별도 path version

`search_normalizer_version`, `search_projection_version`, `id_order_key_version` 중 하나라도
현재 reader가 기대하는 값과 다르면 row는 `READY`가 아니다. old row를 조용히 query에
섞지 않고 backfill/재생성 또는 명시적 unavailable 처리 대상으로 둔다.

### 3.3 runtime 의존성

NFKC는 Unicode normalization data를, `toLocaleLowerCase("ko-KR")`는 실행 환경의
ECMAScript/ICU locale data를 사용한다. ECMAScript `String.prototype.normalize`는
지정한 normalization form으로 Unicode Standard에 따라 결과를 만든다
([ECMAScript text processing](https://tc39.es/ecma262/2024/multipage/text-processing.html#sec-string.prototype.normalize),
[Unicode UAX #15](https://www.unicode.org/reports/tr15/)). Node 문서도
`normalize()`와 locale 기능이 ICU 지원 범위와 data에 영향을 받음을 설명한다
([Node internationalization](https://nodejs.org/api/intl.html#internationalization-support)).

따라서 version 문자열만 저장한다고 실행 runtime의 Unicode/ICU data가 고정되는 것은
아니다. writer와 backfill은 승인된 runtime 식별자(최소 Node/ICU/Unicode data)를
기록하거나 release manifest에 binding해야 한다. 정확한 형식은 아직 미결이다.
runtime이 바뀌거나 locale/Unicode data가 달라지면 다음을 수행하기 전에는 기존
projection을 현재 version으로 간주하지 않는다.

1. 기존 vector와 변경된 runtime의 output 대조
2. 차이가 있으면 affected/all row 재생성
3. source digest, version, provider parity 재검증
4. cursor/order version을 유지할 수 없는 변경이면 cursor version을 올리고 old cursor를 거부

## 4. 저장 구조 대안

### 4.1 대안 A: `courses`에 derived column 추가

개념 예시는 `courses.search_text_v2`, `courses.id_order_key_v1`, 각 version/state 및
source binding을 `courses`에 추가하는 방식이다.

장점:

- 과정 1건을 읽을 때 join이 단순하다.
- 과정 insert/update와 projection upsert를 같은 row mutation 안에서 묶기 쉽다.
- course ID가 이미 PK이므로 별도 FK 조회가 없다.

단점:

- canonical table에 read-model lifecycle, failure, runtime/version metadata가 섞인다.
- group 이름 변경 시 모든 자식 과정의 `courses` row를 fan-out update해야 한다.
- projection backfill과 canonical course update가 같은 table index/write budget을 경쟁한다.
- field가 늘거나 projection을 재생성할 때 canonical schema의 additive change가 반복된다.
- projection만 stale인데 course row는 정상이라는 상태를 명시적으로 분리하기 어렵다.

### 4.2 대안 B: course ID를 참조하는 별도 projection table

제안 logical table 이름은 `public_course_search_projections`다. course당 현재 version의
projection row를 최대 1개 두고, `course_id`를 PK 겸 FK로 사용한다. 이 table은 canonical
과정의 대체물이 아니라 rebuild 가능한 read model이다.

장점:

- canonical source와 파생 text/key/state/version을 물리적으로 분리한다.
- projection 없음, 실패, stale, unsupported를 row 존재 및 state로 관찰할 수 있다.
- additive rollout에서 row를 먼저 준비하고 provider 전환을 별도 gate로 둘 수 있다.
- projection version을 바꾸어도 canonical course row를 다시 해석하는 책임이 분명하다.
- course hard delete 시 dependent row를 cascade로 정리할 수 있고, soft delete는 canonical
  predicate와 writer가 별도로 처리한다.

단점:

- provider가 `courses`, `course_groups`, projection을 join해야 한다.
- group 이름 변경은 여전히 그 group의 모든 course projection을 갱신해야 한다.
- 별도 row의 원자적 upsert, retry, backfill checkpoint가 필요하다.
- projection이 준비되지 않으면 provider가 조용히 누락시키지 않도록 readiness gate가 필요하다.

`public_course_search_projections.course_id`는 `courses.id`를 참조하는 PK/FK로
제안하고, dependent read model의 orphan 방지를 위해 projection 쪽 FK에
`ON DELETE CASCADE`를 우선 제안한다. 이는 현재 `courses.course_group_id`의
`ON DELETE RESTRICT`를 바꾸자는 뜻이 아니다. course의 soft delete는 projection
row를 자동 삭제하는 근거가 아니며, reader가 canonical `deleted_at` predicate를
재검사해야 한다.

이 B안은 `course_id` 단일 PK이므로 한 course에 현재 projection row를 한 개만
보존하는 **single-current-row 모델**이다. 따라서 구 projection과 신 projection을
동시에 보존해 provider를 겹쳐 운영하거나 rollback 때 구 row를 복구하는 기능은 이
identity만으로 제공되지 않는다. 그런 겹침이 필요하면 `(course_id, projection_version)`
또는 generation identity, 별도 version table, 혹은 구 reader가 projection이 아닌
기존 canonical/raw 경로를 계속 읽는 compatibility 전략 중 무엇을 택할지 먼저
결정해야 한다. 이 문서는 그 선택을 확정하지 않으며, 단일 row 덮어쓰기와 version
병행 보존을 같은 보장으로 표현하지 않는다.

현재 schema와 검토한 application writer에는 course/group hard delete 경로가
확인되지 않았고, `deleted_at`과 `active`를 통한 soft/inactive 상태가 별도 경계로
존재한다. 실제 DB에서 course를 hard delete할 때만 제안 projection FK cascade가
적용되며, group 비활성화·soft delete나 현재 `courses.course_group_id`의
`ON DELETE RESTRICT`를 projection cascade로 해석해서는 안 된다. 향후 SQL/운영
삭제 경로의 inventory와 허용 여부는 별도 선행 결정이다.

### 4.3 선택 권고

**logical storage approach는 대안 B, 별도 `public_course_search_projections` table을
권고한다.** canonical `courses` 확장의 작은 join 이득보다 파생 read model의 lifecycle,
version, failure, rebuild 경계를 명시하는 이득이 크다. 이 권고는 schema/migration 승인이나
정책 적용이 아니다.

다만 다음은 아직 implementation decision이다.

- `id_order_key`를 ASCII hex `TEXT`로 저장할지, 그 ASCII bytes를 `BLOB`/`bytea`로 저장할지
- runtime 식별자와 source digest의 정확한 직렬화
- D1/PostgreSQL에서 제안 collation과 index가 실제 provider plan을 충족하는지
- path classification을 같은 row에 둘지 별도 projection으로 둘지

이 미결이 해결되기 전에는 table 이름과 logical field 의미만 재사용하고 migration을
작성하지 않는다.

## 5. 제안 필드 계약

아래는 B안의 **logical field proposal**이다. 실제 D1 migration과 PostgreSQL migration에
그대로 복사할 schema가 아니다. D1은 SQLite query engine과 대부분의 SQLite convention을
사용하지만 지원 범위가 동일하다고 가정할 수 없다
([D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)).

### 5.1 identity, projection, state

| 필드 | 역할 | 원본/derived | D1 / PostgreSQL 제안 type | NULL·빈 값·누락 의미 | 생성 주체 | version binding | 검증 규칙 | index |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `course_id` | canonical course identity | 원본 참조 | `TEXT` / `text` PK, FK | NULL 불가. row 없음은 projection `MISSING` | course writer / backfill | 없음. FK identity만 binding | canonical `courses.id`와 정확히 일치. 재발급 금지 | PK 필수 |
| `search_text` | 다섯 field의 normalized substring source | derived | `TEXT` / `text` | `READY`에서는 NULL 불가. non-ready에서는 NULL 허용 가능. 빈 문자열은 helper 결과가 빈 경우에만 허용 | projection writer | normalizer + projection version | pure helper output와 byte-for-byte equality; 저장 truncation 금지 | substring에는 일반 B-tree 효과를 주장하지 않음 |
| `search_normalizer_version` | text normalization version | derived metadata | `TEXT` / `text` | `READY`에서 현재 값 필수. NULL/old는 non-ready | writer | `public-course-search.normalizer.nfkc-trim-ko-lower.v1` | exact constant equality | readiness partial/composite 후보 |
| `search_projection_version` | field order/display helper/join contract version | derived metadata | `TEXT` / `text` | `READY`에서 현재 값 필수. NULL/old는 non-ready | writer | 제안 `public-course-search.projection.five-fields.v1` | exact approved version equality | readiness partial/composite 후보 |
| `id_order_key` | UTF-16 code-unit order key | derived | 논리적으로 ASCII hex `TEXT` / `text`; physical BLOB/bytea는 미결 | `READY`에서 NULL 불가. empty ID는 지원하지 않으므로 빈 key 금지 | writer / backfill | `id_order_key_version`과 pair | `createPublicCourseSearchIdOrderKey(course_id)`와 exact equality; 4-hex-unit 반복; uppercase ASCII only | order key 비교 index 후보 |
| `id_order_key_version` | key encoding version | derived metadata | `TEXT` / `text` | `READY`에서 현재 값 필수. 혼용 row는 non-ready | writer | `public-course-search.id-order.utf16-code-unit-hex.v1` | exact approved version equality; key prefix에 version을 넣지 않음 | readiness/comparator gate |
| `course_public_path` | certification/professional 등 path selection read model | derived, optional | `TEXT` / `text` | path materialization을 승인하지 않으면 NULL/column 없음은 `NOT_USED`; 사용 시 unknown은 READY 금지 | path writer | 별도 path rule version 필요 | current path classifier와 vector parity; search text version만으로 검증하지 않음 | path equality/filter 후보 |
| `course_public_path_version` | path rule binding | derived metadata, optional | `TEXT` / `text` | path를 사용하면 필수, 사용하지 않으면 `NOT_USED` | path writer | 미결 | classifier 규칙과 exact match | path filter 후보 |
| `projection_state` | readiness와 오류 상태 | derived operational state | `TEXT` / `text` + cross-DB CHECK 후보 | row 없음=`MISSING`; `BUILDING`, `READY`, `STALE`, `FAILED`, `UNSUPPORTED`를 구분 | writer / validator | current versions와 함께 판정 | `READY`는 모든 required field/version/digest/key 검사를 통과해야 함 | `state + versions` partial/composite 후보 |
| `source_digest` | projection input이 어느 source tuple에서 생성됐는지 binding | derived digest | `TEXT` / `text` | `READY`에서 필수. non-ready NULL 또는 불일치 | writer / backfill | input serializer와 projection version에 binding | 승인된 canonical serialization의 SHA-256 hex; reader가 source를 재계산해 비교 | stale audit 후보 |
| `source_course_updated_at` | 빠른 stale candidate 표시 | source snapshot marker | 현재 schema 형태에 맞춰 `TEXT` / `text` | source marker를 읽을 수 없으면 READY 금지 | writer / backfill | source row version과 binding | canonical `courses.updated_at`와 exact equality; digest의 대체 아님 | stale scan 후보 |
| `source_group_updated_at` | group fan-out stale candidate 표시 | source snapshot marker | `TEXT` / `text` | group marker를 읽을 수 없으면 READY 금지 | writer / backfill | group source version과 binding | canonical `course_groups.updated_at`와 exact equality; digest의 대체 아님 | stale scan 후보 |
| `built_at` | projection 생성 시각 | operational metadata | `TEXT` / `text` | non-null 권고. source currentness를 뜻하지 않음 | writer / backfill | 없음 | approved timestamp format | 운영 관찰용, order/search index 아님 |
| `last_failure_code` | 재시도 가능한 분류만 보관 | operational metadata | `TEXT` / `text` nullable | 성공 시 NULL. raw exception/secret 저장 금지 | writer / validator | error taxonomy version 필요 | 허용된 stable code만 기록 | failure scan 후보 |

`projection_state`의 권장 의미는 다음과 같다.

- row 없음: `MISSING`
- `BUILDING`: writer가 완성된 값을 아직 commit하지 않은 중간 상태
- `READY`: 현재 모든 version, source digest, key, required value 검증 통과
- `STALE`: source digest/marker 또는 rule version이 현재 source와 다름
- `FAILED`: source는 존재하지만 계산/저장/검증이 실패함
- `UNSUPPORTED`: malformed surrogate, target DB가 지원하지 않는 canonical identity 등 현재 계약으로 저장할 수 없음

`MISSING`을 실제 state 값으로도 저장할지는 운영 관찰 요구에 따라 결정할 수 있으나,
provider가 “row 없음”과 “계산 실패 row”를 같은 정상 결과로 처리해서는 안 된다. 어떤
표현을 택하든 `READY` predicate는 명시적인 exact version과 non-null 검사를 포함해야 한다.

### 5.2 source digest 제안

`source_course_updated_at`과 `source_group_updated_at`만으로 정합성을 증명하지 않는다.
timestamp를 갱신하지 않은 raw SQL, 동일 timestamp, 또는 writer 누락은 marker만으로
검출되지 않을 수 있다. `source_digest`를 채택한다면 다음 입력을 고정된 순서의 typed
object로 직렬화해 SHA-256을 계산하는 방식을 제안한다.

```text
course_id
course_group_id
courses.name
courses.short_name
courses.description
courses.difficulty
course_groups.name
display-helper rule versions
search_normalizer_version
search_projection_version
```

status (`active`, `published`, `deleted_at`)와 display order는 projection text/key의
입력이 아니다. status는 provider가 canonical table에서 매번 확인해야 하고, display
order는 canonical order tuple의 일부이므로 필요하지 않은 rebuild를 일으키지 않도록
digest에서 분리한다. path classifier를 저장하면 그 classifier가 실제 읽는 모든 source와
path version을 digest에 추가한다.

현재 repository에는 이 digest serializer가 없다. delimiter 충돌이 없는 typed
serialization 방식, 고정 필드 순서, NULL과 빈 문자열의 구분, Unicode를 UTF-8로
인코딩하는 규칙, serialization version, JSON property order/escaping, digest hex
case를 정하지 않은 채 writer를 구현해서는 안 된다. `source_digest` equality는
source tuple equality를 확인하는 보조 수단일 뿐, source와 projection의 원자적
commit, durable write, runtime 동시성, 또는 public eligibility/공개 승인을 증명하지
않는다. normalizer/runtime이 바뀌면 digest가 같아도 exact version gate와 output
재계산 검증을 통과하기 전에는 READY로 취급하지 않는다.

## 6. normalization projection 저장 규칙

### 6.1 입력 shape와 null/empty

pure helper는 다섯 field 모두 `string`이고 well-formed Unicode여야 하며, missing field를
빈 문자열로 coerce하지 않는다. 따라서 writer는 다음을 따른다.

- canonical non-null schema 값을 그대로 읽는다.
- `description`을 저장 편의상 `null`/`undefined`로 바꾸지 않는다.
- empty `name`, `shortName`, `groupName`을 임의로 제거하거나 fallback하지 않는다.
- `publicDescription`은 `courseDescription`의 결과, `audienceLabel`은 승인된
  `courseAudienceLabel`의 결과를 전달한다.
- field별 trim, Unicode replacement character 삽입, byte/character truncation을 하지 않는다.
- 입력 string이 well-formed Unicode가 아니면 `FAILED`가 아니라 `UNSUPPORTED`/명시적
  저장 거부 분류로 기록하고 `READY`로 표시하지 않는다.

현재 관리자 route는 [course route](../../app/api/admin/courses/route.ts#L17)와
[course-group route](../../app/api/admin/course-groups/route.ts#L13)를 통해
`saveCourse`/`saveCourseGroup`으로 들어간다. validation이 이 route에 적용된다는
사실은 seed/import/raw SQL writer도 자동으로 보호한다는 뜻이 아니다.

### 6.2 query와 stored text의 일치

reader는 query에만 다음을 적용한다.

1. string/well-formed 검사
2. NFKC
3. 전체 `trim`
4. `toLocaleLowerCase("ko-KR")`
5. normalized query의 UTF-8 48-byte 제한

이 normalized query와 저장된 `search_text`의 normalization version이 같을 때만 검색
한다. 저장된 text를 query 시점에 DB `lower()`/`ILIKE`로 다시 변환하지 않는다. 그런
추가 case conversion은 JS helper의 version 밖이며, DB별 locale/collation 차이를 다시
만든다.

현재 adapter의 `includes` 의미를 SQL로 옮기는 구현은 다음 중 하나를 **동일 parity로
검증한 뒤** 선택해야 한다.

- D1/SQLite와 PostgreSQL의 substring function을 adapter dialect별로 사용한다.
  PostgreSQL의 `strpos(text, substring)`는 substring 위치 또는 0을 반환한다
  ([PostgreSQL string functions](https://www.postgresql.org/docs/17/functions-string.html#FUNCTIONS-STRING-OTHER)).
- 기존 provider 형태의 `LIKE` predicate를 사용한다. 이 경우 query parameter에만
  `\\ → \\\\`, `% → \\%`, `_ → \\_` 순서로 escape하고, `ESCAPE`를 명시한다.
  PostgreSQL `LIKE`의 `%`, `_`, escape 규칙은 [PostgreSQL pattern matching](https://www.postgresql.org/docs/17/functions-matching.html#FUNCTIONS-LIKE)과
  일치해야 한다.

`LIKE`를 택하면 D1의 SQLite 지원 범위와 case behavior를 target 환경에서 확인해야
한다. `search_text`가 이미 lower 결과라는 이유만으로 D1의 LIKE와 PostgreSQL의 LIKE/
ILIKE가 모든 Unicode 입력에서 동일하다고 추론하지 않는다. substring function을
택하더라도 `%`, `_`, `\\`는 특별한 wildcard가 아니라 parameter의 literal character다.

escape 표기는 문자 기준으로 해석한다. query의 U+005C 한 개는 pattern parameter에서
U+005C 두 개가 되고, `%`와 `_`는 각각 앞에 U+005C 한 개를 붙인다. SQL literal의
escape character 자체는 target dialect가 한 문자로 해석하는지 별도 fixture로 확인한다.

어느 구현이든 다음은 고정한다.

- SQL literal concatenation 대신 parameter binding
- 저장 text가 `LIKE` pattern으로 escape된 값이 아님
- wildcard 문자를 포함한 query는 literal substring으로 처리
- field별 검색이 아니라 다섯 field를 join한 하나의 text 검색
- empty query는 모든 public eligible row를 대상으로 함
- query normalization/version 불일치는 query를 변환해 맞추지 않고 명시적 incompatibility

## 7. ID order key와 DB 비교 계약

### 7.1 encoding

`createPublicCourseSearchIdOrderKey`의 기존 계약을 그대로 저장한다.

- ID는 non-empty string이고 well-formed Unicode여야 한다.
- ID를 NFKC, trim, case-fold, separator 처리하지 않는다.
- JavaScript UTF-16 code unit 하나를 4자리 uppercase hexadecimal ASCII로 바꾼다.
- key는 version prefix를 갖지 않는다. version은 별도 field와 reader gate에 둔다.
- `A → 0041`, `a → 0061`, `한 → D55C`, U+10000(`D800 DC00`) → `D800DC00`,
  U+E000 → `E000`처럼 key는 UTF-16 code-unit 순서를 보존한다.

key 길이는 `4 × ID의 UTF-16 code-unit 수`다. canonical ID에 유한 길이 제한이
승인되지 않았으므로 `VARCHAR(n)`의 n을 임의로 정하지 않는다. `TEXT`/`text`는 길이
제한을 숨기지 않지만, 구현 시 key length/index size와 최대 ID 길이를 별도로 측정한다.

helper는 NUL을 거부하지 않고 U+0000을 `0000`으로 encoding한다. 이는 **key encoder가
NUL을 표현한다는 pure 계약**일 뿐, canonical ID를 D1과 PostgreSQL에 동일하게 저장할
수 있다는 증거가 아니다. 특히 target database의 text encoding/driver가 NUL 또는
malformed surrogate를 어떻게 처리하는지 확인하기 전에는 해당 ID를 지원 범위로
선언하지 않는다. 저장 불가능한 값은 replacement character로 바꾸거나 ID를 재발급하지
않고 `UNSUPPORTED`/명시적 incompatibility로 넘긴다.

### 7.2 physical comparison

논리 key는 uppercase ASCII hex string이다. 권고하는 1차 physical proposal은 helper의
출력을 그대로 저장하는 것이다.

- D1: `TEXT COLLATE BINARY` 후보
- PostgreSQL: `text COLLATE "C"` 후보

SQLite 문서는 `BINARY`가 text encoding과 무관하게 `memcmp()`로 문자열을 비교하고,
BLOB도 byte-by-byte로 비교한다고 설명한다
([SQLite collating sequences](https://www.sqlite.org/datatype3.html#collating_sequences)).
PostgreSQL 17 문서는 `C`/`POSIX`가 자연어 순서가 아닌 byte value 순서를 사용한다고
설명한다
([PostgreSQL collation support](https://www.postgresql.org/docs/17/collation.html#COLLATION-MANAGING-COLLATION)).
그러나 이 문서의 제안만으로 D1의 실제 index/operator와 PostgreSQL의 실제
parameter/index plan이 parity를 보장한다고 주장하지 않는다. migration 전용 fixture에서
다음 두 가지를 모두 확인해야 한다.

1. equality와 `>` 비교가 uppercase ASCII byte sequence의 prefix/length semantics를 같게 계산
2. `ORDER BY`와 bound predicate가 같은 column collation/operator/index semantics를 사용

ASCII hex라 해도 모든 default collation에서 동일하다고 가정하지 않는다. 대안으로
ASCII hex의 UTF-8 bytes를 D1 `BLOB`/PostgreSQL `bytea`로 저장할 수 있지만, writer
parameter binding, ORM mapping, dump/import, cursor serialization이 추가로 바뀐다.
이는 physical type의 미결 사항이며 raw UTF-16 bytes로 바꾸는 것은 v1 key 계약을
조용히 바꾸는 것이므로 허용하지 않는다.

### 7.3 uniqueness, duplicate, prefix

well-formed JS string에 대한 code-unit encoding은 injective이므로 서로 다른 canonical
ID가 같은 유효 key를 가져서는 안 된다. 같은 key를 가진 두 course가 관찰되면
collation에 기대어 tie-break하지 않고 projection/source integrity 오류로 분류한다.
`course_id`를 임의의 raw text comparator로 뒤에 붙이는 방식은 JS order를 복구하지
않으므로 기본 해결책이 아니다.

비교는 key의 사전식 byte order다.

- 같은 prefix면 더 짧은 key가 먼저다.
- prefix가 아닌 첫 byte/code unit이 작은 key가 먼저다.
- key 값은 canonical ID identity와 함께 검증해야 한다.
- cursor에는 원래 ID를 보존할 수 있지만, `after` 비교에는 저장된 order key를 사용하고
  reader가 cursor ID로 key를 재계산해 parity를 검사한다.

## 8. 검색 query, order, keyset 경계

provider 전환 후 개념적인 query shape는 다음과 같다. SQL dialect별 placeholder와
boolean encoding은 기존 repository adapter 규칙에 맞춰 별도 구현한다.

```sql
SELECT c.id, c.course_group_id, c.code, c.slug, c.name, c.short_name,
       c.description, c.thumbnail_url, c.total_levels, c.passing_score,
       c.difficulty, c.active, c.published, c.display_order, c.is_sample,
       c.deleted_at, g.name AS group_name, g.active AS group_active,
       g.deleted_at AS group_deleted_at, g.display_order AS group_display_order,
       p.id_order_key
FROM courses AS c
JOIN course_groups AS g ON g.id = c.course_group_id
JOIN public_course_search_projections AS p ON p.course_id = c.id
WHERE c.active = 1
  AND c.published = 1
  AND c.deleted_at IS NULL
  AND g.active = 1
  AND g.deleted_at IS NULL
  AND p.projection_state = :ready
  AND p.search_normalizer_version = :normalizer_version
  AND p.search_projection_version = :projection_version
  AND p.id_order_key_version = :order_key_version
  AND p.search_text LIKE :escaped_contains_pattern ESCAPE '\'
ORDER BY g.display_order ASC, c.display_order ASC, p.id_order_key ASC
LIMIT :limit_plus_one;
```

위 SQL은 구현 파일이 아니라 경계 예시다. empty query의 predicate, path predicate,
`LIKE` 대신 substring function 선택, D1 placeholder, PostgreSQL boolean representation은
실제 provider 계약에서 확정해야 한다. `p.projection_state = READY` row만 읽되,
projection not-ready가 public eligible source를 조용히 누락시키지 않도록 다음 중
하나의 운영 gate를 구현 전에 정해야 한다.

- requested public scope의 non-ready source가 하나라도 있으면 명시적 provider unavailable
- rollout 전 모든 public-eligible source가 READY임을 확인하고, write path가 그 상태를 유지
- group fan-out 중에는 public reader activation을 막고 batch completion 후 재개

legacy raw provider로 조용히 fallback하거나 전체 table을 읽어 JS로 다시 정렬하는 방식은
기본 해결책이 아니다.

### 8.1 order tuple

유효 projection의 comparator는 다음과 같다.

```text
(group.display_order ASC,
 course.display_order ASC,
 projection.id_order_key ASC)
```

group/course display order는 canonical table에서 읽는다. projection에 복제하지 않는
것이 기본 권고다. 그래야 order/status의 stale copy가 public authority가 되지 않는다.
ID key는 projection에서 읽고, source ID와 재계산 검증한다.

`after = (g, d, k)`는 다음 논리식이어야 한다.

```text
g.display_order > :g
OR (g.display_order = :g AND c.display_order > :d)
OR (g.display_order = :g AND c.display_order = :d AND p.id_order_key > :k)
```

`ORDER BY`와 이 bound predicate는 동일한 column collation/operator를 사용해야 한다.
`NULL` key를 마지막으로 보내거나 raw ID 비교로 보정하지 않는다. 같은 유효 key가 두
identity에 나타나면 query result를 정상화하지 않고 integrity failure로 처리한다.

### 8.2 cursor version

현재 adapter의 cursor는 `public-course-search.cursor.v1`이고 raw `id`와
`groupDisplayOrder`/`displayOrder`를 포함한다
([cursor encoding](../../lib/services/public-course-search-adapter.ts#L430)).
projection key를 도입하는 reader는 comparison contract의 version binding과 함께
cursor v2를 별도 계약으로 승인해야 한다. 최소한 다음을 fingerprint/fields에 binding한다.

- comparison contract version
- normalizer version
- search projection version
- ID order key version
- path, normalized query, limit 등 기존 query identity
- cursor에 저장된 canonical ID와 order key의 consistency

v1 cursor를 v2 reader가 조용히 첫 페이지로 restart하지 않는다. 명시적
`INVALID_CURSOR`/incompatibility로 거부하고 client가 새 query를 시작하게 한다.
order-key 일관성은 cursor snapshot 보장이 아니다. concurrent insert, delete, group/order
변경 중 한 논리적 snapshot을 보장하려면 별도의 DB snapshot/token 설계가 필요하며
이번 계약은 이를 확정하지 않는다.

## 9. index와 비용 경계

별도 table에서 제안할 index 후보는 다음과 같다.

```text
PRIMARY KEY (course_id)
READY/version gate + id_order_key composite index 후보
```

구체적인 index column 순서는 provider의 실제 join/order plan과 데이터 분포를 보고
정해야 한다. 예를 들어 `projection_state, search_normalizer_version,
search_projection_version, id_order_key, course_id`는 ready/version gate와 key scan의
후보가 될 수 있지만, canonical group/course display order를 대신하지 않는다.

기존 schema의 `course_groups_listing_idx`, `courses_group_idx`,
`courses_public_listing_idx`도 참고 대상이지만, 이 index가 projection join과
`(group order, course order, key)` 전체 order를 자동으로 cover한다고 주장하지 않는다.
`%query%` arbitrary substring은 일반 B-tree prefix scan이 아니며, index가 존재한다는
이유만으로 query cost가 result limit에 의해 bounded라고 말하지 않는다. FTS5 또는
별도 search engine 도입은 이 계약의 범위를 넘는다.

후속 구현에서 실행할 비용 검증은 다음을 분리해 기록한다.

- D1/PostgreSQL `EXPLAIN` 또는 해당 플랫폼의 plan 관찰
- projection/order/index 크기
- empty query와 selective/non-selective query의 row examined/returned
- prefix, non-prefix, full-width/compatibility query 비용
- `LIMIT + 1`과 keyset bound가 실제로 unbounded materialization을 만들지 않는지

## 10. writer와 변경 전파 책임

projection writer는 canonical mutation의 일부로 설계하되, 모든 source writer가 같은
경계를 통과하는지 확인해야 한다. 현재 main에는 projection writer가 없으므로 아래
표의 “현재 구현”은 모두 `NOT_IMPLEMENTED`이며, 경로는 향후 변경 대상 inventory다.

| 경로 | 변경 가능한 source | 영향 범위 | projection 책임 | 원자성/실패 | 후속 검증 | 현재 구현 |
| --- | --- | --- | --- | --- | --- | --- |
| admin course route → `saveCourse` | name, shortName, description, difficulty, group, active/published, display order 등 | 해당 course의 text/path/key 또는 canonical order/status | course 관련 derived 값 재계산. group 변경이면 이전/새 group 영향도 확인 | 같은 DB transaction에서 source와 projection을 함께 commit하는 방안 권고. 계산 실패 시 source까지 rollback하거나 non-ready를 durable하게 남기고 public gate 유지 | source tuple 재읽기, digest/key/version parity, public predicate | [route](../../app/api/admin/courses/route.ts#L17), [saveCourse](../../db/repositories.ts#L827)에는 없음 |
| admin group route → `saveCourseGroup` | group name, active, display order | group의 모든 course search text/path; group order는 모든 child order tuple | child course 전부 fan-out 재계산. name 변경은 특히 누락 금지 | 작은 group은 transaction fan-out. 큰 group은 source update와 child `STALE` marking을 atomic으로 하고 rebuild 완료 전 reader gate | child count가 아닌 각 child digest/version/key 검증 | [route](../../app/api/admin/course-groups/route.ts#L13), [saveCourseGroup](../../db/repositories.ts#L798)에는 없음 |
| canonical independent professional group provisioner | group insert/identity check | 새 group에 이미 연결될 course와 group metadata | group row 성공 후 child가 있으면 projection 생성; group-only insert도 후속 readiness 대상 | provisioner의 transactional/non-transactional 분기와 projection transaction 경계를 별도 설계 | identity readback + projection row/readiness | [provisioner](../../lib/services/securium-canonical-independent-professional-course-group-provisioner.ts#L47) |
| canonical security professional learning group provisioner | group insert/identity check | 같은 group의 child course 전체 | group insert/update 결과와 child projection을 연결 | 현재 group provisioner의 transaction이 projection을 포함하지 않음. 실패 시 partial source/projection을 READY로 두지 않음 | group readback, all child current digest | [provisioner](../../lib/services/securium-canonical-security-professional-learning-group-provisioner.ts#L40) |
| ISRM parent-group runtime reconciler | canonical ISRM course insert/name metadata reconciliation, parent group dependency | ISRM course 및 parent group child set | insert/update/reconciled name이 projection input이면 즉시 재계산 또는 stale gate | 현재 statement 단위의 course/group 조건과 projection 원자성은 미구현 | exact identity/readback + projection parity | [reconciler](../../lib/services/securium-isrm-parent-group-runtime-name-reconciler.ts#L58) |
| secure-coding runtime registration | fixed course insert/identity readback | 등록 course 1건 | successful registration 후 projection을 만들거나 activation 전 gate에 포함 | [registration script](../../scripts/register-secure-coding-8h-runtime.mjs#L42)는 projection을 알지 못함. 실패를 legacy fallback으로 숨기지 않음 | exact registration row + projection validation | NOT_IMPLEMENTED |
| D1 seed | group/course seed rows | seed에 포함된 모든 course/group | seed/rebuild phase에서 projection을 함께 만들거나 seed 완료 후 backfill gate | [seed](../../db/seed.sql#L23)만으로 projection completeness를 주장하지 않음 | row-by-row digest/version/key check | NOT_IMPLEMENTED |
| PostgreSQL baseline/migration | schema/data migration이 수정하는 course/group | migration 대상 row와 child fan-out | migration이 source field을 바꾸면 affected projection을 stale/rebuild 대상으로 선언 | migration transaction과 batch rebuild 경계를 명시 | migration 후 stale census + parity | [0009 taxonomy cleanup](../../db/postgres/migrations/0009_security_certification_taxonomy_cleanup.sql#L131) 등은 projection 미지원 |
| 별도 SQL/ops/managed import | UNKNOWN | 전체 또는 import scope | import contract에 projection write 또는 post-import rebuild을 포함 | source/projection two-phase 상태와 retry 정의 필요 | source count가 아니라 digest/version census | 현재 inventory 완전성 UNKNOWN |

위 표에서 course status 변경은 search text를 바꾸지 않을 수 있지만 public eligibility를
바꾼다. 그러므로 projection을 READY로 유지하는 것과 public predicate를 승인하는 것은
별개다. provider는 active/published/deletedAt를 canonical table에서 계속 조회한다.
projection의 `course_public_path`가 source status를 복제하더라도 그 값으로 공개 접근을
승인하지 않는다.

### 10.1 groupName fan-out

group `name`은 모든 child의 다섯 field 중 `groupName`이고, `courseAudienceLabel`과
path classification에도 영향을 줄 수 있다. 따라서 `saveCourseGroup` 한 번을
수정했다고 모든 writer가 대응하는 것이 아니다.

1. group name 변경 transaction에서 child course identity 목록을 안정적으로 잡는다.
2. 각 child의 source tuple을 같은 transaction snapshot 또는 version check로 읽는다.
3. child projection을 재계산하고 동일 source digest/version으로 upsert한다.
4. fan-out 중 오류가 있으면 전체 transaction rollback 또는 affected child를 `STALE`/
   `FAILED`로 남기고 public reader gate를 유지한다.
5. 완료 건수만으로 성공을 선언하지 말고 child별 expected/current digest를 대조한다.

child 수가 커서 한 transaction이 부적절하면 batch checkpoint를 허용할 수 있지만,
그 동안 old projection을 정상 검색에 섞거나 new group name을 일부 child에만 공개하는
정책은 별도로 승인해야 한다. 기본 계약은 non-ready scope를 명시적으로 차단한다.

## 11. 기존 데이터와 전환 계약

### 11.1 상태 탐지

| 관찰 상태 | 탐지 | 전환 전 의미 |
| --- | --- | --- |
| projection 없음 | `course_id` row 없음 | `MISSING`; provider 성공 결과에 포함시키지 않고 readiness gap으로 집계 |
| 일부 field만 생성 | required field NULL, state/versions 불완전 | `BUILDING` 또는 `FAILED`; READY 아님 |
| 구버전 | any version != reader expected | old projection; 재계산 전 사용 금지 |
| source 변경 후 stale | source digest 불일치 또는 source marker 불일치 | `STALE`; marker equality만으로 통과시키지 않음 |
| 생성 실패 | `FAILED`와 stable failure code 또는 write/readback 오류 | retry/repair 대상; 조용한 legacy fallback 금지 |
| 지원하지 않는 입력 | malformed surrogate, unsupported DB identity/encoding 등 | `UNSUPPORTED`; replacement/reissue 금지 |
| 현재 검증 완료 | state READY, required fields non-null, 모든 version exact, digest/key 재계산 일치 | provider candidate 가능. public predicate는 여전히 canonical query가 확인 |

기존 row 존재, 현재 version 값, 완료 건수, source timestamp만으로 정합성을 확인하지
않는다. validator는 canonical row를 재읽어 helper output, key, source digest, versions,
FK 및 state를 함께 확인한다.

### 11.2 권고 rollout 순서

다음 단계는 계획이며 이번 목표에서 실행하지 않는다.

1. pure contract/vector와 display-helper/path version 확정
2. additive projection schema와 collation/index 설계 승인
3. 모든 course/group writer, seed/import, provisioner/reconciler의 dual-write 준비
4. 기존 data를 primary-key keyset/checkpoint 방식으로 backfill
5. source 재계산 대조로 누락, stale, duplicate key, wrong version 검증
6. provider/adapter/cursor를 동시에 전환하고 old cursor 거부 규칙 배포
7. D1/PostgreSQL parity, plan, index size, result/cost 검증
8. rollout/rollback 조건 확인 후에만 reader activation

schema만 먼저 추가하거나 projection table row를 채우는 것은 public search 동작을
활성화한 것이 아니다.

### 11.3 concurrent backfill

backfill worker는 다음을 지켜야 한다.

- `course_id` keyset과 durable checkpoint를 사용하고 전체 목록을 memory에 적재하지 않는다.
- source를 읽은 시점의 course/group identity와 source marker/digest를 보관한다.
- projection upsert 직전에 source를 다시 읽거나 source version을 조건에 포함한다.
- 재읽은 source가 달라지면 old 계산 결과를 commit하지 않고 retry/stale로 분류한다.
- upsert 후 readback으로 version, digest, key exact equality를 확인한다.
- 같은 source/version 입력은 idempotent하게 같은 값을 만든다.
- 완료 건수보다 expected/current digest census와 누락/duplicate/error 목록을 기준으로
  완료를 선언한다.

group fan-out과 backfill이 경쟁하면 마지막 writer가 old value를 되살리지 않도록 source
version compare-and-set 또는 transaction lock 중 하나를 구현 전에 선택해야 한다. 지금은
이 선택이 미결이다. 실제 backfill, 운영 복구, DB 실행은 이 문서에서 수행하지 않는다.

위의 transaction 권고는 D1과 PostgreSQL이 동일한 transaction-scoped readback이나
격리 보장을 이미 제공한다는 뜻이 아니다. 현재 D1 provider는 statement batch를
노출하지만 transaction-scoped readback을 거부하고
([D1 provider](../../db/provider/d1-database-provider.ts#L49)), PostgreSQL provider는
callback transaction 경로를 별도로 가진다
([PostgreSQL provider](../../db/provider/postgres-database-provider.ts#L87)). 따라서
source update, child fan-out, projection readback의 원자성을 target별로 입증하기
전에는 “D1/PostgreSQL 공통 transaction 보장”으로 표현하지 않는다.

### 11.4 cutover와 rollback

cutover 전 필수 gate:

- public-eligible scope의 `MISSING`, non-current version, `STALE`, `FAILED`, `UNSUPPORTED`가
  승인된 zero/exception threshold를 충족
- 각 READY row의 digest/key/source identity readback 통과
- D1/PostgreSQL comparator fixture가 같은 order와 cursor boundary를 생성
- 모든 writer가 dual-write/retry/readback 책임을 가짐
- current public predicate가 projection 값과 독립적으로 보존됨

rollback은 canonical source rollback이 아니라 reader/writer compatibility rollback을
분리한다. provider가 v1 raw path로 돌아가야 한다면 raw comparator mismatch가 이미
관찰됐다는 사실을 숨기지 말고 명시적 degradation/hold로 승인해야 한다. v2 cursor를
v1 reader가 해석할 수 없으면 cursor를 첫 페이지로 재시작하지 않고 incompatibility로
응답한다. projection table을 즉시 삭제하는 rollback은 orphan/복구 가능성을 훼손하므로
별도 승인 없이는 하지 않는다.

rollback 전환표에는 최소한 구/new writer의 동시 허용 범위, single-row projection의
구/new version compatibility, provider/adapter comparator, 이미 발행된 v1/v2 cursor를
각각 적어야 한다. 단일 current row를 덮어쓴 뒤 구 projection을 되살릴 수 있다고
가정하지 않으며, 구 cursor를 거부하는 동작과 cursor 없이 첫 페이지를 새로 시작하는
동작을 같은 복구로 취급하지 않는다.

## 12. 후속 검증 수용 기준

아래는 필요한 검증이지 이번 목표에서 실행한 결과가 아니다. 현재 fixture에서 literal
wildcard와 일부 Unicode case가 통과했다는 기존 관찰은 future DB projection parity를
대체하지 않는다.

### 12.1 pure/vector

- NFKC: full-width, compatibility character, composed/decomposed, Hangul 조합
- case: ASCII, 한글, `ko-KR` locale edge, empty/outer/internal whitespace
- five-field order, one-space join, empty middle field, cross-field substring
- query에만 UTF-8 48-byte limit; stored text에는 limit 없음
- malformed surrogate와 non-string rejection
- literal `%`, `_`, `\\` query 및 SQL pattern escape
- publicDescription fallback과 audience label rule version

### 12.2 order/key/cursor

- ASCII, 한글, BMP, non-BMP, prefix ID
- `A`, `a`, `한`, U+10000, U+E000의 JS expected order
- UTF-16 code-unit key exact equality, uppercase 4-hex format, key length
- empty ID, malformed surrogate, NUL pure helper와 DB boundary 분리
- 동일 key/identity collision 검출
- prefix와 length comparator
- D1/PostgreSQL `ORDER BY`와 `after`가 같은 comparator인지
- page boundary에서 누락/중복 없음
- version 혼용 cursor rejection 및 cursor key recomputation

### 12.3 storage/writer/backfill

- course name/shortName/description/difficulty 변경 후 해당 row 갱신
- group name 변경 후 모든 child projection 갱신
- group/course insert, soft delete/restore, publish/unpublish에서 canonical predicate 보존
- projection 없음/partial/old/stale/failed/unsupported 검출
- writer transaction rollback, durable failure, retry/readback
- concurrent backfill 중 source update 누락 방지
- source digest/marker mismatch가 row/version 존재만으로 숨겨지지 않음

### 12.4 database/operations

- D1과 PostgreSQL의 declared collation, parameter type, equality/greater-than semantics
- TEXT와 BLOB/bytea 후보의 dump/import/ORM/driver parity
- index size, join/order plan, substring scan, returned/examined rows, `LIMIT + 1` 비용
- public predicate가 projection READY state와 독립적으로 재검사됨
- stale projection을 조용한 omission 또는 legacy fallback으로 숨기지 않음
- rollback 시 writer와 cursor version compatibility

각 검증은 `PASS`, `FAIL`, `NOT_RUN`, `UNKNOWN`을 구분한다. isolated fixture 성공은 실제
운영 DB의 projection/backfill/provider 동작이나 공개 정책 승인을 뜻하지 않는다.

## 13. 미결 사항

1. #193 helper/comparison contract를 main에 merge할지와 merge 후 exact version constants
2. `id_order_key`의 TEXT+명시 collation과 BLOB/bytea 중 physical type
3. D1의 target-supported `COLLATE BINARY`, PostgreSQL `COLLATE "C"`, index/operator의
   실제 parity
4. LIKE+ESCAPE와 D1 `instr`/PostgreSQL `strpos` 중 adapter SQL implementation
5. `source_digest` canonical serialization, digest encoding, display-helper/path rule versions
6. normalizer runtime/ICU/Unicode data 식별자와 runtime upgrade policy
7. `course_public_path`를 같은 projection row에 저장할지, 별도 read model로 분리할지
8. projection non-ready source를 provider unavailable로 표기하는 정확한 error/status contract
9. group fan-out의 transaction size, queue/checkpoint, compare-and-set/lock 방식
10. source writer inventory에 포함되지 않은 managed import/SQL/운영 작업 경로
11. canonical ID의 NUL 및 malformed Unicode를 각 target DB/driver가 지원하는 범위
12. order 변경 중 pagination의 snapshot guarantee 필요 여부

결정되지 않은 항목을 default collation, 임의 coercion, 조용한 첫 페이지 restart,
자동 재검색/fallback으로 해결하지 않는다.

## 14. 이 문서의 상태

```text
STORAGE_SCHEMA_IMPLEMENTATION: NOT_STARTED
WRITER_INTEGRATION: NOT_IMPLEMENTED
DATABASE_PARITY_VALIDATION_THIS_GOAL: NOT_RUN
HISTORICAL_BACKFILL: NOT_EXECUTED
CURSOR_V2_ACTIVATION: NOT_ENABLED
PUBLIC_TOOL_ACTIVATION: NOT_ENABLED
MANAGED_RUNTIME_VALIDATION: NOT_RUN
CONCURRENT_PAGINATION_SNAPSHOT_GUARANTEE: NOT_ESTABLISHED
CANONICAL_MUTATION: NONE
REMOTE_MUTATION: NONE
POLICY_INTENT: INTENT_NOT_ESTABLISHED
AUTHENTICATION_AND_ENROLLMENT_POLICY: UNCHANGED
```

이 문서는 저장 계약과 후속 구현의 acceptance boundary를 제안할 뿐이다. public search
정책 적용, schema/migration, projection writer, provider/cursor 활성화는 후속 승인과
별도 작업이다.
