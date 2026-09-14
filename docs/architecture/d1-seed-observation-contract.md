# D1 seed observation contract design

## 1. 목적과 기준

이 문서는 현재 standalone D1 seed caller가 실제로 노출하는 실행 관찰값을
병합된 `d1-seed-result-classifier` 입력으로 어떻게 대응할 수 있는지 정리한다.
기존 결과 상태 계약은
[`d1-standalone-seed-result-contract.md`](./d1-standalone-seed-result-contract.md)에,
현재 순수 classifier의 실제 타입은
[`d1-seed-result-classifier.ts`](../../lib/services/d1-seed-result-classifier.ts)에
정의되어 있다. 이 문서는 그 계약을 재정의하거나 caller를 연결하지 않는다.

- 기준 main / classifier merge: `00a58e083648b3d10ac27f969af5c0866c43e5aa`
- 작업 branch: `docs/d1-seed-observation-contract`
- 확인 시점: 2026-09-14
- 검토 범위: 현재 D1 local seed 경로, 직접 호출되는 subprocess/query/검증 경계
- 비범위: caller 연결, commit 증거 수집 구현, DB/Wrangler/seed 실행, report 저장,
  recovery, PostgreSQL 전체 경로, PR #190 재검토

표현은 다음처럼 구분한다.

- **현재 구현 사실**: checkout의 코드와 package script에서 확인한 동작
- **현재 관찰 한계**: 코드가 보존하거나 구분하지 않는 값
- **설계 제안**: 후속 변경에서 선택할 수 있는 최소 구조. 이 문서에서는 구현하지 않음

## 2. 현재 활성 실행 경로

### 2.1 활성 entrypoint

참조 계약서와 현재 package script가 설명하는 standalone D1 content seed의 실제
진입점은 다음이다.

```text
npm run content:security-certification:v3:seed:d1-local
  -> node scripts/security-content-upgrade-v3.mjs seed:d1-local
```

근거: [`package.json`](../../package.json#L99-L101)의 `seed:d1-local` script.

`npm run db:seed`는 별도의 base seed 경로로
`run-wrangler.mjs d1 execute DB --local ... --file db/seed.sql`를 호출한다
([`package.json`](../../package.json#L43-L44)). 그것은 아래의 content-v3
preflight/snapshot/verification 흐름과 혼동하지 않는다.

### 2.2 실제 순서와 경계

[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L25-L51)는
action을 선택하고 source를 읽어 plan을 만든 뒤 다음 D1 흐름을 호출한다.

```text
action/source-root/config 준비
  -> source 파일 존재 확인, JSON parse, plan 생성
  -> prerequisite query 및 protected-progress conflict query
  -> immutable content conflict query
  -> protected-course snapshot(before)
  -> temporary SQL file 생성
  -> write subprocess: run-wrangler -> Wrangler d1 execute --local --file
       generated D1 SQL: BEGIN TRANSACTION; ... COMMIT;
  -> protected-course snapshot(after)
  -> verifyD1 aggregate/integrity query
  -> SECURITY_CONTENT_V3_D1_LOCAL_APPLIED 출력
  -> process.exit(0)
```

실제 `seedD1` 순서는
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L80-L101),
generated transaction 경계는
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L88-L96)와
[`security-content-upgrade-v3.mjs`](../../lib/data/security-content-upgrade-v3.mjs#L211-L243)에서
확인된다. preflight, before/after snapshot, verification은 모두 별도
`d1Query` 호출이며 동일 D1 transaction 안에서 이어지지 않는다.

`verify:d1-local`은
[`package.json`](../../package.json#L101-L101)과
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L219-L224)의
별도 action이다. 이전 seed operation ID, write response, target identity, source
plan을 결과에 결합하지 않으므로 이전 seed의 verification receipt로 취급하지 않는다.

### 2.3 subprocess와 query의 현재 동작

`d1Query`와 write subprocess는
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L346-L368)에
있다.

- `d1Query`와 write 모두 `process.execPath`로 `scripts/run-wrangler.mjs`를 실행한다.
- `runCapture`는 child의 stdout과 stderr를 하나의 문자열에 합친다.
- `close`의 code만 보존하고 signal을 별도 값으로 보존하지 않는다.
- 유한 timeout이 없고, timeout과 process loss를 현재 caller가 구분하지 않는다.
- child `error`는 code `1`로, null close code도 `1`로 정규화된다.
- write nonzero는 `SECURITY_CONTENT_V3_PROCESS_FAILED`와 합쳐진 출력의 tail을
  출력하고 `process.exit(1)`을 호출한다.
- query nonzero는 `SECURITY_CONTENT_V3_D1_QUERY_FAILED`로 실패한다.
- query output은 ANSI를 제거한 뒤 첫 `[`부터 마지막 `]`까지 JSON parse한다.
  구간이 없으면 `SECURITY_CONTENT_V3_D1_JSON_MISSING`; JSON parse 예외는 별도
  구조화 code 없이 전파될 수 있다.
- `payload[0]?.results`가 없으면 빈 배열로 취급한다. 출력 부재, 잘못된 shape,
  정상적인 빈 결과를 바깥 observation envelope가 구분할 수 있도록 현재 반환값만
  사용해서는 안 된다.

`run-wrangler.mjs`는
[`run-wrangler.mjs`](../../scripts/run-wrangler.mjs#L10-L38)에서 local 명령에
`D1_TEST_PERSIST_PATH`가 있고 `--persist-to`가 없으면 persistence 인자를 추가한다.
따라서 실행 명령은 local로 제한되지만, 실제 local persistence 선택은 명시된
config와 선택적 persistence 설정을 함께 확인해야 한다.

## 3. 단계별 관찰값 inventory

아래 표는 현재 코드에서 실제로 얻을 수 있는 값과, 그 값을 classifier input으로
직접 표현할 수 있는 범위를 구분한다. stdout 내용, SQL, row payload, credential는
복제하지 않는다.

| 단계 / 실제 함수·위치 | 현재 얻을 수 있는 관찰값 | 관찰 시점 / 오류 지점 | 현재 보존 여부 | classifier 직접 대응 | 추가 근거 필요 |
| --- | --- | --- | --- | --- | --- |
| action/source/plan 준비 — `resolveSourceRoot`, `readSource`, `buildSecurityContentV3Plan` ([script](../../scripts/security-content-upgrade-v3.mjs#L25-L32), [source loader](../../scripts/security-content-upgrade-v3.mjs#L56-L78)) | action 유효성, source root 존재, 필수 source file 존재, JSON read/parse 성공 여부, plan 생성 도달 여부 | write 호출 전. invalid action/source root/file 또는 parse/plan exception | fail code 또는 uncaught error와 process 종료만 구조적으로 보존 | write subprocess가 호출되지 않았다는 제어 흐름을 확실히 기록할 수 있으면 `PREFLIGHT` + `attempted=false` + `NOT_STARTED` + verification `NOT_RUN`으로 `FAILED_BEFORE_WRITE` | caller가 “write 미호출”을 명시적으로 보존해야 함. source가 정상이라는 사실은 target 상태를 말하지 않음 |
| prerequisite/protected-progress preflight — `assertD1Prerequisites`, `assertD1NoProtectedProgressConflict` ([script](../../scripts/security-content-upgrade-v3.mjs#L123-L139)) | query child 종료 code, 합쳐진 output 수신 여부, JSON row parse 시도, prerequisite count 또는 conflict predicate 결과 | write subprocess 전. query process, output boundary, JSON/semantic assertion에서 실패 | query 결과는 함수 local에만 있고, fail code/일부 detail만 terminal 출력 | write가 아직 호출되지 않았다는 사실을 함께 보존할 때만 `FAILED_BEFORE_WRITE` | query process state와 semantic precondition failure를 분리해야 함. 기존 row 부재/clean target은 증명하지 않음 |
| immutable-content preflight — `assertD1NoImmutableContentConflict`, `contentConflictSql` ([script](../../scripts/security-content-upgrade-v3.mjs#L141-L196)) | 대상 ID의 기존 immutable projection이 expected projection과 다른지, version conflict인지 여부 | write 전 query와 in-memory comparison | mismatch는 fail code로만 출력; row 자체는 보존하지 않음 | write 미시도라면 `FAILED_BEFORE_WRITE` 가능 | conflict가 없다는 결과는 새 write가 이후 commit된다는 근거가 아님 |
| protected snapshot(before) — `protectedCourseSnapshotSql`, `d1Query` ([script](../../scripts/security-content-upgrade-v3.mjs#L84-L85), [snapshot](../../scripts/security-content-upgrade-v3.mjs#L289-L305)) | 보호 대상 course별 subject/topic/unit/lesson/question count query의 parse 결과 | write 전. query/process/JSON/shape 오류 가능 | `before`가 local 변수에만 있음 | 실패 시 write 미시도이면 `FAILED_BEFORE_WRITE`; 성공 자체는 classifier result state가 아님 | snapshot row가 seed target의 operation identity를 포함하지 않음 |
| SQL 생성 및 temp file — `mkdtemp`, `writeFile`, `generateSecurityContentV3Sql` ([script](../../scripts/security-content-upgrade-v3.mjs#L85-L89)) | temp directory/file 생성 도달, SQL generation/write promise 성공 여부 | write subprocess 전. filesystem/generator error 가능 | 성공 marker나 structured stage 없음. `finally`에서 temp dir 제거 시도 | write가 시작되지 않았음을 보존하면 `FAILED_BEFORE_WRITE` | temp path, generated SQL, payload는 evidence로 보존하지 않음. file 존재는 DB commit 근거가 아님 |
| write subprocess — `runCapture`와 `run-wrangler` ([script](../../scripts/security-content-upgrade-v3.mjs#L89-L96), [wrapper](../../scripts/run-wrangler.mjs#L20-L38)) | child spawn 시도, merged stdout/stderr 수신, close code 또는 child error에 따른 code | generated SQL 실행 중. code `0`, nonzero, child error 가능 | attempted 여부는 control flow로 추론 가능하나 별도 envelope 없음. signal, timeout, stdout/stderr 분리 없음 | code `0`이고 아직 verification을 input에 넣지 않는다면 `attempted=true`, `EXIT_ZERO`, evidence `NONE`으로 `COMMITTED_BUT_UNVERIFIED`; write 후 nonzero이면 `EXIT_NONZERO` + `verification=NOT_RUN`으로 `COMMIT_OUTCOME_UNKNOWN` | exit `0`은 commit proof가 아님. nonzero는 rollback 또는 no-commit을 말하지 않음. timeout/output loss는 현재 구분 불가 |
| temp cleanup — `finally rm` ([script](../../scripts/security-content-upgrade-v3.mjs#L87-L97)) | cleanup promise 호출/성공 또는 throw 가능 | write result 직후, after snapshot 전. `rm` 실패가 원래 error를 가릴 수 있음 | `CLEANUP_FAILED` secondary로 분리 보존하지 않음 | future envelope가 원래 primary와 별도로 보존할 때만 `secondaryFailures: ["CLEANUP_FAILED"]` | cleanup 성공은 DB 상태가 아님. cleanup 실패를 commit/rollback 결과로 바꾸지 않음 |
| snapshot(after) — `d1Query`, `assertProtectedSnapshot` ([script](../../scripts/security-content-upgrade-v3.mjs#L98-L99), [snapshot](../../scripts/security-content-upgrade-v3.mjs#L302-L305)) | after query 결과, before/after 보호 snapshot equality 또는 mismatch | write subprocess 종료 후. query/process/JSON 오류 또는 snapshot mismatch | mismatch는 fail code, row/provenance/operation link는 보존하지 않음 | exit `0` + query failure는 verification `QUERY_FAILED`로 제한적으로 표현 가능. snapshot mismatch를 `MISMATCH`로 넣으려면 operation-bound evidence가 필요하며 현재는 unsupported | before/after equality는 보호 범위 보존 관찰이지 이번 write의 commit 증명이 아님 |
| verification — `verifyD1`, `verificationSql`, `assertVerification` ([script](../../scripts/security-content-upgrade-v3.mjs#L219-L224), [assert](../../scripts/security-content-upgrade-v3.mjs#L263-L287)) | aggregate counts, link/version/orphan/integrity predicate 결과, verification query/process/JSON 성공 여부 | after snapshot 뒤. 각 metric mismatch, missing ontology edges, query/parse error 가능 | 성공은 JSON summary와 marker, 실패는 fail code로 terminal 출력; operation ID/target/source binding 없음 | `QUERY_FAILED`/`UNAVAILABLE`은 write outcome에 따라 제한적으로 직접 대응. `PASSED`/`MISMATCH`는 operation-bound evidence 없이는 classifier `UNSUPPORTED_COMBINATION` | verification 조건과 write invocation의 causality를 결합할 trusted evidence가 필요 |
| success marker / exit — top-level dispatch ([script](../../scripts/security-content-upgrade-v3.mjs#L38-L52)) | `SECURITY_CONTENT_V3_D1_LOCAL_APPLIED` 출력 도달, success `process.exit(0)` | after snapshot과 `verifyD1` 성공 뒤 | marker와 exit code만 terminal 관찰값 | marker와 exit `0`은 `COMMITTED_VERIFIED` 입력으로 직접 승격 불가. verification을 사실대로 `PASSED`로 유지하면 operation-bound evidence 부족으로 unsupported | marker가 어느 target/source plan/operation에 결합됐는지 필요 |
| 별도 verify command — `verify:d1-local` ([script](../../scripts/security-content-upgrade-v3.mjs#L49-L51)) | 현재 target query의 verification summary와 `SECURITY_CONTENT_V3_D1_LOCAL_OK` | 이전 seed와 무관한 별도 invocation | 이전 write receipt와 결합된 보존 없음 | `PASSED`/`MISMATCH`를 보존하면서 operation-bound evidence 없음을 별도 기록; classifier에는 success로 강제 입력하지 않음 | 이전 seed operation, target identity, source plan, replay 여부 결합 필요 |

핵심은 “관찰 가능”과 “classifier가 요구하는 인과 근거가 있음”이 다르다는 점이다.
현재 caller는 process 종료와 여러 query 결과를 관찰할 수 있지만, 그것들을 하나의
operation-bound commit evidence로 만들지는 않는다.

## 4. Classifier input 대응표

현재 classifier의 input object는
[`D1SeedResultObservation`](../../lib/services/d1-seed-result-classifier.ts#L61-L71)의
다음 축만 받는다.

```text
executionStage: PREFLIGHT | WRITE | POST_WRITE_RECHECK | VERIFICATION | REPORT | DONE
write.attempted: boolean
write.processOutcome: NOT_STARTED | EXIT_ZERO | EXIT_NONZERO | TIMEOUT | PROCESS_LOSS | OUTPUT_LOSS
write.commitEvidence: NONE | WRITER_ACKNOWLEDGEMENT | TARGET_READ_BACK | OPERATION_BOUND_READ_BACK
verification: NOT_RUN | PASSED | MISMATCH | QUERY_FAILED | UNAVAILABLE
rollback: NOT_APPLICABLE | CONFIRMED | NOT_CONFIRMED
secondaryFailures: REPORT_WRITE_FAILED | CLEANUP_FAILED
```

검증과 결과 도출은
[`classifyD1SeedResult`](../../lib/services/d1-seed-result-classifier.ts#L241-L309)의
실제 규칙을 따른다. 따라서 다음처럼 매핑한다.

| 현재 관찰 사실 | classifier input으로 보존할 수 있는 표현 | 직접 결과 / 상태 | 주의점 |
| --- | --- | --- | --- |
| write 전 preflight 실패, write subprocess 미호출 | `PREFLIGHT`, `attempted=false`, `NOT_STARTED`, `NONE`, `NOT_RUN`, `NOT_APPLICABLE` | `FAILED_BEFORE_WRITE` | 기존 target에 row가 없다는 뜻이 아님 |
| write child가 시작되고 nonzero 종료, commit evidence 없음 | `WRITE`, `attempted=true`, `EXIT_NONZERO`, `NONE`, `NOT_RUN`, `NOT_APPLICABLE` | `COMMIT_OUTCOME_UNKNOWN` | rollback/no-commit으로 번역하지 않음 |
| write child가 code 0, 후속 verification을 아직 실행하지 않음 | `WRITE` 또는 `POST_WRITE_RECHECK`, `EXIT_ZERO`, `NONE`, `NOT_RUN`, `NOT_APPLICABLE` | `COMMITTED_BUT_UNVERIFIED` / `ACKNOWLEDGED` | acknowledgement는 durable commit proof가 아님 |
| write child code 0 후 plain target/read-back만 확인 | `EXIT_ZERO`, `TARGET_READ_BACK`, verification 사실에 맞는 값 | 보통 `COMMITTED_BUT_UNVERIFIED` / `ACKNOWLEDGED` | `TARGET_READ_BACK`은 operation-bound proof가 아님 |
| write timeout 또는 output loss를 신뢰할 수 있게 관찰 | `TIMEOUT` 또는 `OUTPUT_LOSS`, `NONE`, verification `NOT_RUN` 또는 `UNAVAILABLE` | `COMMIT_OUTCOME_UNKNOWN` | 현재 `runCapture`는 timeout/signal/output loss를 구분하지 않으므로 직접 생성 불가 |
| verification query/process/JSON 오류, write code 0 | `EXIT_ZERO`, `NONE` 또는 plain `TARGET_READ_BACK`, `QUERY_FAILED`/`UNAVAILABLE` | `COMMITTED_BUT_UNVERIFIED` / `ACKNOWLEDGED` | 실패 사실을 `NOT_RUN`으로 지우지 않음 |
| operation-bound evidence와 verification `PASSED` | `OPERATION_BOUND_READ_BACK`, `PASSED` | `COMMITTED_VERIFIED` | 현재 caller에는 이 evidence 생성 경계가 없음 |
| operation-bound evidence와 verification `MISMATCH` | `OPERATION_BOUND_READ_BACK`, `MISMATCH` | `COMMITTED_VERIFICATION_FAILED` | mismatch 원인을 classifier가 증명하는 것은 아님 |
| verification `PASSED` 또는 `MISMATCH`, operation-bound evidence 부족 | verification 사실을 그대로 유지하고 별도 observation envelope에 기록 | classifier `UNSUPPORTED_COMBINATION` | `PASSED`를 `NOT_RUN`으로 바꾸지 않음 |
| confirmed rollback | `rollback=CONFIRMED` | classifier `ROLLBACK_CONFIRMED_NOT_IN_RESULT_SET` | 현재 caller는 rollback을 확인하지 않음 |
| report/cleanup 오류 동반 | 유효한 primary input + `secondaryFailures`에 별도 코드 | primary result 유지 | 현재 caller는 cleanup을 secondary로 분리하지 않음 |
| invalid type/unknown enum/field contradiction | classifier에 전달하면 `INPUT_ERROR` | `INVALID_INPUT_TYPE`, `UNKNOWN_ENUM_VALUE`, `CONTRADICTORY_OBSERVATION` | caller 관찰을 임의로 정상 enum으로 정규화하지 않음 |

특히 정상 seed의 현재 실제 사실은 “write code 0, after snapshot 성공,
verification pass, success marker 출력”이다. 이를 classifier에 넣으려면
`verification=PASSED`가 되지만 `OPERATION_BOUND_READ_BACK`이 없으므로
`VERIFICATION_REQUIRES_OPERATION_BOUND_COMMIT_EVIDENCE`가 된다. 이 결과는
관찰 실패가 아니라 현재 계약과 증거 수준의 불일치이며, 연결 전에 해소해야 하는
blocker다.

## 5. Commit, target, causality 증거 경계

### 5.1 현재 target 선택

활성 command는 `--local`, binding `DB`, 기본 config `wrangler.local.jsonc`를
사용한다([`package.json`](../../package.json#L99-L101),
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L80-L83)).
`--config=`와 `--persist-to=`는 argument로 바뀔 수 있고, source root도
`--source-root=` 또는 `SECURIUM_CONTENT_V2_SOURCE_ROOT`로 바뀔 수 있다
([`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L56-L78),
[`security-content-upgrade-v3.mjs`](../../scripts/security-content-upgrade-v3.mjs#L370-L376)).
`.env.local`은
[`load-local-env.mjs`](../../scripts/load-local-env.mjs#L3-L31)에서 환경변수 이름을
읽어 process 환경에 채운다.

따라서 현재 코드에서 말할 수 있는 것은 caller가 local D1 모드와 특정 config
경로/DB binding을 선택했다는 사실까지다. 설정 문자열만으로 provider가 실제로
사용한 target identity가 caller 의도와 일치한다고 증명하지 않는다. local
`--persist-to`와 managed/remote D1 identity를 같은 기준으로 취급하지 않으며,
이 command를 managed 실행 승인으로 표현하지 않는다.

PostgreSQL seed branch는 별도 `seed:postgres` action이고 별도 approval/env 및
connection path를 갖는다. 그것의 transaction client 경계를 D1의 여러 Wrangler
subprocess에 적용하지 않는다.

### 5.2 operation-bound evidence가 아직 없는 이유

현재 `runCapture`의 write 인자에는 script, target binding/config, optional
persistence argument, temp SQL path가 있을 뿐 operation ID나 durable marker가
없다. after snapshot과 verification query는 별도 subprocess이고, 그 결과에는
다음 연결 정보가 없다.

- 어느 target identity가 실제로 사용됐는지에 대한 provider 관찰
- 어떤 immutable payload/version/mapping을 의도했는지에 대한 bounded source identity
- 같은 row가 실행 전부터 있었는지, exact replay인지 여부
- 경쟁 writer가 같은 row를 만들었는지 여부
- write acknowledgement와 after read-back 사이의 operation causality
- snapshot/verification 결과가 같은 invocation의 commit을 관찰했다는 proof

단순 UUID, timestamp, local receipt file, source/payload hash만으로 이 공백을
채우지 않는다. 그것들은 상관관계 또는 동일성 비교에 사용할 수 있지만 권한,
실행 주체, durable commit, causality를 단독으로 증명하지 않는다. 현재 schema에
새 durable operation marker가 필요할 수 있으나, 그 marker의 의미·소유자·transaction
경계는 별도 선행 결정이며 이번 문서에서 구현하지 않는다.

## 6. Unsupported 조합과 연결 전 처리

| 경우 | 현재 확인 가능한 사실 | classifier 수용 여부 | 가능한 판정 또는 unsupported | 현재 caller 동작 | 연결 전 필요한 결정 |
| --- | --- | --- | --- | --- | --- |
| write 전 실패 | preflight/query/source 준비 실패, write child 미호출 | 수용 가능 | `FAILED_BEFORE_WRITE` | fail code와 nonzero | write 미시도 사실을 structured observation으로 보존 |
| write process nonzero | child가 실패 code로 닫힘. transaction rollback 여부는 모름 | 수용 가능 | `COMMIT_OUTCOME_UNKNOWN` | `SECURITY_CONTENT_V3_PROCESS_FAILED`, nonzero | signal/exit/error와 output availability 분리 |
| write timeout/process loss | 현재 timeout 없음, signal을 별도 보존하지 않음 | future input은 수용 가능 | `TIMEOUT`/`PROCESS_LOSS`이면 `COMMIT_OUTCOME_UNKNOWN` | 현재는 대개 nonzero 또는 process-level failure | finite timeout과 signal/close 관찰 계약 |
| write exit 0, output parse 실패 | write CLI code 0인지 query/write output shape인지 구분 필요 | write 사실만 넣으면 제한 수용 | verification parse 실패는 `QUERY_FAILED`/`UNAVAILABLE`; 성공으로 확정하지 않음 | write는 merged output, query는 JSON boundary error | write response parse와 verification parse를 별도 축으로 보존 |
| write response 후 snapshot 실패 | write acknowledgement 뒤 after query/process/JSON 오류 | 수용 가능 | `COMMITTED_BUT_UNVERIFIED`, verification `QUERY_FAILED` 또는 `UNAVAILABLE` | fail code nonzero | write acknowledgement와 query failure를 같은 사건으로 합치지 않음 |
| verification `true`/pass, commit evidence 부족 | aggregate verification query가 기대 metric을 통과하고 marker 출력 | **unsupported** | `VERIFICATION_REQUIRES_OPERATION_BOUND_COMMIT_EVIDENCE` | 현재 marker와 exit 0 출력 | operation-bound evidence 없이는 classifier 호출 결과를 success로 사용하지 않음 |
| verification `false`/mismatch, commit evidence 부족 | snapshot equality 또는 verification metric mismatch | **unsupported** | 동일 unsupported code; mismatch 사실은 별도 보존 | fail code와 nonzero | mismatch를 query error/not-run으로 바꾸지 않고 원인·scope read-only 확인 |
| verification query 오류 | query nonzero, JSON missing, parse exception 가능 | 수용 가능 | write code 0이면 `COMMITTED_BUT_UNVERIFIED` + `QUERY_FAILED`/`UNAVAILABLE` | `SECURITY_CONTENT_V3_D1_QUERY_FAILED` 또는 parse failure | JSON shape/empty output/transport loss 분리 |
| confirmed rollback | 현재 D1 caller는 rollback 관찰 API가 없음 | **unsupported** | `ROLLBACK_CONFIRMED_NOT_IN_RESULT_SET` | rollback을 보고하지 않음 | rollback proof와 별도 결과 state 계약 선행 |
| cleanup/report 오류 동반 | temp `rm` 실패 가능, report persistence 자체는 없음 | secondary만 수용 | primary state를 유지하고 `CLEANUP_FAILED`/`REPORT_WRITE_FAILED` 별도 | cleanup error가 원래 오류를 가릴 수 있음 | finally 오류를 secondary로 캡처하고 report 저장 경계 별도 결정 |
| 원래 primary 오류가 이미 있음 | preflight/write/verification failure가 먼저 발생할 수 있음 | primary + secondary 수용 | secondary가 primary를 덮지 않음 | 현재는 단일 fail/exit path | primary observation을 먼저 고정하고 cleanup/report 오류를 추가 |
| plain row/read-back만 존재 | target query가 row/count를 반환할 수 있음 | 제한 수용 | `TARGET_READ_BACK`은 `CONFIRMED`가 아니며, pass/mismatch와 함께 넣으면 verification unsupported 가능 | 현재 row identity/provenance 미보존 | row가 기존/경쟁 write인지 operation-bound인지 결정 |

classifier에 맞추기 위해 관찰 사실을 삭제하거나 다른 값으로 대체하지 않는다.
예를 들어 verification 성공을 관찰했지만 operation-bound evidence가 없으면
성공을 `NOT_RUN`으로 바꾸지 않고, observation envelope에는 `PASSED`와 evidence
부족을 함께 남기며 classifier 결과는 unsupported로 다룬다.

## 7. 연결 전략 비교와 권고

| 전략 | 장점 | 위험 / 선행 조건 | 평가 |
| --- | --- | --- | --- |
| 관찰 가능한 부분만 제한적으로 연결 | 기존 exit 0/nonzero를 유지하며 preflight failure와 unknown outcome부터 구조화 가능 | 정상 verification pass/mismatch가 operation-bound 부족으로 unsupported가 될 수 있음 | 작은 첫 단계로 적합. unsupported를 명시적으로 노출해야 함 |
| classifier 계약을 먼저 보완 | caller의 aggregate verification을 더 쉽게 표현할 수 있음 | commit 증거가 없는 성공을 committed state로 오해할 위험. 기존 negative boundary 재결정 필요 | 현재 근거로 권고하지 않음 |
| 별도 evidence 수집 계약을 먼저 확정 | target/payload/version/replay/causality를 먼저 정의하여 `COMMITTED_*`를 안전하게 사용 가능 | durable marker/transaction/provider 경계 및 schema 결정이 필요 | `COMMITTED_VERIFIED` 연결의 선행 조건 |

### 권고: 가장 작은 안전한 순서

1. **관찰 envelope만 설계·구현한다.** `executionStage`, write child 시작 여부,
   process outcome, stdout/stderr 수신 상태, parse 상태, snapshot/verification
   결과, cleanup secondary를 각각 보존한다. existing exit 0/nonzero는 바꾸지 않는다.
2. **현재 caller의 제한 결과를 먼저 연결한다.** write 전 실패는
   `FAILED_BEFORE_WRITE`, 시작 후 nonzero는 `COMMIT_OUTCOME_UNKNOWN`, write code 0
   후 verification 미완료/query 오류는 `COMMITTED_BUT_UNVERIFIED`로 제한한다.
3. **verification pass/mismatch는 사실대로 유지하되, evidence 부족이면
   classifier unsupported로 명시한다.** 성공을 숨기거나 `NOT_RUN`으로 정규화하지
   않는다. 이 상태에서 자동 recovery나 재실행을 하지 않는다.
4. **별도 operation-bound evidence 계약을 확정한다.** target identity, immutable
   plan identity, replay/competing writer 구분, write-to-read-back causality를
   어떤 trusted layer가 어떻게 증명할지 결정한 뒤에만 `OPERATION_BOUND_READ_BACK`
   을 사용할 수 있다.
5. **그 후 classifier 호출 위치와 report/secondary 저장 경계를 결정한다.**
   report 실패는 primary state를 변경하지 않으며, numeric exit code 변경은 별도
   caller/CI 계약 확인 뒤에 결정한다.

현재 정상 성공 경로가 unsupported가 될 수 있다는 사실은 연결 blocker다. 이를
숨기지 않는 것이 classifier의 보수적 경계를 유지하는 최소 안전 단계다.

## 8. 최소 후속 구현 범위와 비실행 합성 시나리오

### 8.1 후보 파일·함수 단위

후속 implementation 후보는 다음으로 한정한다.

| 후보 위치 | 제안 책임 | 금지 범위 |
| --- | --- | --- |
| `scripts/security-content-upgrade-v3.mjs` — `seedD1`, `d1Query`, `runCapture` | stage envelope, child started/exit/signal/timeout, stdout·stderr availability, parse status, verification result와 cleanup secondary 분리 | 실제 caller 연결을 이번 문서에서 수행, exit code 자동 변경, raw output 무조건 저장 |
| `scripts/run-wrangler.mjs` — child boundary | wrapper가 전달한 process 종료·signal을 잃지 않도록 bounded observation 제공 | target을 local에서 managed/remote로 변경, credential 출력 |
| `lib/data/security-content-upgrade-v3.mjs` — generated SQL transaction | operation marker를 도입하기로 별도 결정된 경우에만 transaction 내부의 제한된 marker/guard 설계 | migration/schema 변경, 근거 없는 rollback 또는 abort 주장 |
| `lib/services/d1-seed-result-classifier.ts` — existing pure function | 유효한 observation만 분류하고 unsupported/input error를 그대로 반환 | unsupported 회피를 위한 coercion, caller side effect |
| 별도 focused boundary test | synthetic subprocess/read-back/parse/cleanup seams로 mapping 검증 | 실제 DB, managed D1, learner/Evidence 데이터 접근 |

### 8.2 최소 allowlist

후속 report 또는 envelope에 제안할 최소 필드는 다음과 같다. 실제 schema와 version은
별도 결정한다.

```text
schema_version
opaque_operation_id                 # correlation only
target_scope                        # display scope, identity proof 아님
target_identity_evidence[]          # verified evidence code만
source_plan_hash                    # comparison/replay aid, commit proof 아님
execution_stage
write.attempted
write.process_outcome
write.commit_evidence
verification
rollback
secondary_failures[]
error_class
report_status                       # persistence를 선택한 경우
```

무조건 보존하지 않는 값: raw stdout/stderr, 전체 generated SQL, row payload,
content body, learner/Evidence data, credential, 전체 environment, 개인 절대 경로,
소유권 검증에 불필요한 fixture/container 정보. sanitized error tail이 필요해도
allowlist와 길이 제한을 별도로 확정한다.

### 8.3 실행하지 않는 합성 시나리오

다음은 향후 bounded seam test 계획이며, 이 문서 작성에서는 실행하지 않았다.

| 시나리오 | 보존해야 할 사실 | 기대 classifier 처리 |
| --- | --- | --- |
| subprocess 시작 전 입력/source/preflight 오류 | write 미시도, 기존 target 상태 미확인 | `FAILED_BEFORE_WRITE` 가능 |
| 정상 write response만 수신 | child exit 0, operation-bound evidence 없음 | `COMMITTED_BUT_UNVERIFIED` / `ACKNOWLEDGED` |
| write timeout 또는 process loss | write 시작, commit 여부 미확정 | `COMMIT_OUTCOME_UNKNOWN` |
| write/query output loss 또는 malformed JSON | output 부재/shape 오류, 명시적 process 실패와 분리 | query 결과는 `QUERY_FAILED`/`UNAVAILABLE`; commit은 별도 판단 |
| 기존 row가 있는 exact replay | row 존재, replay identity 비교 필요 | plain `TARGET_READ_BACK`만으로 confirmed 금지 |
| divergent existing row | immutable mismatch와 대상 ID | primary conflict/error 보존, 자동 update 금지 |
| after snapshot 실패 | write acknowledgement 뒤 snapshot query/process/parse 실패 | `COMMITTED_BUT_UNVERIFIED` 가능, rollback 아님 |
| verification pass 또는 mismatch + evidence 부족 | verification 사실은 `PASSED`/`MISMATCH` 그대로 | classifier unsupported; `NOT_RUN`으로 변경 금지 |
| 모순된 observation | 예: attempted false인데 write outcome exit zero | `CONTRADICTORY_OBSERVATION` input error |
| cleanup 실패 동반 | primary observation과 cleanup failure 동시 존재 | primary 유지 + `CLEANUP_FAILED` secondary |
| operation-bound evidence + verification pass/mismatch | trusted layer가 identity/payload/version/causality까지 확인 | 각각 `COMMITTED_VERIFIED` 또는 `COMMITTED_VERIFICATION_FAILED` |

이 시나리오들은 실제 D1 재현이나 PR CI 재실행의 PASS 근거가 아니다.

## 9. 비실행·미구현 상태

이 설계 작업에서 다음을 수행하지 않았다.

- DB, Docker, Wrangler, local seed, migration guard, test, build, CI 실행
- managed/shared/learner database 접근 또는 credential/environment 값 출력
- caller에 classifier 연결, process exit 변경, report persistence, recovery/replay
- operation-bound commit evidence 수집 또는 durable marker/migration 구현
- PostgreSQL seed/apply 경로의 전체 재검토
- 종료된 PR #190의 review 재개, push, PR, merge/rebase, branch 삭제

유지하는 상태:

```text
D1_CALLER_INTEGRATION: NOT_IMPLEMENTED
OPERATION_BOUND_COMMIT_EVIDENCE_COLLECTION: NOT_IMPLEMENTED
D1_POST_COMMIT_VERIFICATION_LIMITATION: UNCHANGED
DATABASE_EXECUTION_THIS_GOAL: NOT_RUN
MANAGED_RUNTIME_VALIDATION: NOT_RUN
HISTORICAL_BACKFILL: NOT_EXECUTED
OPERATIONAL_RECOVERY_EXECUTION: NOT_RUN
REMOTE_MUTATION: NONE
```

결론적으로 현재 caller는 write 전 미시도, process 종료, 일부 query/verification
결과를 관찰할 수 있지만, 정상 verification 성공을 operation-bound durable commit으로
증명할 수 없다. 따라서 첫 연결은 관찰값을 잃지 않는 제한적 envelope와
unsupported 보존이어야 하며, `COMMITTED_*` 연결은 별도 evidence 계약 확정 뒤로
남겨야 한다.
