# 통합 운영 준비 점검

마지막 갱신일: 2026-07-31

이 문서는 SECURIUM 운영 전 점검 상태를 정리한다. 코드로 준비된 기능, 운영 환경에서 확인된 기능, 외부 서비스 또는 네트워크 제약으로 아직 확인이 필요한 항목을 분리한다.

## 점검 원칙

- Secret, 토큰, 비밀번호, 연결 문자열 원문은 문서와 로그에 기록하지 않는다.
- Production DB migration, seed, RLS, Storage 변경은 명시적 승인 후 수행한다.
- Mock/샘플 콘텐츠는 실제 운영 연동 완료로 표시하지 않는다.
- `.openai/hosting.json`은 기존 Sites/D1 호스팅 설정이므로 삭제하거나 Vercel 설정으로 대체하지 않는다.
- Vercel 배포와 Supabase 운영 연결은 코드 작성 완료와 실제 운영 반영 여부를 구분한다.

## 구현 및 운영 확인 상태

| 영역 | 상태 | 비고 |
|---|---|---|
| App Router 기반 화면 | 완료 | `app`/`app/api` 구조 유지 |
| DB Repository 패턴 | 완료 | API Route에 직접 DB 접근을 늘리지 않는 방향 유지 |
| 브랜드 SECURIUM 통일 | 완료 | 공개 화면과 metadata 기준 반영 |
| 공개 랜딩/대시보드 분리 | 완료 | 로그인 사용자의 `/` 접근은 `/dashboard`로 이동 |
| Vercel 최신 Production 배포 | 확인 완료 | 2026-07-31 기준 커밋 `858f5d7` Production Ready 및 `securium.vercel.app` 연결 확인 |
| Supabase Auth | 부분 운영 확인 | Google OAuth 및 쿠키 기반 세션 흐름 확인 이력 있음. 브라우저별 최종 수동 회귀는 계속 필요 |
| PostgreSQL Runtime Provider | 코드 준비 완료 | `postgres@3.4.7`, `db:postgres:*` 스크립트 존재 |
| Production PostgreSQL migration | 적용 이력 있음 | 상태 확인 성공 이력 있음. 현재 Codex 터미널에서는 원격 검증 제한 발생 |
| 정보보안기사/산업기사 커리큘럼 | 적용·활성화 진행 이력 있음 | 운영 DB 최종 읽기 검증은 Supabase SQL Editor 또는 네트워크 허용 환경에서 필요 |
| Storage Provider | 코드 준비 중심 | 실제 bucket/정책/권한 검증 필요 |
| RLS | 정책 준비 중심 | 실제 Production 적용 여부 별도 확인 필요 |
| AI Provider/Retrieval | 코드 준비 | 외부 OpenAI 연동과 Mock 구분 필요 |
| 감사로그 | 코드 구현 | 운영 중요 작업별 실제 로그 생성 회귀 필요 |

## 최근 검증 결과

| 항목 | 결과 |
|---|---|
| Git 상태 | `main...origin/main`, working tree clean |
| 최신 로컬 커밋 | `858f5d7 Separate public landing and learner dashboard UX` |
| Vercel 최신 배포 | Ready / Production / `securium.vercel.app` 연결 확인 |
| 최신 배포 고유 URL 공개 랜딩 | 새 문구 반영 확인 |
| 운영 도메인 로그인 세션 `/` 접근 | `/dashboard` 이동 확인 |
| 원격 Postgres 커리큘럼 seed 검증 | 현재 Codex 터미널에서 `ENOTFOUND`로 실패 |
| 원격 Postgres 커리큘럼 coverage 검증 | 현재 Codex 터미널에서 `EACCES`로 실패 |

원격 PostgreSQL 검증 실패는 현재 실행 환경의 DNS/네트워크/소켓 접근 제한 가능성이 있으며, 운영 DB에 데이터가 없다는 의미로 해석하지 않는다.

## 운영 전 남은 확인사항

1. Supabase Auth 수동 회귀
   - 비로그인 보호 경로 접근 시 `/login?return_to=...`
   - 로그인 성공 후 `return_to` 복귀
   - 로그인 상태에서 `/login` 접근 시 `/dashboard`
   - 로그아웃 후 보호 콘텐츠 미노출
   - Google OAuth 취소/오류 처리

2. 운영 PostgreSQL 검증
   - migration status
   - 정보보안기사/산업기사 커리큘럼 tree `ACTIVE`
   - `curriculum_nodes` 노드 수
   - `course_lessons` 연결 수
   - `question_courses` 연결 수

3. Supabase Storage
   - bucket 생성 여부
   - 공개/비공개 분리
   - signed URL 권한
   - MIME/크기 제한

4. RLS/권한
   - 서버 ORM 전용 접근 범위
   - 클라이언트 직접 접근이 있는 경우 RLS 정책
   - service role key 클라이언트 노출 없음

5. 보안 및 의존성
   - 네트워크 가능한 환경에서 `npm audit`
   - Production 보안 헤더
   - rate limit 운영 Provider
   - 에러 응답 stack trace 미노출

6. 백업/복구
   - DB 백업
   - Storage 백업
   - migration 전 백업
   - 복구 후 학습 기록/권한/감사로그 정합성 확인

## 권장 검증 명령

로컬 코드 검증:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

PostgreSQL 상태 검증:

```bash
npm run db:postgres:validate
npm run db:postgres:status
npm run db:postgres:runtime-status
```

정보보안기사/산업기사 커리큘럼 검증:

```bash
node --env-file=.env.local scripts/verify-security-certification-curriculum-seed.mjs postgres --expect-active
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres
```

현재 Codex 터미널에서 위 원격 PostgreSQL 검증은 네트워크 제한으로 실패할 수 있다. 이 경우 Supabase Dashboard SQL Editor에서 `docs/supabase.md`의 읽기 전용 SQL을 실행한다.

## 운영 판정

**CONDITIONAL GO**

코드와 Vercel 최신 배포는 진행 가능 상태다. 다만 Production 운영 전에는 Supabase PostgreSQL 커리큘럼 데이터, Storage/RLS, Dependency Audit, 인증/로그아웃 브라우저 회귀 검증을 완료해야 한다.
