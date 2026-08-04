# SECURIUM Learner Experience UX

## 1. 학습자 경험 목표

학습자는 SECURIUM에서 “무엇을 배워야 하는지, 왜 틀렸는지, 다음에 무엇을 복습해야 하는지”를 빠르게 이해해야 한다.

학습자 UX의 핵심 문장:

> 오늘 학습할 것, 취약한 것, 다시 봐야 할 것을 한눈에 보여준다.

## 2. 핵심 플로우

### 첫 방문

```text
홈
→ 과정 둘러보기
→ 과정 상세
→ 무료 계정 만들기 또는 로그인
→ 내 학습에 추가
→ 학습 시작
```

### 일상 학습

```text
대시보드
→ 오늘의 학습
→ CurriculumNode 또는 CourseLesson
→ 문제풀이
→ AI 해설
→ 오답노트
→ 복습 일정
```

### 취약 영역 복습

```text
학습분석
→ 취약 과목/개념
→ 관련 CurriculumNode
→ 추천 문제
→ 오답 재풀이
→ AI 설명 확인
```

## 3. Dashboard

### 목적

대시보드는 “현재 상태 요약”보다 “다음 행동 선택”이 우선이다.

### 권장 구성

1. 오늘의 학습 카드
2. 이어서 학습할 과정
3. 복습 예정/연체
4. 취약 영역
5. 최근 풀이/최근 학습
6. AI 튜터 바로가기

### 피해야 할 것

- 의미 없는 전체 통계 나열
- 데이터가 없는데 가짜 진행률 표시
- 준비 중 기능을 완료된 기능처럼 표시

## 4. Course Learn Overview

`/learn/[courseSlug]`는 과정별 학습 허브다.

권장 정보구조:

```text
Course Learn Overview
├─ Course status summary
├─ Today for this course
├─ Official Curriculum Tree
├─ Continue learning
├─ Practice and review
└─ Course analytics preview
```

핵심:

- 공식 CurriculumTree가 있으면 이를 기본 학습 구조로 사용한다.
- Subject/Topic legacy 구조는 fallback 또는 보조 정보로 낮춘다.
- CourseLesson 기반 진도를 우선한다.

## 5. Curriculum Tree UX

학습자용 CurriculumTree는 관리자용보다 더 단순해야 한다.

기본 원칙:

- 과목 단계까지만 기본 펼침
- 공식 명칭 우선
- 내부 stable key 숨김 또는 secondary 처리
- 연결된 레슨과 문제 수를 작은 배지로 표시
- 선택 시 상세 패널에서 설명, 출처, 학습 콘텐츠 표시

노드 상태:

- 학습 가능
- 진행 중
- 완료
- 복습 필요
- 콘텐츠 준비 중

## 6. Lesson UX

Lesson은 Notion식 문서 읽기 경험과 학습 진행 상태를 결합한다.

권장 구성:

1. Breadcrumb: Course → CurriculumNode → Lesson
2. Lesson title
3. 공식 출처/기준일/버전
4. 본문
5. 핵심 요약
6. 관련 문제
7. AI에게 질문하기
8. 완료 처리
9. 다음 학습

## 7. Practice UX

문제풀이 화면은 “문제를 풀고, 왜 맞거나 틀렸는지 이해하는 것”이 핵심이다.

권장 구성:

- 문제 지문
- 선택/답안 입력
- 제출 CTA
- 제출 후 정답 여부
- 관리자 검수 해설
- AI 참고 해설
- 관련 CurriculumNode
- 관련 Concept
- 오답노트/즐겨찾기/신고

정답 데이터는 제출 전 노출하지 않는다.

## 8. AI Tutor UX

AI Tutor는 “대화형 검색창”보다 “근거 기반 학습 보조”로 보여야 한다.

권장 기능:

- 현재 과정/노드/문제 맥락 자동 연결
- 근거 부족 시 확정 답변 대신 제한 안내
- Citation 카드
- 관련 개념
- 유사 문제 추천
- 오답 복습 연결

AI 고지:

> AI가 생성한 참고용 설명이며 공식 기준·법령·시험 채점 결과가 아닙니다.

## 9. Mobile UX

모바일은 학습자의 실제 사용 빈도가 높을 수 있으므로 우선순위를 높인다.

기준:

- 주요 CTA 44px 이상
- 좌우 여백 최소 16px
- 하단으로 긴 tree를 무작정 늘리지 않음
- tree는 collapse 기본
- detail panel은 bottom sheet 또는 별도 화면
- 문제풀이 버튼은 손가락 터치 영역 확보

## 10. Empty / Loading / Error

### 빈 상태

예:

- 아직 등록한 과정이 없습니다.
- 관심 있는 과정을 찾아 학습을 시작해보세요.

### 로딩

예:

- 학습 정보를 불러오고 있습니다.

### 오류

예:

- 정보를 불러오지 못했습니다.
- 잠시 후 다시 시도해주세요.

오류 화면에는 가능한 경우 “다시 시도”와 “과정 둘러보기”를 제공한다.
