# SECURIUM Design System v2

SECURIUM Design System v2는 앞으로 추가되는 학습자 화면과 관리자 화면이 같은 제품 언어를 유지하도록 만드는 상위 표준이다. 이 문서는 기능 구현 지시서가 아니라, 화면을 설계하고 구현할 때 따라야 하는 UX·UI 판단 기준이다.

## 1. Product North Star

> SECURIUM은 정보를 많이 보여주는 플랫폼이 아니라, 다음 행동을 알려주는 정보보호·개인정보보호 AI 학습 플랫폼이다.

학습자는 내부 데이터 구조를 이해할 필요가 없다. 학습자 화면은 항상 다음 네 가지 질문에 빠르게 답해야 한다.

1. 지금 어디까지 했지?
2. 다음은 뭘 해야 하지?
3. 시험에는 얼마나 남았지?
4. 내가 약한 부분이 어디지?

관리자는 반대로 커리큘럼, 콘텐츠, 문제, 온톨로지, 커버리지, AI 근거 추적을 촘촘하게 점검해야 한다. 따라서 SECURIUM의 UI는 역할에 따라 두 가지 모드로 분리한다.

| 영역 | 핵심 모델 | 우선순위 |
| --- | --- | --- |
| 학습자 | Action-first Learning | 오늘 할 일, 이어서 학습, 복습, 취약영역 |
| 관리자 | Console + Inspector | 탐색, 검수, 연결, 추적, 변경 이력 |

## 2. Design Principles

### 2.1 공식성

국가기술자격 출제기준, ISMS-P 인증기준, 법령, 개인정보 영향평가 기준처럼 검증 가능한 기준을 화면의 신뢰 근거로 사용한다. 단, 학습자에게는 “공식 기준 기반”처럼 이해 가능한 문구를 우선 사용하고 내부 식별자는 숨긴다.

### 2.2 설명 가능성

SECURIUM의 AI는 답만 제시하지 않는다. 가능한 경우 “왜 그런지”, “어떤 기준에 근거하는지”, “어떤 개념과 연결되는지”를 함께 보여준다.

### 2.3 행동 우선

모든 주요 화면은 하나의 주 행동을 가진다. 예: 이어서 학습, 복습 시작, 문제풀이, AI 해설 보기, 커버리지 점검.

### 2.4 역할 분리

학습자 화면에는 `Stable Key`, `CurriculumNode`, `CourseLesson`, `Coverage`, `AI Trace` 같은 내부 용어를 노출하지 않는다. 관리자는 Inspector에서 이러한 정보를 확인하고 복사할 수 있다.

### 2.5 차분한 밀도

보안 학습은 정보량이 많지만 화면은 압박감을 주면 안 된다. 학습자 화면은 카드와 리스트를 적절히 섞고, 관리자 화면은 Shell·Tree·Table·Inspector로 밀도를 감당한다.

### 2.6 접근성 우선

색상만으로 상태를 전달하지 않는다. 모든 상호작용 요소는 키보드로 접근 가능해야 하며, focus-visible 상태가 명확해야 한다.

## 3. Design Tokens

현재 CSS 토큰은 유지하되, 새 화면은 의미 기반 semantic token을 우선 사용한다.

### 3.1 Core Color

| Token | 역할 |
| --- | --- |
| `--ink` | 기본 텍스트, 어두운 표면 |
| `--paper` | 기본 페이지 배경 |
| `--white` | 카드, 패널, 입력 표면 |
| `--line` | 경계선 |
| `--muted` | 보조 텍스트 |
| `--lime` | SECURIUM primary accent |
| `--aqua` | 보조 정보, 지식 연결 |
| `--danger` | 오류, 위험, 삭제 |

### 3.2 Semantic Color

| 의미 | 권장 색상 | 사용 예 |
| --- | --- | --- |
| 진행 중 | Lime / Green | 현재 학습, 이어서 학습 |
| 완료 | Blue | 완료 배지, 수료 상태 |
| 복습 | Amber / Yellow | 복습 예정, 오답 복습 |
| 주의 | Red | 오류, 위험, 삭제, 권한 실패 |
| AI | Purple | AI 해설, AI 추천, AI Trace |
| 보조 | Gray | 비활성, 메타데이터, 설명 |

권장 alias:

```css
--semantic-progress: var(--lime);
--semantic-complete: #3b82f6;
--semantic-review: #f59e0b;
--semantic-danger: var(--danger);
--semantic-ai: #8b5cf6;
--semantic-muted: var(--muted);
```

### 3.3 Typography

| 스타일 | Desktop | Mobile | 용도 |
| --- | --- | --- | --- |
| Display | 56-72px | 36-44px | 랜딩 Hero |
| H1 | 40-56px | 30-38px | 페이지 제목 |
| H2 | 28-36px | 24-30px | 주요 섹션 |
| H3 | 20-24px | 18-22px | 카드/패널 제목 |
| Body | 15-17px | 15-16px | 본문 |
| Caption | 12-13px | 12-13px | 메타, 보조 |

공식 명칭과 학습 항목명은 항상 내부 코드보다 먼저 보여준다.

### 3.4 Spacing

기본 간격은 4px 계열을 사용한다.

| 값 | 사용 |
| --- | --- |
| 4 | 아이콘과 텍스트 사이 |
| 8 | 작은 요소 간격 |
| 12 | compact list |
| 16 | 모바일 기본 padding |
| 24 | 카드 내부 padding |
| 32 | 섹션 내부 간격 |
| 48 | 섹션 간격 |
| 64 | 랜딩 대형 섹션 |

### 3.5 Radius and Elevation

| Surface | Radius | Shadow |
| --- | --- | --- |
| Button | 10-14px | 없음 또는 약함 |
| Card | 18-24px | 약한 그림자 |
| Inspector | 18-22px | 고정 패널 그림자 |
| Dialog | 20-24px | 강한 focus shadow |

## 4. Surface Usage Rules

| Pattern | 언제 사용하는가 | 피해야 할 사용 |
| --- | --- | --- |
| Card | 오늘 학습, AI 추천, 모의고사처럼 CTA가 있는 덩어리 | 깊은 계층 구조 전체 |
| List | 커리큘럼, 문제 목록, 오답 목록처럼 스캔이 중요한 정보 | 단일 핵심 CTA |
| Table | 관리자 데이터 비교, 로그, 커버리지 현황 | 모바일 학습자 핵심 화면 |
| Tree | 공식 계층, 온톨로지, 커리큘럼 탐색 | 단순 카드 목록 |
| Inspector | 선택한 항목의 상세, 메타, 연결 정보 | 짧은 확인 메시지 |
| Dialog | 삭제, 승인, 위험 작업, 짧은 결정 | 긴 편집 흐름 |
| Drawer | 보조 흐름, 모바일 상세, 필터, 계정 메뉴 | 치명적 확인 작업 |
| Split Panel | Tree + Detail, AI Trace, Coverage 분석 | 단순 읽기 화면 |
| Wizard | 여러 단계 설정, import, batch 작업 | 한 번의 저장으로 끝나는 폼 |

## 5. Component Standard

### 5.1 Button

| Variant | 역할 |
| --- | --- |
| Primary | 화면의 가장 중요한 다음 행동 |
| Secondary | 보조 행동 |
| Danger | 삭제, 반려, 위험 변경 |
| Ghost | 낮은 우선순위 행동 |
| Icon Button | 작은 도구 행동, 반드시 `aria-label` 포함 |
| FAB | 모바일에서 한 화면의 핵심 생성 행동이 있을 때만 사용 |

규칙:

- 높이 최소 44px
- 처리 중에는 disabled + loading 상태
- disabled는 `cursor-not-allowed`와 시각적 대비를 함께 제공
- focus-visible ring 필수
- 한 화면에 Primary CTA는 원칙적으로 하나

### 5.2 Card

카드는 “정보를 담는 박스”가 아니라 “사용자가 행동할 이유가 있는 묶음”이다.

좋은 카드:

- 오늘 할 학습
- 이어서 학습
- AI 추천
- 모의고사 시작
- 약한 영역 복습

피해야 할 카드:

- 과목 → 주요항목 → 세부항목 전체를 중첩 카드로 표현
- 내부 메타데이터만 담는 카드
- CTA가 없는 반복 카드 남발

### 5.3 Badge

상태는 색상 + 텍스트를 함께 쓴다.

| 상태 | 권장 문구 |
| --- | --- |
| 진행 중 | 진행 중 |
| 완료 | 완료 |
| 복습 필요 | 복습 필요 |
| 개설 예정 | 개설 예정 |
| AI 생성 | AI 생성 |
| 검수 완료 | 검수 완료 |
| 주의 | 확인 필요 |

### 5.4 Input

- 모든 input은 label과 연결한다.
- 오류는 필드 가까이에 표시한다.
- 서버 오류의 내부 상세는 숨긴다.
- 이메일, 비밀번호, 검색, 숫자 필드는 적절한 `autocomplete`, `inputmode`를 사용한다.

### 5.5 Table

관리자 화면에서 주로 사용한다.

- 필터, 검색, pagination을 함께 제공
- 행 선택 시 Inspector에 상세 표시
- 상태 컬럼은 badge 사용
- 모바일에서는 card/list fallback 또는 가로 스크롤 컨테이너 사용

### 5.6 Tree

Tree는 SECURIUM의 핵심 구조 표현이다.

학습자:

- 공식 명칭과 공식 순번을 먼저 표시
- 내부 타입과 Stable Key는 표시하지 않음
- 기본은 필요한 깊이까지만 펼침

관리자:

- 공식 명칭 + 한글 계층명 우선
- Stable Key는 작은 보조 텍스트와 복사 버튼
- 선택한 노드는 Inspector에서 상세 확인

### 5.7 Inspector Panel

Inspector는 “선택한 대상에 대한 판단과 조치”를 돕는 패널이다.

공통 구성:

1. Summary
2. Metadata
3. Relation
4. Coverage
5. AI Usage
6. Audit
7. History

적용 대상:

- Curriculum
- Ontology
- Coverage
- AI Explainability
- Content Revision
- Analytics

### 5.8 Command Palette

전문 사용자를 위한 빠른 이동·검색 인터페이스다.

- 관리자: 커리큘럼, 온톨로지, 문제, 콘텐츠, 감사로그로 빠른 이동
- 학습자: 과정, 이어서 학습, 문제풀이, 복습으로 이동
- 단축키는 문서화하고, 입력 중 Escape로 닫는다.

## 6. Learner Layout Standard

학습자 화면은 내부 구조보다 “오늘의 행동”을 먼저 보여준다.

### 6.1 Dashboard

권장 순서:

1. 오늘 할 학습
2. 이어서 학습
3. 오늘 복습
4. 약한 영역
5. 모의고사
6. AI 추천
7. 최근 학습
8. 전체 통계

통계는 중요하지만 첫 화면의 주인공은 아니다. 학습자는 숫자보다 다음 행동을 먼저 원한다.

### 6.2 Course Detail

권장 순서:

1. 과정명과 한 줄 가치
2. 추천 대상
3. 학습량과 예상 기간
4. 내 상태
5. 주요 CTA
6. 커리큘럼 요약
7. 평가·수료 기준

### 6.3 Curriculum

학습자에게 보여줄 명칭:

- 필기
- 과목
- 주요항목
- 세부항목
- 세세항목
- 핵심 이론
- 관련 문제

숨길 명칭:

- TRACK
- SUBJECT
- MAJOR_ITEM
- SUB_ITEM
- DETAIL_ITEM
- CourseLesson
- CurriculumNode
- Stable Key

### 6.4 Lesson

Lesson 화면은 읽기보다 완료까지의 흐름을 도와야 한다.

- 현재 위치
- 예상 학습 시간
- 핵심 요약
- 본문
- 관련 문제
- 완료 또는 다음 학습 CTA

### 6.5 Mobile Learner Navigation

모바일에서는 앱처럼 행동 중심 하단 네비게이션을 우선한다.

| 탭 | 의미 |
| --- | --- |
| 홈 | 오늘 할 일 |
| 학습 | 내 과정과 이어서 학습 |
| 문제 | 문제풀이 |
| 복습 | 오답·취약영역 |
| 마이 | 프로필·설정 |

## 7. Admin Layout Standard

관리자 화면은 Console Shell을 기준으로 통일한다.

### 7.1 Console Shell

구성:

1. Top Bar
2. Sidebar
3. Breadcrumb
4. Page Header
5. Toolbar
6. Main Workspace
7. Inspector Panel
8. Drawer 또는 Dialog

### 7.2 Admin Workspace Patterns

| 화면 | 권장 패턴 |
| --- | --- |
| Dashboard | Status cards + review queue + recent activity |
| Curriculum | Tree + Detail + Inspector |
| Ontology | Explorer Tree + Concept Detail + Inspector |
| Coverage | Table/Matrix + Inspector |
| AI Trace | Timeline + Context Viewer + Citation Inspector |
| Audit | Filtered Table + Read-only Detail |
| Content Revision | Version list + Diff + Inspector |

관리자 화면에서는 밀도를 허용하되, 조작 위치와 상세 판단 위치를 분리한다.

## 8. Responsive Standard

| Breakpoint | 기준 |
| --- | --- |
| 360-480px | Mobile |
| 768px | Tablet |
| 1024px | Desktop |
| 1440px+ | Wide Desktop |
| 1920px | Operations / Admin Wide |

### Mobile

- 좌우 여백 최소 16px
- 주요 버튼 44px 이상
- 카드보다 리스트 우선
- Inspector는 Drawer로 전환
- Header 메뉴는 햄버거 또는 하단 네비게이션 사용

### Tablet

- 2열 카드 가능
- Sidebar는 collapsed 또는 drawer
- Inspector는 필요 시 overlay

### Desktop

- Shell + Sidebar + Main + Inspector 사용
- 학습자 화면은 지나치게 넓어지지 않도록 최대 폭 제한
- 관리자 화면은 wide workspace 허용

## 9. Accessibility Standard

목표는 WCAG 2.2 AA 수준이다.

필수 기준:

- 모든 버튼과 링크는 키보드 접근 가능
- `focus-visible` 스타일 명확히 제공
- heading 순서 유지
- label과 input 연결
- icon-only button은 `aria-label` 필수
- 확장/접힘 요소는 `aria-expanded` 사용
- 현재 메뉴는 `aria-current="page"` 사용
- 로딩은 `role="status"` 또는 `aria-live` 사용
- 오류는 사용자가 이해 가능한 문장으로 표시
- 색상만으로 상태 구분 금지
- motion은 `prefers-reduced-motion` 고려

## 10. CTA Pattern

CTA는 “다음 행동”을 말해야 한다.

| 상황 | 권장 CTA |
| --- | --- |
| 로그인 전 | 무료로 학습 시작하기 |
| 과정 미등록 | 내 학습에 추가 |
| 등록 완료 | 이어서 학습 |
| 복습 필요 | 복습 시작 |
| 문제 추천 | 문제풀이 |
| AI 해설 가능 | AI 근거 보기 |
| 완료 과정 | 복습하기 |
| 개설 예정 | 개설 예정 |

피해야 할 CTA:

- 확인
- 이동
- 자세히
- 시작

단, 맥락상 충분히 명확할 때만 짧은 CTA를 허용한다.

## 11. Icon and Terminology System

### 11.1 Icon Role

| 의미 | 권장 아이콘 방향 |
| --- | --- |
| 홈 | house |
| 학습 | book |
| 문제 | pencil/check |
| 복습 | refresh |
| 마이 | user |
| AI | sparkle / bot |
| 관리자 | shield / settings |
| 감사로그 | history |
| 온톨로지 | network |
| 커버리지 | grid/check |

아이콘은 장식이 아니라 스캔 보조 수단이다. 아이콘만으로 의미를 전달하지 않는다.

### 11.2 Terminology

| 내부 용어 | 학습자 표기 | 관리자 표기 |
| --- | --- | --- |
| Course | 과정 | 과정 |
| Subject | 과목 | 과목 |
| Topic | 주제 | 주제 |
| CurriculumNode | 커리큘럼 항목 | CurriculumNode |
| CourseLesson | 학습 항목 | CourseLesson |
| Lesson | 핵심 이론 | Lesson |
| Stable Key | 표시하지 않음 | Stable Key / 관리자 식별자 |
| Coverage | 표시하지 않음 또는 준비 상태 | Coverage |
| Ontology | 관련 개념 | Ontology / 지식 연결 |
| AI Trace | 표시하지 않음 | AI Trace |
| Content Revision | 최신 기준일 | Content Revision |

## 12. Adoption Plan

### Phase 1: Documentation Lock

- 이 문서를 Design System v2 기준으로 채택한다.
- 신규 화면 설계 시 이 문서를 먼저 확인한다.

### Phase 2: Learner Action Dashboard

- Dashboard를 통계 중심에서 행동 중심으로 조정한다.
- 오늘 할 학습, 이어서 학습, 복습, 취약영역을 우선한다.

### Phase 3: Curriculum Language Cleanup

- 학습자 Curriculum에서 내부 타입과 Stable Key 노출을 제거한다.
- 공식 명칭과 공식 순번을 첫 번째 시각 요소로 사용한다.

### Phase 4: Mobile App-like Navigation

- 모바일 하단 네비게이션을 검토한다.
- 홈, 학습, 문제, 복습, 마이를 우선한다.

### Phase 5: Admin Inspector Unification

- Coverage, Ontology, AI Explainability, Content Revision, Analytics를 Inspector Pattern으로 통일한다.

## 13. Definition of Done

새 화면 또는 주요 화면 리팩터링은 다음을 만족해야 한다.

- 학습자 화면에서 다음 행동이 3초 안에 보인다.
- 내부 구현 용어가 학습자에게 노출되지 않는다.
- 관리자 화면은 Shell + Workspace + Inspector 구조를 따른다.
- 모바일 360px에서 가로 스크롤이 없다.
- 주요 버튼 높이가 44px 이상이다.
- 색상만으로 상태를 구분하지 않는다.
- 로딩, 빈 상태, 오류 상태가 공통 패턴을 따른다.
- `focus-visible`이 명확하다.
- 화면의 Primary CTA가 하나로 명확하다.
