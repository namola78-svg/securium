# Student Core Wireframes

SECURIUM 학생 화면의 핵심 목적은 “오늘 무엇을 학습해야 하는지, 지금 어디까지 왔는지, 다음 행동이 무엇인지”를 명확하게 보여주는 것이다.

## 1. Dashboard

### Purpose

로그인 직후 학습자의 현재 상태와 오늘의 우선 학습 행동을 보여준다.

### Primary User Question

“오늘 나는 무엇부터 공부하면 좋을까?”

### Layout

```text
[Header]

[Hero Summary]
  - 오늘의 학습 상태
  - 전체 수강 과정 수
  - 오늘 추천 학습 시간
  - 최근 학습 과정

[Primary Action Card]
  - 이어서 학습하기
  - 오늘의 복습 시작

[Course Progress Grid]
  - 과정별 진행률
  - 최근 학습일
  - 정답률

[Recommended Next]
  - 추천 레슨
  - 추천 문제
  - 취약 주제

[Activity Snapshot]
  - 최근 7일 문제 풀이
  - 오답 수
  - 복습 예정 수
```

### Key Components

- `SectionHeader`
- `MetricCard`
- `StatusBadge`
- `Card`
- `EmptyState`

### Primary CTA

`이어서 학습하기`

### Empty State

아직 수강 중인 과정이 없습니다. 관심 있는 과정을 찾아 학습을 시작해보세요.

### Error State

학습 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.

### Mobile Behavior

요약 카드 → Primary CTA → 과정 진행률 → 추천 학습 순서로 1열 배치한다.

### Accessibility Notes

- 대시보드 요약은 `h1` 아래 `section`으로 구분한다.
- 진행률은 색상뿐 아니라 숫자와 텍스트로 함께 표시한다.

## 2. My Courses

### Purpose

사용자가 등록한 과정을 비교하고 바로 이어서 학습할 수 있게 한다.

### Primary User Question

“내가 수강 중인 과정 중 어디를 이어서 할까?”

### Layout

```text
[Header]

[Page Title]
  - 내 학습
  - 수강 중 / 완료 / 일시중지 필터

[Course List]
  [Course Card]
    - 과정명
    - 진행률
    - 현재 단계
    - 최근 학습일
    - 정답률
    - CTA: 학습 계속하기

[Recommended Course]
  - 새 과정 추천
```

### Primary CTA

`학습 계속하기`

### Empty State

아직 등록한 과정이 없습니다. 과정 목록에서 관심 있는 과정을 추가해보세요.

### Mobile Behavior

필터는 가로 스크롤 chip으로 제공하고, 과정 카드는 1열로 표시한다.

## 3. Course Detail

### Purpose

비로그인·로그인 사용자가 수강 여부를 판단하고 등록 또는 이어학습을 수행한다.

### Primary User Question

“이 과정이 나에게 필요한 과정인가?”

### Layout

```text
[Course Hero]
  - 과정명
  - 한 줄 소개
  - 추천 대상
  - 난이도
  - 예상 기간
  - 총 주제 수
  - 총 문제 수
  - 최근 업데이트

[Enrollment CTA Panel]
  - 비로그인: 로그인하고 과정 추가
  - 미등록: 내 학습에 추가
  - 등록 완료: 학습 계속하기
  - 완료: 복습하기

[Course Overview]
[Recommended For]
[Learning Goals]
[Curriculum Preview]
[Assessment Criteria]
```

### Empty State

아직 공개된 커리큘럼이 없습니다. 과정 콘텐츠를 준비하고 있습니다.

### Mobile Behavior

CTA 패널을 Hero 바로 아래에 배치한다.

## 4. Learn Overview

### Purpose

특정 과정의 학습 단위, 커리큘럼, 문제풀이, 복습으로 이동하는 과정 홈이다.

### Primary User Question

“이 과정 안에서 다음에 무엇을 해야 하지?”

### Layout

```text
[Course Header]
  - 과정명
  - 진행률
  - 현재 단계

[Today in This Course]
  - 추천 레슨
  - 복습 예정 문제
  - 취약 주제

[Curriculum Tree Compact]
  - 과목
  - 주요항목
  - 세부항목
  - 연결된 레슨/문제 수

[Right Inspector / Mobile Drawer]
  - 선택한 노드 상세
  - 공식 출처
  - 관련 콘텐츠
```

### Primary CTA

`추천 학습 시작`

### Mobile Behavior

Tree는 compact list로 표시하고 상세는 drawer로 연다.

## 5. Lesson Detail

### Purpose

본문형 이론 레슨을 읽고 완료 상태를 기록한다.

### Primary User Question

“이 개념을 이해했고 다음으로 넘어가도 될까?”

### Layout

```text
[Lesson Header]
  - 레슨 제목
  - 과정명
  - 커리큘럼 위치
  - 예상 학습 시간
  - 기준일 / 버전

[Lesson Body]
  - 제목
  - 문단
  - 목록
  - 표
  - 코드 블록
  - 인용

[Learning Actions]
  - 완료 처리
  - 관련 문제 풀기
  - AI에게 설명 요청

[Navigation]
  - 이전 레슨
  - 다음 레슨
```

### Primary CTA

`학습 완료`

### Accessibility Notes

- 본문 heading 순서를 유지한다.
- 코드 블록은 복사 버튼과 언어 라벨을 제공한다.

## 6. Question Practice

### Purpose

과정·과목·주제 기준으로 문제를 풀고 즉시 채점 결과를 확인한다.

### Primary User Question

“내 답이 왜 맞거나 틀렸을까?”

### Layout

```text
[Practice Header]
  - 과정명
  - 문제 진행률
  - 문제 유형
  - 난이도

[Question Panel]
  - 문제 지문
  - 선택지 또는 입력 영역
  - 답안 제출

[Result Panel]
  - 정답 여부
  - 관리자 검수 해설
  - AI 참고 해설
  - 관련 기준/법령

[Question Navigator]
  - 이전
  - 다음
  - 즐겨찾기
  - 신고
```

### Primary CTA

`답안 제출`

### Error State

문제를 불러오지 못했습니다. 과정 또는 필터를 다시 확인해주세요.

## 7. Review

### Purpose

오답, 연체 복습, 취약 주제를 우선순위에 따라 다시 학습한다.

### Primary User Question

“지금 복습해야 하는 가장 중요한 것은 무엇일까?”

### Layout

```text
[Review Summary]
  - 오늘 복습 수
  - 연체 수
  - 예상 소요 시간

[Priority Queue]
  - 반복 오답
  - 연체 복습
  - 낮은 정답률 주제

[Review Session CTA]
  - 복습 시작

[Filters]
  - 과정
  - 과목
  - 난이도
  - 숙지 상태
```

### Empty State

오늘 예정된 복습이 없습니다. 새로운 문제를 풀거나 과정을 이어서 학습해보세요.

## 8. AI Tutor

### Purpose

학습자가 질문하거나 문제·레슨에 대한 AI 참고 설명을 확인한다.

### Primary User Question

“이 개념을 내 수준에 맞게 다시 설명해줄 수 있을까?”

### Layout

```text
[AI Tutor Header]
  - AI 참고 고지
  - 현재 과정 컨텍스트

[Prompt Input]
  - 질문 입력
  - 컨텍스트 선택

[Answer]
  - 요약
  - 설명
  - 근거 콘텐츠
  - 관련 문제
  - 검수 여부

[Citation Drawer]
  - 출처 목록
  - 기준일
  - 콘텐츠 ID
```

### Primary CTA

`AI에게 질문하기`

### Safety Notes

- AI 답변은 공식 채점 결과가 아님을 명시한다.
- 근거가 부족하면 확정적 설명을 제공하지 않는다.

## 9. Analytics

### Purpose

과정별·통합 학습 성과와 취약 영역을 확인한다.

### Primary User Question

“내가 어느 영역을 더 공부해야 할까?”

### Layout

```text
[Analytics Summary]
  - 전체 정답률
  - 누적 문제 수
  - 학습 일수
  - 복습 성공률

[Course Breakdown]
  - 과정별 진행률
  - 과정별 정답률

[Subject Accuracy]
  - 과목별 막대그래프

[Weak Areas]
  - 취약 주제
  - 반복 오답
  - 추천 학습
```

### Empty State

아직 분석할 학습 기록이 없습니다. 문제를 풀거나 레슨을 완료하면 분석이 표시됩니다.

### Accessibility Notes

- 그래프 수치는 표 형태 대체 정보를 함께 제공한다.
- 색상만으로 좋은/나쁜 상태를 구분하지 않는다.

