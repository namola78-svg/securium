# Repository Adapter

## 분석 결과

`db`에는 TypeScript 파일 22개가 있으며, 실제 비즈니스 Repository는 상위 13개 파일에 집중되어 있다. 기존 구현은 Drizzle D1 `getDb()`를 사용하고 API Route는 이 함수들을 import한다.

| 유형 | 현재 Repository |
|---|---|
| 단순 CRUD·관리자 | `repositories.ts`의 과정군·과정·과목·주제, `audit-repositories.ts` |
| 사용자별 학습 데이터 | `lesson-repositories.ts`, `audio-repositories.ts`, `lecture-repositories.ts` |
| 과정별 콘텐츠 | `lesson-repositories.ts`, `specialized-repositories.ts`, `practical-specialization-repositories.ts` |
| 복합 transaction | `question-repositories.ts`, `phase3-repositories.ts`, `content-revision-repositories.ts` |
| 검색 | `question-repositories.ts`, `lecture-repositories.ts`, `ai-repositories.ts` |
| 통계·추천 | `phase3-repositories.ts`, `repositories.ts`의 수강 통계 |
| 관리자 CMS | 과정·레슨·문제·모의고사·특화 콘텐츠 Repository |
| migration 전용 | Repository가 아니라 `scripts/postgres-migrations.mjs`, `scripts/d1-postgres-migration.mjs` |

주요 패턴:

- 조회·CRUD: Drizzle query builder와 `getDb()`
- 복합 쓰기: D1 `batch()`
- pagination: `LIMIT/OFFSET`
- upsert: `onConflictDoNothing()` 또는 `onConflictDoUpdate()`
- 검색: D1 `LIKE`, 길이 제한을 둔 pattern
- 통계: group/aggregate와 일부 메모리 조합
- 데이터 격리: 사용자 ID와 과정 ID를 where 조건에 포함

N+1 및 과도한 조회 후보는 추천·통계·콘텐츠 영향 조회처럼 여러 영역을 조합하는 함수다. 현재 Sprint에서는 동작을 바꾸지 않고 후속 query profiling 대상으로 남긴다.

## 선택한 구조

**B. 공통 Query Adapter + 기존 Repository 유지**를 선택했다.

- 기존 API Route와 D1 Drizzle Repository는 수정하지 않는다.
- `RepositoryContext`가 `DatabaseProvider`를 감싼다.
- `RepositorySqlDialect`가 placeholder, 검색, upsert, pagination 차이를 생성한다.
- `SqlEntityRepository`가 CRUD, scope, allowlist, pagination 공통 규칙을 제공한다.
- 특수 관계가 필요한 문제·모의고사 시도는 전용 Repository method를 제공한다.
- `getCoreRepositoryAdapters()`가 선택된 DB Provider에 Adapter를 연결한다.

이 구조는 D1 SQL을 PostgreSQL에 억지로 재사용하지 않으며, 나머지 Repository를 파일 단위로 점진 전환할 수 있다.

## 공통 규칙

- 값은 항상 parameters 배열로 binding한다.
- table/column/sort/filter는 내부 allowlist만 사용한다.
- nullable은 `null`로 정규화한다.
- boolean은 호환 schema의 integer `0/1`로 직렬화한다.
- datetime은 ISO 문자열로 정규화한다.
- JSON은 중앙에서 stringify/parse한다.
- update 대상이 없으면 `REPOSITORY_NOT_FOUND`를 반환한다.
- DB 오류는 `DatabaseProviderError`의 안전한 분류만 전달한다.
- 사용자 학습 Repository는 `userId`, 과정 데이터는 `courseId` scope를 요구한다.
- `RepositoryContext`가 선택적 `requestId`를 보존한다.

## 우선 구현 Repository

1. User
2. Role
3. Course
4. Enrollment
5. Lesson
6. LessonProgress
7. Question
8. QuestionAttempt
9. WrongNote
10. MockExamAttempt

공통 지원:

- create
- findById
- list
- update
- 필요한 deactivate
- page/pageSize/total/hasMore
- sort/filter allowlist
- 사용자·과정 scope

Question은 `question_courses`를 통한 과정별 조회·검색·원자적 연결 생성을 지원한다. MockExamAttempt는 `mock_exams` join을 통해 과정별 응시 결과를 분리한다. QuestionAttempt 같은 불변 학습 이벤트는 create/read 중심이며 일반 update나 delete를 사용하지 않는다.

## SQL Dialect

| 기능 | D1 | PostgreSQL |
|---|---|---|
| placeholder | `?` | `$1`, `$2` |
| case-insensitive 검색 | `lower(column) LIKE lower(?)` | `column ILIKE $1` |
| 중복 무시 | `INSERT OR IGNORE` | `ON CONFLICT ... DO NOTHING` |
| transaction | statement batch | 동일 connection transaction |
| returning | 지원 범위에서 `RETURNING` | `RETURNING` |

`PostgresDatabaseProvider`는 기존 중립 `?`와 새 Adapter의 native `$n`을 모두 검증한다. 두 방식을 한 statement에서 혼합하면 차단한다.

## Transaction Context

`RepositoryContext.transaction()`은 callback에서 statement를 수집한 뒤 Provider transaction으로 한 번에 전달한다.

- D1: `batch()`로 원자 실행
- PostgreSQL: `PostgresExecutor.transaction()`의 동일 connection에서 순차 실행
- callback 안에서 새 Provider나 pool connection을 만들지 않음
- 실패 시 전체 rollback

현재 transaction context는 미리 구성 가능한 write statement에 집중한다. transaction 중간 결과를 읽어 다음 SQL을 동적으로 만드는 workflow와 nested transaction은 후속 savepoint 설계가 필요하다.

## 미포팅 범위

- AI 및 AI 특화 기록
- Audio와 Lecture
- Audit Log
- Content Revision
- Level·Review·Recommendation·Statistics
- MockExam 전체 구성과 답안
- 특화 과정과 실무 과정
- Question 선택지·버전·신고 전체 workflow
- 기존 Repository의 모든 세부 메서드

실제 Supabase 연결, migration, 데이터 이동, RLS, Storage 및 배포는 수행하지 않았다.
