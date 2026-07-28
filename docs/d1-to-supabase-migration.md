# D1에서 Supabase PostgreSQL로 이전

> 도구 준비 문서다. 이번 Sprint에서 Production export, import 또는 cutover를 수행하지 않았다.

## 사전 점검

1. D1 백업과 복구 가능성을 확인한다.
2. 대상 Supabase가 Preview/Production 중 무엇인지 명시한다.
3. PostgreSQL schema diff와 migration SQL을 검토한다.
4. 테이블별 건수, 예상 export 크기, import 시간과 잠금 시간을 추정한다.
5. 실행자, 검증자와 rollback 결정자를 지정한다.

## Schema와 dry-run

```bash
npm run db:postgres:generate
npm run db:postgres:validate
npm run migration:d1:export -- --local --output work/d1-export
npm run migration:postgres:import -- --output work/d1-export
npm run migration:verify -- --output work/d1-export
```

이전 명령은 기본적으로 외부 DB를 읽거나 쓰지 않고 계획만 출력한다.

## Export

실제 실행은 명시적 `--execute`가 필요하다. 테이블을 FK 순서와 고정 PK 순서로 읽고, batch NDJSON과 건수 manifest를 생성한다. 행 원문은 로그에 출력하지 않는다.

Production D1 원격 export는 `--remote`, `--confirm-production-read`와 별도 승인 환경변수를 모두 요구한다.

## Import

Import는 `DIRECT_URL`, 로컬 `psql`, `--execute`, `--confirm-import`와 승인 환경변수가 필요하다.

- FK 순서로 처리
- batch별 transaction
- `ON CONFLICT DO NOTHING`
- 완료 테이블 checkpoint
- 재실행 안전성
- 실패 시 오류 코드만 출력

## 검증

모든 테이블 row count와 FK orphan을 비교한다. users, courses, enrollments, questions, attempts, wrong notes, mock exam attempts, 관리자 역할과 감사로그 건수는 운영 검증 기록에 별도로 표시한다.

## Cutover와 rollback

D1 쓰기를 점검 창 동안 중지하고 마지막 증분 이전 후 건수·FK·사용자 시나리오를 검증한다. 승인 후에만 `DB_PROVIDER=supabase`를 적용한다.

cutover 직후 D1을 삭제하지 않는다. PostgreSQL 쓰기가 발생했다면 단순 Provider 원복 전에 데이터 분기 범위를 산정하고 승인된 역동기화 또는 복구를 선택한다. D1 보존기간과 최종 종료 기준은 운영기관이 정한다.
