# Supabase RLS와 접근 방식

## 서버 Repository

현재 권장 구조다. 브라우저는 DB 테이블에 직접 접근하지 않고 SIWC 인증 후 서버 API/Repository를 사용한다. Service Role 또는 DB owner 연결은 RLS를 우회할 수 있으므로 애플리케이션 RBAC와 소유권 검증이 필수다.

더 강한 DB 방어가 필요하면 제한된 runtime DB role을 만들고 transaction마다 검증된 `app.user_id`와 `app.actor_role`을 `SET LOCAL`로 설정한 뒤 검토용 RLS를 적용한다.

## 직접 Supabase 클라이언트

현재 구현하지 않았다. 향후 Storage 직접 업로드나 realtime 기능을 브라우저에 제공하면 `auth.uid()`와 SIWC 사용자 간 안정적 매핑, JWT 발급 주체, RLS와 cross-user denial test가 선행돼야 한다.

`docs/supabase/rls-policies.example.sql`에는 AudioProgress, LectureProgress, LectureNote, Bookmark 소유권과 관리자 콘텐츠 변경 예시가 있다. Private Storage는 direct policy 없이 signed URL을 사용한다.

## 서버 전용 잠금 migration

`db/postgres/migrations/0002_server_only_rls_lockdown.sql`은 현재 서버
Repository 구조를 위한 별도 보안 migration이다.

- 68개 애플리케이션 테이블과 `app_schema_migrations`에서 `PUBLIC`,
  `anon`, `authenticated`의 직접 테이블 권한을 제거한다.
- 모든 대상 테이블에서 RLS를 활성화한다.
- 직접 브라우저 정책은 생성하지 않는다.
- DB owner 기반 서버 연결과 애플리케이션 RBAC·소유권 검증은 계속
  필수다.
- 향후 생성되는 postgres 소유 테이블·sequence·function의 기본 직접
  접근 권한도 제거한다.

현재 상태:

- `0001_d1_compatibility_schema`: Production 적용 완료
- `0002_server_only_rls_lockdown`: Production 적용 및 검증 완료

2026-07-27 적용 직후 확인 결과:

- public 테이블 69개 중 RLS 활성 테이블 69개
- `anon`, `authenticated` 직접 테이블 grant 0건
- public RLS policy 0건
- `anon`, `authenticated`의 `users` 조회 권한 없음
- DB owner인 `postgres`의 서버 조회 권한 유지

현재 애플리케이션은 직접 Supabase 클라이언트를 지원하지 않는다. 향후
직접 접근이 필요하면 기존 잠금을 해제하지 말고 별도 검수 migration과
사용자 매핑·교차 사용자 차단 테스트를 먼저 추가한다.
