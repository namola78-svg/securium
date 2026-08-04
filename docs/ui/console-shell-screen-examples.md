# Console Shell Screen Examples

This document applies Console Shell slots to six representative SECURIUM admin screens.

## 1. Admin Dashboard

### Goal

Show operational health, review queues, content coverage, AI feedback, and recent audit activity.

### Wireframe

```text
Top Bar
Sidebar: Dashboard active
Breadcrumb: Admin
Page Header:
  ADMIN OVERVIEW
  Dashboard
  운영 상태와 우선 조치 항목을 확인합니다.
  Primary CTA: 이슈 확인
Toolbar:
  Date range | Scope | Refresh
Main:
  Metric Cards
  Operational Queue
  Coverage Snapshot
  Recent Activity
Inspector:
  Closed by default
```

### States

- Empty: “아직 집계된 운영 데이터가 없습니다.”
- Loading: metric card skeleton + queue skeleton.
- Error: dashboard error state with retry.

## 2. Curriculum Tree

### Goal

Review official curriculum tree, content connections, question coverage, and gaps.

### Wireframe

```text
Top Bar
Sidebar: Curriculum active
Breadcrumb: Admin > Curriculum > 정보보안기사
Page Header:
  CURRICULUM
  정보보안기사 공식 출제기준
  ACTIVE · 2027-2029 · 필기/실기
  Primary CTA: 노드 검토
Toolbar:
  Course | Exam type | Subject | Gap filter | Expand/Collapse | Density
Main:
  Compact Tree List
  Node row: official order, official title, Korean type, coverage badges, stable key copy
Inspector:
  Selected Node
  Summary
  Content
  Questions
  Coverage
  Version
  Audit
```

### Coverage Checklist Placement

Coverage checklist belongs in Inspector under `Coverage`, with a shortcut in Toolbar filter.

## 3. Ontology Explorer

### Goal

Explore concepts, aliases, relations, cross-course mapping, and AI usage.

### Wireframe

```text
Top Bar
Sidebar: Ontology active
Breadcrumb: Admin > Ontology > AES
Page Header:
  ONTOLOGY
  AES
  Concept · ACTIVE · v1.2
  Secondary: 이력 보기
  Primary: 검수 요청
Toolbar:
  Concept search | Domain | Relation type | Coverage | AI usage
Main:
  Left workspace pane: Ontology Tree
  Center workspace: Concept Detail
Inspector:
  Summary
  Alias
  Relation summary
  Mapping
  AI contribution
  Audit
```

Important distinction:

- Global Sidebar is application navigation.
- Ontology Tree is a workspace pane inside Main Content.

## 4. Content List

### Goal

Map lessons, theory, shared content, and citations to curriculum and ontology.

### Wireframe

```text
Top Bar
Sidebar: Content active
Breadcrumb: Admin > Content
Page Header:
  CONTENT OPERATIONS
  Content
  커리큘럼과 연결 가능한 콘텐츠를 관리합니다.
  Primary CTA: 콘텐츠 생성
Toolbar:
  Search | Content type | Course | Status | Missing mapping | Sort | Columns
Main:
  Admin Table
  Columns: title, type, course scope, curriculum mapping, ontology mapping, review status, updated
Inspector:
  Selected Content
  Metadata
  Mappings
  Version
  Related Questions
  Audit
```

## 5. AI Explainability Trace

### Goal

Review how an AI answer was generated and whether it is trustworthy.

### Wireframe

```text
Top Bar
Sidebar: AI Trace active
Breadcrumb: Admin > AI Trace > request_id
Page Header:
  AI EXPLAINABILITY
  Request Trace
  provider · model · status · latency
  Primary CTA: 검수 완료
Toolbar:
  Provider | Status | Course | Date | Request ID | Reviewer
Main:
  Retrieval Trace Timeline
  Expanded Query
  Concept Detection
  Alias Expansion
  Context Table
  Citation Viewer
  Answer Viewer
Inspector:
  Request Summary
  Provider
  Course
  Feedback
  Issue
  Queue
```

General user AI explanation screen must not be merged with this admin Console.

## 6. Coverage Operations

### Goal

Find curriculum nodes lacking content, questions, ontology mapping, or AI evidence.

### Wireframe

```text
Top Bar
Sidebar: Coverage active
Breadcrumb: Admin > Coverage
Page Header:
  COVERAGE
  Coverage Operations
  공식 기준 대비 누락 영역을 추적합니다.
  Primary CTA: 액션 생성
Toolbar:
  Course | Exam type | Gap type | Severity | Owner | Status | Due date
Main:
  Coverage Table / Matrix
  Rows: curriculum node
  Columns: lesson, theory, question, review, ontology, AI evidence
Inspector:
  Gap Detail
  Recommended Action
  Related Content
  Owner
  Audit
```

## Shared Validation

| Check | Dashboard | Curriculum | Ontology | Content | AI Trace | Coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Top Bar | Yes | Yes | Yes | Yes | Yes | Yes |
| Sidebar active | Yes | Yes | Yes | Yes | Yes | Yes |
| Breadcrumb | Minimal | Yes | Yes | Yes | Yes | Yes |
| Page Header | Yes | Yes | Yes | Yes | Yes | Yes |
| Toolbar | Date/scope | Tree filters | Concept filters | List filters | Trace filters | Gap filters |
| Main Content | Dashboard | Tree | Explorer | Table | Timeline | Matrix |
| Inspector | Optional | Node | Concept | Content | Request | Gap |
| Mobile drawer | Optional | Node detail | Concept detail | Content detail | Trace step | Gap detail |

