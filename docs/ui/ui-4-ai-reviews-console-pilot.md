# UI-4 AI Reviews Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the AI review queue page. It preserves the existing client-side review console, review actions, API route, and review history behavior.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/ai-reviews` | Review course-specialized AI outputs and keep AI originals separate from admin-reviewed content | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

AI review needs strong trust cues. The page now separates:

1. **Header** — explains AI original/admin-reviewed separation and links to AI Trace and Question Bank.
2. **Metrics** — summarizes review queue size, completed reviews, rejected/deleted items, and Mock AI count.
3. **Toolbar** — highlights pending queue and Mock AI state.
4. **Main Workspace** — preserves the existing `AdminAIReviewConsole`.
5. **Inspector** — summarizes the most recent AI generation and safety constraints.

## Compatibility

- Existing `AdminAIReviewConsole` remains unchanged.
- Existing `/api/admin/ai-reviews` mutation route remains unchanged.
- Existing authorization remains `requireQuestionReviewer("/admin/ai-reviews")`.
- No repository or API contract changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a content reviewer or admin account:

1. Review actions still update status locally after successful API response.
2. JSON edit validation still blocks malformed edited results.
3. Copy-to-reviewed-content action still requires a title.
4. Existing review history still expands inside each card.
5. Inspector stacks below the review queue on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
