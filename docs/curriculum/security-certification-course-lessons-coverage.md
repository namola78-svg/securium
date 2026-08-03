# 정보보안기사·정보보안산업기사 CourseLesson Coverage 확인

이 문서는 정보보안기사와 정보보안산업기사 공식 커리큘럼 트리에 CourseLesson 연결이 충분히 적용되었는지 확인하는 읽기 전용 절차를 정리한다.

## 기본 확인

기본 coverage 확인은 현재 로컬 또는 운영 DB 상태를 조회만 한다. Production DB를 변경하지 않는다.

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres
```

로컬 D1에서 공식 커리큘럼 트리가 아직 `ACTIVE`가 아닌 상태라면 구조 확인만 수행할 수 있다.

```powershell
node scripts/verify-security-certification-curriculum-coverage.mjs d1-local --allow-inactive
```

## 공식 CourseLesson seed 적용 후 강제 확인

공식 CourseLesson seed를 적용한 뒤에는 다음 옵션으로 필수 연결 수까지 검증한다.

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons
```

## 다음 작업 큐 확인

운영 DB를 변경하지 않고 다음 커버리지 작업을 JSON으로 확인하려면 `--action-queue`를 함께 사용한다.

```powershell
npm run curriculum:security-certification:coverage-actions:d1-local
```

Production PostgreSQL 상태를 읽기 전용으로 확인할 때는 다음 스크립트를 사용한다.

```powershell
npm run curriculum:security-certification:coverage-actions:postgres
```

동일한 동작을 직접 실행하면 다음과 같다.

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons --action-queue
```

출력 개수를 제한하려면 `--action-queue-limit=<n>`을 함께 사용한다. 예:

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons --action-queue --action-queue-limit=20
```

특정 gap만 보고 싶다면 `--action-type=<type>`을 사용한다. 예:

```powershell
node --env-file=.env.local scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons --action-queue --action-type=CONTENT_METADATA_GAP --action-queue-limit=20
```

`actionQueue`에는 다음 유형이 포함될 수 있다.

| 유형 | 의미 |
| --- | --- |
| `TREE_STATUS` | 공식 CurriculumTree가 `ACTIVE`가 아님 |
| `COURSELESSON_LINK_GAP` | 공개 CourseLesson 중 CurriculumNode 연결이 없는 항목이 있음 |
| `OFFICIAL_COURSELESSON_GAP` | 공식 CourseLesson seed 기준 수량이 부족함 |
| `CONTENT_METADATA_GAP` | `curriculum_nodes.metadata.linkedContent` 기준 본문 Content 연결 확인이 필요함 |
| `QUESTION_GAP` | 공개 문제 연결 확인이 필요함 |

## 주요 출력 필드

- `publishedCourseLessonCount`: 과정의 전체 공개 CourseLesson 수
- `courseLessonNodeCount`: 공개 CourseLesson이 연결된 CurriculumNode 수
- `officialSeedCourseLessonCount`: 공식 CourseLesson seed가 추가한 CourseLesson 수
- `officialSeedNodeCount`: 공식 CourseLesson seed가 연결한 CurriculumNode 수
- `unlinkedCourseLessonCount`: CurriculumNode에 연결되지 않은 공개 CourseLesson 수
- `publishedQuestionCount`: 과정에 연결된 공개 문제 수

## 기대값

| 과정 | 공식 CourseLesson | 연결 노드 | 미연결 노드 |
| --- | ---: | ---: | ---: |
| 정보보안기사 | 6 | 6 | 0 |
| 정보보안산업기사 | 5 | 5 | 0 |

위 값은 `SUBJECT`와 `PRACTICAL` 최상위 학습 개요 노드를 기준으로 한다. `MAJOR_ITEM`, `SUB_ITEM` 단위의 본문 Content 매핑은 과목별 정식 본문 구축 단계에서 확장한다.

`CONTENT_METADATA_GAP`은 DB metadata의 직접 연결 여부를 확인한다. `lib/curriculum/security-certification-content-map.ts`의 정적 content map coverage와 기준이 다르므로, 운영 확인 시 두 값을 분리해서 해석한다.

## Action queue triage fields

Each `actionQueue` item includes `severity` and `nextStep` so operators can
triage read-only coverage results before requesting production activation or seed
approval.

## linkedContent metadata backfill

`CONTENT_METADATA_GAP` is resolved by adding `linkedContent` entries to
`curriculum_nodes.metadata`. The backfill preserves existing metadata fields and
merges reusable `CONTENT` links from the official CourseLesson seed.

```powershell
npm run curriculum:security-certification:linked-content:stats
npm run curriculum:security-certification:linked-content:d1-local
```

PostgreSQL/Supabase is gated as a production data change:

```powershell
$env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL = "APPLY_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL"
npm run curriculum:security-certification:linked-content:postgres -- --confirm-production-seed
Remove-Item Env:SECURIUM_CONFIRM_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL
```

Do not run the PostgreSQL command until the production data change is explicitly
approved.

## 실패 시 확인 순서

1. PostgreSQL migration 상태가 최신인지 확인한다.
2. 공식 CurriculumTree가 존재하고 `ACTIVE`인지 확인한다.
3. 공식 CurriculumNode seed가 누락되지 않았는지 확인한다.
4. CourseLesson seed가 운영 승인 후 적용되었는지 확인한다.
5. `course_lessons.deleted_at`과 `status` 값을 확인한다.
6. `--action-queue` 출력으로 우선 처리할 gap을 확인한다.

이 검증 절차는 읽기 전용이다. Production DB 적용, seed 실행, 상태 전환은 별도 승인 후 수행한다.
