# Vercel과 Supabase 런타임

## 호환성

- `postgres` Driver는 Vercel Node serverless와 Supabase transaction pooler에 적합하다.
- 현재 Vinext/Sites 빌드는 Cloudflare Worker 대상이며 `nodejs_compat`가 활성화되어 있다. postgres.js도 이 환경을 지원하지만, 실제 패키지가 설치된 상태의 번들 및 Preview 연결 검증은 아직 수행하지 않았다.
- API Route가 Driver를 직접 import하지 않는다. 서버 Repository 또는 Database Provider factory에서만 접근한다.
- Edge/Worker/Node 중 실제 배포 runtime의 TCP 지원과 outbound DB 연결 정책을 Preview에서 확인해야 한다.

## 환경 분리

- Development: 기본 D1 또는 별도 개발 PostgreSQL
- Preview: 별도 Supabase Preview 프로젝트 권장
- Production: Production Supabase 프로젝트
- Preview에서 Production DB 사용 금지

`DATABASE_URL`은 runtime pooled connection, `DIRECT_URL`은 별도 migration 작업에만 사용한다. Migration을 Install/Build Command에 넣지 않는다.

## Serverless 설정

- module-scope singleton 재사용
- 첫 query 전 connection을 열지 않는 lazy client
- 인스턴스당 기본 pool 1
- transaction pooler에서 `prepare: false`
- connect/idle/query timeout 적용
- Driver debug와 NOTICE 로그 비활성화
- 종료 가능한 환경에서는 `disconnectRuntimePostgresExecutor()`로 cleanup

## Preview 확인 목록

1. `postgres` 의존성과 lockfile 설치 확인
2. Preview 환경변수 이름과 Secret 범위 확인
3. D1과 다른 Preview DB 사용 확인
4. Driver bundle 및 runtime import 확인
5. Health check 성공 확인
6. parameter binding, CRUD, transaction rollback, unique/FK 오류 확인
7. 동시 요청에서 pool 상한 확인
8. 기존 D1 회귀 테스트 재실행

실제 PostgreSQL 서버가 없는 단위 테스트는 Executor 계약만 검증하며 네트워크, TLS, pooler, DB schema 호환을 검증하지 않는다.
