# D1 standalone seed result and recovery contract

상태: 설계 제안만 포함한다. 이 문서의 상태명, exit code, report field는
현재 제품에 구현되어 있지 않다.

검토 기준은 `origin/main`의 `83f89fb57a85365c12258727ca8caeff3550fd10`이다.
현재 구현은 `scripts/security-content-upgrade-v3.mjs`,
`lib/data/security-content-upgrade-v3.mjs`,
`tests/security-content-upgrade-v3.test.ts`, `package.json`을 직접 대조했다.
이전 standalone 검토의 관찰은 다음 보고서에서 재사용했지만, 이 문서에는
그 파일을 저장소 내 영구 상대 링크로 참조하지 않는다.

- `standalone-seed-transaction-boundary-review-20260912.md`
- `standalone-postgres-seed-atomic-verification-repair-20260913.md`
- `standalone-postgres-seed-atomic-review-ci-20260914.md`

이번 목표에서는 DB, Docker, Wrangler, 전체 테스트, CI를 실행하지 않았다.

## 문제와 사용자·운영 영향

standalone D1 seed는 데이터 쓰기와 외부 verification을 하나의 caller-owned
세션으로 실행하지 않는다. generated SQL에는 `BEGIN TRANSACTION;`과 `COMMIT;`이
있지만, caller의 다음 단계인 protected snapshot 확인과 `verifyD1`은 별도
Wrangler CLI 호출이다. 따라서 다음 두 사실이 동시에 가능하다.

1. generated SQL의 쓰기 transaction은 commit되었다.
2. 그 뒤의 verification query, 결과 판정, subprocess 통신 또는 report 처리가
   실패하여 caller는 nonzero로 끝난다.

현재의 일반 실패 값 하나로 이 둘을 표현하면 운영자는 저장되지 않은 실패와
이미 저장됐지만 확인되지 않은 실패를 구분할 수 없다. 그 결과 다음 재실행이
중복 생성인지, immutable 충돌인지, 단순한 확인 재시도인지 판단하기 어렵다.

이 문서는 저장 상태를 추측하거나 자동 복구를 허가하지 않는다. 먼저 실행 단계,
write/commit 결과, verification 결과, 각 결과를 뒷받침하는 관찰 근거를 분리하고,
그 조합으로 운영 가능한 결과를 표현하는 계약을 제안한다.

## 현재 활성 실행 경로와 transaction 경계

`package.json`의 활성 D1 경로는 다음이다.

```text
content:security-certification:v3:seed:d1-local
  -> node scripts/security-content-upgrade-v3.mjs seed:d1-local
```

현재 `seedD1`의 실제 순서는 다음과 같다.

```text
source read / plan 생성
  -> prerequisite 및 protected-progress D1 CLI query
  -> immutable-content preflight D1 CLI query
  -> protected course snapshot(before) D1 CLI query
  -> 임시 generated SQL 파일 생성
  -> D1 CLI d1 execute --local --file
       BEGIN TRANSACTION;
       contents 쓰기 및 immutable guard
       course/question/mapping/ontology 쓰기
       COMMIT;
  -> protected course snapshot(after) D1 CLI query
  -> verifyD1 D1 CLI query
  -> 성공 marker 출력
```

직접 확인한 현재 경계는 다음과 같다.

- `seedD1`의 preflight, before/after snapshot, verification은 각각
  `d1Query`를 거치는 별도 `scripts/run-wrangler.mjs` subprocess다.
- `generateSecurityContentV3Sql(..., { dialect: "d1" })`는
  `BEGIN TRANSACTION;`으로 시작하고 `COMMIT;`으로 끝난다.
- generated SQL의 immutable guard는 content materialization 뒤, course lesson
  mapping 전에 실행된다. 기존 content row의 immutable 값이 다르면
  의도적으로 이미 존재하는 ID를 다시 삽입하여 해당 transaction을 실패시킨다.
- D1 caller의 `runCapture`는 현재 child stdout/stderr를 한 문자열로 합치고,
  유한 timeout을 두지 않으며, write subprocess가 nonzero면 `fail`과
  `process.exit(1)`로 끝난다.
- 성공 marker `SECURITY_CONTENT_V3_D1_LOCAL_APPLIED`는 after snapshot과
  `verifyD1`까지 끝난 뒤에만 출력된다. 그러나 그 앞의 generated SQL은 이미
  terminal `COMMIT`을 실행한다.
- `verify:d1-local`은 별도 실행 명령이다. 현재는 이전 seed operation, target
  identity, source plan을 결과에 결합하는 report 계약이 없다.

PostgreSQL standalone seed에 추가된 caller-owned transaction 개선은 이 D1
경로에 적용됐다는 근거가 없다. PostgreSQL의 reserved client, 같은 transaction
client, verification-before-commit 계약을 D1의 여러 Wrangler CLI 호출에
그대로 가정하지 않는다.

## 관찰 가능한 근거와 관찰 불가능한 상태

현재 caller와 CLI에서 관찰할 수 있는 사실은 제한적이다.

| 관찰 | 말할 수 있는 것 | 아직 말할 수 없는 것 |
| --- | --- | --- |
| preflight가 write 호출 전에 실패함 | 이 실행의 write subprocess는 시작되지 않음 | target에 기존 row가 없거나 다른 이전 실행이 없다는 것 |
| write subprocess exit `0` | CLI가 generated SQL 실행을 성공으로 반환함 | 별도 read-back 없이 모든 기대 row가 durable하게 존재한다는 것 |
| write subprocess nonzero | 실행이 성공 응답을 반환하지 않음 | transaction rollback 완료 또는 commit 미발생 |
| after snapshot/read-back 성공 | 특정 query의 결과와 target에서 읽힌 row를 확인함 | verification 전체 조건이 통과했다는 것 |
| verification false | 읽은 상태가 기대 조건과 맞지 않음 | 원인, 소유 writer, 안전한 보상 삭제 방법 |
| verification query/process/JSON 오류 | verification 결과를 얻지 못함 | seed가 rollback되었거나 저장되지 않았다는 것 |
| process timeout/connection/output loss | caller가 성공 응답을 받지 못함 | server-side commit 여부 |

이전 bounded disposable 관찰은 synthetic D1 write 뒤 injected post-commit
failure에서 row가 남을 수 있음을 보여주었지만, 실제 content mismatch,
운영 DB 손상, 과거 incident를 증명하지 않는다. 이전 PostgreSQL repair와 CI는
PostgreSQL의 verification-before-commit 경계를 검증했을 뿐 D1의 경계를
변경하거나 검증하지 않았다.

## 제안 결과 모델

다음은 후속 구현을 위한 제안이다. 현재 코드의 enum이나 report schema가 아니다.

### 독립 축

| 축 | 제안 값 | 의미 |
| --- | --- | --- |
| `execution_stage` | `PREFLIGHT`, `WRITE`, `POST_WRITE_RECHECK`, `VERIFICATION`, `REPORT`, `DONE` | caller가 마지막으로 시작 또는 완료한 단계 |
| `write_commit` | `NOT_ATTEMPTED`, `FAILED`, `ACKNOWLEDGED`, `CONFIRMED`, `UNKNOWN` | 쓰기 시도와 commit에 대한 결과. `ACKNOWLEDGED`는 writer 성공 응답만, `CONFIRMED`는 target read-back 근거까지 포함한다. |
| `verification` | `NOT_RUN`, `PASSED`, `MISMATCH`, `QUERY_FAILED`, `UNAVAILABLE` | seed 결과 검증의 독립 결과 |
| `rollback` | `NOT_APPLICABLE`, `CONFIRMED`, `NOT_CONFIRMED` | provider 또는 target 근거가 있는 경우에만 `CONFIRMED` |
| `evidence` | 구조화된 관찰 목록 | process exit, provider response, read-back, rollback 관찰, transport loss 등을 각각 기록 |

`COMMITTED_BUT_UNVERIFIED`는 write commit에 대한 성공 응답 또는 제한된
read-back은 있으나 외부 verification 결과를 얻지 못한 제안 결과다.
`COMMIT_OUTCOME_UNKNOWN`은 성공 응답을 받지 못해 commit 여부를 결정할 수
없는 제안 결과다. 두 이름은 서로 대체하지 않는다.

operation ID, timestamp, source hash, target hash만으로 commit을 증명하지
않는다. hash는 동일성 비교와 replay 결합에 사용되는 입력이지 저장소 상태의
commit 증거가 아니다.

## 실패 상태별 exit/report/복구 계약

아래 표의 report 값과 exit 동작은 제안이다. 숫자형 exit code는 현재 호출자를
전수 확인하기 전까지 확정하지 않으며, 호환 가능한 최소안은 기존 nonzero
실패를 유지하고 report로 의미를 확장하는 것이다.

| 상황 | 현재 가능한 관찰 | 확정 가능한 저장 상태 | 제안 report와 exit | 자동 재실행 | 필요한 후속 확인 | 해서는 안 되는 주장 |
| --- | --- | --- | --- | --- | --- | --- |
| A. 쓰기 전 입력·설정·preflight 실패 | write subprocess가 시작되지 않았다는 caller 사실 | 이번 operation의 write는 시도되지 않음. 기존 target 상태는 미확인 | `FAILED_BEFORE_WRITE`; `write_commit=NOT_ATTEMPTED`, `verification=NOT_RUN`; 기존 호환 nonzero | 명시적으로 write 미시도 사실이 보존될 때만 수정 후 controlled retry 가능. 불확실하면 금지 | 입력, source root, config, target binding을 수정하고 preflight 재확인 | “DB가 완전히 변하지 않았다” 또는 “동일 operation이 저장되지 않았다” |
| B. transaction 내부 write/guard 오류 | write CLI가 nonzero 또는 provider 오류를 반환 | rollback은 provider/target 근거가 있을 때만 확정. D1 caller의 현재 exit만으로는 부족 | rollback 근거가 있으면 `WRITE_FAILED_ROLLBACK_CONFIRMED`; 아니면 `write_commit=UNKNOWN`, `rollback=NOT_CONFIRMED`; 모두 nonzero | rollback confirmed이고 immutable identity가 동일한 경우에만 controlled retry 검토. 그 외 자동 재실행 금지 | read-only 대상 재확인, 오류 분류, immutable row와 downstream mapping 확인 | nonzero를 rollback 완료 또는 commit 미발생으로 번역 |
| C1. commit 후 verification false/mismatch | write 성공 응답과 verification query의 실제 부정 결과 | read-back이 대상 row를 확인하면 commit은 `CONFIRMED`; 검증 조건은 실패 | `COMMITTED_VERIFICATION_FAILED`; `write_commit=CONFIRMED`, `verification=MISMATCH`; nonzero | 금지 | 대상 DB identity, payload/version, mapping 및 mismatch 원인을 read-only로 대조 | rollback, 자동 DELETE, 새 snapshot 생성, 운영 데이터 손상 확정 |
| C2. commit 후 verification query/process/JSON 오류 | write 응답은 성공했으나 외부 verification 결과를 얻지 못함 | 저장 상태는 verification 미완료. write response만으로 durable 전체 상태를 확정하지 않음 | `COMMITTED_BUT_UNVERIFIED`; `write_commit=ACKNOWLEDGED` 또는 제한된 `CONFIRMED`, `verification=QUERY_FAILED`/`UNAVAILABLE`; nonzero | 금지. 먼저 read-only verification | 동일 target과 동일 source plan에 결합한 read-only recheck | verification 실패를 data mismatch 또는 rollback으로 단정 |
| D. commit 여부 미확정 | write timeout, process 종료, connection/output loss, 성공 응답 손실 | commit 여부 미확정 | `COMMIT_OUTCOME_UNKNOWN`; `write_commit=UNKNOWN`, `verification=NOT_RUN` 또는 `UNAVAILABLE`; nonzero | 금지 | exact target identity로 read-only recheck, immutable payload/version과 mapping 확인 | 실패 응답만으로 rollback 추정, 즉시 seed 재실행, DELETE 후 재생성 |
| E. commit과 verification 모두 성공 | write 성공, target read-back, 모든 verification 조건 성공, success marker 생성 | 기대 seed 상태가 확인됨 | `COMMITTED_VERIFIED`; `write_commit=CONFIRMED`, `verification=PASSED`; seed exit `0` | 불필요. exact replay 요청은 별도 idempotency 계약에 따름 | report 보존과 후속 모니터링 | 성공 marker만으로 다른 target 또는 운영 DB까지 검증됐다고 주장 |

`exit 0`은 E의 조건, 즉 write/commit evidence와 verification이 모두 성공한
경우에만 허용한다. report 파일 생성 실패가 발생해도 이미 계산한 seed 결과를
성공으로 덮어쓰거나 반대로 원래 seed 오류를 report 오류로 바꾸지 않는다.
report가 저장되지 않으면 seed 결과와 별개로 `report_write_failed`를 남기고
nonzero를 유지하되, 복구에 필요한 최소한의 sanitized stderr를 시도한다.

### 최소 호환 exit 설계

현재 `seedD1` 호출자는 내부 `fail`에서 `process.exit(1)`을 사용하고,
`seed:d1-local`은 성공 후 `process.exit(0)`을 사용한다. 현재 코드에서
특정 숫자별 분기 호출자가 확인됐다는 근거는 없다. 따라서 후속 구현의 최소안은
다음과 같다.

- seed success는 계속 `0`으로 둔다.
- A-D는 기존과 같이 nonzero로 유지한다.
- 의미 구분은 숫자보다 구조화 report의 `result_state`, 축별 결과, evidence로
  제공한다.
- 별도 exit code를 도입하려면 npm script, CI runner, shell caller, 운영 도구가
  `1` 외의 값을 어떻게 처리하는지 먼저 확인한다. 그 확인 전에는 숫자값을
  문서 계약으로 고정하지 않는다.

## replay 및 immutable identity 보존

복구는 “다시 실행해도 안전하다”는 일반 문장이 아니라, 동일 target과 동일
immutable identity를 재확인한 경우로 제한한다.

1. target binding을 확인한다. 최소한 D1 local/remote 구분, 명시적 config,
   persistence/database identity, operation 대상 scope가 일치해야 한다.
2. source plan identity와 content/question IDs, version, immutable payload
   projection을 비교한다. 전체 SQL이나 content 본문은 report에 넣지 않는다.
3. 기존 row가 있으면 exact existing replay와 divergent payload를 구분한다.
   동일 immutable payload/version이면 exact replay는 새 snapshot을 만들지 않는
   기존 계약을 보존한다.
4. 동일 ID의 payload/version이 다르면 immutable conflict로 fail closed 한다.
   downstream mapping을 먼저 만들거나, 기존 row를 UPDATE하여 충돌을 숨기지
   않는다.
5. course lesson, question link, question version, ontology mapping 등
   downstream mapping의 정합성을 read-only로 확인한다.

다음 복구는 제안하지 않는다.

- commit 여부를 모른 채 자동 seed 재실행
- direct content UPDATE로 immutable 충돌 해소
- revision, Evidence, progress를 우회한 보상 write
- 무조건 DELETE 후 재생성
- 다른 writer의 row나 mapping을 운영자가 소유한다고 가정한 cleanup

기존 immutable preflight와 transaction 내부 TOCTOU guard는 반드시 유지한다.
그 guard가 통과했다는 사실도 외부 verification 성공이나 commit 증명과 같은
의미로 확대하지 않는다.

## 로그·민감정보·소유권 경계

후속 report에는 최소한 다음만 제안한다.

```json
{
  "schema_version": 1,
  "operation_id": "opaque-operation-id",
  "target_scope": "d1-local",
  "source_plan_hash": "hash-for-comparison-only",
  "execution_stage": "VERIFICATION",
  "write_commit": "ACKNOWLEDGED",
  "verification": "QUERY_FAILED",
  "rollback": "NOT_APPLICABLE",
  "error_class": "D1_VERIFICATION_PROCESS_FAILED",
  "evidence": ["WRITE_PROCESS_EXIT_ZERO", "VERIFICATION_OUTPUT_UNAVAILABLE"],
  "report_written": true
}
```

실제 field 이름과 schema version은 구현 전에 확정한다. 다음은 출력하지 않는다.

- credential, connection string, 전체 environment variables
- 전체 generated SQL, content body, answer payload
- learner 데이터, 개인 evidence, unrelated row
- 개인 절대 경로, 임시 fixture 경로, 소유권 검증에 불필요한 container 정보

operation ID와 timestamp는 상관관계 추적용이다. commit proof, 권한, source
authority로 사용하지 않는다. target ownership은 명시적 local persistence
scope와 안정된 target identity를 통해 확인하고, report 자체를 권한 증명으로
취급하지 않는다.

cleanup이나 report 저장 오류가 원래 seed 오류를 덮지 않도록 원인과 후속 오류를
별도 field로 기록한다. report 파일을 만들 수 없으면 원래 `result_state`를
메모리상 유지한 채, sanitized error와 report failure를 분리하여 nonzero로
끝낸다.

## 후속 구현 범위와 검증 시나리오

이번 문서는 구현하지 않는다. 후속 구현 후보는 다음으로 제한한다.

| 후보 | 제안 범위 | 금지 범위 |
| --- | --- | --- |
| `scripts/security-content-upgrade-v3.mjs` | 별도 stdout/stderr, finite subprocess timeout, 축별 result envelope, read-only recheck, report 오류 분리 | D1 transaction이 여러 CLI 호출에 걸쳐 유지된다고 가정 |
| `lib/data/security-content-upgrade-v3.mjs` | pinned D1/Wrangler에서 검증된 SQL-expressible guard만 generated transaction 내부에 추가 | 근거 없는 abort 문법, schema/migration 변경 |
| `tests/security-content-upgrade-v3.test.ts` | generator guard 순서, report/exit compatibility, source/target binding 계약 | 실행하지 않은 결과를 PASS로 기록 |
| 새 focused D1 boundary test | subprocess 결과와 synthetic read-back을 이용한 결과 분류 테스트 | 실제 DB, managed D1, learner 데이터 접근 |

SQL로 표현할 수 있는 count, orphan, mapping 조건은 pinned runtime에서 abort가
검증된 방법으로 generated transaction 내부 guard로 옮길 수 있다. 반면 caller가
별도 read로 얻는 protected snapshot 비교, subprocess health, JSON parsing,
connection/output loss는 현재 CLI 경계상 외부 verification으로 남는다. 외부
verification을 같은 transaction에 넣을 수 있다고 현재 실행 방식만으로
가정하지 않는다.

후속 회귀 계획은 다음이며, 이 문서 작성 중 실행하지 않았다.

- preflight 실패: write 미시도와 기존 상태 미확인을 분리
- write-time immutable conflict: guard 실패, rollback 근거, downstream mapping
  부재를 분리
- commit 확인 후 verification false: `COMMITTED_VERIFICATION_FAILED`
- commit 확인 후 verification query 오류: `COMMITTED_BUT_UNVERIFIED`
- write subprocess timeout 또는 output loss: `COMMIT_OUTCOME_UNKNOWN`
- 원래 seed 오류와 report/cleanup 오류 동시 발생: 원인 보존
- exact replay: 새 snapshot 없이 동일 identity로 종료
- divergent replay: immutable conflict로 거부
- 부분 상태 또는 잘못된 target DB: 성공으로 처리하지 않음

각 시나리오는 실제 seed 수행 대신 bounded synthetic seam 또는 읽기 전용
fixture 계약으로 검증할 수 있어야 한다. 성공한 focused test가 provider SQL의
실제 조회량, managed D1 durability, 동시 변경 중 snapshot 일관성을 증명하지는
않는다.

## 미해결 결정 사항과 범위 제한

- Wrangler/D1 CLI가 현재 pinned runtime에서 “commit acknowledged”와 “durable
  target read-back”을 어떤 출력과 query로 구분해 제공하는지 후속 구현에서
  확인해야 한다.
- D1 transaction 내부에서 verification failure를 원자적으로 abort할 수 있는
  SQL 표현과 오류 전파 방식은 실행 검증 전까지 결정하지 않는다.
- report의 저장 위치, 보존 기간, 파일 ownership, stdout/stderr 우선순위가
  정해지지 않았다.
- 특정 numeric exit code, retry supervisor 연동, alert severity는 현재
  호출자 조사 전까지 확정하지 않는다.
- local `--persist-to`, remote D1, managed runtime의 target identity와
  read-back 계약은 별도 설계가 필요하다.
- concurrent writer가 있는 동안의 snapshot 일관성과 provider collation,
  실제 운영 데이터의 누락 여부는 이 결과 계약의 범위를 넘는다.

이 문서는 현재 D1 standalone seed의 post-commit verification 한계를
`D1_POST_COMMIT_VERIFICATION_LIMITATION: UNCHANGED`로 유지한다. PostgreSQL
standalone repair가 D1에 적용됐다고 주장하지 않으며, 결과 분류와 복구 절차를
설계했을 뿐 구현·운영 승인·복구 실행을 의미하지 않는다.
