# 최초 최고 관리자 생성

## 현재 인증 구조

이 프로젝트는 비밀번호 인증이 아니라 배포 플랫폼이 전달한 SIWC 사용자 식별자와 이메일을 사용한다. 따라서 최초 관리자 생성 도구도 비밀번호를 생성하거나 입력받지 않는다. 지정한 이메일은 실제 운영 SIWC 계정 이메일과 정확히 일치해야 한다.

개발 Seed 계정과 운영 관리자 생성은 분리되어 있다. `npm run db:seed`는 운영 관리자 생성 절차가 아니며 Production에서 실행하면 안 된다.

## 안전장치

- 활성 `SUPER_ADMIN`이 한 명이라도 있으면 실행을 거부한다.
- 사전 조회 뒤에도 SQL 조건을 다시 검사해 동시 실행의 중복 생성을 막는다.
- 원격 실행에는 `--remote`, `--confirm-remote`, 확인 환경변수가 모두 필요하다.
- 이메일과 표시 이름을 검증하며 비밀번호 입력을 받지 않는다.
- 성공 시 `ADMIN_BOOTSTRAPPED` 감사로그를 생성한다.
- CLI 출력에는 이메일, SQL, 비밀번호, 토큰 또는 공급자 오류 원문을 출력하지 않는다.
- 마지막 활성 최고 관리자의 역할 제거 또는 정지를 막는 도메인 가드를 제공한다.

현재 관리자/역할 변경 API는 제공되지 않는다. 향후 해당 API를 만들 때에는 역할 변경, 활성 최고 관리자 수 검사와 감사로그를 하나의 트랜잭션에서 처리하고 `assertSuperAdminRoleChangeAllowed`를 반드시 호출해야 한다.

## 로컬 검증

로컬 D1에 활성 최고 관리자가 이미 있으면 다음 명령은 `ADMIN_BOOTSTRAP_ALREADY_COMPLETE`로 종료되는 것이 정상이다.

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = "approved-admin@example.invalid"
$env:ADMIN_BOOTSTRAP_CONFIRM = "CREATE_FIRST_SUPER_ADMIN"
npm run admin:bootstrap
Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL
Remove-Item Env:ADMIN_BOOTSTRAP_CONFIRM
```

빈 로컬 DB에서 절차를 시험할 때에는 별도의 폐기 가능한 로컬 D1을 사용한다. 운영 DB를 복제한 파일이나 Production binding을 사용하지 않는다.

## Production 실행 절차

이 저장소의 `wrangler.local.jsonc`는 로컬 전용이며 Production 식별자를 담지 않는다. 먼저 승인된 운영 담당자가 저장소에 커밋하지 않는 별도 Wrangler 설정을 준비해야 한다.

1. DB 백업과 복구 가능 여부를 확인한다.
2. 적용할 schema/migration 상태를 확인한다.
3. 대상 SIWC 계정의 이메일을 별도 채널로 확인한다.
4. 두 명 이상이 대상 환경, 이메일, 명령을 검토한다.
5. 승인된 운영 터미널에서만 다음과 같이 실행한다.

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = "<approved SIWC email>"
$env:ADMIN_BOOTSTRAP_DISPLAY_NAME = "<approved display name>"
$env:ADMIN_BOOTSTRAP_CONFIRM = "CREATE_FIRST_SUPER_ADMIN"
node scripts/admin-bootstrap.mjs --remote --confirm-remote --config wrangler.production.jsonc
Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL
Remove-Item Env:ADMIN_BOOTSTRAP_DISPLAY_NAME
Remove-Item Env:ADMIN_BOOTSTRAP_CONFIRM
```

성공 출력은 `ADMIN_BOOTSTRAP_COMPLETED` 한 줄이다. 그 외 코드는 실패로 취급한다. 이 Sprint에서는 원격 실행을 수행하지 않았다.

### Supabase PostgreSQL

동일한 CLI가 `DB_PROVIDER=supabase`일 때 `DIRECT_URL`과 로컬 `psql`을 사용한다. D1용 `--local`, `--remote`, `--config` 옵션을 함께 사용하지 않는다.

```powershell
$env:DB_PROVIDER = "supabase"
$env:DIRECT_URL = "<approved direct PostgreSQL URL>"
$env:ADMIN_BOOTSTRAP_EMAIL = "<approved SIWC email>"
$env:ADMIN_BOOTSTRAP_CONFIRM = "CREATE_FIRST_SUPER_ADMIN"
node scripts/admin-bootstrap.mjs --confirm-remote
Remove-Item Env:DB_PROVIDER
Remove-Item Env:DIRECT_URL
Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL
Remove-Item Env:ADMIN_BOOTSTRAP_CONFIRM
```

PostgreSQL에서는 사용자, 역할, grant와 감사로그를 하나의 transaction에 넣는다. 활성 최고 관리자 존재 여부를 transaction 내부에서도 다시 확인한다. 실제 Supabase 관리자 생성은 수행하지 않았다.

## 실행 후 확인

- 동일 명령 재실행이 `ADMIN_BOOTSTRAP_ALREADY_COMPLETE`로 차단되는지 확인한다.
- 대상 사용자가 SIWC로 로그인하여 관리자 경로에 접근할 수 있는지 확인한다.
- `ADMIN_BOOTSTRAPPED` 감사로그의 actor, resource, request ID와 결과를 확인한다.
- 활성 최고 관리자가 정확히 한 명 이상인지 확인한다.
- 운영 점검 기록에는 계정 이메일 원문 대신 승인 티켓 또는 내부 식별자를 남긴다.

## 장애 처리

성공 확인 전에는 후속 관리자 작업을 시작하지 않는다. CLI가 실패하면 DB 상태를 조회하고 감사로그 및 역할 grant가 모두 생성되지 않았는지 확인한다. 부분 반영이 의심되면 임의 SQL로 수정하지 말고 백업 및 복구 절차에 따라 승인된 복구 또는 forward fix를 수행한다.
