# UI-3A Validation Results

SECURIUM 관리자 Console Shell pilot 검증 기록입니다.

## Scope

이번 검증 범위는 UI-3A에서 적용한 관리자 공통 Shell입니다.

- Admin Console Top Bar
- Admin Sidebar grouped navigation
- Account Drawer
- Environment Badge
- Admin Dashboard pilot
- Inspector Panel 적용 상태

다음 항목은 이번 검증 범위가 아닙니다.

- Production DB 변경
- Seed 변경
- Migration 실행
- API 변경
- Repository 변경
- 운영 배포

## Automated Validation

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | Pass |
| `npm.cmd run lint` | Pass |
| `node --test tests/postgres-runtime.test.ts` | Pass |
| `npm.cmd run build` | Pass |
| `npm.cmd run db:check` | Pass |

## Local D1 Validation

로컬 D1은 `wrangler.local.jsonc`와 `.wrangler/state/v3/d1` 상태를 기준으로 확인했습니다.

| Check | Result |
| --- | --- |
| Core tables | `users`, `roles`, `user_roles`, `course_groups`, `courses` 확인 |
| Role data | `ADMIN`, `SUPER_ADMIN`, `USER`, `COURSE_MANAGER`, `CONTENT_EDITOR`, `CONTENT_REVIEWER` 확인 |
| Local admin user | `dev-super-admin@example.invalid`에 `SUPER_ADMIN` 역할 확인 |
| Public page via Vinext | `/courses` HTTP 200 확인 |

## Browser / Runtime Validation

### Protected Route Check

| Scenario | Result |
| --- | --- |
| Anonymous access to `/admin` | `/login?return_to=%2Fadmin`으로 이동 |
| Protected content exposure before login | 관찰되지 않음 |
| Auth route loop | 관찰되지 않음 |

### Admin Shell Check

관리자 Shell 시각 검증은 현재 로컬 도구 환경에서 완전히 완료하지 못했습니다.

확인한 내용:

- `next dev`는 Cloudflare D1 binding을 주입하지 않아 `/admin`에서 `DATABASE_PROVIDER_CONFIGURATION_INVALID` 오류가 발생합니다.
- `vinext dev`는 로컬 D1 binding을 사용해야 하는 올바른 경로입니다.
- 현재 환경에서 `vinext dev`는 IPv6 loopback(`[::1]:3000`)으로만 포트를 열었습니다.
- in-app browser는 `[::1]` 주소를 열지 못해 시각 검증이 제한되었습니다.
- 터미널 HTTP 요청으로는 `/courses`가 200으로 응답했습니다.
- 임시 로컬 JWT 쿠키로 `/admin` 인증 경계를 넘기는 시도에서는 사용자 역할 조회 쿼리 단계에서 500이 발생했습니다.
- 같은 사용자 역할 SQL은 `wrangler d1 execute --local`에서 정상 실행됩니다.

해석:

- UI Shell 코드는 typecheck, lint, production build를 통과했습니다.
- 로컬 D1 데이터 자체는 존재하고 관리자 역할도 확인됐습니다.
- 남은 차이는 `vinext dev` 런타임의 D1 prepared statement 처리 또는 로컬 worker 요청 환경 차이로 보입니다.
- Production DB, seed, migration, 운영 배포는 수행하지 않았습니다.

## PostgreSQL Runtime Status

Supabase/PostgreSQL 직접 검증은 현재 실행 환경의 네트워크 제한 때문에 완료하지 못했습니다.

관찰된 안전 오류:

- `DATABASE_URL`: `EACCES`
- `DIRECT_URL`: `ENOTFOUND`

`scripts/postgres-runtime-status.mjs`는 연결 문자열이나 비밀값을 출력하지 않고
`POSTGRES_RUNTIME_STATUS_FAILED:<reason>` 형식으로 안전하게 실패 사유만 보고합니다.

## PostgreSQL Raw Compatibility Guard

PostgreSQL runtime provider로 D1 스타일 raw query가 라우팅될 때 안전하게 처리되는지 회귀 테스트를 보강했습니다.

Covered behavior:

- Duplicate raw column positions are preserved.
- Bound raw query parameters are normalized from D1 placeholders to PostgreSQL native placeholders before execution.
- Bound values remain parameterized.

## Revalidation Checklist

운영 또는 로컬 브라우저에서 다시 확인할 항목입니다.

1. PostgreSQL runtime status 확인.
2. `EACCES`가 계속되면 Supabase pooler로 나가는 네트워크 정책 확인.
3. `ENOTFOUND`가 계속되면 Supabase direct database hostname DNS 확인.
4. `users`, `roles`, `user_roles` 테이블 존재 확인.
5. 대상 관리자 사용자에게 `ADMIN` 또는 `SUPER_ADMIN` 역할이 있는지 확인.
6. `/admin` 접속.
7. Console Top Bar 표시 확인.
8. grouped Sidebar navigation 표시 확인.
9. `/admin` active navigation state 확인.
10. Account Drawer 열기/닫기 확인.
11. Account Drawer 링크와 logout button 상태 확인.
12. 1440px desktop 확인.
13. 768px tablet 확인.
14. 390px mobile 확인.

## Current Verdict

CONDITIONAL GO.

UI-3A 코드는 빌드 안전성이 확인되었습니다. 다만 `/admin`의 브라우저 수준 시각 검증은
Supabase 네트워크 접근이 가능한 환경 또는 `[::1]` 접근이 가능한 로컬 브라우저에서 재검증해야 합니다.
