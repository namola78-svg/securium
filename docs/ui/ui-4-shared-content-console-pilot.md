# UI-4 Shared Content Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the Shared Content management surface without changing data access, API routes, repository logic, migrations, seeds, or production configuration.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/shared-content` | Manage reusable Content, CourseLesson bridges, curriculum node links, and course-specific extensions | Section Header, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Shared Content is one of SECURIUM's highest-complexity admin workflows because it connects:

- reusable theory content
- course-specific CourseLessons
- curriculum nodes
- course-specific display and exam context
- coverage remediation

The UI therefore now separates the screen into:

1. **Header** — explains the workflow and links to Curriculum and Coverage.
2. **Metrics** — summarizes content, selected course lessons, and curriculum nodes.
3. **Toolbar** — shows current tree/content state and reset action.
4. **Main Workspace** — preserves the existing `AdminSharedContentManager`.
5. **Inspector** — summarizes selected content, usage, CourseLesson, CurriculumNode, and operational guidance.

## Compatibility

- Existing manager component is preserved.
- Existing query parameters are preserved:
  - `courseId`
  - `contentId`
  - `courseLessonId`
  - `curriculumNodeId`
- Existing authorization remains `requireCatalogManager("/admin/shared-content")`.
- Existing repository calls remain unchanged.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed — `rendered-html` suite includes shared content coverage |
| Production build | Passed |

## Manual QA

Verify with an admin account:

1. Course selector still reloads the selected course.
2. Content selection still updates usage.
3. CourseLesson selection still drives the selected content.
4. Curriculum node linking workflow remains unchanged.
5. Inspector stacks below the workspace on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
