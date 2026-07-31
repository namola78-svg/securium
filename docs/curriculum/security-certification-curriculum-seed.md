# 정보보안기사·정보보안산업기사 공식 커리큘럼 Seed 운영 가이드

이 문서는 정보보안기사와 정보보안산업기사 2027~2029 출제기준 기반 CurriculumTree/Node Seed SQL의 생성과 적용 절차를 설명한다.

## 현재 범위

확인된 사실:

- 대상 과정은 `course-ise`, `course-isie`이다.
- `curriculum_trees`는 `course_id + version` 유일 제약을 가진다.
- 생성되는 공식 커리큘럼 트리는 모두 `DRAFT` 상태이다.
- `curriculum_nodes`는 생성된 stable node id를 사용한다.
- D1용 SQL과 PostgreSQL용 SQL을 같은 TypeScript 정의에서 생성한다.

제안 및 운영 정책:

- 생성된 트리는 관리자 Curriculum 화면에서 검토한 뒤 별도 승인으로 `ACTIVE` 전환한다.
- 운영 DB에 적용하기 전에 로컬 또는 스테이징에서 먼저 적용 결과를 확인한다.
- 같은 `course_id + version`의 다른 트리가 이미 존재하면 자동 병합하지 말고 수동으로 충돌을 검토한다.

## SQL 생성

```powershell
npm run curriculum:security-certification:sql
```

생성 파일:

- `db/seeds/security-certification-curriculum-2027-2029.d1.sql`
- `db/seeds/security-certification-curriculum-2027-2029.postgres.sql`

생성 통계 확인:

```powershell
node scripts/generate-security-certification-curriculum-seed.mjs --stats
```

## D1 로컬 적용

로컬 D1에만 적용한다.

```powershell
npm run curriculum:security-certification:seed:d1-local
```

주의:

- 로컬 D1 데이터 변경이다.
- Production D1에는 적용하지 않는다.
- `wrangler.local.jsonc`를 기본으로 사용한다.

## PostgreSQL / Supabase 적용

Production 또는 원격 PostgreSQL 적용은 명시적 승인 후에만 수행한다.

```powershell
$env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED = "APPLY_SECURITY_CERTIFICATION_CURRICULUM_SEED"
node --env-file=.env.local scripts/apply-security-certification-curriculum-seed.mjs postgres --confirm-production-seed
Remove-Item Env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED
```

연결 문자열 우선순위:

1. `POSTGRES_SEED_URL`
2. `POSTGRES_MIGRATION_URL`
3. `DIRECT_URL`
4. `DATABASE_URL`

주의:

- Secret 값은 터미널이나 문서에 출력하지 않는다.
- Seed는 `DRAFT` 데이터 삽입만 수행한다.
- 같은 `course_id + version`의 다른 트리가 있으면 충돌이 발생할 수 있으며, 이 경우 수동 검토가 필요하다.

## D1 원격 적용

D1 원격은 현재 기본 운영 경로가 아니므로 별도 config를 명시해야 한다.

```powershell
$env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED = "APPLY_SECURITY_CERTIFICATION_CURRICULUM_SEED"
node scripts/apply-security-certification-curriculum-seed.mjs d1-remote --confirm-production-seed --config=<wrangler production config>
Remove-Item Env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED
```

## 적용 후 확인 SQL

자동 검증:

```powershell
npm run curriculum:security-certification:verify:d1-local
```

PostgreSQL/Supabase 검증:

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-seed.mjs postgres
```

검증 항목:

- 트리 2개 존재
- 두 트리 모두 `DRAFT`
- 정보보안기사 노드 수 79
- 정보보안산업기사 노드 수 64
- 정보보안기사 필기 5과목
- 정보보안산업기사 필기 4과목
- `정보보안관리 및 법규`는 정보보안기사에만 포함

수동 SQL:

PostgreSQL 예시:

```sql
SELECT id, course_id, version, status
FROM curriculum_trees
WHERE id IN (
  'curriculum-ise-2027-2029-official',
  'curriculum-isie-2027-2029-official'
);

SELECT curriculum_tree_id, COUNT(*) AS node_count
FROM curriculum_nodes
WHERE curriculum_tree_id IN (
  'curriculum-ise-2027-2029-official',
  'curriculum-isie-2027-2029-official'
)
GROUP BY curriculum_tree_id;
```

예상 노드 수:

- 정보보안기사: 79
- 정보보안산업기사: 64

## 활성화 전 체크리스트

- 공식 PDF 원문과 사용자 제공 이미지 기준의 세부 항목 대조
- 한글 인코딩 표시 확인
- 관리자 Curriculum 화면에서 트리 구조 검토
- 정보보안기사 5과목 구성 확인
- 정보보안산업기사 4과목 구성 확인
- 기사 실기 전용 `위험분석 및 정보보호 대책 수립`이 산업기사에 섞이지 않았는지 확인
- 기존 CourseLesson, Practice, Review, Analytics 흐름에 영향이 없는지 확인
