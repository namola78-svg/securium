# SECURIUM Admin Console UX

## 1. 관리자 UX 방향

SECURIUM의 관리자 화면은 단순 CRUD가 아니라 “학습 품질 운영 Console”이어야 한다.

관리자는 다음 질문에 빠르게 답할 수 있어야 한다.

- 공식 기준 대비 어떤 영역의 콘텐츠가 부족한가?
- 어떤 문제와 해설이 검수 대기 중인가?
- AI가 어떤 근거로 답변했는가?
- 특정 Concept가 어떤 과정, 문제, 콘텐츠와 연결되어 있는가?
- 운영상 위험한 변경이 있었는가?

## 2. Console Shell

관리자 화면은 공통 Console Shell을 갖는 것이 좋다.

```text
Admin Console Shell
├─ Global header
│  ├─ Current console
│  ├─ Search
│  ├─ Environment badge
│  └─ User/account menu
├─ Domain navigation
├─ Filter/action bar
├─ Main work area
└─ Detail panel / drawer
```

## 3. Operations Dashboard

목적:

- 운영자가 오늘 봐야 할 위험과 할 일을 보여준다.

권장 카드:

- Pending review
- Coverage gap
- AI failed/insufficient context
- Recent admin actions
- Production data change warnings
- Content revision status

## 4. Curriculum Console

목적:

- 공식 출제기준과 SECURIUM 학습 구조를 관리한다.

권장 UI:

- Compact Tree List
- Node Detail Panel
- Coverage badges
- Source page
- Stable key copy
- Course extension indicators

목록에서 반복하지 말고 detail panel로 이동할 정보:

- 전체 metadata
- 연결 CourseLesson
- 연결 Question
- 연결 Concept
- 변경 이력

## 5. Ontology Console

목적:

- Concept, Alias, Synonym, Parent/Child, Related Concept, Cross-course mapping을 관리한다.

권장 UI:

```text
Ontology Console
├─ Filter: namespace, status, source type, relation
├─ Concept list
├─ Relation graph preview
├─ Detail panel
│  ├─ Concept identity
│  ├─ Aliases
│  ├─ Edges
│  ├─ Connected curriculum nodes
│  ├─ Connected content/questions
│  └─ Review workflow
└─ Coverage/action queue
```

우선순위:

- 공식 명칭 또는 대표 Concept label
- namespace
- 검수 상태
- 연결 수
- stable key

## 6. AI Explainability Console

목적:

- AI 결과가 어떤 근거로 생성됐는지 추적하고 검수한다.

권장 탭:

- Overview
- Concept Detection
- Alias Expansion
- Retrieval Trace
- Context Viewer
- Prompt Viewer
- Citation Viewer
- Token / Latency / Cost
- Feedback
- Review Action

보안 원칙:

- 사용자 답안 전체 원문, 토큰, secret, 민감정보는 저장하거나 노출하지 않는다.
- Prompt Viewer는 시스템 프롬프트 전체가 아니라 안전한 요약 또는 redacted view를 우선한다.
- 일반 사용자는 AI Trace Console에 접근할 수 없다.

## 7. Coverage Console

목적:

- CurriculumNode별 콘텐츠, 문제, 개념, AI 근거 Coverage를 점검한다.

권장 화면:

```text
Coverage Console
├─ Course selector
├─ Tree coverage table
├─ Gap filters
│  ├─ No content
│  ├─ No question
│  ├─ No concept
│  ├─ No AI context
│  └─ Needs review
├─ Recommended actions
└─ Export/report
```

Coverage row 정보:

- 공식 계층 순번
- 공식 명칭
- content count
- question count
- concept count
- coverage score
- status
- action

## 8. Content Console

목적:

- 공유 Content, CourseLesson, revision, 공식 출처를 관리한다.

권장:

- Content canonical record와 CourseLesson course-specific extension을 명확히 분리한다.
- 한 콘텐츠가 여러 과정에서 재사용되는 경우 재사용 관계를 표시한다.
- 새 버전 게시 시 기존 학습 기록을 삭제하지 않는다는 안내를 명확히 둔다.

## 9. Question Console

목적:

- 문제 작성, 검수, 게시, 신고, 연결 관계를 관리한다.

권장:

- 문제 본문과 정답/해설 관리
- 연결 Course/CurriculumNode/Concept
- 공식 기준 근거
- AI 해설 생성/검수 상태
- 신고 처리 상태

## 10. Analytics Console

목적:

- 학습자 통계, 과정별 약점, 콘텐츠 품질, 문제 품질을 분석한다.

권장 섹션:

- Course performance
- CurriculumNode weakness
- Question difficulty quality
- Wrong note recurrence
- Review success
- AI helpfulness
- Coverage vs performance

## 11. Interaction 원칙

- 선택 기반 split panel을 우선한다.
- 목록에서 편집 모달을 남발하지 않는다.
- 위험 작업은 confirmation과 audit log를 남긴다.
- Production 데이터 변경은 명시적 승인과 환경 표시가 필요하다.
- 필터는 URL query에 반영해 새로고침과 공유가 가능해야 한다.

## 12. 구현 순서

1. Admin Console Shell
2. Compact Tree List component
3. Detail Panel component
4. Filter Bar component
5. Status Badge system
6. Curriculum Console 개선
7. Ontology Console 개선
8. AI Explainability Console 개선
9. Coverage Console 신설 또는 확장
