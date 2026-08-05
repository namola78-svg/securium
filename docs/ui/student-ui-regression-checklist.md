# SECURIUM Student UI Regression Checklist

Use this checklist before product-facing deployments that touch public or learner UI.

## Validation commands

Run the project-defined commands, substituting only when a script is missing:

1. `npm.cmd run typecheck`
2. `npm.cmd run lint`
3. `npm.cmd run test:unit`
4. `npm.cmd run build`

For server-rendered UI checks:

```powershell
node scripts/run-d1-test-suite.mjs --test --test-concurrency=1 tests/rendered-html.test.mjs
```

## Public landing

- [ ] `/` renders without authentication.
- [ ] Hero includes SECURIUM brand and learner-value message.
- [ ] Primary CTA leads to sign-up or login start.
- [ ] Secondary CTA leads to `/courses`.
- [ ] Product preview card is understandable without decorative effects.
- [ ] No `Phase`, `개발용 샘플`, `TODO`, or internal implementation status is visible.
- [ ] Empty/database-unavailable states do not expose stack traces or internal details.

## Header and navigation

- [ ] Public header shows only valid public links.
- [ ] Signed-in header shows learner links and account menu.
- [ ] Active state follows the current path.
- [ ] Mobile drawer opens and closes with click, ESC, and item selection.
- [ ] Background scroll is locked while the mobile drawer is open.
- [ ] Logout disables repeated clicks and redirects to `/login`.

## Course catalog and detail

- [ ] Course cards show name, description, target audience, structure, duration, content count, status, and CTA.
- [ ] Internal course codes are secondary, not primary.
- [ ] Planned courses have disabled CTA with visible disabled styling.
- [ ] Course detail CTA states are clear: loading, login required, add course, continue, review, error.
- [ ] Enrollment success refreshes the UI without duplicate enrollment.

## Learner dashboard

- [ ] Empty state guides users to course browsing.
- [ ] Course progress is scoped per course.
- [ ] Recommended next action is visible above secondary metrics.
- [ ] Loading state reserves layout space and uses shared state UI.
- [ ] Error state hides sensitive details and supports retry.

## Curriculum and lesson

- [ ] Curriculum tree keeps official labels first and internal keys secondary.
- [ ] Default expansion is not overwhelming on mobile.
- [ ] Selected node details are available in a panel or drawer.
- [ ] Lesson progress is course-scoped via CourseLesson where available.
- [ ] Completed lessons do not create duplicate progress rows.

## Question, AI explanation, review

- [ ] Questions do not expose correct answers before submission.
- [ ] AI explanation is labeled as reference-only, not official scoring.
- [ ] Citations or context references are visible when available.
- [ ] Wrong-note and review actions are course-scoped.
- [ ] Review empty state suggests a safe next learning action.

## Accessibility and responsive checkpoints

Test at:

- [ ] 360px
- [ ] 390px
- [ ] 768px
- [ ] 1024px
- [ ] 1440px
- [ ] 1920px

Check:

- [ ] No horizontal scroll.
- [ ] Button touch targets are at least 44px.
- [ ] Focus-visible ring is clear.
- [ ] Heading order is logical.
- [ ] Labels are connected to inputs.
- [ ] Icon-only controls have accessible names.
- [ ] Disabled controls are not communicated by color alone.
- [ ] Loading states use `role=status` or equivalent where practical.

