# Console Shell High-Fidelity Wireframe

Console Shell은 SECURIUM 관리자 화면의 공통 골격이다. Curriculum, Content, Question, Ontology, Coverage, AI Trace, Audit, Settings 화면은 이 Shell을 공유한다.

목표는 관리자 화면을 CRUD 페이지 모음이 아니라 “운영 상황을 판단하고, 선택한 리소스를 검토하며, 안전하게 조치하는 Console”로 만드는 것이다.

UI-2C의 상세 문서는 다음 파일에서 관리한다.

- [High-Fidelity Spec](./console-shell-high-fidelity.md)
- [Layout Spec](./console-shell-layout-spec.md)
- [Responsive Spec](./console-shell-responsive.md)
- [Screen Examples](./console-shell-screen-examples.md)
- [Implementation Plan](./console-shell-implementation-plan.md)

## Product Principle

```text
Navigation decides where I am.
Toolbar decides what I can filter.
Main content decides what I am inspecting.
Inspector decides what I can understand and act on.
```

## Desktop Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                      │
│ SECURIUM Admin | Command Search | Environment | Notifications | Account      │
├───────────────┬───────────────────────────────────────────────┬──────────────┤
│ Sidebar       │ Main Workspace                                │ Inspector    │
│               │                                               │ Panel        │
│ Dashboard     │ Breadcrumb                                    │              │
│ Curriculum    │ Page Header + Primary CTA                     │ Summary      │
│ Content       │ Toolbar                                       │ Metadata     │
│ Question      │                                               │ Relations    │
│ Ontology      │ Table / Tree / Timeline / Graph               │ Coverage     │
│ Coverage      │                                               │ AI Usage     │
│ AI Trace      │ Empty / Loading / Error states                │ Audit        │
│ AI Feedback   │                                               │ Actions      │
│ Audit         │                                               │              │
│ Settings      │                                               │              │
└───────────────┴───────────────────────────────────────────────┴──────────────┘
```

## Responsive Layout

| Viewport | Sidebar | Main | Inspector |
| --- | --- | --- | --- |
| 1440px+ | Fixed expanded | Fluid | Fixed right panel |
| 1024px | Collapsible compact | Fluid | Drawer or narrow panel |
| 768px | Hidden behind menu | Full width | Drawer |
| 390px / 360px | Bottom or hamburger nav | Full width single column | Full-screen drawer |

## Top Bar

### Purpose

전역 상태와 빠른 이동을 제공한다.

### Structure

```text
[Brand/Admin Label] [Command Search] [Environment Badge] [Notification] [Account]
```

### Rules

- 화면별 필터를 Top Bar에 넣지 않는다.
- Command Search는 전역 이동과 빠른 리소스 탐색만 담당한다.
- Production/Preview/Local 환경 배지는 관리자 화면에서 명확히 표시한다.
- 알림은 검수 대기, 커버리지 gap, AI 피드백, 운영 오류처럼 행동 가능한 항목만 포함한다.

## Sidebar

### Purpose

관리자 도메인 간 이동을 담당한다.

### Order

1. Dashboard
2. Curriculum
3. Content
4. Question
5. Ontology
6. Coverage
7. AI Trace
8. AI Feedback
9. Audit
10. Settings

### Rules

- 메뉴명은 내부 모델명이 아니라 운영자가 이해하는 도메인명으로 표시한다.
- 현재 경로 active 상태를 텍스트와 시각적 상태로 함께 표시한다.
- 권한이 없는 메뉴는 숨기고, 권한이 있지만 아직 사용할 수 없는 메뉴는 disabled로 표시한다.
- Sidebar collapsed 상태에서도 icon button에는 `aria-label`을 제공한다.

## Breadcrumb

### Purpose

깊은 리소스 상세 화면에서 현재 위치를 알려준다.

### Examples

```text
Admin / Curriculum / 정보보안기사 / 필기 / 네트워크 보안
Admin / Ontology / Network Security / IDS
Admin / AI Trace / request_123
```

### Rules

- Breadcrumb은 뒤로가기 대체가 아니라 위치 정보다.
- 마지막 항목은 링크가 아니라 현재 위치로 표시한다.

## Page Header

### Purpose

현재 화면의 목적과 가장 중요한 행동을 정의한다.

### Structure

```text
[Eyebrow]
[H1 Title]                         [Primary CTA]
[Description]
[Status / Scope Badges]
```

### Rules

- Primary CTA는 한 개만 둔다.
- 위험 작업은 Page Header가 아니라 Toolbar 또는 Inspector의 action 영역에서 확인 절차와 함께 제공한다.

## Toolbar

### Purpose

현재 화면의 데이터 탐색 조건을 제어한다.

### Common Controls

- Search
- Course filter
- Status filter
- Type filter
- Date range
- Reviewer / owner filter
- Sort
- View toggle: Table / Tree / Graph / Timeline

### Rules

- 전역 Command Search와 혼동되지 않게 placeholder를 구체적으로 작성한다.
- 필터 초기화 버튼을 제공한다.
- 적용된 필터 수를 표시한다.

## Main Workspace

### Purpose

관리자가 실제로 비교, 선택, 검토하는 중심 영역이다.

### Supported Views

| View | Use |
| --- | --- |
| Table | Question, Audit, Feedback, Coverage 목록 |
| Compact Tree | Curriculum 계층 |
| Explorer Tree | Ontology 탐색 |
| Timeline | AI Trace |
| Graph | Ontology relation, Coverage relation |
| Split List | Content mapping, Review queue |

### Rules

- 선택 가능한 row/node/card는 선택 상태를 명확히 표시한다.
- 선택은 Inspector Panel과 동기화한다.
- 대량 작업은 기본적으로 제공하지 않고, 필요 시 보관/비활성화 중심으로 설계한다.

## Inspector Panel

### Purpose

선택한 리소스의 세부 정보, 관계, 상태, 안전한 조치 버튼을 제공한다.

### Standard Sections

```text
[Inspector Header]
  Resource title
  Status badge
  Stable key / ID copy

[Summary]
[Metadata]
[Relations]
[Coverage]
[AI Usage]
[Audit]
[History]
[Actions]
```

### Rules

- Inspector는 선택 리소스가 없을 때 안내 Empty State를 표시한다.
- ID, stable key, source URL은 복사 기능을 제공한다.
- 위험 action은 Dialog 확인을 요구한다.
- 모바일에서는 Drawer로 전환한다.

## Drawer

### Use Cases

- 모바일 Inspector
- 긴 상세 편집
- Citation / Context Viewer
- AI Trace step detail

### Rules

- Drawer가 열리면 배경 스크롤을 막는다.
- ESC로 닫는다.
- 닫기 후 focus를 trigger로 돌린다.

## Dialog

### Use Cases

- 게시
- 보관
- 반려
- 권한 변경
- 위험 설정 저장

### Rules

- 짧고 위험한 결정에만 사용한다.
- 장문 입력이나 복잡한 편집은 Drawer 또는 별도 페이지를 사용한다.

## State Design

### Empty

```text
선택된 항목이 없습니다.
왼쪽 목록에서 검토할 항목을 선택하세요.
```

### Loading

- Top Bar와 Sidebar는 유지한다.
- Main Workspace와 Inspector만 skeleton 처리한다.

### Error

```text
정보를 불러오지 못했습니다.
잠시 후 다시 시도해주세요.
[다시 시도]
```

### Permission Denied

```text
이 화면에 접근할 권한이 없습니다.
필요한 권한이 있다면 관리자에게 문의하세요.
```

## Keyboard Interaction

| Key | Behavior |
| --- | --- |
| `Ctrl/Cmd + K` | Command Palette 열기 |
| `Esc` | Drawer/Dialog/Palette 닫기 |
| `Tab` | Top Bar → Sidebar → Main → Inspector 순서 이동 |
| `Arrow Up/Down` | Tree/Table row 이동 |
| `Enter` | 선택 또는 primary action |

## Accessibility Requirements

- Top Bar, Sidebar, Main, Inspector는 landmark 또는 명확한 heading 구조를 가진다.
- Sidebar active 상태는 색상만으로 구분하지 않는다.
- Inspector open/close 상태는 screen reader에 전달한다.
- 모든 icon-only control은 `aria-label`을 가진다.
- Table/Tree row 선택은 keyboard로 가능해야 한다.

## Console Shell Review Checklist

| Check | Pass Criteria |
| --- | --- |
| Layout consistency | 관리자 모든 주요 화면이 같은 Shell을 사용한다 |
| Action clarity | Page Header에 Primary CTA가 하나만 있다 |
| Selection sync | Main selection과 Inspector가 동기화된다 |
| Safe action | 위험 작업은 Dialog 확인을 거친다 |
| Mobile fallback | Inspector가 Drawer로 전환된다 |
| Keyboard | 주요 탐색이 keyboard로 가능하다 |
| Accessibility | focus-visible, aria-label, heading 구조를 제공한다 |
