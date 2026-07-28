# Database Provider

## 현재 구조

- 기본 Provider는 `d1`이며 `.openai/hosting.json`의 `DB` binding과 Drizzle D1 Repository를 사용한다.
- `DB_PROVIDER=supabase`는 `PostgresDatabaseProvider`와 `PostgresJsExecutor`를 선택한다.
- API Route는 Driver를 직접 호출하지 않고 Repository와 Database Provider 계층을 사용한다.
- Provider 초기화가 실패해도 D1로 자동 전환하지 않는다.
- 기존 Repository는 아직 D1 Drizzle 구현이므로 PostgreSQL 전환 범위에 포함되지 않는다.

## 공통 계약

`DatabaseProvider`는 다음 결과를 반환한다.

- Query: `rows`, `rowCount`, `metadata.provider`
- Execute: `affectedRows`, `returnedRows`, `metadata.provider`
- 단건 Query: 행 또는 `null`
- Transaction: Execute 결과 배열
- Health check: 정상 응답 여부

PostgreSQL의 `RETURNING` 결과는 `returnedRows`에 보존한다. D1에는 같은 개념을 억지로 만들지 않고 빈 배열을 반환한다. D1 전용 `lastInsertId`도 공통 계약에 포함하지 않는다.

## SQL과 파라미터

Provider 입력은 하나의 SQL statement와 별도 parameters 배열이다. 사용자 입력을 SQL 문자열에 결합하지 않는다. PostgreSQL Provider는 공통 `?` placeholder를 인용 문자열 바깥에서 `$1`, `$2` 형태로 변환하고 개수를 검증한다.

## PostgreSQL Driver

선택 Driver는 `postgres`(postgres.js) 3.4.7이다.

- Supabase transaction pooler와 호환
- TypeScript 지원
- `sql.begin()` 기반 commit/rollback
- module-scope singleton과 lazy connection
- `prepare: false`
- 작은 per-instance pool
- 연결 및 유휴 timeout
- Cloudflare Workers `nodejs_compat` 및 Node serverless 지원

설치:

```bash
npm install postgres@3.4.7 --save-exact
```

현재 제한된 개발 환경에서는 npm registry 접근이 `EACCES`로 차단되어 의존성과 lockfile 갱신이 완료되지 않았다. D1 빌드를 보호하기 위해 Driver 모듈은 Supabase Provider가 실제 선택될 때만 지연 로드한다. PostgreSQL Preview 검증 전에는 위 설치가 반드시 성공해야 한다.

## Pool과 timeout

- 기본 최대 연결 수: 인스턴스당 1
- 기본 idle timeout: 20초
- 기본 connect timeout: 10초
- 기본 query timeout: 10초
- query timeout 시 진행 중 query의 cancel을 요청하고 안전한 timeout 오류로 변환
- Pooler transaction mode에서는 prepared statement를 비활성화

`PostgresJsExecutor.transaction()`은 하나의 connection을 예약하며 callback 실패 시 rollback한다. Transaction callback에는 query 전용 executor만 전달하므로 nested transaction은 현재 지원하지 않는다. 필요하면 별도 savepoint 정책을 설계해야 한다.

## 오류 처리

Driver 원문 오류는 외부 API에 전달하지 않는다. 다음 범주로 변환한다.

- `connection_error`
- `timeout`
- `unique_violation`
- `foreign_key_violation`
- `not_null_violation`
- `syntax_error`
- `transaction_error`
- `unknown_database_error`

정규화된 오류에는 connection string, SQL 원문, parameters 또는 Driver stack을 복사하지 않는다. `debug`와 NOTICE logging도 Driver 설정에서 끈다.

## 전환 경계

`getDatabaseProvider()`는 Supabase 선택 시 실제 Executor를 연결할 수 있다. 반면 `getDb()`는 기존 D1 Drizzle Repository 전용이므로 Supabase 설정에서 명시적으로 실패한다. 이 경계는 Repository 전체 port가 완료되기 전 D1로 잘못 fallback하거나 서로 다른 DB를 동시에 쓰는 것을 방지한다.

핵심 Repository의 점진 전환 구조와 D1/PostgreSQL SQL 차이는
[`repository-adapter.md`](repository-adapter.md)를 참고한다.
