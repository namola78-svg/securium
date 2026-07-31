# SECURIUM 학습 개요 정보구조

## 1. 기존 구조

현재 과정 학습 개요(`/learn/[courseSlug]`)는 다음 학습 구조를 함께 사용한다.

- `CourseLevel`: 단계 학습과 잠금/해제 상태
- `CurriculumTree` / `CurriculumNode`: 공식 출제기준 또는 운영 커리큘럼 경로
- `Content` / `CourseLesson`: 여러 과정에서 재사용 가능한 이론 학습 콘텐츠
- `Subject` / `Topic` / `LearningUnit` / `Lesson`: 초기 버전의 과목 중심 학습 구조
- `UserCourseLessonProgress`: 과정별 CourseLesson 진도
- 기존 `LessonProgress` 및 subject 기반 진도: legacy fallback

이 구조는 데이터 보존과 점진적 마이그레이션에는 유리하지만, 학습자 화면에서는 “공식 커리큘럼”, “공통 이론”, “과목 목록”이 동시에 보일 수 있어 학습 시작점이 불명확해진다.

## 2. 문제점

- 공식 커리큘럼 경로와 기존 과목 목록이 같은 학습 범위를 다른 방식으로 보여줄 수 있다.
- 공유 `Content`는 재사용 구조로는 적절하지만, 학습자 화면에서 별도 섹션으로 크게 노출되면 공식 커리큘럼과 분리된 자료처럼 보인다.
- `TRACK`, `SUBJECT`, `MAJOR_ITEM` 같은 내부 타입명이 학습자에게 그대로 노출되면 공식 계층 이해보다 구현 구조가 먼저 보인다.
- 공식 커리큘럼이 존재하지만 CourseLesson 연결이 부족한 과정은 fallback 정책이 명확해야 한다.

## 3. 목표 구조

학습자 화면의 기본 탐색 축은 공식 `CurriculumTree`로 둔다.

```text
Course
└─ CurriculumTree
   └─ CurriculumNode
      └─ CourseLesson
         └─ Content
            └─ CourseLessonExtension
```

`Content`는 공통 원본으로 유지하고, 과정별 표현·시험 포인트·실무 메모는 `CourseLesson`과 extension 계층에서 보강한다.

## 4. CurriculumTree 중심 학습 흐름

학습자는 과정 학습 화면에서 다음 순서로 정보를 본다.

1. 과정 요약과 전체 학습 상태
2. 단계 학습
3. 공식 커리큘럼
4. 복습, 문제풀이, 모의고사, 분석 등 보조 카드

공식 커리큘럼에 연결된 `CourseLesson`이 있으면 해당 경로를 주 학습 경로로 사용한다.

## 5. CourseLesson 연결 방식

`CourseLesson.curriculumNodeId`가 있는 경우 해당 노드의 연결 레슨으로 표시한다.

- 레슨 링크는 기존 `/learn/[courseSlug]/course-lessons/[courseLessonId]`를 유지한다.
- 동일 `Content`가 여러 과정에 연결되어도 진도는 `courseLessonId + userId + courseId` 기준으로 분리한다.
- 동일 `CourseLesson`이 여러 노드에 연결되는 경우는 관리자 데이터 품질 점검 대상으로 본다.

## 6. 기존 Subject fallback

다음 경우에는 기존 `Subject` / `Topic` 기반 학습 목록을 fallback으로 유지한다.

- active `CurriculumTree`가 없는 과정
- active `CurriculumTree`는 있지만 published `CourseLesson` 연결이 없는 과정
- 공식 커리큘럼 연결 레슨이 운영 기준상 충분하지 않은 과정

현재 구현 기준은 단순하고 안전하게 `linkedLessonCount > 0`이면 공식 커리큘럼을 주 경로로 사용한다. 이후 운영 데이터가 충분해지면 “leaf node 연결률” 또는 “필수 레슨 연결률” 기준으로 확장할 수 있다.

## 7. 진도 계산 정책

공식 커리큘럼 진도는 연결된 `CourseLesson`의 완료 상태를 기준으로 계산한다.

- 전체 진도: published CourseLesson 중 완료 수 / 전체 수
- 노드 진도: 해당 CurriculumNode에 연결된 CourseLesson 완료율
- 레슨이 없는 노드: 진도 분모에 포함하지 않고 구조 탐색 노드로 표시
- 선택 레슨: 학습 화면에는 표시하되 전체 필수 진도 반영 여부는 추후 `isRequired` 기준으로 확장 가능

기존 subject 기반 진도는 fallback 화면에서만 사용한다.

## 8. 중복 방지 정책

공식 커리큘럼에 연결 레슨이 있으면 학습 개요 본문에서 다음 섹션을 숨긴다.

- 공통 이론 레슨
- 기존 과목 목록

단, 우측 보조 카드의 “이론 학습” 추천은 유지한다. 이는 사용자가 다음 레슨으로 빠르게 이동하기 위한 바로가기이므로 구조 중복이 아니라 행동 보조로 본다.

## 9. 필기/실기 분리

필기와 실기는 `CurriculumNode.nodeType = TRACK` 또는 metadata의 공식 계층 정보를 통해 분리한다.

학습자 화면에는 내부 타입 대신 한글 라벨을 우선 표시한다.

- `TRACK`: 필기/실기
- `SUBJECT`: 과목
- `MAJOR_ITEM`: 주요항목
- `SUB_ITEM`: 세부항목
- `STANDARD`: 세세항목
- `PRACTICAL`: 실기

## 10. 관리자 데이터 품질 경고

학습자 화면에는 내부 경고를 직접 노출하지 않는다. 다음 항목은 관리자 점검 대상으로 유지한다.

- leaf CurriculumNode에 CourseLesson 미연결
- CourseLesson이 없는 active CurriculumTree
- 동일 CourseLesson의 과도한 다중 노드 매핑
- 공식 과목과 기존 Subject 불일치
- active CurriculumTree 중복
- 기사/산업기사 간 CourseLesson 또는 진도 혼합 가능성

## 11. 마이그레이션 전략

이번 단계에서는 데이터베이스 구조와 기존 데이터를 변경하지 않는다.

- `Subject`, `Topic`, `LearningUnit`, `Lesson` 삭제 금지
- 기존 진도 데이터 삭제 금지
- `Content`, `CourseLesson`, `CurriculumTree`, `CurriculumNode` 구조 유지
- 학습자 화면의 정보 우선순위만 조정

향후 Subject/Topic 축소는 다음 조건이 충족될 때 별도 Sprint로 진행한다.

- 모든 운영 과정에 active CurriculumTree 존재
- 필수 leaf node의 CourseLesson 연결률이 운영 기준 이상
- 기존 Subject URL 접근에 대한 redirect 또는 archive 정책 수립
- 기존 진도와 통계의 호환성 검증 완료

