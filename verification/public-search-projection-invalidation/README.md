# Public search projection invalidation offline evaluation

이 평가는 `docs/architecture/public-course-search-storage-contract.md`와
`docs/architecture/public-course-search-comparison-contract.md`의 저장 계약을
합성 canonical course/group 상태와 합성 stored projection으로 점검한다.

직접 실행:

```text
node --import tsx --test tests/public-search-projection-invalidation.test.ts
```

## 실제 제품 함수와 평가 규칙

테스트는 다음 실제 pure comparison primitive를 import한다.

- `buildPublicCourseSearchProjection`
- `createPublicCourseSearchIdOrderKey`
- comparison, normalizer, order-key version 상수

따라서 NFKC, trim, `toLocaleLowerCase("ko-KR")`, 다섯 searchable field의
결합 순서, query-only 48-byte 제한과 분리된 stored projection 의미, UTF-16
code-unit key encoding을 평가 코드에 복제하지 않는다. query byte limit은 저장
projection 계산에 적용하지 않는다는 계약도 유지한다.

fixture의 `expectedSearchText`와 `expectedIdOrderKey`는 사람이 읽고 고정한
independent oracle이다. 예상 projection이나 fan-out 영향 대상은 실제 함수의
반환값, mismatch 계산 결과, 또는 테스트 중 생성하지 않는다. 테스트는 실제 함수의
관찰값을 이 고정 oracle과 비교한다.

fixture는 canonical field, group 관계·상태, canonical revision marker, 이전/이후
stored projection과 명시적인 comparison/normalizer/order-key metadata를 담는다.
revision marker는 digest serialization을 구현한 것이 아니라 오프라인 stale 관찰을
위한 합성 값이다.

## 시나리오 범위

- A: `name`, `shortName`, `groupName`, `publicDescription`, `audienceLabel` 각각의
  변경과 검색 무관 metadata 변경을 비교한다. searchable field 변경은 writer 갱신이
  필요하다는 문서 근거를 사용하지만, metadata-only와 normalized-equivalent의
  freshness 갱신 정책은 `UNRESOLVED`로 남긴다.
- B: 전각/ASCII 및 분해형/조합형 Unicode가 같은 normalized text를 만드는 사례를
  비교한다. normalized value equality는 canonical revision equality가 아니다.
- C: 두 group과 세 child course를 두고 한 group의 groupName 변경 영향 대상을 고정
  oracle과 비교한다. 다른 group은 제외하고, 한 child만 새 값으로 저장한 partial 상태를
  남은 mismatch로 탐지한다.
- D: course의 unpublished/inactive/deleted와 group의 inactive/deleted를 포함한다.
  현재 `isPublicCourse`와 search adapter의 group active/deleted 조건을 관찰 기준으로
  사용한다. projection이 READY이고 text가 같아도 public eligibility는 별도 결과다.
- E: course가 다른 group으로 이동하면 groupName projection은 바뀌고 course ID key는
  유지되는지 확인한다. group 관계가 없으면 빈 groupName으로 보정하지 않고
  `UNRESOLVED_RELATIONSHIP` 관찰로 남긴다.
- F: 정상, 누락, 다른 comparison/normalizer/order-key version metadata를 구분한다.
  ID key에는 version prefix가 없으며, metadata 불일치 탐지는 harness에만 있다.
- G: projection 부재, 오래된 search text, partial fan-out, version/state/source marker
  불일치를 각각 분류한다. 관찰된 mismatch만 기록하며 특정 writer 실패, 경쟁 실행,
  DB corruption의 원인을 추정하지 않는다.

## 명시적 경계

- projection freshness는 공개 승인이나 권한 증명이 아니다.
- projection 존재·문자열 일치만으로 public read를 승인하지 않는다.
- normalized value equality는 canonical revision equality가 아니다.
- version metadata는 실제 Node/ICU/Unicode runtime 호환성 증명이 아니다.
- 부분 갱신 탐지는 transaction 또는 snapshot 보장이 아니다.
- 합성 fan-out 성공은 실제 D1/PostgreSQL fan-out 완료가 아니다.
- digest serialization, source digest encoding, runtime binding, physical key type,
  atomicity, queue/checkpoint, compare-and-set/lock 정책은 이번 평가에서 확정하지 않는다.
- 실제 schema, migration, projection writer, provider SQL, backfill, cursor v2는
  구현하지 않으며 실제 DB cascade·soft-delete 처리도 실행하지 않는다.
- 실제 공개 predicate는 canonical course/group 상태를 별도로 확인해야 한다. 이
  harness의 `publicEligibilityObservation`은 현재 코드와 문서에 확인된 조건을 fixture에
  적용하는 관찰 규칙이지 새 제품 정책이나 public endpoint가 아니다.
- 이 평가는 시간·난수·환경변수·네트워크·DB·전역 mutable state를 사용하지 않는다.
  전체 unit/build/E2E, 서버·브라우저·API/MCP/LLM은 실행하지 않는다.

## 아직 미결인 구현 결정

다음은 테스트 skip으로 숨기지 않고 후속 구현 결정으로 남긴다.

- 단일 row overwrite와 version 병행 보존의 전환 모델
- physical key type, column/index/operator/collation 조합과 D1/PostgreSQL parity
- digest canonical field 순서, NULL/empty 구분, delimiter/encoding/serialization version
- Node/ICU/Unicode runtime binding 및 재생성 조건
- group fan-out의 transaction 크기, atomicity 또는 durable `STALE`/`FAILED` gate
- backfill과 fan-out의 stale write 방지, source version/CAS/lock 선택
- public predicate와 projection readiness의 provider query 경계
- cursor v2, 이미 발행된 cursor, rollback 및 구/new version compatibility

이 평가는 현재 comparison primitive의 결과와 저장 계약의 오프라인 acceptance
경계를 확인할 뿐, 위 결정이나 실제 writer/provider 동작을 승인하지 않는다.
