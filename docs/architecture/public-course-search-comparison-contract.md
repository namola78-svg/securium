# Public course search comparison contract

상태: 설계와 DB-independent pure primitive/vector 구현 완료. 이번 변경은
provider, schema, migration, writer 및 cursor v2 전환을 구현하지 않으며, adapter에는
query well-formed 입력 검증만 최소 보완했다.

이 문서는 `feat/public-course-search-provider`의 공개 course search에 대해 D1,
PostgreSQL, provider, adapter가 공유해야 할 검색·정렬·cursor 의미를 결정하기 위한
설계안이다. 권고안은 구현, migration, backfill 또는 공개 활성화의 승인·완료를
의미하지 않는다.

revision context: 작업 시작 시점의 HEAD는 `147502743b114c5416cec5e1a97f5c7f4f286bfb`이며,
candidate `99ae1237dce4ba79e60570b7e128f805aaa4f059`의 descendant다. 이 목표에서
최신 `origin/main`을 한 번 fetch한 뒤 관찰된 SHA는
`f8ecdc0fd7bbf8ba9068e45784d905f0db566d72`다. 사용자 제공 마지막 관찰값
`ed3c443cbf2c875c4f0f5b995a0932ce9adb8033` 이후 main에는 D1 standalone seed
result contract 문서와 `mockExamAttempts.composition_snapshot_json` schema
column이 추가됐다. 후자는 public course search 관련 drift가 아니며, provider,
adapter, 반례 test 파일에는 관련 차이가 없었다. 이 branch에는 자동 merge/rebase를
적용하지 않았다.

## 1. 결정 요약

권고안은 **D: B를 기반으로 한 최소 C**이다.

- 검색의 사용자 의미는 현재 adapter의 `NFKC → trim →
  `toLocaleLowerCase("ko-KR")`` 순서를 유지한다.
- 원문 표시 값은 보존하고, 같은 알고리즘과 명시된 버전으로 만든 파생 검색
  projection을 저장한다.
- ID 정렬은 DB의 자연어 collation에 맡기지 않는다. 현재 adapter가 의도한
  JavaScript UTF-16 code-unit 순서를 보존하는 versioned order key를 만들고,
  두 DB에서 그 key의 bytewise 비교를 사용한다. 구현 시 권고하는 표현은 각
  UTF-16 code unit을 고정 폭 대문자 hexadecimal으로 이어 붙이는 방식이다.
- `ORDER BY`와 `after` predicate는 같은 `(groupDisplayOrder,
  displayOrder, idOrderKey)` tuple과 같은 비교 의미를 사용한다.
- 검색·정렬·cursor 버전을 함께 올리고, 이전 cursor를 첫 페이지로 조용히
  해석하지 않는다.

이 선택은 현재 검색 의미를 가능한 한 보존하면서 DB collation 차이를 제거하는
방향이다. 다만 파생 column, index, 모든 확인 가능한 write path, 기존 데이터
backfill이 필요하므로 이번 목표의 허용 범위에서는 구현하지 않는다.

현재 코드만으로 provider-only 해결이 원천적으로 불가능하다고 결론내리지는
않는다. 정확히 같은 정규화 함수와 비교 key를 양 DB가 제공하고 그 동작을
검증한다면 다른 해법도 가능하다. 그러나 현재 구현에는 그 공통 DB 계약이
없고, provider의 raw `lower`/`ILIKE` 및 raw ID 정렬은 이미 반례에서
실패했으므로, **현재 허용 범위에서 portable parity를 확립할 수 없다**고
판단한다.

## 2. 현재 구현에서 확인한 의미

근거가 된 tracked source는 [public-course-search-adapter.ts](../../lib/services/public-course-search-adapter.ts),
[course-display.ts](../../lib/course-display.ts),
[public-copy.ts](../../lib/public-copy.ts)이다. 원본 provider branch의
`db/public-course-search-provider.ts`는 과거 parity 반례의 source로만 참조하며,
이 분리 PR에는 포함하지 않는다.

### 2.1 Query와 저장 projection

현재 adapter는 query에 다음 순서를 적용한다.

```text
NFKC normalize
→ trim
→ toLocaleLowerCase("ko-KR")
→ UTF-8 byte length <= 48 확인
```

adapter request에서 `query`가 생략되거나 `undefined`이면 빈 문자열로
기본화하고, `null` 및 다른 non-string은 `INVALID_INPUT`으로 거부한다.
이번 pure query helper도 이 한정된 request 경계에서는 `undefined → ""`를
재현한다. 저장 text helper는 source projection 누락을 숨기지 않기 위해
undefined를 허용하지 않는다.

NFKC와 case conversion은 같은 연산이 아니다. NFKC는 compatibility
decomposition과 canonical composition을 포함하고, case conversion은 별도의
locale-sensitive Unicode 처리다. 두 단계를 합친 것으로 취급하지 않는다.

adapter의 검색 대상은 다음을 하나의 text로 조립한 값이다.

```text
course.name
course.shortName
group.name
publicCopy(course.description)
courseAudienceLabel(course)
```

현재 adapter는 이 조립 결과에 NFKC와 `toLocaleLowerCase("ko-KR")`를 적용한
뒤 `includes(normalizedQuery)`를 사용한다. 저장 원문을 덮어쓰거나 별도의
정규화 검색 column을 읽지는 않는다.

현재 adapter의 assembled haystack에는 마지막 `trim` 호출이 없다. 반면 이번
v2 derived projection primitive는 query와 저장 projection의 동일한 normalizer
계약을 위해 결합 후 `trim`한다. query는 이미 앞뒤 whitespace를 trim하므로,
정상적인 non-empty query의 eligible match 의미에서 바깥 whitespace를
제거하는 차이는 관찰되지 않았지만, 두 문자열의 raw representation이
byte-for-byte 같다는 주장은 하지 않는다. v2 저장 projection의 정확한
표현은 이 문서의 제안이며 현재 adapter의 기존 저장 field 동작을 소급해
바꾸지 않는다.

원본 provider branch의 현재 provider는 같은 논리 필드를 SQL 식으로 구성하지만 raw 저장 text에
D1의 `lower(...) LIKE lower(?)` 또는 PostgreSQL의 `ILIKE ?`를 적용한다.
NFKC를 SQL에서 적용한다는 계약은 없으며, 두 provider가 adapter의 locale
case mapping과 같은 결과를 낸다는 근거도 없다. `%`, `_`, `\`는 provider가
LIKE pattern용으로 escape하고 escape clause를 사용한다. 이 literal 검색
동작은 반례에서 유지됐다.

query가 빈 문자열이면 query predicate는 적용되지 않는다. 결과 row는
course/group의 active, published, deleted 상태를 포함한 public eligibility를
만족해야 하며, course가 group에 조인되어야 한다. provider가 전체 목록을
읽어 JavaScript로 다시 필터하거나 정렬하는 것은 현재 bounded provider
계약이 아니다.

### 2.2 분류와 `/courses` 표시 의미

certification/professional path는 검색 정규화와 별개다.

- adapter의 certification 판단은 표시용 `courseTypeLabel`의 keyword 판단
  또는 group 이름의 `국가기술자격` 포함 규칙을 사용한다.
- professional은 그 complement다.
- provider는 대응 SQL pattern으로 이를 재현한다.

따라서 검색 text에 NFKC를 도입한다고 분류 값까지 자동으로 NFKC 처리하는
것은 계약 변경이다. 분류 projection을 변경하려면 별도의 버전과 fixture가
필요하다.

`/courses`의 일반 표시 목록은 기존 catalog/display helper와 route의 표시
목적 의미를 따른다. 내부 public search adapter는 server-owned repository를
통해 bounded page, path, query, cursor를 검증하는 별도 경계다. 두 경계를
일치시킬 수는 있지만, 현재 focused test가 통과했다는 이유로 두 API의 전체
결과·정렬·검색 의미가 이미 동일하다고 확대하지 않는다.

### 2.3 정렬, after, 잘못된 projection

이번 정합화에서 `isSupportedPublicCourseSearchId`를 pure comparison module의
공유 predicate로 두고, adapter의 source record validation, position 생성,
cursor decode가 함께 사용한다. 따라서 source ID와 cursor after-ID는 모두
빈 문자열·non-string·unpaired surrogate를 동일한 입력 경계에서 거부한다.
기존 오류 경계는 유지한다: source row는 `INVALID_SOURCE`, cursor payload는
`INVALID_CURSOR`다. 유효한 BMP/non-BMP pair와 NUL은 이 JavaScript 경계에서
그대로 허용한다.

현재 adapter comparator는 다음과 같다.

```text
(groupDisplayOrder ASC, displayOrder ASC, id by JavaScript `<`)
```

마지막 `id` 비교는 locale sort가 아니라 JavaScript string relational
comparison이다. JavaScript 문자열은 UTF-16으로 표현되므로, 현재 의도된
정렬은 UTF-16 code-unit 사전식 정렬이다.

provider SQL의 `after`와 `ORDER BY`는 모두 다음 raw tuple을 사용한다.

```text
group.display_order ASC,
course.display_order ASC,
course.id ASC
```

after 조건은 group order가 더 크거나, 앞의 값들이 같을 때 course order가
더 크거나, 둘 다 같을 때 `course.id > after.id`인 row다. SQL comparator와
adapter comparator가 ID에서 같다는 보장이 없어 현재 cursor page 경계가
깨진다.

NULL 또는 잘못된 order projection은 유효한 정렬 위치로 대체하지 않는다.
adapter는 safe integer가 아닌 order와 빈 문자열/non-string ID를
`INVALID_SOURCE`로 거부한다. provider mapping도 malformed source를
`INVALID_SOURCE`로 처리한다. 새 derived projection이 없다는 이유로 row를
조용히 제외하거나 unbounded fallback을 사용해서는 안 된다.

### 2.4 현재 cursor

현재 adapter의 fingerprint는 contract version, order version, path, normalized
query를 JSON으로 만들어 SHA-256 digest한 값이다. cursor에는 cursor type/version,
fingerprint, limit, group/display order, ID, integrity digest가 들어가며,
decode 시 query/path/limit/version mismatch를 `INVALID_CURSOR`로 거부한다.

현재 cursor version은 normalizer version 또는 derived order-key version을
별도 필드로 표현하지 않는다. integrity digest도 secret-backed signature,
authorization proof, publication decision, snapshot proof가 아니다. cursor는
페이지 위치와 요청 의미가 일치하는지 확인하는 opaque lookup position일 뿐이다.

## 3. 고정된 반례와 그 의미

이번 목표에서는 기존 corrected disposable probe와 readiness 실패를 재실행하지
않는다. 아래 결과를 결정적 evidence로 사용한다. fixture는 실제 learner나
Evidence 데이터가 아닌 합성 row였다.

### 3.1 Unicode ID ordering

모든 row는 같은 `groupDisplayOrder`와 `displayOrder`를 가졌다. ID는
`unicode-order-` prefix 뒤에 다음 한 문자를 붙였다.

| suffix | code point |
| --- | --- |
| `A` | `U+0041` |
| `a` | `U+0061` |
| `한` | `U+D55C` |
| `𐀀` | `U+10000` (UTF-16 `D800 DC00`) |
| `` | `U+E000` |

독립적으로 adapter comparator로 계산한 기대 순서는 다음과 같다.

```text
unicode-order-A
unicode-order-a
unicode-order-한
unicode-order-𐀀
unicode-order-
```

관찰된 실제 순서는 다음과 달랐다.

| 실행 대상 | 실제 순서 | 판정 |
| --- | --- | --- |
| JavaScript adapter comparator | `A → a → 한 → U+10000 → U+E000` | 기대 기준 |
| D1 provider | `A → a → 한 → U+E000 → U+10000` | DB/adapter 불일치 |
| PostgreSQL 17.6, `en_US.utf8` | `한 → U+E000 → a → A → U+10000` | DB/adapter 불일치 |

`limit=1`로 실제 adapter cursor를 따라간 경우 D1은 `A`, `a`, `한`까지
성공한 뒤 다음 page에서 `INVALID_SOURCE`를 냈다. PostgreSQL은 첫 page의
`한` 다음 page에서 같은 오류를 냈다. 관찰된 성공 page들에서는 중복은
없었지만, 전체 cursor completeness는 확립되지 않았다. 즉 단일 page의 row가
맞아 보이는 것과 후속 page에서 순서·cursor가 완전한 것은 다른 주장이다.

이 관찰은 해당 D1 local binding 및 PostgreSQL 17.6/`en_US.utf8` 환경의
결과다. 모든 D1 runtime, 모든 PostgreSQL collation, 모든 Unicode 문자열의
보편 결과를 뜻하지 않는다.

### 3.2 NFKC/search

각 query는 adapter가 적용하는 기대 eligible set과 비교했다.

| case | 저장 값 / code point 요약 | query / code point 요약 | 기대 | D1 | PostgreSQL |
| --- | --- | --- | --- | --- | --- |
| 전각 | `Ｆｕｌｌｗｉｄｔｈ` (`U+FF26 U+FF55 ...`) | `ＦＵＬＬＷＩＤＴＨ` (`U+FF26 U+FF35 ...`) | row eligible | EMPTY | EMPTY |
| 분해형 | `Cafe` + `U+0301` | `CAFÉ` (`U+00C9`) | row eligible | EMPTY | EMPTY |
| 호환 문자 | `①Compatibility` (`U+2460 ...`) | full-width `１ＣＯＭＰＡＴＩＢＩＬＩＴＹ` | row eligible | EMPTY | EMPTY |
| literal | `Literal 100%_\\value` | `100%_\\value` | `unicode-search-literals` | OK | OK |

앞의 세 case는 저장 text와 query에 같은 NFKC projection을 적용해야 하는데
현재 provider가 raw text/DB case operator를 사용해서 누락됐다. literal
case는 wildcard escaping의 반례가 아니며, NFKC parity가 확립됐다는 뜻도
아니다.

### 3.3 재현 환경과 검증 한계

- probe Node: `24.19.0`, ICU `78.3`, Unicode `17.0`.
- local D1 helper는 Miniflare lockfile `4.20260515.0` 계열이었다.
- D1 binding의 version/encoding/collation introspection은 binding의 허용
  범위 밖이라 거부됐다. 따라서 D1의 숨은 SQLite version/collation을
  추정하지 않는다.
- PostgreSQL: `17.6`, Debian package `17.6-2.pgdg13+1`, encoding `UTF8`,
  collation/ctype `en_US.utf8`.
- 기존 기준 focused test는 `14/14 PASS`였다. 변경 후 focused 실행은
  PostgreSQL readiness timeout으로 test suite 진입 전에 종료됐고, 별도
  corrected disposable probe로 위 반례를 수집했다. 최종 전체 suite PASS는
  미확정이다.

Unicode 정규화는 [Unicode UAX #15](https://www.unicode.org/reports/tr15/)의
정의에 따르고, ECMAScript의 문자열·`normalize`·locale case 동작은
[ECMAScript text processing](https://tc39.es/ecma262/2024/multipage/text-processing.html)
및 [Node.js ICU 문서](https://nodejs.org/api/intl.html)의 runtime/data
조건을 받는다. SQLite의 기본 `BINARY`와 제한적인 `NOCASE`는
[SQLite collating sequences](https://www.sqlite.org/datatype3.html#collating_sequences)에
설명되어 있다. D1은 SQLite 기반이지만 함수·extension·PRAGMA 지원이
제한된다는 점은 [D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)의
지원 범위를 따른다. PostgreSQL의 collation이 comparison, `ORDER BY`,
`lower`, pattern operator에 영향을 주고 ICU 동작이 ICU version에 의존할
수 있다는 점은 [PostgreSQL 17 collation](https://www.postgresql.org/docs/17/collation.html)과
[pattern matching](https://www.postgresql.org/docs/17/functions-matching.html)을
근거로 한다.

이 공식 문서들은 특정 production D1 binding의 runtime/collation 또는
현재 schema에서 두 엔진의 Unicode 결과가 동일하다는 것을 보장하지 않는다.
그 부분은 UNKNOWN으로 남긴다.

## 4. 대안 비교

| 대안 | 검색 의미 | D1/PostgreSQL 및 Unicode 전제 | 정렬·cursor | 비용/반환량 | schema·기존 데이터 | write/cursor/장애·활성화 |
| --- | --- | --- | --- | --- | --- | --- |
| **A. provider에서 현재 의미 재현** | 정확한 공통 함수가 입증되면 보존. 현재 raw SQL은 보존하지 못함. | DB 함수, collation, locale 동등성을 별도로 입증해야 한다. NFKC SQL 함수나 UDF/extension은 가정할 수 없다. Unicode/ICU/locale drift에 취약. | 같은 ID comparator와 after 식을 provider마다 재현해야 한다. 현재 raw `id`는 실패. | bounded SQL은 유지할 수 있으나 `%query%` scan과 collation sort 비용은 별개로 증가할 수 있다. | schema/backfill 없이 가능하다는 보장은 없음. 기존 row는 건드리지 않음. | writer 부담은 낮지만 엔진별 장애 탐지가 어렵고 rollback 기준이 약하다. 기존 cursor 의미가 바뀌면 version을 올려야 한다. 두 엔진 matrix와 다중 page 검증 없이는 활성화 불가. |
| **B. 저장 normalized search field + deterministic order key** | 원문은 보존하고 파생 field로 현재 검색 의미를 보존. | write-time 공통 구현과 pinned version만 DB에 저장한다. DB는 단순 equality/bytewise/range 비교만 담당. | 저장된 key를 `ORDER BY`와 after 양쪽에 공통 사용하면 동등성 확보 가능. | bounded range/LIKE query를 유지하지만 derived column/index 저장·sort 비용이 추가된다. 반환 limit이 query cost 상한은 아니다. | column/index와 기존 row 생성·검증/backfill 필요. | 모든 writer와 group fan-out 갱신이 필요. version/null 검사, dual-write, rollback 가능. 기존 cursor는 재사용하지 않고 version 전환. |
| **C. 공통 비교 의미를 새로 정의하고 adapter/provider/cursor 동시 변경** | 현재 JavaScript ID 순서나 검색 case semantics가 바뀔 수 있음. 명시적인 API 변경. | 예를 들어 bytewise canonical key를 정의하고 두 DB의 명시적 binary comparison만 사용. DB-specific Unicode 함수는 전제하지 않음. | 새 comparator와 SQL after를 함께 바꾸므로 일관성은 명확하지만 breaking change. | provider bounded read는 가능하나 새 key 계산·sort 비용을 측정해야 한다. | key 저장을 택하면 schema/backfill 필요. 저장하지 않으면 A의 구현·검증 위험이 남음. | adapter/provider/cursor와 모든 소비자를 함께 배포. 새 cursor version 필수. 기존 결과 diff, 장애 관측, rollback/restart을 먼저 검증해야 함. |
| **D. B + 최소 C (권고)** | NFKC/query case 의미는 유지하고, ID 비교 표현과 version을 명시한다. 분류는 별도 version으로 관리. | pinned write-time normalizer와 portable order key를 사용한다. D1 `BINARY`/PostgreSQL `C` 또는 동등한 bytewise 저장 type은 구현 전 공식 지원·실행 matrix로 확인해야 하며 미확인 전제를 두지 않는다. | `order tuple → order key → 동일 after`를 하나의 계약으로 삼는다. provider SQL과 adapter comparator가 key를 공유한다. | bounded query를 유지하고 derived field/index 비용을 별도 측정한다. 전체 JS 재정렬은 채택하지 않는다. | schema/index, backfill, null/version 관리가 필요하다. 원문·ID identity는 변경하지 않는다. | writer inventory와 dual-write가 필요하다. 새 contract/order/cursor version으로 전환하고 구 cursor는 명시 거부한다. D1/PG, 다중 page, stale projection, rollback 검증 뒤에만 활성화한다. |

### 4.1 A를 현재 해결안으로 채택하지 않는 이유

provider가 query마다 JS로 정규화하거나 전체 row를 가져와 정렬하면 bounded
provider 요구를 위반하고, raw SQL을 유지하면 반례가 남는다. D1과 PostgreSQL에
같은 NFKC 함수·case mapping·ID collation이 있다는 것도 확인되지 않았다.
따라서 A는 가능한 미래 조사 항목이지 이번 contract의 최소 해결안이 아니다.

### 4.2 B와 D가 schema/write 변경을 요구하는 이유

현재 `id`는 text primary key이고 명시적인 공통 collation/order key가 없다.
현재 schema의 course/group definition은
[db/schema.ts](../../db/schema.ts)에 있다. 기존 write helper는
[repositories.ts](../../db/repositories.ts)의 `saveCourseGroup`과 `saveCourse`
이며, 관리자 route는 [course route](../../app/api/admin/courses/route.ts)와
[course-group route](../../app/api/admin/course-groups/route.ts)를 거친다.
이 구조에서 provider만 바꾸어 write-time derived value의 완전성과
version을 보장할 수 없다.

## 5. 권고 comparison contract v2

아래는 구현 전에 승인되어야 할 명세 초안이다. 이름의 `v2`는 예시이며,
실제 상수·column 이름은 구현 단계에서 결정한다.

### 5.1 Normalizer

검색 query와 저장 `search_text_v2`에 동일한 함수 `N_v2`를 적용한다.

```text
N_v2(s) = toLocaleLowerCase(trim(normalize(s, "NFKC")), "ko-KR")
```

query에는 이 결과의 UTF-8 byte length가 48 이하인지 확인한다. 저장 값에는
query의 48-byte 제한을 적용하지 않는다. 두 단계는 다음과 같이 구분한다.

1. NFKC: compatibility/canonical normalization.
2. trim: query 입력 경계와 저장 projection 경계의 whitespace 정책.
3. Korean-locale lower case: case mapping.

현재 adapter의 검색 의미를 보존하기 위해 위 순서를 baseline으로 권고한다.
다만 `ko-KR` case mapping을 write runtime에 고정할지, locale-independent
default lower로 바꿀지는 남은 제품 결정이다. 바꿀 경우 `normalizerVersion`,
query fingerprint, cursor version을 함께 바꾼다. Node/ICU/Unicode data version은
생성 artifact metadata에 기록하고, 서로 다른 normalizer version의 row를
같은 provider read에 섞지 않는다.

### 5.1.1 이번 commit에서 구현한 pure primitive

구현은 [public-course-search-comparison.ts](../../lib/services/public-course-search-comparison.ts)에
있고, 고정 벡터는 [public-course-search-comparison.test.ts](../../tests/public-course-search-comparison.test.ts)에
있다.

- `normalizePublicCourseSearchText(value)`는 string 및 well-formed Unicode
  scalar value만 받아 `NFKC → trim → toLocaleLowerCase("ko-KR")`를 적용한다.
  암묵적 string coercion은 하지 않는다.
- `normalizePublicCourseSearchQuery(value)`는 `undefined`를 빈 query로
  처리하고, 그 밖의 input은 well-formed Unicode인지 먼저 확인한 뒤 같은
  정규화 결과에 대해서만 UTF-8 byte length `<= 48`을 검사한다. 저장
  projection에는 이 query limit을 적용하지 않는다.
- `buildPublicCourseSearchProjection(value)`는 `name`, `shortName`,
  `groupName`, 이미 `publicCopy`가 적용된 `publicDescription`, 이미
  `courseAudienceLabel`이 적용된 `audienceLabel`을 이 순서로 ASCII space
  하나로 결합한 뒤 동일 normalizer를 적용한다. 다섯 property는 runtime에서
  모두 string이어야 하며 누락된 field는 빈 문자열로 대체하지 않는다.
  추가 property는 무시한다. 따라서 임의의 필드 결합이나 필드별 별도
  normalization을 만들지 않는다.
- `createPublicCourseSearchIdOrderKey(value)`는 빈 ID와 unpaired surrogate를
  거부하고, 각 UTF-16 code unit을 4자리 대문자 hexadecimal ASCII로 이어
  붙인다. NUL은 순수 함수 범위에서 `0000`으로 지원한다.
- key에는 version prefix를 넣지 않는다. `PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION`
  상수로 version을 별도 전달하고, 서로 다른 version key를 비교하는 helper는
  제공하지 않는다. version gate는 후속 provider/adapter 경계의 책임이다.
- 이 primitive는 SQL LIKE escaping, DB collation, cursor, identity,
  authorization을 구현하거나 증명하지 않는다. 특히 NUL 및 Unicode 저장
  가능성은 이 순수 함수의 지원 범위를 넘어서는 저장 경계의 결정이다.

실제 adapter source validation은 추가 metadata field를 허용하지만, 위 다섯
검색 source field가 누락되면 `INVALID_SOURCE`로 중단한다. pure projection의
추가 property 무시와 required property 거부는 이 source boundary와
정합적이다. query는 adapter와 pure helper 모두 원문이 well-formed Unicode인지
정규화 전에 확인한다. malformed surrogate는 adapter에서 기존
`PublicCourseSearchError`의 `INVALID_INPUT`으로 거부되고 repository에 전달되지
않으며, pure helper에서는 `RangeError`로 거부된다. `undefined → ""`, 빈 query,
유효한 surrogate pair 및 query에만 적용하는 48-byte 제한은 유지한다.

이 입력 경계의 정합화는 DB 저장 가능성, provider 검색 parity 또는 Unicode
구현 버전의 고정을 의미하지 않는다. NUL 및 기타 문자열의 저장 지원은 여전히
후속 storage boundary 결정이다.

이 구현은 현재 adapter의 결합 문자열 검색 의미를 명시한 v2 projection
primitive다. 현재 provider가 이미 derived column을 읽거나, 저장 writer가
이를 생성한다는 뜻은 아니다.

저장 projection은 원문을 덮어쓰지 않는다. 다음 source projection을 현재
표시 규칙으로 먼저 만들고, 그 결과를 하나의 문자열로 조립한 뒤 `N_v2`를
한 번 적용한다.

```text
name + " " + shortName + " " + groupName + " "
+ publicCopy(description) + " " + courseAudienceLabel(course)
```

여기서 `publicCopy`와 audience 계산의 version도 projection 계약의 일부다.
필드별로 서로 다른 normalization을 적용해 query와 다른 공백/결합 의미를
만들지 않는다. 검색 projection은 identity나 canonical 콘텐츠가 아니며,
NFKC collision은 서로 다른 course의 identity 충돌로 취급하지 않는다.

`%`, `_`, `\`는 normalized text에 대한 substring 검색에서도 literal 요구를
유지한다. provider는 normalized query를 pattern parameter로 만들 때
`\ → \\`, `% → \%`, `_ → \_` 순서의 escape와 명시적인 escape clause를
사용해야 한다. normalization이 wildcard 문자를 새로 wildcard로 만들도록
허용하지 않는다.

### 5.2 Search fields와 classification

권고하는 derived metadata는 개념적으로 다음과 같다.

```text
search_text_v2
search_normalizer_version
search_projection_version
course_public_path_v2        // CERTIFICATION | PROFESSIONAL
```

실제 schema column은 이번 문서에서 만들지 않는다. `course_public_path_v2`는
현재 `courseTypeLabel` 및 group-name fallback 규칙을 명시적으로 materialize할
수 있지만, 검색 NFKC와 합치지 않는다. group 이름이나 course name/difficulty가
분류에 영향을 주는 경우 해당 row를 다시 계산해야 한다.

파생 field가 NULL, 누락, source version mismatch이면 eligible row를 조용히
누락하지 않는다. rollout 중 provider는 명시적인 stale/missing projection
failure를 관측 가능하게 내거나, publication gate가 해당 상태를 차단해야
한다. 전체 목록 fallback으로 limit을 무력화하는 방식은 금지한다.

### 5.3 Deterministic ID order key

현재 외부 adapter 의미를 보존하는 baseline으로 `id_order_key_v2`를 다음과
같이 정의한다.

- 유효한 Unicode scalar string의 JavaScript UTF-16 code unit을 순서대로 읽는다.
- 각 16-bit unit을 정확히 4개의 대문자 hexadecimal ASCII 문자로 인코딩한다.
- separator, locale case folding, Unicode normalization을 ID에 적용하지 않는다.
- 전체 ID를 인코딩하므로 prefix와 suffix 모두 비교 대상이다.

예를 들면 단일 suffix의 key는 `A = 0041`, `a = 0061`, `𐀀 = D800DC00`,
` = E000`이다. 따라서 `D800DC00`이 `E000`보다 앞서고, 현재 JS
comparator의 `U+10000 → U+E000` 순서를 표현할 수 있다. 이는 DB의 자연어
collation을 흉내내는 것이 아니라, 그 위에 ASCII/bytewise key를 비교하는
명시적 encoding이다.

최종 정렬 tuple은 다음이다.

```text
(groupDisplayOrder ASC,
 displayOrder ASC,
 id_order_key_v2 ASC,
 id identity)
```

`id_order_key_v2`는 유효한 ID에서 identity를 결정하므로 실질적인 마지막
tie-breaker다. cursor에는 원래 `id`도 넣어 row identity와 key 재계산 결과를
검증한다. DB가 원래 text `id`를 locale comparator로 다시 비교하는 fallback은
허용하지 않는다. 두 key가 같으면 동일 ID여야 하며, 그렇지 않은 row는
`INVALID_SOURCE`/stale projection으로 중단한다.

권고 key의 저장 type은 구현 전 결정한다. 우선순위는 bytewise `BLOB`/`bytea`
등의 명시적 binary type이고, 운영 schema 공통성이 필요하면 uppercase hex
ASCII text에 D1 `BINARY`와 PostgreSQL explicit `C`/동등한 bytewise collation을
명시하는 방식이다. PostgreSQL `en_US.utf8`의 자연어 text collation을 그대로
사용하지 않는다. 두 선택 모두 실제 지원되는 column/operator/index 조합과
fixture로 확인해야 하며, 확인 전 DB 함수·extension·UDF를 전제하지 않는다.

### 5.4 ORDER BY와 cursor after

provider의 `ORDER BY`와 `after`는 반드시 같은 derived key와 같은 tuple
prefix를 사용한다.

```text
ORDER BY group_display_order ASC,
         display_order ASC,
         id_order_key_v2 ASC

after:
  group > g
  OR (group = g AND display > d)
  OR (group = g AND display = d AND id_order_key_v2 > k)
```

adapter comparator도 raw ID가 아니라 `id_order_key_v2`를 비교하고, source row의
ID와 key가 일치하는지 검증한다. SQL에서 `NULLS FIRST/LAST`에 기대지 않는다.
group/display order가 safe integer가 아니거나 derived key가 없거나 key가 ID와
일치하지 않으면 invalid source다. DB에서 NULL이 나올 수 있는 projection은
schema/read contract가 허용하지 않아야 한다.

반환 `limit + 1` lookahead와 실제 반환량 `limit`은 유지한다. 반환량 상한은
scan, LIKE substring 비용, sort 비용, index 사용 여부의 상한이 아니다.
이 비용은 별도의 query-plan/resource-budget 검증으로 측정한다.

### 5.5 Projection 갱신 책임

다음 변경은 관련 derived value를 같은 transaction 또는 durable retry 단위로
갱신해야 한다.

- course name, short name, description, difficulty 변경: 해당 course.
- group name 변경: 그 group의 모든 public-search 대상 course. group name은
  search text와 현재 분류 fallback에 함께 영향을 줄 수 있다.
- display order 변경: order key 자체가 ID-only라면 row의 numeric position만
  바뀌지만, cursor/page 경계 영향은 즉시 발생한다.
- path 분류 규칙 또는 audience/public-copy helper version 변경: 영향을 받는
  전체 projection.
- 삭제/복원/visibility 변경: derived text를 원문과 분리해 보존하되,
  재공개 시 현재 projection version인지 확인한다.

검색 projection은 표시 원문·canonical course 콘텐츠·두 번째 원본이 아니다.
원문을 정규화된 값으로 덮어쓰지 않으며, `search_text_v2`를 unique identity로
사용하지 않는다.

## 6. Write path와 기존 데이터 영향

읽기 전용 조사에서 확인한 경로는 다음과 같다. 이는 repository 전체의 모든
직접 SQL writer가 없다고 보증하는 목록이 아니다.

| 경로 | 확인한 영향 | 범위 판정 |
| --- | --- | --- |
| 관리자 course/group 저장 route → `saveCourse`/`saveCourseGroup` | update와 신규 UUID insert 모두 derived value 생성/갱신 필요 | 확인된 application writer |
| canonical independent professional group provisioner | conditional/transactional group INSERT | 확인된 governed writer |
| canonical security professional learning group provisioner | conditional/transactional group INSERT | 확인된 governed writer |
| ISRM parent-group runtime-name reconciler | course INSERT 및 UPDATE | 확인된 governed reconciler |
| secure-coding runtime registration script | non-production course INSERT SQL 생성 | 확인된 script writer |
| `db/seed.sql` | synthetic/dev seed INSERT OR IGNORE | 확인된 seed path |
| taxonomy cleanup migrations | 기존 course UPDATE | 확인된 migration path |
| 직접 SQL, 운영 도구, managed 환경의 별도 import/materialization | 이 조사에서 완전한 inventory 근거 없음 | 범위 밖/추가 조사 필요 |

관련 tracked source는 [repositories.ts](../../db/repositories.ts),
[admin course route](../../app/api/admin/courses/route.ts),
[admin group route](../../app/api/admin/course-groups/route.ts) 및 위 provisioner,
script, seed, migration 파일이다. 이번 변경에서는 어느 writer도 수정하지
않는다.

### 6.1 기존 데이터 계획

구현 단계에서는 다음 순서를 지킨다.

1. nullable derived field와 version/index를 추가하는 설계를 승인한다. 실제
   migration SQL은 별도 변경으로 작성한다.
2. read-only dry-run으로 eligible 및 non-eligible 전체 row의 생성 가능성,
   code point, normalizer/projection version, ID key 일치 여부를 집계한다.
   누락/NULL/잘못된 source는 수치와 ID 목록 정책을 명시한다.
3. 새 writer를 dual-write하고, backfill을 primary key keyset과 checkpoint로
   idempotent하게 수행한다. 기존 row의 원문과 identity는 변경하지 않는다.
4. backfill 결과와 재계산 parity를 D1/PostgreSQL fixture 및 운영 승인된
   read-only 검사로 비교한다. partial rollout 중 old writer가 만든 stale row를
   provider가 성공 row처럼 반환하지 않게 한다.
5. 모든 required row가 새 version을 갖는다는 gate 후에만 non-null/enforcement와
   bounded provider read를 활성화한다.

재시도는 동일 source와 version에 대해 같은 결과를 쓰는 방식이어야 한다.
지속 실패율, projection mismatch, key 불일치, 중복 identity가 기준을 넘으면
중단한다. 원문 복구를 위해 derived field만 되돌리며, 운영 데이터 전체를
재작성하는 rollback을 자동화하지 않는다. 미생성 row를 provider가 조용히
제외하거나 전체 목록 fallback으로 처리하지 않는다.

## 7. Cursor 전환 계약

정규화, projection, ID comparator가 바뀌므로 기존 `public-course-search.cursor.v1`
은 새 계약과 호환되는 것으로 취급하지 않는다.

새 cursor에는 적어도 다음 의미를 포함한다.

```text
cursorType
cursorVersion
comparisonContractVersion
normalizerVersion
searchProjectionVersion
orderKeyVersion
query/path semantic fingerprint
limit
groupDisplayOrder
displayOrder
id_order_key
id
integrity
```

fingerprint에는 query와 path뿐 아니라 해당 request를 해석하는 contract,
normalizer, projection, order version을 결합한다. limit은 현재처럼 별도로
검증하되 fingerprint/정책에도 명시한다. key와 원래 ID를 함께 담아 cursor가
row identity와 derived key의 불일치를 감지하게 한다.

- v1 cursor를 v2 read에 보내면 `INVALID_CURSOR` 또는 명시적인 restart 응답을
  낸다. 첫 page로 조용히 바꾸지 않는다.
- v2 cursor를 v1 server가 받는 혼재 배포에서는 v1 server가 이를 알 수 없는
  cursor로 거부해야 한다. 새·구버전 server가 같은 cursor namespace를 공유할
  수 있도록 route/version pinning 또는 배포 gate가 필요하다.
- query/path/limit이 바뀌면 fingerprint mismatch로 거부한다.
- cursor는 현재 권한, public publication 상태, snapshot, row existence를
  증명하지 않는다. 매 요청 eligibility를 다시 평가한다.
- 별도 snapshot token, transaction snapshot, consistent read protocol이
  없으므로 동시 변경 중 page 일관성은 보장하지 않는다. 정렬 동등성 해결과
  concurrent pagination snapshot 보장은 별도 문제다.

## 8. 단계별 구현·검증 계획

아래는 후속 변경의 범위와 완료 근거다. 이번 commit에는 해당 파일을 만들거나
실행하지 않는다.

| 단계 | 허용 파일 범주 | 선행 조건 | 완료 근거 |
| --- | --- | --- | --- |
| 0. 계약 승인 | architecture/design 문서 | case policy, NFKC order, projection, order-key encoding/type, version naming 결정 | 예제 code point와 모든 UNKNOWN/rollback 기준 승인 |
| 1. 순수 contract/vector 구현 | shared normalizer/comparator, adapter/provider test | 단계 0 | query·stored text 동일 vector, `A/a/한/U+10000/U+E000`, malformed surrogate 정책, literal wildcard PASS |
| 2. schema/index 준비 | schema, migration 설계 | 단계 1, 저장 type/operator/index 승인 | 원문 보존, derived field/version/null 정책과 D1/PostgreSQL binary 비교 가능성 확정. 실제 migration은 별도 변경 |
| 3. write inventory 및 dual-write 활성화 | repository, admin routes, provisioner/import/materialization writer | 단계 2, 모든 확인 가능한 writer의 책임·실패 처리 승인 | 확인된 writer 각각 versioned projection을 생성하고, 범위 밖 writer는 명시된 gate로 차단/관측 |
| 4. 기존 데이터 backfill 및 정합성 검증 | backfill tooling, read-only verification | 단계 3, dry-run 승인 | NULL/mismatch 수치 0 또는 승인된 예외, idempotent retry, checkpoint, 중단/원복 기준 |
| 5. provider read 전환 | 두 provider 파일 및 provider focused tests | 단계 4, D1 BINARY/PG bytewise operator 검증 | 두 provider가 같은 stored search field와 order key, 같은 after predicate, bounded `limit+1` 사용 |
| 6. adapter/cursor 전환 | adapter 및 adapter tests | 단계 5 provider v2 fixture PASS | v1 cursor 명시 거부, v2 fingerprint/version/key 검증, 여러 page 누락·중복·INVALID_SOURCE 없음 |
| 7. parity matrix | D1/PostgreSQL disposable fixture tests | 단계 5·6 | Unicode ID, NFKC full-width/decomposed/compatibility, case policy, wildcard, collision, stale/missing/version mismatch 결과 일치 |
| 8. 비용 분리 검증 | provider query-plan/perf tests와 운영 관측 설정 | parity PASS | 반환 row limit과 scan/sort/LIKE 비용을 별도로 기록; full-list JS fallback 없음 |
| 9. rollout/rollback | feature/config/deployment 범주 | 모든 이전 단계와 readiness 문제 별도 해결 | dual-read discrepancy, stale row rate, DB error, rollback/restart 동작 확인 후에만 공개 활성화 |

필수 회귀의 최소 목록은 다음과 같다.

- 작은 `limit`으로 끝까지 cursor 순회해 누락·중복을 확인하고, order mismatch가
  `INVALID_SOURCE`로 바뀌지 않았는지 확인한다.
- 전각, 분해형 é, 호환 문자를 같은 `N_v2` query/stored 조합으로 비교한다.
- `%`, `_`, `\`가 literal인 경우와 normalization collision을 확인한다.
- collision이 발생해도 original name/ID와 course identity가 보존되는지 확인한다.
- missing/stale/version mismatch derived row와 old cursor가 첫 page로
  조용히 fallback되지 않는지 확인한다.
- 두 provider 실제 실행, adapter/provider 연결, 기존 정상 path를 함께
  검증한다.
- D1/PostgreSQL readiness failure는 fixture 실행 문제로 별도 기록한다.
  readiness timeout 또는 retry 수치를 바꿔 최종 suite PASS로 간주하지 않는다.

## 9. 현재 상태와 경계

이번 목표에서의 판단은 다음과 같다.

- 이 분리 PR은 비교 primitive, adapter 입력 검증 및 그 회귀만 포함한다.
  원본 provider branch의 미완료 provider 구현은 이 PR의 main 기반 변경에 없다.
- 현재 raw DB ordering/search와 adapter 의미는 반례에서 parity가 아니다.
- 반례는 특정 disposable D1과 PostgreSQL 17.6/`en_US.utf8` 관찰이지 모든
  collation의 보편 증명이 아니다.
- provider-only 해법의 추상적 불가능성을 주장하지 않는다. 다만 현재 허용
  파일만으로는 공통 normalizer/order key와 write completeness를 계약할 수
  없다.
- 권고안은 필요한 schema/migration/backfill/write-path 변경을 정의하지만,
  그 변경은 이번 목표에서 승인·작성·실행되지 않았다.
- DB/Docker는 이 목표에서 실행하지 않았다. 이전 focused 실행의 PostgreSQL
  readiness timeout과 corrected disposable probe 결과는 서로 대체하지 않는다.
- 운영/managed DB 조회, credential, learner/Evidence 데이터, historical
  backfill, publication은 범위 밖이다.

상태:

```text
PROVIDER_IMPLEMENTATION: NOT_INCLUDED_IN_THIS_PR
ORIGINAL_PROVIDER_IMPLEMENTATION: PARTIAL
COMPARISON_PRIMITIVES_IMPLEMENTATION: COMPLETE
QUERY_INPUT_CONTRACT_ALIGNMENT: COMPLETE
STORED_PROJECTION_AND_WRITER_INTEGRATION: NOT_IMPLEMENTED
PUBLIC_TOOL_ACTIVATION: NOT_ENABLED
CURSOR_V2_ACTIVATION: NOT_ENABLED
DATABASE_PARITY_VALIDATION_THIS_GOAL: NOT_RUN
DATABASE_EXECUTION_THIS_GOAL: NOT_RUN
MANAGED_RUNTIME_VALIDATION: NOT_RUN
HISTORICAL_BACKFILL: NOT_EXECUTED
CONCURRENT_PAGINATION_SNAPSHOT_GUARANTEE: NOT_ESTABLISHED
CANONICAL_MUTATION: NONE
```

## 10. 남은 결정 사항

1. `ko-KR` locale lower를 고정할 runtime/ICU/Unicode artifact와, 장기적으로
   locale-independent case policy를 채택할지 결정한다.
2. `id_order_key_v2`의 binary type과 D1/PostgreSQL index/operator 조합을
   결정하고, `BINARY`/`C` bytewise parity를 실행 fixture로 승인한다.
3. `search_text_v2`, projection version, path classification projection을
   실제 schema에 어떻게 표현할지 결정한다.
4. 확인된 writer 외의 import/materialization/direct SQL ownership과 rollout
   중 old writer를 차단할 gate를 결정한다.
5. stale/missing projection의 API error/activation gate, backfill 중단·원복
   threshold, v1 cursor restart UX를 결정한다.
6. 정렬 동등성 외에 snapshot-consistent pagination이 필요한지, 필요하다면
   별도 snapshot 전략을 설계한다.

이번 문서는 위 결정을 대신해 임의의 ASCII-only 제한, Unicode row 제외,
실패 assertion 완화, DB 함수/extension/UDF 존재 가정을 도입하지 않는다.
