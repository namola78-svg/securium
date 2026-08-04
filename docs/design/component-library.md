# SECURIUM Component Library

이 문서는 SECURIUM 화면을 구성하는 핵심 컴포넌트와 variant 체계를 정의한다.

Drawer, Dialog, Inspector, Split Panel, Tree, Wizard의 사용 판단 기준은 `docs/design/interaction-pattern-decisions.md`에서 관리한다.

Foundation 기준 핵심 컴포넌트:

```text
Button
Card
Table
Badge
Tree
Dialog
Drawer
Search
Toast
Tabs
```

## 1. Button

### 목적

사용자의 명확한 행동을 실행한다.

### Variants

| Variant | 용도 | 예시 |
| --- | --- | --- |
| Primary | 화면의 가장 중요한 실행 | 무료로 학습 시작하기, 저장, 게시 |
| Secondary | Primary 다음 우선순위의 실행 | 과정 둘러보기, 미리보기 |
| Danger | 위험하거나 되돌리기 어려운 실행 | 삭제, 비활성화, 반려, 보관 |
| Ghost | 낮은 우선순위 이동 또는 보조 실행 | 취소, 뒤로가기, 상세 보기 |
| Icon Button | 아이콘만 사용하는 짧은 액션 | 복사, 닫기, 열기, 필터 |
| FAB | 모바일 또는 복잡한 Console의 주요 빠른 액션 | 새 콘텐츠 추가, 새 문제 작성 |
| Link Button | 링크처럼 보이지만 버튼 역할이 필요한 경우 | 자세히 보기, 관련 기준 열기 |
| Loading Button | 요청 처리 중 상태 | 저장 중, 등록 중, 로그아웃 중 |
| Disabled Button | 아직 실행할 수 없는 액션 | 개설 예정, 권한 없음 |

### 공통 기준

- 최소 높이 44px
- `focus-visible` 명확히 표시
- 처리 중에는 disabled와 로딩 문구를 함께 제공
- 중복 클릭 방지
- Danger는 색상뿐 아니라 텍스트로 위험성을 명확히 표시
- Icon Button에는 `aria-label` 필수

### SECURIUM 적용

- 공개 CTA: 무료로 학습 시작하기
- 학습 CTA: 학습 계속하기, 문제 풀기, 복습 시작
- 관리자 CTA: 저장, 게시, 검수 요청, 반려, 보관
- 커리큘럼 CTA: Stable Key 복사, 전체 펼치기, 전체 접기

## 2. Card

### 목적

하나의 의미 있는 정보 묶음을 보여준다.

### Variants

| Variant | 용도 | 예시 |
| --- | --- | --- |
| Course Card | 과정 비교 | ISMS-P, 정보보안기사 과정 |
| Learning Card | 다음 학습 행동 | 이어 학습, 오늘의 학습 |
| Question Card | 문제 요약 또는 풀이 | 객관식, 단답형 문제 |
| Evidence Card | 근거 콘텐츠 표시 | 관련 법령, 공식 기준, 레슨 |
| Metric Card | 숫자 요약 | 정답률, 커버리지, AI 비용 |
| Action Card | 관리자 작업 진입 | 커리큘럼 점검, 콘텐츠 연결 |
| Empty Card | 빈 상태 안내 | 아직 등록한 과정 없음 |

### 공통 기준

- 제목, 요약, 메타, CTA 순서를 일관되게 유지
- 같은 grid 안에서는 높이를 최대한 맞춤
- CTA는 하단 고정
- hover/focus는 border 또는 shadow 중심으로 가볍게 처리

## 3. Table

### 목적

대량의 구조화된 데이터를 비교하고 관리한다.

### Variants

| Variant | 용도 | 주요 열 |
| --- | --- | --- |
| Admin Table | 관리자 기본 목록 | 이름, 상태, 수정일, 액션 |
| Question Table | 문제은행 | 문제명, 유형, 난이도, 상태, 과정, 검수자 |
| Coverage Table | 커버리지 점검 | 노드, 콘텐츠 수, 문제 수, Concept 수, Gap |
| Audit Table | 감사로그 | actor, action, resource, result, createdAt |
| AI Trace Table | AI 요청 추적 | provider, status, latency, token, review |
| Ontology Table | Concept 목록 | concept, alias, status, mapping count |
| Compact Table | 좁은 공간의 요약 | label, value, status |
| Responsive Card Table | 모바일 전환 목록 | row를 카드형으로 표시 |

### 공통 기준

- column heading 명확화
- 정렬/필터 가능 여부 표시
- 빈 상태 제공
- 모바일에서는 카드형 목록 또는 horizontal scroll 정책 명시
- row click과 checkbox action을 혼동하지 않게 분리
- 대량 조회는 pagination 또는 limit 제공

### SECURIUM 우선 적용

1. Admin Table
2. Question Table
3. Coverage Table
4. Ontology Table
5. AI Trace Table

## 4. Badge

### 목적

상태, 분류, 출처를 짧고 일관되게 표시한다.

### Variants

| Variant | 의미 |
| --- | --- |
| Neutral | 일반 메타 |
| Success | 완료, 활성, 승인 |
| Warning | 검토 필요, 근거 부족 |
| Danger | 실패, 반려, 위험 |
| Info | AI, 운영 정보 |
| Brand | 현재 선택, 주요 상태 |
| Compact | 작은 공간의 보조 상태 |

### 상태 예시

- Official
- AI
- Published
- Draft
- Review
- Active
- Archived
- Gap
- Ready
- Mock

### 현재 primitive

- `StatusBadge`

## 5. Tree

### 목적

계층 구조를 탐색하고 선택한 노드의 상세 정보를 확인한다.

### Variants

| Variant | 용도 | 특징 |
| --- | --- | --- |
| Compact Tree | 깊은 계층을 압축 표시 | 중첩 카드 금지, 한 줄 중심 |
| Explorer Tree | 관리자 탐색형 tree | expand/collapse, 검색, 선택 |
| Ontology Tree | 개념 상하위 구조 | parent/child, related concept |
| Curriculum Tree | 공식 출제기준 구조 | 공식 순번, source page, stable key |
| Learner Tree | 학습자 커리큘럼 경로 | 진행률, 학습 CTA |
| Mapping Tree | 연결 검수 | 콘텐츠/문제/Concept 연결 상태 |

### 공통 기준

- 기본 상태는 필요한 단계까지만 펼침
- expand/collapse 제공
- 전체 펼치기/전체 접기 제공
- 공식 명칭을 첫 번째 시각 요소로 표시
- stable key는 작은 보조 텍스트로 표시하고 복사 기능 제공
- 내부 타입보다 사용자 언어 우선
- 선택 노드 상세는 Inspector Panel에 표시

### SECURIUM 적용

- CurriculumTree
- Learn Curriculum Path
- Ontology Parent/Child
- CurriculumNode Mapping
- Coverage Gap 탐색

## 6. Dialog

### 목적

사용자의 집중이 필요한 짧은 작업 또는 확인을 처리한다.

### Variants

| Variant | 용도 |
| --- | --- |
| Confirmation Dialog | 삭제, 게시, 반려 확인 |
| Form Dialog | 짧은 입력 |
| Preview Dialog | 콘텐츠 미리보기 |
| Command Dialog | Command Palette |
| Danger Dialog | 위험 작업 영향 범위 확인 |
| Review Dialog | AI 또는 문제 검수 처리 |

### 공통 기준

- `role="dialog"`
- `aria-modal="true"`
- ESC 닫기
- focus trap 또는 focus 복귀 처리
- 위험 작업은 영향 범위 표시

## 7. Drawer

### 목적

현재 맥락을 유지한 채 상세 정보나 보조 작업을 보여준다.

### Variants

| Variant | 용도 |
| --- | --- |
| Account Drawer | 모바일 계정 메뉴 |
| Inspector Drawer | 모바일 상세 패널 |
| Filter Drawer | 모바일 필터 |
| Action Drawer | 관리자 조치 패널 |
| Navigation Drawer | 모바일 전체 메뉴 |

### 공통 기준

- 모바일에서 배경 스크롤 차단
- ESC 닫기
- 메뉴 항목 선택 후 닫기
- `aria-expanded`와 상태 동기화
- 열림 상태에서 가로 스크롤 발생 금지

## 8. Search

### 목적

화면, 콘텐츠, 문제, 개념, 근거를 빠르게 찾는다.

### Variants

| Variant | 용도 |
| --- | --- |
| Global Search | Command Palette |
| Local Search | 목록 내부 검색 |
| Faceted Search | 과정, 상태, 유형, 난이도 필터 |
| Semantic Search | AI/Retrieval |
| Tree Search | CurriculumNode, Concept 탐색 |
| Admin Filter Bar | 관리자 목록 필터 |

### 공통 기준

- label 연결
- placeholder는 label 대체 금지
- 검색 중 상태 표시
- 결과 없음 상태 제공
- 민감정보 검색 로그 저장 금지

## 9. Toast

### 목적

작업 결과를 짧게 알려준다.

### Variants

| Variant | 용도 |
| --- | --- |
| Success Toast | 저장, 복사, 게시 완료 |
| Error Toast | 저장 실패, 접근 실패 |
| Info Toast | 진행 안내 |
| Warning Toast | 검토 필요 |
| Undo Toast | 되돌릴 수 있는 작업 |

### 공통 기준

- `role="status"` 또는 상황에 따라 `role="alert"`
- 중요한 오류는 화면 내 메시지도 함께 제공
- 민감한 서버 오류 노출 금지
- 같은 메시지 반복 누적 방지

## 10. Tabs

### 목적

같은 대상의 여러 관점을 전환한다.

### Variants

| Variant | 용도 |
| --- | --- |
| Detail Tabs | 개요, 연결, 이력, 분석 |
| Admin Tabs | 콘텐츠, 문제, 개념, Trace |
| Learner Tabs | 이론, 문제, 복습, 통계 |
| Inspector Tabs | 상세 패널 내부 관점 전환 |
| Route Tabs | URL과 동기화되는 탭 |

### 공통 기준

- `role="tablist"`, `role="tab"`, `role="tabpanel"` 고려
- 키보드 좌우 이동 지원
- 현재 탭 active 상태 명확화
- URL query와 동기화할지 화면별 결정

## 11. 구현 우선순위

| 우선순위 | 컴포넌트 | 이유 |
| --- | --- | --- |
| P0 | Button, Badge, Card | 이미 전 화면에서 사용 |
| P0 | Tree, Inspector Panel | Curriculum/Ontology 핵심 |
| P1 | Table, Search | 관리자 Console 핵심 |
| P1 | Dialog, Drawer | 모바일·검수 UX 안정화 |
| P2 | Toast, Tabs | 피드백과 복합 상세 화면 고도화 |

## 12. 현재 구현 연결

| 컴포넌트 | 현재 상태 |
| --- | --- |
| Button | 기존 class 기반 사용, variant primitive 필요 |
| Card | Course/Metric/Admin card 분산 구현 |
| Table | 일부 화면에서 개별 구현 |
| Badge | `StatusBadge` primitive 추가 |
| Tree | CurriculumTree, LearnCurriculumPathTree 구현 |
| Dialog | Command Palette에서 dialog 패턴 사용 |
| Drawer | Header mobile drawer 구현 |
| Search | Command Palette, 개별 검색 input 존재 |
| Toast | 일부 복사 피드백 inline 구현, 공통화 필요 |
| Tabs | 공통 primitive 미구현 |

## 13. 다음 구현 작업

1. Button variant primitive 정리
2. Card primitive 정리
3. Table primitive 설계
4. Tree primitive와 기존 CurriculumTree 패턴 연결
5. Dialog/Drawer 접근성 기준 보강
6. Search/Toast/Tabs primitive 순차 구현
