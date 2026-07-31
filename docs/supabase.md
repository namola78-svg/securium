# Supabase 연동 상태

마지막 갱신일: 2026-07-31

이 문서는 SECURIUM의 Supabase PostgreSQL/Auth/Storage 준비 상태를 “코드 준비”, “운영 연결”, “검증 제한”으로 구분한다. Secret, 토큰, 비밀번호, 연결 문자열 원문은 문서에 기록하지 않는다.

## 현재 상태 요약

| 항목 | 상태 | 근거 |
|---|---|---|
| PostgreSQL 런타임 드라이버 | 코드 준비 완료 | `postgres@3.4.7` 설치 및 `db:postgres:*` 스크립트 존재 |
| DB Provider 전환 | 코드 준비 완료 | `DB_PROVIDER=d1` 또는 `DB_PROVIDER=supabase` 구조 사용 |
| Supabase Auth | 운영 연동 진행 완료 | 운영 로그인, Google OAuth, Supabase 쿠키 기반 세션 흐름 확인 |
| Production PostgreSQL migration | 적용 이력 있음 | `scripts/postgres-migrations.mjs status` 실행 시 적용 상태 확인 이력 있음 |
| 커리큘럼 운영 Seed/ACTIVE 전환 | 진행 이력 있음 | 정보보안기사/산업기사 공식 커리큘럼 Seed 및 ACTIVE 전환 승인·실행 이력 있음 |
| Storage Provider | 코드 준비 중심 | 실제 버킷 생성/정책 적용 여부는 별도 운영 확인 필요 |
| RLS | SQL/정책 준비 중심 | 실제 Production 정책 적용 여부는 Supabase Dashboard/SQL로 별도 확인 필요 |
| pgvector | 확장 준비 문서화 | 이번 단계에서 벡터 검색 완전 구현 대상 아님 |

## 환경변수

| 변수 | 용도 | 비고 |
|---|---|---|
| `DB_PROVIDER` | `d1` 또는 `supabase` 선택 | Vercel Production/Preview에서 명시 필요 |
| `DATABASE_URL` | 런타임 pooled PostgreSQL 연결 | Supabase transaction pooler 권장 |
| `DIRECT_URL` | migration/status/직접 연결 | Supabase direct connection 권장 |
| `POSTGRES_VERIFY_URL` | 운영 검증 전용 연결 | 선택. 없으면 스크립트가 `DATABASE_URL`, `DIRECT_URL` 등을 순차 사용 |
| `POSTGRES_MIGRATION_URL` | migration 전용 연결 | 선택. 운영 migration 시 명시 권장 |
| `POSTGRES_SEED_URL` | seed 전용 연결 | 선택. 운영 seed 시 명시 권장 |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 Supabase 프로젝트 URL | 공개 가능 값이지만 프로젝트 혼용 주의 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 anon key | 공개 가능 키이나 RLS/권한 정책과 함께 관리 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service role key | 클라이언트 노출 금지. 현재 문서/로그에 기록 금지 |

`DATABASE_URL`, `DIRECT_URL`, `POSTGRES_*_URL`, service role key는 Secret으로 관리한다. 로그, 문서, 이슈, PR 설명에 원문을 남기지 않는다.

## 연결 및 검증 명령

로컬 또는 운영 검증 환경에서 다음 명령을 사용할 수 있다.

```bash
npm run db:postgres:validate
npm run db:postgres:status
npm run db:postgres:runtime-status
npm run curriculum:security-certification:verify:postgres -- --expect-active
npm run curriculum:security-certification:coverage:postgres
```

PowerShell에서 운영 검증 전용 URL을 임시로 설정할 경우:

```powershell
$env:POSTGRES_VERIFY_URL = "<Supabase direct 또는 pooled connection string>"
node --env-file=.env.local scripts/verify-security-certification-curriculum-seed.mjs postgres --expect-active
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres
Remove-Item Env:POSTGRES_VERIFY_URL
```

## 2026-07-31 Codex 터미널 검증 결과

다음 명령을 실행했으나, 현재 Codex 터미널 환경에서는 원격 PostgreSQL 연결이 제한되어 성공하지 못했다.

| 명령 | 결과 | 해석 |
|---|---|---|
| `node --env-file=.env.local scripts/verify-security-certification-curriculum-seed.mjs postgres --expect-active` | `ENOTFOUND` | 연결 대상 DNS/URL 해석 실패. 운영 DB 미적용을 의미하지 않음 |
| `node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres` | `EACCES` | 현재 실행 환경의 네트워크/소켓 접근 제한 가능성. 운영 DB 미적용을 의미하지 않음 |

따라서 운영 커리큘럼 최종 검증은 Supabase Dashboard SQL Editor 또는 네트워크가 허용된 로컬 터미널에서 재실행해야 한다.

## 운영 확인 필요사항

1. Vercel Production 환경변수
   - `DB_PROVIDER=supabase`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Supabase Auth
   - Site URL: `https://securium.vercel.app`
   - Redirect URLs: 운영 도메인 및 OAuth callback 경로
   - Google Provider Client ID/Secret 설정

3. PostgreSQL
   - migration status
   - 정보보안기사/정보보안산업기사 커리큘럼 tree ACTIVE 여부
   - `course_lessons`, `curriculum_nodes`, `question_courses` 연결 수

4. Storage
   - 공개/비공개 bucket 분리
   - signed URL 권한 검증
   - MIME/크기 제한

5. RLS
   - 서버 ORM 전용 접근인지, 클라이언트 직접 접근인지 구분
   - 실제 적용 전에는 “RLS 적용 완료”로 보고하지 않는다.

## 운영 전 권장 SQL 확인

Supabase SQL Editor에서 Secret 없이 다음 정도의 읽기 전용 검증을 수행할 수 있다.

```sql
SELECT id, course_id, version, status
FROM curriculum_trees
WHERE id IN (
  'curriculum-ise-2027-2029-official',
  'curriculum-isie-2027-2029-official'
)
ORDER BY id;
```

```sql
SELECT curriculum_tree_id, COUNT(*) AS node_count
FROM curriculum_nodes
WHERE curriculum_tree_id IN (
  'curriculum-ise-2027-2029-official',
  'curriculum-isie-2027-2029-official'
)
GROUP BY curriculum_tree_id
ORDER BY curriculum_tree_id;
```

```sql
SELECT course_id, COUNT(*) AS published_course_lesson_count
FROM course_lessons
WHERE course_id IN ('course-ise', 'course-isie')
  AND status = 'PUBLISHED'
  AND deleted_at IS NULL
GROUP BY course_id
ORDER BY course_id;
```

## 결론

Supabase 연동 코드는 운영 사용 가능한 단계까지 준비되었고, 운영 Auth 및 Vercel 배포 흐름도 확인되었다. 다만 현재 Codex 터미널에서는 원격 PostgreSQL 검증이 제한되므로, 운영 DB의 최종 커리큘럼/Storage/RLS 검증은 Supabase Dashboard 또는 네트워크가 허용된 환경에서 별도로 확인해야 한다.
