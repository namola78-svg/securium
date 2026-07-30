# Supabase PostgreSQL 준비

> 상태: 런타임 Adapter 코드 준비 완료, `postgres` 의존성 설치와 실제 Supabase 연결은 미완료

## 연결 변수

| 변수 | 용도 | 필수 시점 |
|---|---|---|
| `DB_PROVIDER` | `d1` 또는 `supabase` 선택 | Preview/Production |
| `DATABASE_URL` | 런타임 transaction pooler 연결 | `DB_PROVIDER=supabase` |
| `DIRECT_URL` | migration·상태 확인용 직접 연결 | migration 명령 |
| `POSTGRES_MAX_CONNECTIONS` | 인스턴스별 pool 상한(1~20) | 선택, 기본 1 |
| `POSTGRES_IDLE_TIMEOUT_SECONDS` | idle 종료(1~600초) | 선택, 기본 20 |
| `POSTGRES_CONNECT_TIMEOUT_SECONDS` | 연결 제한(1~60초) | 선택, 기본 3 |
| `POSTGRES_QUERY_TIMEOUT_MS` | query 제한(100~120000ms) | 선택, 기본 10000 |
| `POSTGRES_SSL_MODE` | `disable`, `require`, `verify-full` | 선택, 기본 `require` |

`DATABASE_URL`과 `DIRECT_URL`은 서버 Secret이다. URL, 비밀번호 또는 전체 query parameters를 로그에 출력하지 않는다. Runtime 시작에는 `DIRECT_URL`을 요구하지 않지만 migration 명령은 반드시 요구한다.

Production에서는 localhost DB와 TLS 비활성화를 차단한다. 기본 비밀번호 형태도 거부한다.

## Runtime 연결

1. 승인된 환경에서 `npm install postgres@3.4.7 --save-exact`를 실행하고 lockfile을 검토한다.
2. Supabase의 transaction pooler URL을 `DATABASE_URL`에 설정한다.
3. `DB_PROVIDER=supabase`를 설정한다.
4. Provider factory를 통해 health check를 수행한다.
5. 빈 Preview DB에서 schema와 Repository 호환 테스트를 수행한다.

Driver client는 module scope에서 재사용하지만 실제 connection은 첫 query까지 열리지 않는다. Driver 초기화 또는 health check 실패 시 D1로 fallback하지 않는다.

## Migration

Migration과 상태 확인은 `DIRECT_URL`만 사용한다. Vercel/Sites Build Command에서 migration을 실행하지 않는다.

```bash
npm run db:postgres:validate
npm run db:postgres:status
```

실제 배포 명령은 별도 승인, 백업, schema 검토 후에만 실행한다.

## 현재 미수행 범위

- 실제 Supabase 프로젝트 연결
- Production/Preview migration
- D1 export와 PostgreSQL import
- 68개 Repository PostgreSQL port
- RLS 적용
- Storage bucket 생성
- Production 배포

따라서 Provider 단위 테스트 통과를 실제 PostgreSQL 통합 연결 완료로 해석하면 안 된다.
