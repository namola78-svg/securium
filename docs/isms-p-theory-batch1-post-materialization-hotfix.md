# ISMS-P Theory Batch 1 Post-Materialization Hotfix

## A. Production impact

- Audit mode: PostgreSQL `REPEATABLE READ`, `READ ONLY`
- `transaction_read_only`: `on`
- Snapshot: `2026-08-13 07:57:21.628199+00`
- Production statements: 5 SELECT, 0 write
- QA-user CourseLesson progress aggregate: 3 before the smoke, 6 after it (`+3`)
- No Production remediation, materializer, or rollback was executed.

## B. Exact progress side effects

The three Production detail GETs created an `IN_PROGRESS` row with progress `1` and no
completion timestamp for each of these deterministic CourseLesson IDs:

- `1.1.1` — `course-lesson-isms-p-theory-1-1-1`
- `2.2.6` — `course-lesson-isms-p-theory-2-2-6`
- `2.9.2` — `course-lesson-isms-p-theory-2-9-2`

There were no completion activities and no score or answer writes for those lessons.
This is a confirmed durable START side effect, not a completion side effect.

## C. Raw JSON root cause

The tracked registry intentionally stores the approved Content V3 body as JSON text and
sets `bodyFormat` to `STRUCTURED_JSON`. The materializer and
`getPublishedCourseLessonForUser` preserve both values correctly. The mismatch was in
`SafeLessonContent`: only `PLAIN_TEXT` had a special path and every other discriminator,
including `STRUCTURED_JSON`, was sent through the Markdown renderer. The raw JSON was
therefore a presentation-contract defect, not a stored Production payload defect.

## D. Progress mutation root cause

`CourseLessonActions` invoked `run("START")` from its mount effect. That issued
`POST /api/course-lessons/progress`, whose route called
`updateCourseLessonProgress`; the repository then inserted/upserted an `IN_PROGRESS`
row. Its scroll effect also issued `UPDATE` or `COMPLETE`. The legacy `LessonActions`
component had the same mount/scroll behavior. Repository completion paths can create a
missing progress row directly, so START is not a prerequisite for an explicit COMPLETE.

## E. Fix

- Added an explicit Content V3 structured-body parser and semantic renderer.
- The parser activates only for `STRUCTURED_JSON`, validates the current registry
  contract, renders approved learner prose as headings, paragraphs, and lists, and
  fails closed without exposing malformed raw JSON.
- Sections already rendered elsewhere on the detail page (exam points, practical notes,
  common mistakes, evidence, title, and provenance) remain excluded from the body to
  avoid duplicate presentation.
- Preserved the existing `PLAIN_TEXT` and Markdown paths.
- Removed START/UPDATE/COMPLETE requests from both detail mount/scroll effects. Scroll
  now updates local reading presentation only. The existing explicit completion button
  remains the sole durable progress action.
- No content data, schema, migration, seed, analytics calculation, or Production row was
  changed.

## F. Regression tests

- Structured focused tests: 5/5 PASS
- All 12 Batch bodies: parse 12/12, valid rendering contract 12/12, raw JSON fallback 0
- Representative payloads: `1.1.1`, `2.2.6`, `2.9.2` PASS
- Malformed structured input: fail-closed PASS
- Shared structured discriminator plus legacy text/Markdown preservation: PASS
- Detail mount/scroll source contract: no START/UPDATE action and no effect-scoped fetch
- Unit: 364/364 PASS
- Integration: 23/23 PASS
- Full E2E: 80/80 PASS
- Typecheck: PASS
- Lint: PASS (one pre-existing warning in an unrelated untracked audit helper)
- Next build: PASS
- Cloudflare/Vinext build: PASS

## G. D1/PostgreSQL validation

- Isolated D1 materialization: 36 created; replan 36 NOOP; conflict 0
- Isolated D1 browser progress rows before/after representative GETs: 0 → 0
- Existing D1 materializer/executor regression suite: PASS
- Disposable PostgreSQL 17.6 runtime-link/executor parity: PASS
- Production secrets used by isolated validation: 0

## H. Browser QA

Local authenticated fixture only; Production detail routes were not revisited.

- Chromium / Playwright 1.62.1
- Representative details: 3/3 structured learner prose PASS
- Raw JSON keys visible: 0
- Mount POST: 0
- Reload mutation: 0
- Back/forward mutation: 0
- Prefetch/business mutation observed: 0
- Desktop 1440x900: PASS, horizontal overflow 0
- Mobile 390x844: PASS, horizontal overflow 0
- Main landmark/H1/semantic headings and lists: PASS
- Console errors, page errors, failed requests, unexpected 4xx/5xx: 0
- Local screenshots: `reports/ui-v2/batch1-post-materialization-hotfix/`

## I. Production remediation decision pending

The three accidental START rows were not modified. They currently have no completion,
score, or answer effect. Whether to keep or reset them requires a separate, explicit
Production remediation decision after the hotfix is reviewed, merged, and deployed.
No Production re-test should open a detail route before deployment of this fix.
