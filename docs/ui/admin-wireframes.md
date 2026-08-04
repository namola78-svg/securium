# Admin Wireframes

관리자 화면은 Console Shell을 사용한다. 목적은 “운영상 중요한 상태를 빠르게 파악하고, 필요한 수정 행동으로 안전하게 이동하는 것”이다.

Console Shell은 SECURIUM 관리자 경험의 최우선 설계 대상이다. Curriculum, Content, Ontology, Coverage, AI Trace, Audit 화면은 같은 골격 안에서 동작해야 한다.

상세 Shell 기준은 [Console Shell High-Fidelity Wireframe](./console-shell-wireframe.md)에서 관리한다.

## Console Shell

```text
[Top Bar]
  Brand | Search / Command Palette | Notification | Account

[Sidebar]
  Dashboard
  Curriculum
  Content
  Question
  Ontology
  Coverage
  AI Trace
  AI Feedback
  Audit
  Settings

[Main]
  Breadcrumb
  Page Header
  Toolbar
  Content Area

[Inspector Panel]
  Selected resource details
  Metadata
  Actions
```

## Console Shell Priority

| Shell Area | Role | Rule |
| --- | --- | --- |
| Top Bar | 전역 검색, 알림, 계정 | 화면별 기능을 넣지 않는다 |
| Sidebar | 관리자 주요 도메인 이동 | 고정 순서 유지 |
| Breadcrumb | 현재 위치 | 깊은 상세 화면에서 필수 |
| Page Header | 화면 목적과 주요 CTA | CTA는 1개 Primary 중심 |
| Toolbar | 검색, 필터, 정렬 | Table/Tree 화면에서 표준화 |
| Main Content | 목록, 트리, 대시보드 | 화면별 핵심 작업 영역 |
| Inspector Panel | 선택 리소스 상세 | 목록/트리 선택과 동기화 |

## 1. Dashboard

- 목적: 운영 지표와 위험 신호를 요약한다.
- 주요 CTA: `이슈 확인`.
- 정보 우선순위: 시스템 상태 → 콘텐츠 커버리지 → 검수 대기 → AI 피드백 → 감사 이벤트.
- Empty State: 운영 데이터가 없으면 “아직 집계된 운영 데이터가 없습니다.”
- Loading: metric card skeleton.
- Error: “관리자 대시보드를 불러오지 못했습니다.”

## 2. Curriculum

- 목적: 공식 기준 CurriculumTree를 탐색·검토한다.
- 주요 CTA: `노드 검토`.
- 정보 우선순위: 과정 → 트리 버전 → 상태 → compact tree → 선택 노드 inspector.
- 패턴: Split Panel + Tree + Inspector.

## 3. Content

- 목적: Lesson, Theory, Question, AI 근거 콘텐츠를 커리큘럼 노드에 연결한다.
- 주요 CTA: `콘텐츠 매핑`.
- 정보 우선순위: 커버리지 상태 → 미연결 콘텐츠 → 연결 후보 → 검수 상태.
- 패턴: Table + Filter + Drawer.

## 4. Question

- 목적: 문제 작성, 검수, 게시, 연결 상태를 관리한다.
- 주요 CTA: `문제 검수`.
- 정보 우선순위: 상태 → 과정/과목/주제 → 문제 유형 → 난이도 → 검수자 → 최근 변경.
- 패턴: Admin Table + Inspector + Workflow Actions.

## 5. Ontology

- 목적: 보안 개념과 alias, relation, cross-course mapping을 관리한다.
- 주요 CTA: `개념 편집`.
- 정보 우선순위: concept name → relation → coverage → AI usage → audit.
- 패턴: Explorer + Inspector.

## 6. Coverage

- 목적: 공식 기준 대비 콘텐츠·문제·AI 근거의 누락 영역을 확인한다.
- 주요 CTA: `액션 생성`.
- 정보 우선순위: gap severity → curriculum node → missing type → owner → due date.
- 패턴: Coverage Table + Priority Filter + Bulk-safe Action.

## 7. AI Trace

- 목적: AI 답변 생성 과정을 검토한다.
- 주요 CTA: `Trace 검토`.
- 정보 우선순위: request → expanded query → detected concepts → retrieval → citations → answer.
- 패턴: Timeline + Context Viewer + Inspector.

## 8. AI Feedback

- 목적: 사용자 AI 피드백을 검수하고 개선 액션으로 연결한다.
- 주요 CTA: `피드백 처리`.
- 정보 우선순위: severity → feedback → AI answer → citation → reviewer note.
- 패턴: Queue + Detail Drawer.

## 9. Audit

- 목적: 중요 관리자 작업의 감사 이력을 확인한다.
- 주요 CTA: `감사로그 조회`.
- 정보 우선순위: action → actor → result → resource → time → metadata.
- 패턴: Immutable Table + Detail Drawer.

## 10. Settings

- 목적: 운영 정책과 UI/AI/보안 설정을 관리한다.
- 주요 CTA: `설정 저장`.
- 정보 우선순위: 설정 그룹 → 현재 값 → 위험도 → 변경 이력.
- 패턴: Sectioned Form + Confirm Dialog.
