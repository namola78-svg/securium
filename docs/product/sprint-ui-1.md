# Sprint UI-1: SECURIUM Product Design Foundation

Sprint UI-1의 목적은 SECURIUM 화면을 바로 고치는 것이 아니라, 이후 모든 UI 구현의 기준이 되는 제품 디자인 Foundation을 완성하는 것이다.

현재 완료 상태는 [Sprint UI-1 Status](./sprint-ui-1-status.md)에서 관리한다.

## Sequence

```text
Brand Foundation
↓
Design Principle
↓
Design Token
↓
Layout
↓
Navigation
↓
Component Library
↓
Screen Inventory
↓
Wireframe
↓
Admin Console
↓
Student Console
↓
Inspector Panel
↓
Command Palette
↓
Design Documentation
```

## 1. Brand Foundation

### 목표

SECURIUM의 공식 브랜드명, 제품 정체성, 공개 화면 톤을 고정한다.

### 산출물

- 공식 브랜드명
- 공식 설명
- 제품 철학
- 공개 화면에서 사용할 핵심 문장

### 기준 문서

- `docs/product/brand.md`
- `docs/design/foundation.md`

## 2. Design Principle

### 목표

SECURIUM의 UI 판단 기준을 명확히 한다.

### 원칙

1. 공식성: 국가기술자격, ISMS-P, 법령, 기준일을 신뢰 가능한 형태로 표시한다.
2. 신뢰성: AI 답변은 근거, 출처, 검수 여부를 함께 보여준다.
3. 단순성: 복잡한 보안 개념도 탐색 가능한 구조로 정리한다.
4. 연결성: 문제, 커리큘럼, 온톨로지, AI 해설, 복습이 끊기지 않게 연결된다.
5. 학습 중심: 관리자 화면보다 학습자의 이해와 다음 행동을 우선한다.

### 기준 문서

- `docs/product/design.md`
- `docs/design/product-design-sprint.md`

## 3. Design Token

### 목표

색상, 간격, 타이포그래피, 상태 표현을 반복 가능한 토큰으로 정리한다.

### 적용 대상

- Brand color
- Surface color
- Text color
- Border
- Focus ring
- Status color
- Spacing
- Radius
- Shadow

### 기준 문서

- `docs/product/token.md`
- `docs/design/design-system-direction.md`

## 4. Layout

### 목표

학생 화면과 관리자 화면의 기본 레이아웃 패턴을 분리한다.

### 패턴

- Public landing layout
- Student learning layout
- Admin workspace layout
- Split panel layout
- Inspector panel layout
- Dense data layout

### 구현 상태

- 관리자 Shell 일부 반영
- 관리자 Dashboard에 메트릭과 Inspector Panel 적용

## 5. Navigation

### 목표

SECURIUM의 주요 이동 경로를 명확하게 한다.

### 포함 범위

- 공개 헤더
- 로그인 후 헤더
- 모바일 메뉴
- 관리자 사이드바
- Command Palette
- Breadcrumb
- Active state

### 구현 상태

- Global Command Palette 초기 버전 구현
- 관리자 내비게이션 정보 구조 일부 정리

## 6. Component Library

### 목표

화면별로 UI를 새로 만들지 않고 공통 컴포넌트를 조합해 확장한다.

### 우선 컴포넌트

- Button
- Card
- Table
- Badge
- Tree
- Dialog
- Drawer
- Search
- Toast
- Tabs
- Inspector Panel
- Command Palette

### 기준 문서

- `docs/design/component-library.md`
- `docs/product/component.md`

## 7. Screen Inventory

### 목표

학생, 관리자, AI, Ontology 화면의 전체 범위를 먼저 정리한다.

### 범위

- 학생 화면 15개
- 관리자 화면 20개
- AI 화면 10개
- Ontology 화면 15개

### 기준 문서

- `docs/design/screen-inventory.md`
- `docs/design/domain-screen-map.md`

## 8. Wireframe

### 목표

구현 전에 Figma 수준의 화면 구조를 텍스트 기반 와이어프레임으로 확정한다.

### 다음 작업

- Student Core Wireframe
- Admin Core Wireframe
- AI Console Wireframe
- Ontology Explorer Wireframe

## 9. Admin Console

### 목표

관리자 화면을 일반 CRUD 모음이 아니라 운영 Console로 재정의한다.

### 핵심 영역

- Dashboard
- Curriculum
- Ontology
- Content
- Coverage
- AI Explainability
- Audit
- Operations

## 10. Student Console

### 목표

학습자가 다음 행동을 쉽게 결정할 수 있게 한다.

### 핵심 영역

- Dashboard
- Course
- Lesson
- Question
- Review
- AI Tutor
- Analytics

## 11. Inspector Panel

### 목표

선택한 개체의 세부 정보, 관계, 상태, 빠른 작업을 우측 패널에서 확인한다.

### 사용 예

- CurriculumNode 상세
- Content 상세
- Question 상세
- Ontology Concept 상세
- AI Trace 상세
- Coverage Gap 상세

### 구현 상태

- `InspectorPanel` primitive 구현
- 관리자 Dashboard에 초기 적용

## 12. Command Palette

### 목표

복잡한 관리·학습 기능을 검색 기반으로 빠르게 이동할 수 있게 한다.

### 단축키

- Windows/Linux: `Ctrl + K`
- macOS: `Cmd + K`

### 구현 상태

- 주요 학습·관리 라우트 검색
- 키보드 탐색
- ESC 닫기
- Enter 이동

## 13. Design Documentation

### 목표

디자인 의사결정을 코드 밖 문서로 남겨 이후 구현의 기준으로 삼는다.

### 문서 허브

- `docs/product/README.md`
- `docs/design/foundation.md`
- `docs/design/component-library.md`
- `docs/design/interaction-pattern-decisions.md`

## Completion Criteria

Sprint UI-1은 다음 조건을 만족하면 완료로 간주한다.

- 브랜드 기준 문서가 있다.
- 디자인 원칙이 있다.
- 토큰과 레이아웃 기준이 있다.
- 컴포넌트 라이브러리 방향이 있다.
- 화면 인벤토리가 있다.
- Command Palette와 Inspector Panel의 초기 구현이 있다.
- 다음 Sprint에서 와이어프레임을 바로 작성할 수 있다.

