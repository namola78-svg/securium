# UI-4 Question New Console Pilot

## Scope

- Target screen: `/admin/questions/new`
- Change type: Admin Console Shell alignment
- Production data impact: none
- API / Repository impact: none
- Migration / Seed impact: none

## Intent

The question creation screen now follows the same admin workspace pattern used by the question bank and question detail screens. The page keeps the existing `AdminQuestionForm` and repository-backed option loading, while improving information hierarchy around draft creation, review flow, and safe answer handling.

## Layout

- Page header
  - Breadcrumb: 관리자 → 문제은행 → 새 문제
  - Title: 문제 초안 등록
  - Status badges: 초안 저장, 검수 필요
- Toolbar
  - Shows the safe-answer-handling note
  - Provides quick links to the question list and review queue
- Metrics
  - Linkable courses
  - Active subjects
  - Active topics
  - Initial workflow state
- Main workspace
  - Existing question form
  - Transaction-save cue
- Inspector
  - Pre-save checklist
  - Review workflow explanation
  - Course / subject / topic linking guidance
  - Links to question list and AI evidence screen

## Preserved Behavior

- Uses the existing `requireQuestionEditor` server-side authorization check.
- Uses the existing repository functions for courses, subjects, and topics.
- Uses the existing `AdminQuestionForm`.
- Does not alter question creation API behavior, transaction logic, grading rules, or data model.

## Verification

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test:integration`
- `npm.cmd run build`

## Follow-up Candidates

- Review `AdminQuestionForm` copy and validation messages for remaining legacy wording.
- Apply the same console shell structure to remaining admin utility screens.
- Add a lightweight browser smoke check for `/admin/questions/new` once an admin session is available.
