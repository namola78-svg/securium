# SECURIUM UI Route Inventory

Generated from the actual `app/**/page.tsx` and `app/**/route.ts` files on 2026-08-10. Dynamic segments are shown in brackets.

## Public and auth

`/`, `/about`, `/guide`, `/courses`, `/courses/[courseSlug]`, `/legal`, `/legal/privacy`, `/legal/terms`, `/privacy`, `/terms`, `/login`, `/signup`

## Learner

`/dashboard`, `/my-courses`, `/my-learning`, `/learn/[courseSlug]`, `/learn/[courseSlug]/course-lessons/[courseLessonId]`, `/learn/[courseSlug]/lessons/[lessonId]`, `/learn/[courseSlug]/levels/[levelId]`, `/learn/[courseSlug]/subjects/[subjectId]`, `/practice`, `/practice/[courseSlug]`, `/reviews`, `/wrong-notes`, `/bookmarks`, `/analytics`, `/analytics/[courseId]`, `/ai-tutor`, `/practical`, `/practical/[courseSlug]`, `/practical/[courseSlug]/code/[sampleId]`, `/practical/[courseSlug]/privacy/[scenarioId]`, `/profile`, `/settings`, `/mock-exams`, `/mock-exams/[mockExamId]`, `/mock-exams/attempts/[attemptId]`, `/lectures/[courseSlug]`, `/lectures/[courseSlug]/[lectureId]`, `/specialized/[courseSlug]`, `/specialized/[courseSlug]/[contentType]/[contentId]`, `/content-versions/[revisionId]`

## Admin

`/admin`, `/admin/ai-explainability`, `/admin/ai-reviews`, `/admin/analytics`, `/admin/audit-logs`, `/admin/content-revisions`, `/admin/course-groups`, `/admin/courses`, `/admin/courses/[courseId]`, `/admin/courses/[courseId]/subjects`, `/admin/coverage`, `/admin/curriculum`, `/admin/lessons`, `/admin/lessons/[lessonId]/preview`, `/admin/levels`, `/admin/mock-exams`, `/admin/mock-exams/[mockExamId]`, `/admin/ontology`, `/admin/practical-specializations`, `/admin/question-reports`, `/admin/questions`, `/admin/questions/[questionId]`, `/admin/questions/new`, `/admin/reviews`, `/admin/shared-content`, `/admin/specialized`, `/admin/subjects/[subjectId]/topics`

## Operations

`/ops/health`, `/ops/dashboard-performance`

## API route handlers

`/api/health`, `/api/auth/session`, `/api/auth/supabase/login`, `/api/auth/supabase/logout`, `/api/auth/supabase/oauth/callback`, `/api/auth/supabase/oauth/google`, `/api/auth/supabase/signup`, `/api/enrollments`, `/api/enrollments/status`, `/api/learning-settings`, `/api/bookmarks`, `/api/wrong-notes`, `/api/question-attempts`, `/api/question-reports`, `/api/lessons/progress`, `/api/levels`, `/api/course-lessons/progress`, `/api/audio/progress`, `/api/lectures/bookmark`, `/api/lectures/note`, `/api/lectures/progress`, `/api/mock-exams/start`, `/api/mock-exams/answer`, `/api/mock-exams/submit`, `/api/practical/code-analysis`, `/api/practical/privacy-assessment`, `/api/specialized/bookmarks`, `/api/specialized/risk-calculate`, `/api/specialized/risk-register`, `/api/specialized/written-grade`, `/api/ai/question-explanations`, `/api/ai/specialized`, `/api/questions`, `/api/admin/ai-explainability`, `/api/admin/ai-reviews`, `/api/admin/audit-logs`, `/api/admin/audit-logs/export`, `/api/admin/content-revisions`, `/api/admin/course-groups`, `/api/admin/courses`, `/api/admin/curriculum-nodes`, `/api/admin/curriculum-trees`, `/api/admin/learning-units`, `/api/admin/lessons`, `/api/admin/level-contents`, `/api/admin/levels`, `/api/admin/mock-exam-questions`, `/api/admin/mock-exam-sections`, `/api/admin/mock-exams`, `/api/admin/ontology/review-status`, `/api/admin/practical-specializations`, `/api/admin/question-reports`, `/api/admin/questions`, `/api/admin/questions/clone`, `/api/admin/questions/workflow`, `/api/admin/shared-content`, `/api/admin/specialized`, `/api/admin/subjects`, `/api/admin/topics`

## Counts

- page files discovered: 71
- route handler files discovered: 60
- layout files: 2
- loading boundaries: 1
- error boundaries: 1
- not-found pages: 1
