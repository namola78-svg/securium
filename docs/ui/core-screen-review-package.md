# UI-2D Core Screen Review Package

UI-2D의 목적은 React 구현 전에 SECURIUM 핵심 화면 18개를 제품 관점에서 리뷰 가능한 패키지로 묶는 것이다.

이번 문서는 설계 산출물이며 Production DB, Preview DB, Seed, Migration, Secret, API, Repository, 비즈니스 로직, 배포를 변경하지 않는다.

## Review Package Goal

Figma 수준의 상세 시각 디자인을 만들기 전, 다음을 제품 의사결정으로 확정한다.

- 화면 목적
- 주요 사용자 질문
- Primary CTA
- Console Shell slot 사용 여부
- 정보 우선순위
- Empty / Loading / Error 상태
- 재사용 컴포넌트
- 신규 컴포넌트 후보
- 구현 위험도
- 리뷰 판정

## Review Order

1. Console Shell
2. 관리자 Dashboard pilot
3. 학생 학습 핵심 흐름
4. Curriculum
5. Ontology
6. AI Trace
7. Coverage
8. Component and interaction readiness

Dashboard에서 Shell을 먼저 검증한 뒤 복잡한 Tree, Inspector, Trace, Coverage 화면으로 확장한다.

## Screen Review Matrix

| # | Screen | Group | Primary Question | Primary CTA | Shell Pattern | Reusable Components | New Component Candidate | Risk | Review Status |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Admin Dashboard | Admin | 운영 상태가 정상인가? | 이슈 확인 | Full Console, inspector optional | SectionHeader, MetricCard, StatusBadge, Panel | ConsoleTopBar, AdminToolbar | Low | Ready for review |
| 2 | Curriculum Console | Admin | 공식 기준 구조와 커버리지가 맞는가? | 노드 검토 | Tree + Inspector | StatusBadge, InspectorPanel | CompactTreeList, CoverageBadgeSet | High | Needs review |
| 3 | Content Mapping | Admin | 콘텐츠가 커리큘럼/온톨로지와 연결됐는가? | 콘텐츠 매핑 | Table + Inspector/Drawer | Panel, StatusBadge | MappingTable, RelationDrawer | Medium | Needs review |
| 4 | Question Admin | Admin | 문제 품질과 검수 상태는 어떤가? | 문제 검수 | Table + Workflow Inspector | StatusBadge, Panel | QuestionReviewRow, WorkflowActions | Medium | Needs review |
| 5 | Ontology Explorer | Admin/Ontology | 개념 관계가 정확한가? | 개념 편집 | Explorer + Detail + Inspector | InspectorPanel, StatusBadge | OntologyTree, RelationGraph | High | Needs review |
| 6 | Coverage Operations | Admin/Coverage | 공식 기준 대비 누락 영역은 어디인가? | 액션 생성 | Matrix/Table + Inspector | StatusBadge, Panel | CoverageMatrix, GapInspector | High | Needs review |
| 7 | AI Trace Console | Admin/AI | AI 답변은 어떻게 생성됐는가? | Trace 검토 | Timeline + Context + Inspector | InspectorPanel, StatusBadge | TraceTimeline, ContextViewer | High | Needs review |
| 8 | AI Feedback Queue | Admin/AI | 사용자 피드백을 어떻게 처리할까? | 피드백 처리 | Queue + Detail Drawer | Panel, StatusBadge | FeedbackQueue, ReviewerNotePanel | Medium | Needs review |
| 9 | Audit Log | Admin | 중요한 변경 이력이 남았는가? | 감사로그 조회 | Wide Table, inspector drawer | StatusBadge, Panel | ImmutableAuditTable | Medium | Needs review |
| 10 | Settings | Admin | 운영 정책이 안전한가? | 설정 저장 | Sectioned Form | Panel, StatusBadge | SettingsSection, RiskNotice | Medium | Needs review |
| 11 | Home | Student | 무엇을 시작하면 좋을까? | 무료로 학습 시작하기 | Public layout | SectionHeader, Card | HeroLearningCard | Low | Ready for review |
| 12 | Course List | Student | 어떤 과정을 선택할까? | 과정 자세히 보기 | Public/student grid | Card, StatusBadge | CourseComparisonCard | Medium | Needs review |
| 13 | Course Detail | Student | 이 과정이 나에게 필요한가? | 내 학습에 추가 | Detail + CTA panel | StatusBadge, Panel | EnrollmentCtaPanel | Medium | Needs review |
| 14 | Learn Overview | Student | 이 과정 안에서 다음 행동은? | 추천 학습 시작 | Learning overview + compact tree | StatusBadge, InspectorPanel | LearnerCurriculumTree | High | Needs review |
| 15 | Lesson Detail | Student | 이 개념을 이해했는가? | 학습 완료 | Article layout | Panel, StatusBadge | LessonArticle, CompletionBar | Medium | Needs review |
| 16 | Question Practice | Student | 왜 맞거나 틀렸는가? | 답안 제출 | Practice workspace | StatusBadge, Panel | QuestionWorkspace, AnswerResultPanel | High | Needs review |
| 17 | Review | Student | 지금 무엇을 복습해야 하나? | 복습 시작 | Priority queue | MetricCard, StatusBadge | ReviewQueue, MasteryBadge | Medium | Needs review |
| 18 | Analytics | Student | 어느 영역이 취약한가? | 추천 학습 시작 | Dashboard analytics | MetricCard, Panel | WeakAreaChart, AccessibleChartTable | Medium | Needs review |

## Screen Detail Checklist

Each screen should be reviewed with this checklist.

| Check | Question |
| --- | --- |
| Purpose | 화면의 존재 이유가 한 문장으로 설명되는가? |
| Primary CTA | 사용자의 다음 행동이 하나로 명확한가? |
| Information Priority | 가장 중요한 정보가 첫 번째 시각 영역에 있는가? |
| State Design | Empty, Loading, Error가 사용자 언어로 정의됐는가? |
| Mobile | 360px/390px에서 주요 CTA와 heading이 먼저 보이는가? |
| Accessibility | heading, label, focus, color contrast, keyboard 이동이 고려됐는가? |
| Trust | 공식 출처, 기준일, AI 고지, 검수 여부가 필요한 위치에 있는가? |
| Shell Fit | Console Shell slot 책임과 충돌하지 않는가? |
| Component Fit | 기존 primitive를 재사용할 수 있는가? |
| Risk | 인증, 권한, 데이터 격리, 복잡한 상태 변경 위험이 있는가? |

## Pilot: Admin Dashboard

Admin Dashboard를 첫 번째 구현 pilot으로 둔다.

### Why Dashboard First

- Tree, Trace, Matrix보다 상호작용 복잡도가 낮다.
- Top Bar, Sidebar, Page Header, Metric Card, Queue, Error State를 검증할 수 있다.
- 권한 검증 구조는 유지하면서 Shell layout만 확인할 수 있다.
- 실패해도 Curriculum, Ontology, AI Trace 같은 복잡한 화면에 영향을 주기 전 되돌리기 쉽다.

### Pilot Pass Criteria

- Shell 영역이 중복 책임을 갖지 않는다.
- Sidebar active 상태가 명확하다.
- Page Header와 Toolbar CTA가 중복되지 않는다.
- Loading / Empty / Error 상태가 기존 기능을 깨지 않는다.
- 모바일에서 Sidebar는 drawer 또는 compact 상태로 동작한다.
- keyboard focus 순서가 Top Bar → Sidebar → Main → Inspector 흐름을 따른다.

## Screens That Must Not Be First

다음 화면은 Shell pilot 후 진행한다.

- Curriculum Console
- Ontology Explorer
- AI Trace Console
- Coverage Operations

이 화면들은 Tree, Inspector, relation, trace, matrix가 복합적으로 얽혀 있어 Shell 안정화 전에 바꾸면 회귀 위험이 높다.

## Component Readiness

| Component | Current Status | Needed Before Implementation |
| --- | --- | --- |
| StatusBadge | Exists | tone/size API confirm |
| MetricCard | Exists | dashboard grid standard |
| Panel | Exists | surface token standard |
| SectionHeader | Exists | Page Header replacement decision |
| InspectorPanel | Exists | shell-level responsive behavior |
| CommandPalette | Exists | Top Bar integration decision |
| Button | Existing project style | variant standard alignment |
| Card | Existing project style | comparison/dense usage rule |
| Table | Existing project style | admin table standard |
| Tree | Multiple patterns likely | compact/explorer/ontology split |
| Drawer | Header/mobile drawer exists | generic drawer primitive needed |
| Dialog | Existing/unknown | confirm dialog standard needed |
| Toolbar | Page-local | shell toolbar primitive needed |
| Breadcrumb | Page-local/unknown | common breadcrumb primitive needed |

Detailed component readiness is maintained in [Component Implementation Readiness](./component-implementation-readiness.md) and [Component Implementation Map](./component-implementation-map.md).

## Review Decisions Needed

| Decision | Options | Recommendation |
| --- | --- | --- |
| Inspector default desktop | open on selection / always visible / drawer only | open on selection |
| Sidebar mobile | full drawer / bottom nav | full drawer |
| Dashboard pilot scope | shell only / shell + data cards / shell + all widgets | shell + data cards |
| AI Trace user/admin split | shared UI / separated UI | separated UI |
| Ontology tree location | global sidebar / workspace pane | workspace pane |
| Toolbar query state | local only / URL synced | URL synced for shareable filters |
| Review before UI-3 | optional / required | required |

## UI-3 Readiness Verdict

**CONDITIONAL GO**

UI-3A can begin after this package is reviewed, but only with the narrow scope:

1. Top Bar
2. Sidebar grouping
3. Account Drawer
4. Admin Dashboard pilot

Do not start Curriculum, Ontology, AI Trace, or Coverage implementation until Dashboard pilot is validated.

The locked UI-3A scope is defined in [UI-3A Implementation Scope Lock](./ui-3a-scope-lock.md).
