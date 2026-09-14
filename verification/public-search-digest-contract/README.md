# 공개 검색 digest 직렬화 verification 후보

상태: verification 전용 시제품과 독립 고정 벡터. 제품 digest 규격 승인, schema/writer 연결, provider/cursor 연결, backfill, 공개 tool 활성화는 이 작업에서 수행하지 않는다.

기준 commit은 `b652f90b37f4c508fde9bc8160b2cf0b35088cdd`이다. 적용 가능한 `AGENTS.md`는 없었다. 이 worktree는 해당 기준에서 생성되었고, 기준 이후 `origin/main` drift는 자동 merge/rebase하지 않는다.

## 현재 계약과 중복 검토

관련 근거는 다음 문서와 코드다.

- [public-course-search-storage-contract.md](../../docs/architecture/public-course-search-storage-contract.md)
- [public-course-search-comparison-contract.md](../../docs/architecture/public-course-search-comparison-contract.md)
- [public-course-search-comparison.ts](../../lib/services/public-course-search-comparison.ts)
- [public-course-search-adapter.ts](../../lib/services/public-course-search-adapter.ts)

현재 comparison helper가 고정하는 값은 다음과 같다.

- normalizer: `public-course-search.normalizer.nfkc-trim-ko-lower.v1`
- order key: `public-course-search.id-order.utf16-code-unit-hex.v1`
- comparison: `public-course-search.comparison.v2`
- projection source 순서: name, shortName, groupName, publicDescription, audienceLabel
- projection 정규화: 기존 `buildPublicCourseSearchProjection`가 `NFKC → trim → toLocaleLowerCase("ko-KR")` 적용
- ID order key: 기존 `createPublicCourseSearchIdOrderKey`가 UTF-16 code unit을 4자리 대문자 hex로 인코딩

현재 repository에는 source digest serializer가 없다. adapter의 `sha256(JSON.stringify(...))`는 query fingerprint와 cursor integrity를 위한 것이며, source/projection digest 입력 계약과 목적이 다르므로 재사용하지 않았다.

## Digest 목적 분리

### A. raw-source 후보

목적은 canonical source tuple이 바뀌었는지 감지하는 것이다. 따라서 source 값은 정규화하지 않고, helper가 읽는 raw source와 helper-rule version을 고정된 순서로 묶는다.

포함 후보:

- course identity: course id, course group id
- raw name, shortName, groupName
- raw description, raw difficulty
- public-description helper rule version
- audience-label helper rule version
- normalizer version
- projection version

이 후보는 display helper가 같은 출력으로 재계산되더라도 raw source가 달라지면 달라진다. 예를 들어 composed/decomposed source 문자열은 raw-source bytes가 다르다.

### B. normalized-projection 후보

목적은 공개 검색 reader가 비교할 정규화된 projection 값과 그 비교 binding이 바뀌었는지 감지하는 것이다.

포함 후보:

- course identity: course id, course group id
- 기존 comparison helper가 계산한 normalized projection
- 기존 comparison helper가 계산한 ID order key
- normalizer version
- order-key version
- projection version

이 후보는 raw source 표현의 차이를 일부 흡수한다. 예를 들어 NFKC 전에는 다른 composed/decomposed 문자열은 같은 normalized projection bytes를 만들 수 있다.

두 목적은 항상 같은 결과를 내지 않는다. raw-source digest가 같다는 것은 raw source tuple이 같다는 뜻에 가깝고, normalized-projection digest가 같다는 것은 projection output과 binding이 같다는 뜻에 가깝다. 어느 하나도 public approval, canonical revision, write/read 원자성, 최신 source 전체 관찰을 증명하지 않는다. 시제품은 두 의미를 서로 다른 purpose header와 field set으로 분리한다.

## 후보 필드 선택

| 후보 | raw-source | normalized-projection | 판단 |
| --- | --- | --- | --- |
| course identity | 포함 | 포함 | provenance와 row binding이다. identity 변경을 값 변경으로 숨기지 않는다. |
| name | raw 포함 | normalized output에 반영 | raw 목적은 원문 변경을 감지하고, projection 목적은 실제 검색 값을 비교한다. |
| shortName | raw 포함 | normalized output에 반영 | 동일하다. 별도 normalized field로 중복 저장하지 않는다. |
| groupName | raw 포함 | normalized output에 반영 | group fan-out 원인이므로 raw source 후보에 포함한다. |
| publicDescription | 직접 제외 | normalized output에 반영 | source digest에는 raw description과 helper-rule version을 포함한다. 파생 output을 raw source와 중복 직렬화하지 않는다. |
| audienceLabel | 직접 제외 | normalized output에 반영 | source digest에는 raw difficulty와 helper-rule version을 포함한다. |
| normalized projection | 제외 | 포함 | projection 비교 목적의 핵심 output이다. |
| ID order key | 제외 | 포함 | source content가 아니라 정렬/after 비교 binding이다. 기존 helper로 계산한다. |
| normalizer version | 포함 | 포함 | source 계산과 projection 비교가 어느 정규화 계약에 묶였는지 확인한다. |
| order-key version | 제외 | 포함 | raw source 변경 감지와 별개인 정렬 계약이다. |
| serialization version | header에 포함 | header에 포함 | 필드가 아니라 wire format 전체의 해석 version이다. version 변경은 bytes를 무효화한다. |
| Node/ICU/Unicode runtime | 기본 제외, 명시 시 포함 | 기본 제외, 명시 시 포함 | runtime parity 후보이지만 serializer가 실행 환경을 몰래 읽지 않게 한다. 필요할 때 호출자가 explicit metadata를 전달한다. |

source description/difficulty는 사용자-facing projection field 이름은 아니지만 기존 storage contract가 source digest 후보로 열거한 raw 입력이다. publicDescription/audienceLabel의 표시 계산 책임을 감지하려면 raw 입력과 각 helper rule version의 책임을 분리해 기록해야 한다.

publication/권한 상태, active/published/deleted, timestamp, revision, display order는 이 후보의 필수 제품 field로 확정하지 않았다.

- 공개 상태와 권한은 reader/provider가 canonical table에서 확인할 책임이며 digest equality가 approval을 뜻하지 않는다.
- timestamp는 source marker/stale 후보이지 source tuple bytes의 대체로 확정하지 않았다.
- revision이 실제 canonical authority로 승인될 경우 별도 결정과 version binding이 필요하다.
- display order는 검색 source content가 아니라 order tuple의 별도 비교 책임이다.
- path classifier를 digest에 넣을지는 classifier가 실제 읽는 source와 별도 path version을 승인한 뒤 결정한다.

## 선택한 직렬화 후보: serialization v1

선택한 verification 후보의 첫 줄은 다음이다.

```
format=public-course-search.digest-serialization.v1
```

전체 wire text는 ASCII metadata와 lowercase hex 값으로 구성되고, 최종 결과는 그 text의 UTF-8 bytes다. 값 내부의 구분자, 줄바꿈, 탭, 따옴표, 역슬래시, NUL은 raw text로 wire에 넣지 않고 UTF-8 hex로 넣는다. 따라서 metadata delimiter가 값 내부 delimiter와 충돌하지 않는다.

각 field line은 다음 고정 구조다.

```
field-index<TAB>field-name<TAB>type-tag<TAB>state-tag<TAB>utf8-byte-length<TAB>utf8-lowercase-hex<LF>
```

header 다음 순서도 고정한다.

- purpose
- field-count
- field lines

source-input field 순서:

1. course.id
2. course.groupId
3. course.name
4. course.shortName
5. group.name
6. course.description
7. course.difficulty
8. display.publicDescriptionRuleVersion
9. display.audienceLabelRuleVersion
10. search.normalizerVersion
11. search.projectionVersion
12. runtime.node
13. runtime.icu
14. runtime.unicode

normalized-projection field 순서:

1. course.id
2. course.groupId
3. search.normalizedProjection
4. search.idOrderKey
5. search.normalizerVersion
6. search.orderKeyVersion
7. search.projectionVersion
8. runtime.node
9. runtime.icu
10. runtime.unicode

`string/present`는 실제 문자열이며, empty string도 `utf8-byte-length=0`인 present 값이다. `string/omitted`는 runtime metadata를 호출자가 생략한 경우에만 사용한다. required field의 missing, explicit `undefined`, `null`, wrong type, malformed surrogate는 동일 값으로 정규화하지 않고 거부한다. 추가 root field와 추가 projectionParts field도 거부한다.

serialization version은 candidate data field가 아니라 header binding이다. verification 함수는 version 변경 실험을 위해 explicit option으로 다른 version header를 만들 수 있지만, 제품 writer가 서로 다른 serialization version을 섞어 저장해도 된다는 뜻은 아니다.

## 정확한 입력 domain

시제품 함수는 DB/file/network/environment/current time/random/global mutable state에 의존하지 않는다.

- 입력 wrapper는 plain object이고 허용 key set이 정확해야 한다.
- identity와 version은 non-empty well-formed Unicode string이다.
- source content string은 empty를 허용하지만 missing/null/undefined는 허용하지 않는다.
- normalized projection 입력의 다섯 projectionParts는 실제 `buildPublicCourseSearchProjection`가 요구하는 string shape를 사용한다.
- runtime metadata는 `node`, `icu`, `unicode` 세 값을 모두 가진 객체로만 명시할 수 있다. 생략하면 세 runtime field는 omitted이며, null/undefined는 허용하지 않는다.
- serializer 내부에서 trim, case conversion, NFKC, replacement-character 삽입, truncation을 하지 않는다.
- normalized projection과 ID order key는 기존 helper를 직접 호출한다. 알고리즘을 복제하지 않는다.

## Unicode와 UTF-8 경계

검증 벡터는 ASCII, 한글, 유효한 non-BMP pair, composed/decomposed 문자열, 줄바꿈, 탭을 대신하는 control boundary, 따옴표, 역슬래시, NUL 및 `%`, `_`를 포함한다.

먼저 기존 Unicode well-formed predicate로 scalar string인지 검사한 다음 `TextEncoder`로 UTF-8 bytes를 만든다. unpaired high/low surrogate는 `RangeError`로 거부하므로 JavaScript UTF-8 변환이 U+FFFD replacement로 두 입력을 합치는 경계를 허용하지 않는다. 유효한 NUL과 Unicode를 pure function이 표현할 수 있다는 사실은 D1/PostgreSQL/driver의 실제 저장 가능성을 보장하지 않는다.

runtime metadata를 포함한 벡터는 실행 환경에서 자동으로 수집한 값이 아니다. caller가 explicit fixture를 전달했을 때만 bytes에 들어간다. runtime 문자열이 같아도 전체 Unicode/ICU parity를 증명하지 않는다.

## 고정 벡터와 실행

기대 wire는 `vectors.ts`에 literal로 작성되어 있으며 prototype serializer 출력으로 생성하지 않는다. 포함된 사례는 다음과 같다.

- 정상 최소 source/projection
- object key insertion order 차이
- 각 주요 source/projection field 및 version 하나만 변경
- omitted/null/undefined/empty 구분
- delimiter collision 반례와 선택 format의 분리
- newline, quote, backslash, NUL
- 한글과 유효한 non-BMP
- composed/decomposed raw 차이와 normalized projection 동등성
- normalizer/order-key/serialization version 변경
- runtime metadata omitted/included
- wrong type, additional field, malformed surrogate
- 반복 실행 결정성과 입력 불변성

집중 실행 명령:

```
node --import tsx --test tests/public-search-digest-contract.test.ts
```

이번 verification에서 hash가 필요할 때만 test의 Node 내장 `node:crypto`로 bytes의 SHA-256을 시연한다. hash는 동일 bytes의 반복성만 보여주며 제품 hash 알고리즘/저장 형식 승인으로 해석하지 않는다. bytes 생성, serialization ambiguity, hash collision 가능성, 저장 digest의 신뢰성/최신성은 별도 문제다.

## 제품 적용 전에 필요한 결정

1. raw-source digest와 normalized-projection digest를 하나의 저장 digest로 합칠지, 두 binding을 별도 저장/검증할지 결정한다.
2. raw source tuple에 실제 canonical field와 display-helper rule version을 어느 범위까지 포함할지 승인한다.
3. normalized projection의 projection version, normalizer version, order-key version을 schema/readiness gate에서 어떻게 저장할지 결정한다.
4. serialization v1 wire format, field order, hex case, missing/null/empty policy를 제품 계약으로 승인한다.
5. NFKC, `ko-KR` case mapping, Node/ICU/Unicode artifact pinning과 cross-runtime parity 증거 수준을 결정한다.
6. runtime metadata를 저장할지, release/build manifest로 분리할지, 또는 digest input에서 제외할지 결정한다.
7. publication/permission/status/timestamp/revision/path classifier를 digest와 별도 readiness/authority 계약으로 둘지 결정한다.
8. D1/PostgreSQL 저장 type, bytewise comparison, writer ownership, stale/missing failure, cursor transition, transaction boundary를 별도로 승인한다.

## 범위 경계

이 directory는 verification prototype이다. 다음은 연결하지 않았다.

- product lib/db code
- schema/migration
- writer/provider
- cursor
- package/dependency/lockfile
- existing architecture docs
- DB/Docker/Wrangler/server/browser/API/MCP/LLM execution
- backfill, push, PR, workflow, public tool activation

이번 후보의 성공은 이 runtime에서 고정 bytes와 pure input boundary가 검증되었다는 뜻일 뿐, 제품 digest contract 채택이나 source snapshot consistency/fan-out atomicity를 확립했다는 뜻이 아니다.
