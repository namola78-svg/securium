# Student Wireframes

학생 화면의 설계 원칙은 “지금 어디에 있고, 무엇을 하면 되는지”를 한 화면 안에서 명확히 보여주는 것이다.

## Common Student Layout

```text
[Header]
  Logo | Primary Nav | Search / Command | Account

[Page Context]
  Eyebrow
  H1
  Short description
  Primary CTA

[Main Content]
  Summary
  Primary task
  Supporting content

[Optional Inspector / Drawer]
  Evidence
  Related concepts
  Progress metadata
```

## 1. Home

- 목적: SECURIUM의 가치를 설명하고 첫 학습 행동으로 연결한다.
- 사용자 행동: 과정 탐색, 회원가입/로그인, 학습 시작.
- 주요 CTA: `무료로 학습 시작하기`, `과정 둘러보기`.
- 정보 우선순위: 제품 가치 → 핵심 과정 → AI/복습/진도 가치 → CTA.
- Empty State: 없음. 공개 화면은 항상 기본 소개 콘텐츠를 제공한다.
- Loading: 과정 카드 영역만 skeleton 처리.
- Error: 과정 목록 실패 시 “과정 정보를 불러오지 못했습니다.”
- Mobile: Hero CTA를 전체 너비 버튼으로 배치하고 카드 섹션은 1열.

## 2. Course

- 목적: 사용자가 과정명, 대상, 난이도, 학습량, 상태를 비교한다.
- 사용자 행동: 필터링, 과정 상세 이동, 수강 중 과정 이어가기.
- 주요 CTA: `과정 자세히 보기`, 수강 중이면 `학습 계속하기`.
- 정보 우선순위: 과정명 → 한 줄 설명 → 추천 대상 → 난이도 → 학습 구성 → 예상 기간 → 문제/콘텐츠 수 → 상태 → CTA.
- Empty State: “조건에 맞는 과정이 없습니다.”
- Loading: 카드 높이를 유지하는 skeleton grid.
- Error: “과정 목록을 불러오지 못했습니다.”
- Mobile: 1열 카드, 필터는 chip 형태 가로 스크롤.

## 3. Curriculum

- 목적: 공식 기준 기반 커리큘럼 계층을 읽기 쉽게 탐색한다.
- 사용자 행동: 과목 펼치기, 노드 선택, 연결 콘텐츠 확인.
- 주요 CTA: `선택한 영역 학습하기`.
- 정보 우선순위: 공식 명칭 → 공식 계층 순번 → 학습 가능 상태 → 연결 콘텐츠 수 → stable key.
- Empty State: “아직 공개된 커리큘럼이 없습니다.”
- Loading: compact tree skeleton.
- Error: “커리큘럼을 불러오지 못했습니다.”
- Mobile: tree 선택 시 하단 drawer로 상세 표시.

## 4. Lesson

- 목적: 본문형 이론 레슨을 읽고 완료 기록을 남긴다.
- 사용자 행동: 읽기, 완료 처리, 관련 문제 이동, AI 설명 요청.
- 주요 CTA: `학습 완료`.
- 정보 우선순위: 레슨 제목 → 커리큘럼 위치 → 기준일/버전 → 본문 → 관련 문제/AI.
- Empty State: “이 영역에는 아직 공개된 레슨이 없습니다.”
- Loading: 제목, 본문, CTA skeleton.
- Error: “레슨을 불러오지 못했습니다.”
- Mobile: 본문 폭 최적화, sticky CTA는 과도하게 사용하지 않음.

## 5. Theory

- 목적: 공식 기준·법령·보안 개념을 깊게 학습한다.
- 사용자 행동: 기준 탐색, 관련 문제 풀기, 근거 확인.
- 주요 CTA: `관련 문제 풀기`.
- 정보 우선순위: 공식 제목 → 기준일 → 핵심 요약 → 본문 → 관련 법령/문제.
- Empty State: “해당 기준의 이론 콘텐츠를 준비하고 있습니다.”
- Loading: article skeleton.
- Error: “이론 정보를 불러오지 못했습니다.”
- Mobile: 표는 가로 스크롤 대신 stacked table 우선.

## 6. Question

- 목적: 문제풀이와 자동채점, 해설 확인을 연결한다.
- 사용자 행동: 답안 선택/입력, 제출, 해설 확인, 다음 문제 이동.
- 주요 CTA: `답안 제출`.
- 정보 우선순위: 문제 지문 → 답안 영역 → 제출 → 결과 → 해설 → 관련 기준.
- Empty State: “조건에 맞는 문제가 없습니다.”
- Loading: 문제 카드 skeleton.
- Error: “문제를 불러오지 못했습니다.”
- Mobile: 선택지는 44px 이상 터치 영역 유지.

## 7. AI Explanation

- 목적: AI 해설과 관리자 검수 해설을 분리해 신뢰도를 높인다.
- 사용자 행동: AI 설명 읽기, 근거 보기, 피드백 제출.
- 주요 CTA: `근거 보기`.
- 정보 우선순위: 참고용 고지 → 요약 → 정답/오답 이유 → 근거 → 피드백.
- Empty State: “검수된 근거가 부족하여 AI 설명을 제공하기 어렵습니다.”
- Loading: answer skeleton.
- Error: “AI 설명을 생성하지 못했습니다.”
- Mobile: 근거 목록은 drawer로 제공.

## 8. Review

- 목적: 오답과 취약영역을 우선순위에 따라 복습한다.
- 사용자 행동: 복습 시작, 필터링, 숙지 처리.
- 주요 CTA: `복습 시작`.
- 정보 우선순위: 오늘 복습 수 → 연체 수 → 반복 오답 → 취약 주제 → 필터.
- Empty State: “오늘 예정된 복습이 없습니다.”
- Loading: queue skeleton.
- Error: “복습 목록을 불러오지 못했습니다.”
- Mobile: Summary → CTA → queue 순서.

## 9. AI Tutor

- 목적: 학습자가 질문하고 근거 기반 AI 답변을 받는다.
- 사용자 행동: 질문 입력, 컨텍스트 선택, 답변 확인, 근거 확인.
- 주요 CTA: `AI에게 질문하기`.
- 정보 우선순위: 질문 입력 → 컨텍스트 → 답변 → 근거 → 관련 학습.
- Empty State: “궁금한 개념이나 문제를 질문해보세요.”
- Loading: streaming 또는 staged loading.
- Error: “AI Tutor가 응답하지 못했습니다.”
- Mobile: 입력창은 하단 고정 가능하지만 키보드 가림을 피한다.

## 10. Analytics

- 목적: 학습 성과와 취약 영역을 한눈에 보여준다.
- 사용자 행동: 취약 주제 확인, 추천 학습 시작.
- 주요 CTA: `추천 학습 시작`.
- 정보 우선순위: 전체 정답률 → 과정별 진행률 → 과목별 정답률 → 취약 주제 → 추천 학습.
- Empty State: “분석할 학습 기록이 아직 없습니다.”
- Loading: metric/card skeleton.
- Error: “학습 분석을 불러오지 못했습니다.”
- Mobile: 그래프는 표 대체 정보와 함께 1열 표시.

