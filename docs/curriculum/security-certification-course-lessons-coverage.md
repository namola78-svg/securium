# 정보보안 자격 커리큘럼 CourseLesson Coverage 확인

이 문서는 정보보안기사와 정보보안산업기사 공식 커리큘럼에 CourseLesson 연결이 충분히 적용되었는지 확인하는 읽기 전용 절차를 설명한다.

## 기본 확인

기본 coverage 확인은 현재 운영 또는 로컬 DB 상태를 보고만 한다. CourseLesson seed 적용 전에도 실행할 수 있다.

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres
```

로컬 D1에서 공식 커리큘럼을 아직 `ACTIVE`로 전환하지 않은 상태라면 아래처럼 구조 확인만 수행한다.

```powershell
node scripts/verify-security-certification-curriculum-coverage.mjs d1-local --allow-inactive
```

## 공식 CourseLesson seed 적용 후 강제 확인

공식 CourseLesson seed를 적용한 뒤에는 아래 옵션으로 필수 연결 수까지 강제 검증한다.

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons
```

## 주요 출력 필드

- `publishedCourseLessonCount`: 과정의 전체 공개 CourseLesson 수
- `courseLessonNodeCount`: 공개 CourseLesson이 연결된 CurriculumNode 수
- `officialSeedCourseLessonCount`: 공식 CourseLesson seed가 추가한 CourseLesson 수
- `officialSeedNodeCount`: 공식 CourseLesson seed가 연결한 CurriculumNode 수
- `unlinkedCourseLessonCount`: CurriculumNode에 연결되지 않은 공개 CourseLesson 수

## 기대값

- 정보보안기사: 공식 CourseLesson 6개
- 정보보안산업기사: 공식 CourseLesson 5개

## 실패 시 확인 순서

1. PostgreSQL migration 상태가 최신인지 확인한다.
2. 공식 CurriculumTree가 존재하고 `ACTIVE`인지 확인한다.
3. 공식 CurriculumNode seed가 누락되지 않았는지 확인한다.
4. CourseLesson seed를 운영 승인 후 적용했는지 확인한다.
5. `course_lessons.deleted_at`과 `status` 값을 확인한다.

이 검증은 읽기 전용이며 Production DB 데이터를 변경하지 않는다.
