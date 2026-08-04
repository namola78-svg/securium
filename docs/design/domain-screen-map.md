# SECURIUM Domain Screen Map

이 문서는 SECURIUM 화면을 “경로 목록”이 아니라 제품 도메인 기준으로 묶은 IA 지도다.  
Figma 설계와 구현 Sprint를 쪼갤 때 이 문서를 기준으로 사용한다.

## 1. 학생 영역

학생 영역은 학습자가 오늘 무엇을 하고, 어디까지 이해했는지 확인하는 경험을 중심으로 묶는다.

```text
학생
├─ Dashboard
├─ Course
├─ Lesson
├─ Question
├─ Review
├─ AI
├─ Analytics
├─ Account
└─ Support
```

### 1.1 Dashboard

목적: 학습자의 현재 상태와 다음 행동을 한 화면에 정리한다.

포함 화면:

- `/dashboard`
- `/my-courses`

핵심 정보:

- 오늘의 학습
- 이어서 학습
- 과정별 진행률
- 오늘의 복습
- 취약 영역
- 추천 학습

주요 컴포넌트:

- Card
- MetricCard
- Badge
- EmptyState
- Command Palette

### 1.2 Course

목적: 과정을 탐색하고 수강 여부를 결정한다.

포함 화면:

- `/courses`
- `/courses/[courseSlug]`
- `/learn/[courseSlug]`

핵심 정보:

- 과정명
- 추천 대상
- 난이도
- 학습 구성
- 공식 커리큘럼
- 수강 상태
- CTA

주요 컴포넌트:

- Course Card
- Badge
- Tree
- Inspector Panel
- Button

### 1.3 Lesson

목적: CourseLesson 기반 이론 학습을 수행하고 완료 기록을 남긴다.

포함 화면:

- `/learn/[courseSlug]/course-lessons/[courseLessonId]`
- `/learn/[courseSlug]/lessons/[lessonId]`
- `/learn/[courseSlug]/subjects/[subjectId]`

핵심 정보:

- 공식 커리큘럼 위치
- 레슨 제목
- 본문
- 관련 문제
- 관련 개념
- 진행률
- 완료 상태

주요 컴포넌트:

- Reader Layout
- Badge
- Card
- Inspector Panel
- Progress

### 1.4 Question

목적: 문제풀이, 채점, 해설 확인을 수행한다.

포함 화면:

- `/practice`
- `/practice/[courseSlug]`
- `/mock-exams`
- `/mock-exams/[mockExamId]`
- `/mock-exams/attempts/[attemptId]`

핵심 정보:

- 문제 지문
- 선택지 또는 답안 입력
- 제출 상태
- 채점 결과
- 관리자 검수 해설
- AI 참고 해설
- 관련 커리큘럼 노드

주요 컴포넌트:

- Question Card
- Button
- Badge
- Dialog
- Tabs

### 1.5 Review

목적: 오답과 스마트 복습을 관리한다.

포함 화면:

- `/wrong-notes`
- `/reviews`
- `/bookmarks`

핵심 정보:

- 최근 오답
- 반복 오답
- 오늘 복습
- 연체 복습
- 즐겨찾기
- 다시 풀기

주요 컴포넌트:

- Card
- Table
- Badge
- EmptyState
- Filter/Search

### 1.6 AI

목적: AI 설명과 추천을 학습 맥락 안에서 제공한다.

포함 화면:

- `/ai-tutor`
- 문제풀이 내부 AI 해설
- 특화 실무 화면 내부 AI 검토

핵심 정보:

- 질문 또는 학습 맥락
- AI 답변
- 근거 콘텐츠
- 공식/AI/검수 구분
- 추천 학습

주요 컴포넌트:

- AI Response Card
- Citation Card
- Badge
- Search
- Toast

### 1.7 Analytics

목적: 학습 성과와 취약 영역을 확인한다.

포함 화면:

- `/analytics`
- `/analytics/[courseId]`

핵심 정보:

- 전체 정답률
- 과정별 진행률
- 과목별 정답률
- 주제별 취약 영역
- 최근 학습량
- 복습 성공률

주요 컴포넌트:

- MetricCard
- Chart
- Table
- Badge
- Tabs

### 1.8 Account

목적: 계정과 학습 설정을 관리한다.

포함 화면:

- `/profile`
- `/settings`
- `/login`
- `/signup`

핵심 정보:

- 사용자명
- 로그인 상태
- 학습 목표
- 알림/복습 설정
- 로그아웃

주요 컴포넌트:

- Form
- Button
- Drawer
- InlineError

### 1.9 Support

목적: 제품 이해와 초기 진입을 돕는다.

포함 화면:

- `/`
- `/guide`
- `/about`

핵심 정보:

- SECURIUM 가치
- 학습 방법
- 과정 소개
- 무료 시작 CTA

주요 컴포넌트:

- Hero
- Card
- Button
- Accordion 또는 Tabs

## 2. 관리자 영역

관리자 영역은 데이터 생성보다 “운영 상태 판단과 조치”를 중심으로 묶는다.

```text
관리자
├─ Dashboard
├─ Curriculum
├─ Ontology
├─ Content
├─ Question
├─ Coverage
├─ AI
├─ Analytics
├─ Audit
├─ Course
└─ Operations
```

### 2.1 Dashboard

목적: 전체 운영 상태와 우선 조치 항목을 보여준다.

포함 화면:

- `/admin`

핵심 정보:

- 과정 수
- 활성 커리큘럼
- 게시 콘텐츠
- 초안 콘텐츠
- 우선 조치

주요 컴포넌트:

- MetricCard
- Card
- Inspector Panel
- Command Palette

### 2.2 Curriculum

목적: 공식 출제기준 기반 CurriculumTree와 노드를 관리한다.

포함 화면:

- `/admin/curriculum`

핵심 정보:

- CurriculumTree
- CurriculumNode
- 공식 순번
- stable key
- PDF source page
- CourseLesson 연결
- Coverage Gap

주요 컴포넌트:

- Tree
- Table
- Inspector Panel
- Search
- Badge

### 2.3 Ontology

목적: Concept, Alias, Synonym, Relation, Cross-Course Mapping을 관리한다.

포함 화면:

- `/admin/ontology`

핵심 정보:

- Concept
- Alias
- Synonym
- Parent/Child
- Related Concept
- CurriculumNode mapping
- Content/Question mapping

주요 컴포넌트:

- Table
- Tree
- Inspector Panel
- Search
- Tabs

### 2.4 Content

목적: 공통 콘텐츠와 CourseLesson 연결을 운영한다.

포함 화면:

- `/admin/shared-content`
- `/admin/lessons`
- `/admin/lessons/[lessonId]/preview`
- `/admin/content-revisions`

핵심 정보:

- Shared Content
- Lesson
- CourseLesson
- Revision
- 공개 상태
- 연결 커리큘럼 노드

주요 컴포넌트:

- Table
- Card
- Inspector Panel
- Dialog
- Badge

### 2.5 Question

목적: 문제은행, 검수, 게시, 신고를 관리한다.

포함 화면:

- `/admin/questions`
- `/admin/questions/new`
- `/admin/questions/[questionId]`
- `/admin/question-reports`
- `/admin/mock-exams`
- `/admin/mock-exams/[mockExamId]`

핵심 정보:

- 문제 상태
- 문제 유형
- 과정 연결
- 커리큘럼 노드 연결
- 검수 상태
- 신고 사유
- 모의고사 구성

주요 컴포넌트:

- Table
- Form
- Dialog
- Badge
- Tabs

### 2.6 Coverage

목적: 공식 커리큘럼 대비 콘텐츠·문제·온톨로지 연결 누락을 점검한다.

포함 화면:

- `/admin/curriculum` 내부 coverage
- `/admin/analytics`
- 향후 Coverage Console

핵심 정보:

- 노드별 콘텐츠 수
- 노드별 문제 수
- 노드별 Concept 연결
- Gap score
- Action queue

주요 컴포넌트:

- Table
- MetricCard
- Inspector Panel
- Badge
- Search

### 2.7 AI

목적: AI 응답의 근거, 비용, 검수 상태를 추적한다.

포함 화면:

- `/admin/ai-explainability`
- `/admin/ai-reviews`

핵심 정보:

- Retrieval Trace
- Context Viewer
- Prompt Viewer
- Citation Viewer
- Token/Latency/Cost
- AI Feedback
- Review status

주요 컴포넌트:

- Table
- Inspector Panel
- Tabs
- Badge
- Dialog

### 2.8 Analytics

목적: 학습자 활동과 콘텐츠 운영 상태를 분석한다.

포함 화면:

- `/admin/analytics`

핵심 정보:

- 과정별 학습량
- 문제 풀이량
- 오답 빈도
- 취약 주제
- 커버리지 지표

주요 컴포넌트:

- MetricCard
- Chart
- Table
- Tabs

### 2.9 Audit

목적: 중요 관리자 작업과 보안 이벤트를 추적한다.

포함 화면:

- `/admin/audit-logs`

핵심 정보:

- actor
- action
- resource
- result
- requestId
- createdAt
- metadata

주요 컴포넌트:

- Table
- Search
- Inspector Panel
- Badge

### 2.10 Course

목적: 과정, 과정군, 과목, 주제 구조를 관리한다.

포함 화면:

- `/admin/course-groups`
- `/admin/courses`
- `/admin/courses/[courseId]`
- `/admin/courses/[courseId]/subjects`
- `/admin/subjects/[subjectId]/topics`

핵심 정보:

- CourseGroup
- Course
- Subject
- Topic
- 공개/활성 상태
- 정렬 순서

주요 컴포넌트:

- Table
- Form
- Badge
- Dialog

### 2.11 Operations

목적: 운영 상태와 배포/성능/보안 점검 정보를 확인한다.

포함 화면:

- `/ops/health`
- `/ops/dashboard-performance`

핵심 정보:

- Health check
- DB provider
- runtime status
- dashboard performance
- 보안 헤더

주요 컴포넌트:

- MetricCard
- Table
- Badge
- Inspector Panel

## 3. IA 설계 원칙

### 학생 IA 원칙

1. Dashboard는 “오늘 할 일”을 가장 먼저 보여준다.
2. Course는 탐색과 수강 판단을 담당한다.
3. Lesson은 공식 커리큘럼 기반 이해를 담당한다.
4. Question은 이해 확인과 채점을 담당한다.
5. Review는 반복 학습과 취약 영역 회복을 담당한다.
6. AI는 답을 대신하는 것이 아니라 근거 기반 설명을 제공한다.
7. Analytics는 점수보다 다음 학습 판단을 돕는다.

### 관리자 IA 원칙

1. Dashboard는 전체 운영 판단을 돕는다.
2. Curriculum은 공식 기준의 중심축이다.
3. Ontology는 검색, AI, 과정 간 연결의 의미망이다.
4. Content는 재사용 가능한 학습 자산이다.
5. Coverage는 누락을 발견하고 액션으로 연결한다.
6. Audit은 운영 신뢰성을 보장한다.
7. 모든 관리자 상세 정보는 가능하면 Inspector Panel 패턴으로 통일한다.
