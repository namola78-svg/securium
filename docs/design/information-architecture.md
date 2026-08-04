# SECURIUM Information Architecture

## 1. IA 원칙

SECURIUM의 정보구조는 학습자 경험과 관리자 운영 경험을 분리하되, 같은 데이터 축을 공유해야 한다.

공통 데이터 축:

- Course
- CurriculumTree / CurriculumNode
- CourseLesson / Content
- Question
- Ontology Concept / Edge
- AI Trace / Retrieval Context
- Coverage
- Progress / Analytics

## 2. 공개 영역

```text
/
├─ /courses
│  └─ /courses/[courseSlug]
├─ /guide
├─ /about
├─ /login
└─ /signup
```

목표:

- SECURIUM의 가치와 신뢰성을 설명한다.
- 과정 탐색과 가입/로그인으로 자연스럽게 이동한다.
- 공식 기준 기반, AI 근거, 맞춤 복습이라는 차별점을 빠르게 전달한다.

## 3. 학습자 영역

```text
/dashboard
├─ /my-courses
├─ /learn/[courseSlug]
│  ├─ /learn/[courseSlug]/course-lessons/[courseLessonId]
│  ├─ /learn/[courseSlug]/lessons/[lessonId]
│  ├─ /learn/[courseSlug]/levels/[levelId]
│  └─ /learn/[courseSlug]/subjects/[subjectId]
├─ /practice
│  └─ /practice/[courseSlug]
├─ /wrong-notes
├─ /reviews
├─ /mock-exams
│  ├─ /mock-exams/[mockExamId]
│  └─ /mock-exams/attempts/[attemptId]
├─ /analytics
│  └─ /analytics/[courseId]
├─ /ai-tutor
├─ /bookmarks
├─ /lectures/[courseSlug]
├─ /profile
└─ /settings
```

학습자 IA의 핵심은 “다음 학습 행동”이다.

- 오늘 해야 할 학습
- 이어서 볼 레슨
- 풀어야 할 문제
- 복습해야 할 오답
- AI에게 물어볼 수 있는 맥락
- 약한 영역 분석

## 4. 관리자 Console 영역

```text
/admin
├─ /admin/courses
├─ /admin/course-groups
├─ /admin/curriculum
├─ /admin/shared-content
├─ /admin/lessons
├─ /admin/questions
├─ /admin/question-reports
├─ /admin/mock-exams
├─ /admin/ontology
├─ /admin/ai-explainability
├─ /admin/ai-reviews
├─ /admin/analytics
├─ /admin/content-revisions
├─ /admin/audit-logs
└─ /admin/practical-specializations
```

관리자 IA는 CRUD 목록이 아니라 Console 모음으로 재정의한다.

| Console | 목적 |
| --- | --- |
| Operations Dashboard | 운영 상태, 위험, pending action |
| Curriculum Console | 공식 기준 tree, node, course mapping |
| Content Console | lesson, shared content, revision |
| Question Console | 문제 작성, 검수, 게시, 신고 |
| Ontology Console | concept, alias, relation, cross-course mapping |
| AI Trace Console | retrieval, prompt, citation, feedback |
| Coverage Console | curriculum-node별 content/question/concept coverage |
| Analytics Console | 학습, 문제, 오답, AI, coverage 분석 |
| Audit Console | 중요 작업 감사로그 |

## 5. Cross-link 구조

### 학습자 화면

```text
CurriculumNode
→ CourseLesson
→ Question
→ AI Explanation
→ Citation
→ Official Source
→ Review / Wrong Note
```

### 관리자 화면

```text
Official Source
→ CurriculumNode
→ Content
→ Question
→ Ontology Concept
→ AI Retrieval Trace
→ Coverage Gap
→ Action Queue
```

## 6. Navigation 구조

### 로그인 전

- 과정
- 학습 가이드
- 시큐리움 소개
- 로그인
- 무료로 시작하기

### 로그인 후

- 내 학습
- 문제풀이
- 오답노트
- AI 튜터
- 프로필 메뉴

### 관리자

관리자 권한이 있는 사용자에게만 관리자 Console 진입점을 표시한다.

권장:

- 일반 학습자 navigation과 관리자 navigation을 섞지 않는다.
- 관리자 진입 후에는 Console 전용 navigation을 사용한다.

## 7. 정보 우선순위

### 과정

1. 과정명
2. 공식 범위 또는 대상
3. 학습 목표
4. 커리큘럼 요약
5. 문제/콘텐츠 수
6. 상태
7. CTA

### CurriculumNode

1. 공식 명칭
2. 공식 계층 순번
3. 한글 계층명
4. 연결 콘텐츠/문제/개념 수
5. 출처 페이지
6. stable key
7. 상태 배지

### AI Trace

1. 사용자 질문 또는 작업 유형
2. 결과 상태
3. 근거 콘텐츠
4. concept detection
5. retrieval ranking
6. prompt summary
7. token/latency/cost
8. review action

## 8. 우선 개선 화면

1. `/learn/[courseSlug]`
2. `/admin/curriculum`
3. `/admin/ontology`
4. `/admin/ai-explainability`
5. `/admin/analytics`
6. `/courses`
7. `/dashboard`

이 순서가 좋은 이유는 학습자와 관리자 양쪽의 복잡도를 동시에 낮추기 때문이다.
