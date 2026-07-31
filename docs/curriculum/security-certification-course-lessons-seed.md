# 정보보안기사·정보보안산업기사 공식 커리큘럼 CourseLesson 연결 Seed

이 문서는 2027~2029 공식 커리큘럼 트리에 CourseLesson 기반 학습 개요를 연결하는 운영 절차를 설명한다.

## 목적

공식 `CurriculumTree`와 `CurriculumNode`가 활성화된 뒤에도 학습 화면에서 일부 노드가 “연결 레슨 없음”으로 표시될 수 있다. 이 seed는 공식 과목 노드에 학습 개요 `CourseLesson`을 연결해 사용자가 과목 단위 학습을 시작할 수 있게 한다.

## 설계

- `contents`는 공통 학습 개요 콘텐츠를 저장한다.
- `course_lessons`는 과정별 공식 `curriculum_node_id`에 연결한다.
- 정보보안기사와 정보보안산업기사는 일부 공통 콘텐츠를 재사용한다.
- 두 과정의 `course_lesson` 행은 별도이므로 진도, 통계, 완료 상태는 분리된다.
- 공식 문제나 유료 교재 내용을 복제하지 않고, 공식 과목 체계를 설명하는 학습 개요만 제공한다.

## Seed 범위

추가 콘텐츠:

- 시스템보안 학습 개요
- 네트워크보안 학습 개요
- 애플리케이션보안 학습 개요
- 정보보안일반 학습 개요
- 정보보안관리 및 법규 학습 개요
- 정보보안 실무 학습 개요

추가 CourseLesson:

- 정보보안기사: 필기 5과목 + 실기 1과목
- 정보보안산업기사: 필기 4과목 + 실기 1과목

## 통계 확인

```powershell
npm run curriculum:security-certification:course-lessons:stats
```

## 로컬 D1 적용

```powershell
npm run curriculum:security-certification:course-lessons:seed:d1-local
```

## PostgreSQL/Supabase 적용

운영 데이터 변경이므로 명시 승인 후에만 실행한다.

```powershell
$env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_COURSE_LESSON_SEED = "APPLY_SECURITY_CERTIFICATION_COURSE_LESSON_SEED"
node --env-file=.env.local scripts/apply-security-certification-course-lessons-seed.mjs postgres --confirm-production-seed
Remove-Item Env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_COURSE_LESSON_SEED
```

연결 문자열 우선순위:

1. `POSTGRES_SEED_URL`
2. `POSTGRES_MIGRATION_URL`
3. `DIRECT_URL`
4. `DATABASE_URL`

## 적용 후 확인 SQL

```sql
SELECT course_id, COUNT(*) AS official_node_course_lessons
FROM course_lessons
WHERE course_id IN ('course-ise', 'course-isie')
  AND curriculum_node_id IS NOT NULL
  AND status = 'PUBLISHED'
  AND deleted_at IS NULL
GROUP BY course_id
ORDER BY course_id;
```

## 주의사항

- 기존 학습 진도는 삭제하지 않는다.
- `Lesson` 원본 엔티티를 복제하지 않고, CourseLesson 연결을 추가한다.
- 운영 적용 전 공식 커리큘럼 트리가 먼저 존재해야 한다.
- 운영 적용 전 `course_lessons`에 `unlock_condition` 컬럼이 포함된 Sprint F migration 적용 상태를 확인한다.
