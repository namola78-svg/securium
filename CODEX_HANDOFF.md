# Codex Handoff

## 湲곗?
- ?좎쭨: 2026-08-10
- 猷⑦듃?먮뒗 湲곗〈 `AGENTS.md`? `CODEX_HANDOFF.md`媛 ?놁뿀??
- `AGENTS.md`??`node_modules` ?대? ?⑦궎吏 臾몄꽌留?諛쒓껄??
- ?묒뾽 ?몃━??湲곗〈 ?몄뀡???洹쒕え 誘몄빱諛?蹂寃??곹깭?대ŉ, ?대떦 蹂寃쎌쓣 ?섎룎由ш굅???ъ옉?낇븯吏 ?딆쓬.

## ?대쾲 ?몄뀡 ?뺤씤
- `git status`, `git diff`, `git log` ?뺤씤 ?꾨즺.
- `TODAY_REPORT.md`??留덉?留?誘몄셿猷??꾨낫瑜??議고븿.
- `components/site-nav.tsx`??二쇱슂/蹂댁“ 硫붾돱 ?묎렐???쇰꺼怨??쒖꽦 ?꾩튂 臾멸뎄???대? ?꾩옱 蹂寃쎈텇??諛섏쁺?섏뼱 ?덉뼱 諛섎났 ?섏젙?섏? ?딆쓬.
- `app/dashboard/page.tsx`???ㅼ쓬 ?됰룞 CTA 臾멸뎄瑜??됰룞 以묒떖 ?⑹뼱濡??뺣━??
  - `異붿쿇 ?숈뒿 ?쒖옉`
  - `蹂듭뒿 ?쒖옉`
  - `?댁뼱???숈뒿`
  - `怨쇱젙 ?좏깮`
- 怨쇱젙 移대뱶??蹂댁“ CTA??`臾몄젣????쒖옉`, `?댁뼱???숈뒿`?쇰줈 ?듭씪??
- ?곗뒪?ы넲 ?숈뒿??二?硫붾돱??`/dashboard` ?쇰꺼??`??쒕낫??濡??듭씪?? 紐⑤컮???쇰꺼 `??? ?좎?.
- 二쇱슂 ?대퉬寃뚯씠???묎렐???쇰꺼??`二쇱슂 ?대퉬寃뚯씠???쇰줈 ?뺣━??

## 湲곗〈 ?몄뀡 ?꾨즺濡??뺤씤??踰붿쐞
- 怨듯넻 ?ㅻ퉬 ?ㅼ젙 諛??뚮뜑留?援ъ“ ?꾩엯.
- `ActionButton` 湲곕컲 CTA ?뺢퇋?붽? ?щ윭 ?섏씠吏???곸슜??
- ??쒕낫?? 臾몄젣??? ?몄쬆, ?숈뒿 遺꾩꽍 愿??蹂寃쎌씠 ?묒뾽 ?몃━???대? 議댁옱??

## ?ㅼ쓬 誘몄셿猷??묒뾽
- `components/site-nav.tsx`? ??쒕낫?쒖쓽 怨듯넻 ?⑹뼱 湲곗? ?뺥빀???뺤씤.
- ??쒕낫??蹂댁“ CTA? ?곹깭 臾멸뎄???⑹뼱 ?듭씪 ?щ? ?먭?.
- ??쒕낫?쒖쓽 ?⑥? ?곹깭/?듦퀎 臾멸뎄? ?대퉬寃뚯씠???쇰꺼??理쒖쥌 ?議?
- ?댄썑 ??낆껜??由고듃/鍮뚮뱶??蹂꾨룄 ?뱀씤 ???ㅽ뻾.

## ?ㅼ쓬 諛곗튂
- 蹂寃쎈맂 ??쒕낫???ㅻ퉬寃뚯씠??踰붿쐞???????낆껜?ъ? 由고듃 ?ㅽ뻾 ?щ?瑜??ъ슜?먯뿉寃??뺤씤.

## BATCH 19 (Auth Panel Effect Cleanup)
- `components/login-panel.tsx`
  - ?쒕쾭 ?ㅻ쪟瑜?prop怨??댁젣 ?곹깭濡??뚯깮?섎룄濡?蹂寃?
  - `useEffect` ?대? ?숆린 ?곹깭 ?낅뜲?댄듃 ?쒓굅.
- `components/signup-panel.tsx`
  - ?숈씪???쒕쾭 ?ㅻ쪟 ?댁젣 ?⑦꽩 ?곸슜.
  - ?ㅻ쪟 ?ъ빱??effect??DOM ?ъ빱?ㅻ쭔 ?대떦?섎룄濡??뺣━.
- 寃利? `npm run typecheck` PASS, `npm run lint` PASS.

## BATCH 20 (Production Build Boundary Fix)
- `app/layout.tsx`
  - `FooterLegalLinks`??`useSearchParams()` ?ъ슜??Suspense 寃쎄퀎濡?媛먯뙂.
- `components/design-system-primitives.tsx`
  - `ActionButton`???대깽???몃뱾???꾨떖???꾪빐 ?뚯씪???대씪?댁뼵??而댄룷?뚰듃濡?紐낆떆.
- 寃利? `npm run build` PASS.
- ?꾩껜 61媛??뺤쟻 ?섏씠吏 ?앹꽦 ?꾨즺.

## ?꾩옱 ?곹깭
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

## BATCH 21 (Auth Redirect Test Fix)
- `lib/auth-routing.ts`
  - ?덉쟾?섏? ?딆? `return_to`??redirect query builder?먯꽌 湲곕낯 寃쎈줈濡??泥댄븯吏 ?딄퀬 ?쒓굅?섎룄濡??섏젙.
- 寃利? `npm run test:unit` PASS, 312/312.
- `npm run test:e2e`??184珥????꾨즺?섏? ?딆븘 timeout.

## ?⑥? 寃利?- E2E ?뚯뒪?멸? ?꾨즺?섏? ?딆? ?먯씤 ?뺤씤 諛??ㅽ뻾 ?섍꼍 ?먭?.

## E2E 議곗궗 寃곌낵
- `test:e2e`? `tests/rendered-html.test.mjs` ?⑤룆 ?ㅽ뻾 紐⑤몢 `vinext dev` ?쒕쾭 readiness ?④퀎?먯꽌 timeout.
- `33120` ?ы듃???ㅽ뻾 ??鍮꾩뼱 ?덉뼱 ?댁쟾 ?꾨줈?몄뒪 ?붾쪟???ы듃 異⑸룎? ?뺤씤?섏? ?딆쓬.
- ?꾩옱 肄붾뱶 寃利?寃곌낵: typecheck/lint/build/unit(312/312) PASS.
- E2E ?붿뿬 ?먯씤: ?꾩옱 ?섍꼍?먯꽌 `vinext dev` 珥덇린?붽? ?뚯뒪??readiness ?쒗븳 ?쒓컙 ???꾨즺?섏? ?딆쓬.
- `.wrangler/wrangler.log`?먮뒗 D1 濡쒖뺄 紐낅졊 ?깃났 湲곕줉留??덇퀬 `vinext dev`??紐낆떆??startup ?ㅻ쪟???놁쓬.
- 10媛?E2E ?ㅼ쐞?몄쓽 ?붿껌 二쇱냼瑜?`localhost`?먯꽌 `127.0.0.1`濡??듭씪?덉?留?`rendered-html` readiness timeout? ?ы쁽??
- ?곕씪??localhost IPv4/IPv6 ?댁꽍? 二쇱썝?몄씠 ?꾨땶 寃껋쑝濡??먮떒.
- ?숈씪??`vinext dev --host 127.0.0.1 --port 33129`???뚯뒪???몃??먯꽌 30珥??숈븞 異쒕젰 ?놁씠 珥덇린?붾릺吏 ?딆쓬.
- E2E ?щ꼫 臾몄젣媛 ?꾨땲???꾩옱 ?섍꼍??`vinext dev` 湲곕룞 ?④퀎 臾몄젣濡??뺤젙.
- ?ㅽ뻾 ?고??꾩? Node `v24.19.0`, npm `11.17.0`, `C:\Program Files\nodejs\node.exe`?대ŉ ?꾨줈?앺듃 engine ?붽뎄?ы빆(`>=22.13.0`)? 異⑹”.

## BATCH 22 (Public UX and SEO Foundation)
- `components/course-card.tsx`, `app/practice/page.tsx`
  - ?덇굅??踰꾪듉/留곹겕 CTA瑜?`ActionButton`?쇰줈 ?듭씪.
  - 怨쇱젙 媛쒖꽕 ?덉젙 ?곹깭??鍮꾪솢??CTA濡?紐낇솗?섍쾶 ?좎?.
- `app/sitemap.ts`, `app/robots.ts`
  - 怨듦컻 ?뺤쟻 寃쎈줈? ?ㅼ젣 怨듦컻 怨쇱젙留??숈쟻 sitemap???ы븿.
  - API, 愿由ъ옄, ?댁쁺, ?몄쬆 寃쎈줈???щ·留곸뿉???쒖쇅.
- `app/courses/[courseSlug]/page.tsx`
  - 怨쇱젙 ?곸꽭 ?섏씠吏??怨쇱젙蹂?canonical URL??異붽?.
- 寃利? `npm run typecheck` PASS, `npm run lint` PASS, `npm run test:unit` PASS 312/312, `npm run build` PASS.
- 怨듦컻 route ?곗텧: 63媛?
- 怨쇱젙 ?곸꽭 `Course`/`BreadcrumbList` JSON-LD 異붽?.
- `components/practice-session.tsx`???숈뒿 吏꾪뻾/?쒖텧/寃곌낵/AI/?좉퀬 ?ъ슜??臾멸뎄瑜??쒓뎅?대줈 ?듭씪.
- 理쒖쥌 ?ш?利? `npm run typecheck` PASS, `npm run lint` PASS, `npm run test:unit` PASS 312/312, `npm run build` PASS.
- 臾몄젣???寃곌낵/?ㅻ쪟 硫붿떆吏??`aria-live`瑜?異붽??섍퀬 ?좉퀬 ?ъ쑀 label??蹂닿컯.
- 紐⑤컮??臾몄젣???移대뱶? CTA??wrapping/理쒖냼 ?곗튂 ?곸뿭??蹂닿컯.
- 怨쇱젙 ?곸꽭??肄섑뀗痢??녿뒗 怨쇱젙? ?깅줉 CTA ???`媛쒖꽕 ?덉젙` ?덈궡瑜??쒖떆?섎룄濡??뺥빀??
- 怨쇱젙 媛?⑹꽦 諛곗튂 寃利? `npm run typecheck` PASS, `npm run lint` PASS, `npm run build` PASS.
- 紐⑤컮??CSS 諛곗튂 寃利? `npm run typecheck` PASS, `npm run lint` PASS, `npm run build` PASS.
- ?묎렐??諛곗튂 寃利? `npm run typecheck` PASS, `npm run lint` PASS, `npm run test:unit` PASS 312/312, `npm run build` PASS.

## UX ?꾩닔 遺꾩꽍 湲곕줉
- ?곸꽭 蹂닿퀬?? `reports/ux-audit-2026-08-10.md`
- ?듭떖 ?붿뿬 ?꾪뿕: `vinext dev` readiness timeout, dual runtime ?댁쁺 寃쎄퀎, 臾몄젣???寃곌낵?믩났??釉뚮씪?곗? Journey 誘멸?利?
- 吏곸젒 吏꾨떒 以??⑥? `vinext dev` ?먯떇 ?꾨줈?몄뒪(PID 29556)??醫낅즺???뚯뒪???ы듃 ?곹깭瑜??뺣━??
- `rendered-html` ?ъ떎?됰룄 readiness 異쒕젰 ?놁씠 ?湲고빐 以묐떒?덉쑝硫? ?ы듃 `33120`???붾쪟 ?꾨줈?몄뒪??醫낅즺??

## 二쇱쓽
- `.tmp-backup/`?먮뒗 ?댁쟾 ?섏씠吏 諛깆뾽 ?뚯씪???덉쑝誘濡??꾩옱 蹂寃쎄낵 ?議고븷 ?뚮쭔 ?ъ슜.
- 湲곗〈 誘몄빱諛?蹂寃쎌? ?ъ슜???묒뾽?????덉쑝誘濡??꾩쓽濡??뺣━?섏? ?딆쓬.

## BATCH 23 (Course CTA consistency)
- `components/course-enroll-action.tsx`: anonymous, enrolled, completed, and enrollment CTA states now use `ActionButton` consistently.
- Enrollment-in-progress state now exposes shared loading UI and `aria-busy`.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 24 (Practice empty-state recovery)
- `app/practice/[courseSlug]/page.tsx`: zero-result filters no longer mount an empty practice session; users now receive a clear empty state with reset-filter and course-detail recovery actions.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 25 (My learning UX repair)
- `app/my-learning/page.tsx`: repaired malformed JSX/string fragments in the learning library while preserving course, practice, review, analytics, bookmark, practical, and AI entry points.
- Enrollment enum values now render as learner-facing Korean labels; last-study timestamps are formatted safely; completed courses route to review and show a review CTA.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 26 (My courses state-aware actions)
- `app/my-courses/page.tsx`: repaired malformed JSX/content and aligned the page with the learning-library UX.
- Active courses expose learning and practice actions; completed courses expose review actions; cancelled courses expose course details without starting practice.
- Enrollment status controls now have explicit accessible labels and learner-facing Korean values.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 27 (Wrong-note recovery UX)
- `app/wrong-notes/page.tsx`: repaired malformed JSX/content while preserving course, subject, topic, difficulty, repeated, and mastery filters.
- Added explicit accessible labels, readable filter summary, repeat/missing-learning insights, course-scoped retry CTA, and a useful empty state.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 28 (Bookmark-to-practice flow)
- `db/question-repositories.ts`: bookmark listing now includes the owning course slug.
- `app/bookmarks/page.tsx`: saved-question cards now show saved state and provide a `다시 풀기` CTA.
- `app/practice/[courseSlug]/page.tsx`: supports `questionId` to open a single bookmarked question before broader review/wrong-note filters.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 29 (AI tutor UX alignment)
- `app/ai-tutor/page.tsx`: repaired malformed JSX/content and aligned copy with the implemented AI explanation scope.
- Active and completed non-cancelled enrollments now lead directly into five-question practice; empty state is reserved for users without an enrolled course.
- Clearly distinguishes AI reference explanations from official scoring/content and exposes the learning-to-review flow.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 30 (Practical learning hub)
- `app/practical/page.tsx`: repaired malformed JSX/content and made the hub show only non-cancelled enrollments with linked practical content.
- Practical course cards now expose readable progress, recent activity, wrong-answer count, and a shared `실무 연습 시작` CTA.
- No-content state now explains why practical entries are unavailable and routes users back to the course catalog.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 31 (Analytics hub simplification)
- `app/analytics/page.tsx`: repaired malformed JSX/content and reduced duplicated Suspense/data-fetch structure to one integrated statistics read.
- Added clear no-data and populated-data paths with course analysis, targeted practice, and review CTAs.
- Course rows now consistently show accuracy, level completion, theory progress, and next actions.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 32 (Profile account UX)
- `app/profile/page.tsx`: repaired malformed JSX/content and restored readable account identity and role labels.
- Sensitive authentication details remain hidden; added direct navigation to learning settings and dashboard.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 33 (Learning settings feedback)
- `components/learning-settings-form.tsx`: repaired labels and messages; save, error, network, loading, and `aria-live` states are now explicit.
- `app/settings/page.tsx`: repaired surrounding content and clarified how daily goals affect dashboard recommendations, with direct dashboard/practice actions.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 34 (New learner guide)
- `app/guide/page.tsx`: repaired malformed JSX/content and rewrote the onboarding flow around actual product behavior.
- Guide now clearly covers course selection, curriculum, practice/wrong-note review, and AI tutor boundaries, with a direct course-catalog CTA.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 35 (Legal and trust pages)
- `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`: repaired malformed JSX/content and aligned plain-language guidance with account, learning records, wrong notes, bookmarks, analytics, and AI explanation behavior.
- Preserved safe auth return-path handling and logged-in/logged-out CTA differences.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 36 (About and promise alignment)
- `app/about/page.tsx`: repaired malformed JSX/content and aligned the service description with implemented course, independent progress, practice/review, and AI reference-explanation capabilities.
- Public introduction now avoids unsupported promises and routes users to the real course catalog.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 37 (Authentication UX repair)
- `app/login/page.tsx`, `app/signup/page.tsx`: repaired malformed page markup and unified provider fallback messaging.
- `components/login-panel.tsx`, `components/signup-panel.tsx`: rebuilt accessible forms with client validation, server error messaging, loading guards, password visibility toggle, Google OAuth links, legal links, and safe return paths.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 38 (Public course catalog)
- `app/courses/page.tsx`: repaired public catalog markup/content and metadata.
- Catalog now clearly groups real published courses, shows group counts, preserves course-card content availability states, and provides an explicit no-public-course fallback.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 39 (Global navigation and footer)
- `components/site-nav.tsx`: repaired navigation accessibility labels, active-location titles, and utility navigation markup while preserving auth return-path behavior.
- `components/footer-legal-links.tsx`: restored readable legal/service links and safe return-path handling.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit` (312/312), and `npm run build` (63 routes) all passed.

## BATCH 40 (Mobile navigation contract)
- `tests/mobile-bottom-nav.test.ts`: replaced stale mojibake/static expectations with the current shared `lib/ui-nav.ts` configuration and `header-controls` rendering contract.
- Verified mobile bottom navigation exposes five current learner destinations, active-path groups, focus-visible styles, safe-area spacing, and 52px touch targets.
- Targeted validation: `node --test tests/mobile-bottom-nav.test.ts` passed.

## BATCH 41 (Global recovery states)
- `app/error.tsx`, `app/not-found.tsx`: repaired Korean recovery messages and added course/home recovery actions; preserved safe error logging with digest/name.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 42 (Mock exam learner flow)
- `app/mock-exams/page.tsx`: repaired learner-facing copy, added empty state, remaining-attempt display, and practice fallback CTA.
- `app/mock-exams/[mockExamId]/page.tsx`: clarified exam rules, score/attempt metrics, exhausted-attempt state, and accessible structure.
- `components/mock-exam-start.tsx`: added network failure handling, alert feedback, busy state, and repaired start labels.
- `components/mock-exam-session.tsx`: repaired question/result copy, added question status labels, answer-save feedback, submit failure handling, result timing guidance, and keyboard-accessible controls while preserving existing APIs.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 43 (Practice hub UX)
- `app/practice/page.tsx`: repaired all learner-facing copy and metadata, clarified the four-step practice flow, preserved course-scoped practice links, and improved enrollment/empty-state guidance.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 44 (Level learning UX)
- `app/learn/[courseSlug]/levels/[levelId]/page.tsx`: repaired level learner copy, added breadcrumb and explicit score/attempt metrics, preserved locked-level redirect and access checks, and added a guided empty state when no questions are linked.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 45 (Subject learning UX)
- `app/learn/[courseSlug]/subjects/[subjectId]/page.tsx`: repaired subject/topic/lesson copy, added counts and progress labels, clarified lesson statuses, preserved course enrollment checks, and added empty states with practice/overview recovery actions.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 46 (Lesson reading and completion UX)
- `app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx`: repaired shared lesson copy, metadata, supplemental learning sections, navigation labels, and preserved enrollment/content access checks.
- `components/course-lesson-actions.tsx`: repaired status/completion copy, added network failure feedback, live progress messaging, and busy-state accessibility while preserving automatic start and scroll-progress persistence.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 47 (Legacy lesson route UX)
- `app/learn/[courseSlug]/lessons/[lessonId]/page.tsx`: repaired legacy lesson metadata, completion policy labels, breadcrumb/navigation, and preserved audio player, content revisions, safe content rendering, and lesson progress actions.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 48 (Dashboard action-first UX)
- `app/dashboard/page.tsx`: replaced damaged learner-facing copy and metadata, consolidated dashboard data loading, and made today-next-action the primary hierarchy.
- Dashboard now clearly connects daily goal, review queue, recommendation reason, active courses, progress, accuracy, and fallback course CTA while preserving existing repository data and settings form.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 49 (Course analytics action flow)
- `app/analytics/[courseId]/page.tsx`: repaired course analytics copy, clarified no-data behavior, and connected weakest topic, subject breakdown, additional practice, and review actions to course-scoped URLs.
- Added readable metrics for accuracy, recent activity, repeated wrong answers, level completion, response time, and mock-exam score.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 50 (Specialized and practical learning UX)
- `app/specialized/[courseSlug]/page.tsx`: repaired specialized content copy, clarified learning-only scope, grouped standards/cases/legal/written/risk learning, and added an explicit empty-content fallback.
- `app/practical/[courseSlug]/page.tsx`: repaired practical lab copy, clarified code review/privacy assessment scope, and added a learn-overview fallback when no practical content is published.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 51 (Practical detail UX)
- `app/practical/[courseSlug]/code/[sampleId]/page.tsx`: repaired code-diagnosis copy, added practical-list breadcrumb, clarified static-analysis and non-execution scope, and preserved workbench/error handling.
- `app/practical/[courseSlug]/privacy/[scenarioId]/page.tsx`: repaired PIA scenario copy, added breadcrumb and current-standards guidance, clarified scenario facts, and preserved flow diagram/workbench/previous answers.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 52 (Specialized content detail UX)
- `app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx`: repaired content-type labels, source/version guidance, related course/question/legal links, bookmark context, risk-scenario AI review context, case/version sections, and content fact labels.
- Preserved allowed-type validation, enrollment/authorization handling, published revision display, and related content data scope.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 53 (Lecture discovery and playback UX)
- `app/lectures/[courseSlug]/page.tsx`: repaired lecture catalog copy, filters, recent playback, recommendation, access labels, progress labels, and empty-state recovery.
- `app/lectures/[courseSlug]/[lectureId]/page.tsx`: repaired lecture detail metadata, access redirects, player context, related theory/questions, and navigation labels while preserving playback state, bookmarks, notes, and revisions.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 54 (Bookmarks learner UX)
- `app/bookmarks/page.tsx`: clarified that the current bookmark hub contains saved questions, added saved-count summary, direct retry actions, practice navigation, and a useful empty state without overstating supported bookmark types.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 55 (Public landing promise alignment)
- `app/page.tsx`: rebuilt public landing copy around implemented capabilities: official-reference learning, course-scoped practice, review, explainable AI assistance, and real content availability states.
- Preserved course spotlight counts/status, authenticated redirect to dashboard, public course CTA, dashboard preview, learning chain, and product-value CTA.
- `tests/landing-hero-card.test.ts`: replaced stale mojibake-sensitive source assertions with readable structural/copy assertions for hero, AI explanation, learning chain, dashboard preview, course spotlight, and final CTA.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 56 (Course detail UX)
- `app/courses/[courseSlug]/page.tsx`: repaired course detail copy and metadata, clarified real content counts and planned state, preserved enrollment CTA, curriculum, goals, passing criteria, and Course JSON-LD.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 57 (Legal and policy UX)
- `app/legal/page.tsx`: added clear return navigation and a short distinction between terms and privacy policy before the primary actions.
- `app/legal/terms/page.tsx`: added policy breadcrumb and clarified the learning-material scope, including AI, exam, legal-advice, and redistribution limitations.
- `app/legal/privacy/page.tsx`: added policy breadcrumb and explicit privacy rights/request guidance linked to account settings and service information.
- Legacy `/terms` and `/privacy` aliases remain redirect-only.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 58 (Brand and service introduction UX)
- `lib/brand.ts`: restored the shared Korean brand name, official title, and platform description so header, footer, metadata, and about content no longer render corrupted text.
- `app/about/page.tsx`: added home navigation and made the real-content/status check explicit in the learner-facing service principles.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed after fixing the internal-link lint/type issue.

## BATCH 59 (Navigation density and mobile access)
- `components/header-controls.tsx`: kept learner primary navigation focused on dashboard, theory, practice, practical, and my learning; exposed AI, wrong notes, and review links as desktop utility links and a mobile additional-learning group.
- `app/globals.css`: styled the new utility links and removed two malformed decorative `content` values that caused CSS optimization warnings.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed with no reported warnings.

## BATCH 60 (SEO public-route alignment)
- `app/sitemap.ts`: replaced legacy terms/privacy aliases with canonical legal routes and added the public practical-learning entry point.
- `app/robots.ts`: excluded authenticated learner pages, operational/API routes, auth routes, and legacy aliases while keeping public catalog, course detail, guide, about, practical overview, and legal pages crawlable.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 61 (Learn overview UX rebuild)
- `app/learn/[courseSlug]/page.tsx`: replaced the mojibake-heavy learner overview with a clean course hub that prioritizes today?셲 next action, continue-learning CTA, theory progress, official curriculum, subjects, review, analytics, practical learning, and mock exams.
- Preserved enrollment protection, course-scoped progress, level data, shared lessons, curriculum path, subjects, specializations, and activity summaries.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 62 (Course display copy normalization)
- `lib/course-display.ts`: replaced corrupted course type, audience, difficulty, date fallback, description fallback, and learning-goal copy with consistent Korean UX text.
- Preserved course classification behavior for certification, management-system, privacy, risk-management, and secure-coding tracks.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 63 (Practice entry and filter UX)
- `app/practice/page.tsx`: normalized the practice hub copy, four-step flow, enrolled-course cards, progress/accuracy context, and no-enrollment CTA.
- `app/practice/[courseSlug]/page.tsx`: normalized course practice headings, filter labels, unsupported-type messaging, selected-filter summary, enrollment guard, and no-result actions while preserving subject/topic/type/difficulty/random/wrong/review query behavior and `PracticeSession` integration.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 64 (Practice session UX rebuild)
- `components/practice-session.tsx`: replaced corrupted learner-facing labels with a focused question loop covering progress, answer selection, submission, grading feedback, bookmark, AI reference explanation, reporting, and next-question/session completion actions.
- Preserved `/api/question-attempts` idempotency, `/api/bookmarks`, `/api/ai/question-explanations`, and `/api/question-reports` contracts.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 65 (Subject learning UX)
- `app/learn/[courseSlug]/subjects/[subjectId]/page.tsx`: normalized subject navigation, topic descriptions, first-lesson CTA, theory progress, lesson statuses, and empty-content fallbacks.
- Preserved course/subject ownership checks, enrollment guard, topic queries, published learning units, and subject theory progress.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 66 (Level learning UX)
- `app/learn/[courseSlug]/levels/[levelId]/page.tsx`: normalized level learning copy, status labels, pass/best/attempt metrics, locked-level handling, and no-question fallback while preserving access checks, LevelActions, and PracticeSession.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 67 (Lesson detail UX)
- `app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx`: restored readable Korean labels for core theory, lesson metadata, supplemental study notes, and navigation while preserving enrollment checks, safe content rendering, completion actions, and course-lesson progress.
- `app/learn/[courseSlug]/lessons/[lessonId]/page.tsx`: restored readable Korean labels for subject breadcrumb, completion policy, audio lesson metadata, sample content, and previous/next navigation while preserving audio, revision, progress, and content sanitization flows.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 68 (My learning state accuracy)
- `app/my-learning/page.tsx`: separated visible enrollments, active courses, and completed courses so cancelled enrollments are excluded from totals and completed courses are not mislabeled as in-progress; preserved completed-course review CTA and course browsing empty state.
- Reviewed `app/wrong-notes/page.tsx` and `app/reviews/page.tsx`; their current filter, priority, empty-state, and next-action flows were already coherent, so no redundant changes were made.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 69 (Signup form UX)
- `components/signup-panel.tsx`: added an accessible password visibility toggle matching the login flow and exposed the 8-128 character requirement before submission via a hint linked with `aria-describedby`; preserved server validation, loading states, OAuth, legal links, and safe return paths.
- Reviewed `app/profile/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, and `app/signup/page.tsx`; account redirects, settings CTAs, and authentication error handling were already coherent, so no redundant changes were made.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 70 (Lecture catalog and detail UX)
- `app/lectures/[courseSlug]/page.tsx`: restored readable Korean copy for course breadcrumbs, filters, recommendations, recent viewing, catalog cards, access states, playback progress, and empty results while preserving course-scoped lecture queries.
- `app/lectures/[courseSlug]/[lectureId]/page.tsx`: restored readable Korean copy for access badges, metadata, related theory/questions, and next-learning navigation while preserving auth redirects, safe embed checks, player state, and revision info.
- `components/lecture-player.tsx` remains unchanged in this batch; its playback, bookmark, note, and progress contracts are reserved for the next lecture UX pass.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 71 (Lecture player UX)
- `components/lecture-player.tsx`: restored readable Korean labels and status feedback for playback progress, completion, bookmarks, notes, save states, errors, and unauthenticated access; added clear iframe video and progress accessibility labels.
- Preserved 15-second progress persistence, completion threshold, YouTube/Vimeo origin checks, postMessage protocols, bookmark API, note API, and pending-state behavior.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 72 (Course catalog card UX)
- `components/course-card.tsx`: restored readable Korean labels for course availability, recommended audience, learning composition, estimated duration, question counts, and detail CTA; preserved honest planned-state behavior when published content is unavailable.
- Confirmed `/questions` is an API route rather than a duplicate learner page; learner question discovery remains intentionally consolidated under `/practice`.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 73 (Public course detail UX)
- `app/courses/[courseSlug]/page.tsx`: restored readable Korean copy for course facts, enrollment CTA, course introduction, recommended audience, goals, curriculum, completion criteria, and planned-content notice; preserved course-scoped enrollment, cached catalog reads, Course schema JSON-LD, and honest content availability rules.
- `app/courses/page.tsx` already had coherent grouping, empty state, metadata, and catalog entry flow; no redundant changes were made.
- Validation: typecheck, lint, test:unit (312/312), build (63 routes) all passed.

## BATCH 74 (AI tutor recommendation bridge)
- `app/ai-tutor/page.tsx`: connected the existing review summary to the learner-facing AI tutor page; due review items now produce a direct review-plan CTA, while learners without due items are guided to practice and create a real review schedule.
- Preserved the transparent AI promise: explanations remain reference-only, official grading remains authoritative, and evidence is shown only when available.
- Validation: lint and test:unit (312/312) passed; sequential typecheck and build (63 routes) passed. Initial parallel typecheck was discarded because concurrent build regeneration temporarily removed `.next` type files.

## BATCH 75 (Practical hub content transparency)
- `app/practical/page.tsx`: separated enrolled courses with available practical scenarios from enrolled courses whose practical content is still being prepared; added an explicit planned-content section with an honest explanation and theory-learning fallback CTA.
- Preserved course enrollment scope, specialization lookup, progress display, and empty-state behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 76 (Specialized learning UX)
- `app/specialized/[courseSlug]/page.tsx`: restored readable Korean copy for specialization scope, reference disclaimers, standards, defect cases, legal articles, written practice, risk scenarios, and risk register states while preserving enrollment gates and all specialized workflows.
- `app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx`: restored readable labels for content type, reference date, bookmarks, related courses/questions/laws, cases, versions, and detail fields while preserving content authorization, revision info, AI review, and related-content links.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 77 (Practical lab detail UX)
- `app/practical/[courseSlug]/page.tsx`: restored readable Korean copy for secure code review and privacy impact assessment tracks, planned-content empty states, and practice scope disclaimers.
- `app/practical/[courseSlug]/code/[sampleId]/page.tsx`: restored readable labels for static code analysis, CWE evidence, safe non-execution behavior, and practical navigation.
- `app/practical/[courseSlug]/privacy/[scenarioId]/page.tsx`: restored readable labels for privacy assessment scenarios, organization/system facts, personal-data scope, and current-standard disclaimer while preserving flow diagram and workbench contracts.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 78 (Wrong-note card UX)
- `components/wrong-note-card.tsx`: restored readable Korean labels and feedback for wrong-attempt count, mastery status, personal memo, save state, retry-wrong-only CTA, and bookmark action; preserved user-scoped wrong-note and bookmark API payloads.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 79 (Learning goal input UX)
- `components/learning-settings-form.tsx`: exposed valid ranges for daily question and study-minute goals before submission and connected the hints with `aria-describedby`; preserved client/server validation, save feedback, and network error handling.
- Reviewed `components/course-enroll-action.tsx`; login return paths, duplicate enrollment handling, paused/completed states, loading, retry, and refresh synchronization were already coherent, so no redundant changes were made.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 80 (Global header accessibility)
- `components/site-header.tsx`: replaced the corrupted brand link screen-reader label with a clear `SECURIUM ?덉쑝濡??대룞` label while preserving brand metadata, authenticated user loading, and header controls.
- Reviewed `components/site-nav.tsx`; active-route handling, signed-in/public menu separation, and safe auth return-path routing were already coherent, so no redundant changes were made.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 81 (About page rendering cleanup)
- `app/about/page.tsx`: removed a literal `\\n` artifact from the breadcrumb/intro JSX and normalized the page structure without changing the service principles, AI disclaimer, or course CTA.
- Attempted a narrow patch to the larger specialized action component but skipped speculative edits because its stored encoding did not match the displayed text; no unverified component rewrite was made.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 82 (Shared state accessibility)
- `components/state-ui.tsx`: added level-2 heading semantics to shared empty and error state titles without changing visual markup, CTA behavior, retry behavior, or default messages.
- Reviewed `app/privacy/page.tsx`, `app/terms/page.tsx`, and `app/legal/page.tsx`; legacy aliases, safe query forwarding, legal links, and auth return paths were already coherent, so no redundant changes were made.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 83 (Progress bar accessibility)
- `components/progress-bar.tsx`: added `aria-valuetext` so assistive technology announces progress as a completion percentage while preserving clamping, visual width, and existing progressbar semantics.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 84 (Design-system ARIA labels)
- `components/design-system-primitives.tsx`: normalized shared ARIA labels for breadcrumbs (`?꾩옱 ?꾩튂`), drawer surfaces (`?곸꽭 ?⑤꼸`), inspector panels (`?좏깮 ??ぉ ?곸꽭 ?뺣낫`), and inspector status badges (`?곹깭`) without changing button/link behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 85 (Lesson content reference UX)
- `components/safe-lesson-content.tsx`: normalized image attachment and invalid-reference messages inside safe Markdown lesson content rendering; preserved HTTPS/relative URL allowlist, sanitized content, code blocks, headings, lists, quotes, tables, and mobile table wrapping.
- Validation: lint, typecheck, test:unit (312/312), and build (63 routes) all passed.

## BATCH 86 (Lesson completion action UX)
- `components/lesson-actions.tsx`: restored readable status, reading-position, completion, save, and duplicate-request feedback while preserving scroll tracking, auto-start, completion policy, and `/api/lessons/progress` behavior.
- `components/course-lesson-actions.tsx`: restored readable status, progress, completion, save, and network-error feedback while preserving time tracking, scroll thresholds, auto-start, and `/api/course-lessons/progress` behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 87 (Audio player recovery and UX)
- `components/audio-learning-player.tsx`: repaired JSX damage from the previous label substitution and normalized key audio labels for title, playback controls, completion state, speed, progress, and transcript navigation while preserving audio/browser-voice playback, 15-second progress persistence, seeking, completion threshold, and transcript segment behavior.
- The prior intermediate syntax failure is resolved; no broken state remains after validation.
- Validation: typecheck, lint, test:unit (312/312), and build (63 routes) all passed.

## BATCH 88 (Mock exam start UX)
- `app/mock-exams/[mockExamId]/page.tsx`: restored readable labels for question count, time limit, passing score, remaining attempts, exam restrictions, and exhausted-attempt guidance while preserving authenticated access, attempt limits, and `MockExamStart` behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 89 (Mock exam catalog UX)
- `app/mock-exams/page.tsx`: restored readable labels for exam preparation, question count, time limit, best score, remaining attempts, and empty states; aligned exhausted-attempt CTA with the start page and preserved authenticated exam listing.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 90 (Course analytics actionability)
- `app/analytics/[courseId]/page.tsx`: restored readable Korean copy for course analytics, accuracy and progress metrics, weak-topic recommendations, next-action flow, breakdown labels, and metric units; preserved course authorization, statistics calculation, topic-scoped practice links, and review CTA.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 91 (Bookmark reuse UX)
- `app/bookmarks/page.tsx`: restored readable labels for saved-question scope, saved count, learning guidance, difficulty/status badges, retry CTA, and empty state; preserved user-scoped bookmark lookup and question-specific practice links.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 92 (Audio player final recovery)
- `components/audio-learning-player.tsx`: repaired JSX damage from the previous automated label replacement, restored audio event handlers and speed option markup, and normalized key playback/progress/transcript labels while preserving audio/browser-voice playback, 15-second progress persistence, seeking, completion threshold, and transcript segment behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 93 (My courses CTA clarity)
- `app/my-courses/page.tsx`: removed duplicate review actions for completed enrollments, made active/paused courses offer a clear 10-question practice action, exposed numeric progress alongside the progress bar, and routed cancelled courses to a public course revisit path while preserving enrollment status updates and user-scoped data.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed.

## BATCH 94 (Mock exam UX recovery)
- `app/mock-exams/page.tsx`: restored readable Korean copy across the exam catalog, added metadata, clarified exam metrics and remaining attempts, and improved the empty state without changing user-scoped exam availability or attempt limits.
- `app/mock-exams/[mockExamId]/page.tsx`: restored the exam briefing, metrics, no-answer-disclosure notice, exhausted-attempt guidance, and metadata while preserving the existing exam lookup and `MockExamStart` flow.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 95 (Mock exam session UX recovery)
- `components/mock-exam-start.tsx`: restored readable start, loading, network, and failure feedback while preserving duplicate-start protection and attempt redirect behavior.
- `components/mock-exam-session.tsx`: restored question navigation, timer, auto-save, submit confirmation, answer state, grading feedback, and subject/topic analysis labels while preserving the existing timer, server persistence, result availability, and scoring flow.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 96 (Non-automatic question submission)
- `components/practice-session.tsx`: fixed a core learning-flow mismatch where questions without automatic grading displayed a save-only notice but disabled submission. These questions now accept and persist answers, show `답안 저장`, and retain the existing grading, AI explanation, bookmarking, reporting, and navigation behavior for automatically graded questions.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 97 (Wrong-note filter integrity)
- `app/wrong-notes/page.tsx`: validated the course -> subject -> topic filter hierarchy before querying wrong notes, preventing URL-provided cross-course combinations from producing misleading filter state or results while preserving difficulty, mastery, repeated-error filters, and review actions.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 98 (Practice bookmark state clarity)
- `components/practice-session.tsx`: tracks the bookmark response per question and changes the action label between `북마크 저장` and `북마크 삭제`, while preserving the existing bookmark API, feedback, question navigation, answer submission, and AI explanation flow.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 99 (Subject learning continuation)
- `app/learn/[courseSlug]/subjects/[subjectId]/page.tsx`: replaced the always-first-lesson CTA with state-aware navigation to the next incomplete lesson, distinguishing `이어서 학습`, `첫 레슨 시작`, and `레슨 다시 보기`, and surfaced subject theory progress in the page hero.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 100 (Review route metadata)
- `app/reviews/page.tsx`: added explicit title and description metadata for the daily review workflow.
- `app/wrong-notes/page.tsx`: added explicit title and description metadata for the wrong-note workflow.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 101 (Learning route metadata)
- `app/practice/[courseSlug]/page.tsx`: added explicit metadata for the course-specific practice route.
- `app/learn/[courseSlug]/subjects/[subjectId]/page.tsx`: added explicit metadata for subject theory and lesson learning.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 102 (Content version trust UX)
- `app/content-versions/[revisionId]/page.tsx`: restored the previous-version warning, snapshot heading, boolean/null display values, and route metadata while preserving authenticated access, public revision lookup, revision type labels, and latest-version behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 103 (Audio fallback copy cleanup)
- `components/audio-learning-player.tsx`: restored remaining browser-voice availability, playback-speed, progress-save failure, completion-save, transcript-empty, and audio-file fallback messages without changing playback, progress persistence, or transcript logic.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 104 (Shared content version UX)
- `components/content-version-info.tsx`: restored missing-version, content-date, version, review-date, outdated/latest status, change-summary, and detail-link copy while preserving compact rendering, public-copy sanitization, and revision linking.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 105 (Level progression feedback)
- `components/level-actions.tsx`: restored readable level start, processing, error, pass/fail, score, and next-level-unlock feedback while preserving the existing `/api/levels` actions, duplicate-request guard, reload-after-start behavior, and status-based action visibility.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 106 (Level route metadata)
- `app/learn/[courseSlug]/levels/[levelId]/page.tsx`: added explicit metadata describing the stage-based practice and progression route.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 107 (Practical learning route metadata)
- `app/practical/page.tsx`: added metadata for the security practical-learning hub.
- `app/practical/[courseSlug]/page.tsx`: added metadata for course-specific practical scenarios and analysis learning.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 108 (Course learning overview metadata)
- `app/learn/[courseSlug]/page.tsx`: added explicit metadata for the course learning overview, describing curriculum, progress, and lesson continuation.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 109 (Lecture route metadata)
- `app/lectures/[courseSlug]/page.tsx`: added metadata for the course lecture catalog, including search and continued viewing context.
- `app/lectures/[courseSlug]/[lectureId]/page.tsx`: added metadata for lecture playback with progress, bookmark, and note context.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 110 (Account drawer role clarity)
- `components/account-drawer.tsx`: translated internal role codes into learner-facing labels and added a safe `S` avatar fallback when the display name is empty, while preserving focus trapping, logout flow, role access, and error feedback.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 111 (Specialized learning action copy)
- `components/specialized-actions.tsx`: restored user-facing copy for specialized bookmarks, advisory written grading, risk calculation, and risk-register practice, including labels, placeholders, result fields, success/failure messages, and action buttons while preserving all four existing API flows and result rendering.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 112 (Specialized AI review UX recovery)
- `components/specialized-ai-review.tsx`: restored AI review generation controls, advisory disclaimer, provider/status metadata, and type-specific result labels for written answers, risk scenarios, privacy assessments, and secure-code explanations while preserving the `/api/ai/specialized` request contract and evidence rendering.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 113 (Privacy assessment workbench UX)
- `components/privacy-assessment-workbench.tsx`: restored target-decision, assessment checklist, identified-risk, improvement-plan, scoring, and saved-answer copy, and added safe network-error handling around submission while preserving the privacy assessment API, saved answer state, and specialized AI review handoff.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 114 (Secure code analysis workbench UX)
- `components/code-analysis-workbench.tsx`: restored vulnerable-line selection, true/false-positive assessment, remediation input, call-flow context, grading result, and vulnerable-versus-secure code comparison copy, and added network-error handling around submission while preserving idempotent grading and specialized AI review handoff.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 115 (Command palette accessibility and copy)
- `components/command-palette.tsx`: restored learner/operator command labels, scopes, descriptions, search and empty-state copy, and keyboard help; added trigger-focus restoration on close and safe active-index rendering when filtering changes. Preserved route navigation and Ctrl/Cmd+K behavior.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 116 (Curriculum path tree UX recovery)
- `components/learn-curriculum-path-tree.tsx`: restored curriculum summary, expand/collapse controls, selected-node state, lesson/question progress labels, theory/practice actions, source metadata, and next-action guidance while preserving tree expansion, selection, depth rendering, and course-scoped practice links.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 117 (My learning route metadata)
- `app/my-learning/page.tsx`: added explicit metadata for the personalized learning hub covering progress, recent activity, and recommendations.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.
## BATCH 118 (Specialized learning route metadata)
- `app/specialized/[courseSlug]/page.tsx`: added metadata for the specialized security-learning catalog.
- `app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx`: added metadata for specialized content detail routes.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.
## BATCH 119 (Learning and practical detail route metadata)
- `app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx`: added metadata for core course lesson pages.
- `app/learn/[courseSlug]/lessons/[lessonId]/page.tsx`: added metadata for lesson reader pages with audio and progress.
- `app/mock-exams/attempts/[attemptId]/page.tsx`: added noindex metadata for private mock-exam attempts.
- `app/practical/[courseSlug]/code/[sampleId]/page.tsx`: added metadata for secure code-analysis practice.
- `app/practical/[courseSlug]/privacy/[scenarioId]/page.tsx`: added metadata for privacy-impact assessment practice.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.
## BATCH 120 (Bookmarks UX recovery)
- `app/bookmarks/page.tsx`: rewrote corrupted user-facing copy into clear Korean labels and guidance.
- Added page metadata for saved-question navigation and preserved the existing bookmark repository, course practice links, empty state, and replay CTA.
- Validation: lint, test:unit (312/312), sequential typecheck, and build (63 routes) all passed with no lint warnings.

## BATCH 121 (SECURIUM end-to-end UX priority pass)
- Reworked `app/page.tsx` around one primary CTA, explicit knowledge-linked learning flow, goal-based course comparison, dashboard preview, and a final product-value CTA.
- Reworked `app/dashboard/page.tsx` so the first viewport prioritizes the next action, today plan, resume-learning cards, review count, and resilient empty states.
- Simplified `lib/ui-nav.ts` by keeping legal links out of the primary learning navigation.
- Added `components/evidence-card.tsx` and integrated it into practice grading to separate official reviewed explanations from AI reference explanations.
- Replaced corrupted version metadata copy in `components/content-version-info.tsx` and added mobile sticky action/reduced-motion styling.
- Validation: `npm run lint`, `npm run typecheck`, targeted landing tests, and `npm run build` passed. The full unit suite is expected to pass after the restored landing contract is included; browser E2E remains blocked by the local Vinext/Vite dev-server readiness hang.
- Next: run browser visual QA once the local dev server is available; continue copy recovery on remaining review/admin routes and audit modal focus traps.

## BATCH 122 (Review and question workflow UX)
- `app/reviews/page.tsx`: restored readable Korean copy and reframed the page around due reviews, priority items, course-level actions, and useful empty states.
- `components/question-workflow-actions.tsx`: restored workflow labels, added accessible comment labeling/helper text, loading lock, duplicate-action prevention, and recoverable network errors.
- Validation: lint, typecheck, focused learning/workflow tests, and build (63 routes) passed.

## BATCH 123 (Admin question bank UX)
- `app/admin/questions/page.tsx`: replaced corrupted operator-facing copy with clear Korean labels for status, type, difficulty, filters, metrics, empty state, inspector, and actions.
- Preserved existing server-side filters and question repository contracts while adding explicit accessible labels for search controls.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: continue the same copy/state recovery pass on admin shared-content, review, and curriculum screens; browser QA remains unavailable in this environment.

## BATCH 124 (Admin review queue UX)
- `app/admin/reviews/page.tsx`: restored readable Korean copy and made review queue state, oldest-first intent, review criteria, latest-item inspector, and empty state explicit.
- Preserved reviewer authorization and existing `listAdminQuestions` queries.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: apply the same recovery to `app/admin/shared-content/page.tsx` and its manager states.

## BATCH 125 (Admin shared content workspace)
- `app/admin/shared-content/page.tsx`: restored readable Korean copy for shared content, course lessons, curriculum links, usage counts, inspector metadata, and empty/selection guidance.
- Preserved course/content/curriculum repository queries and `AdminSharedContentManager` contracts.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: recover the remaining copy inside `components/admin-shared-content-manager.tsx`, especially content editor labels and save/error states.

## BATCH 126 (Shared content editor recovery)
- `components/admin-shared-content-manager.tsx`: rebuilt the editor workspace with readable Korean labels and preserved the existing API operations for shared content, CourseLesson links, and course-specific extensions.
- Added clear content/lesson/extension sections, accessible labels, status translations, search/filter list, usage list, empty states, and recoverable save/network errors.
- Validation: lint, typecheck, and build (63 routes) passed.
- Note: the original file had encoding damage that made incremental patching unsafe; the replacement preserves the data contracts and core editing fields while removing the malformed JSX.

## BATCH 127 (Curriculum taxonomy labels)
- `components/admin-curriculum-manager.tsx`: restored core taxonomy labels for content types, curriculum node types, and official levels so tree operations are understandable to operators.
- Preserved curriculum tree/node endpoints and existing manager behavior.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: recover the remaining visible copy in the curriculum page and manager status/error messages.

## BATCH 128 (Curriculum operations readiness UX)
- `app/admin/curriculum/page.tsx`: clarified the primary curriculum heading and inspector with tree status, operational readiness, node/content gaps, and next actions.
- `components/admin-curriculum-manager.tsx`: restored taxonomy labels for curriculum content and official level types.
- Preserved coverage calculations, read-only readiness checks, tree/node management, and shared-content navigation.
- Validation: lint, typecheck, and build (63 routes) passed.
- Browser QA remains unavailable; remaining lower-priority curriculum copy can be recovered incrementally.

## BATCH 129 (My learning hub UX)
- `app/my-learning/page.tsx`: rebuilt the learner hub around current courses, next actions, progress summary, practical learning, AI tutor, and useful empty states.
- Restored metadata, status labels, recent-learning fallback, and primary resume/review CTAs while preserving enrollment data and routes.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: apply the same copy recovery to the wrong-notes screen and its filter summary.

## BATCH 130 (Wrong notes UX)
- `app/wrong-notes/page.tsx`: rebuilt the wrong-notes screen with clear course/subject/topic/difficulty/status filters, repeated-wrong-note summary, unresolved count, highest-error signal, and replay CTA.
- Preserved scoped repository queries, query parameters, course practice links, and `WrongNoteCard` rendering.
- Validation: lint, typecheck, and build (63 routes) passed.
- Next: inspect remaining learner analytics and practical-learning screens for copy and state consistency.
## BATCH 131 (Course analytics UX)
- `app/analytics/[courseId]/page.tsx`: rebuilt course analytics copy/layout around overall accuracy, weakest-topic recommendation, direct practice/review actions, breakdowns and metrics.
- Preserved course-scoped statistics, curriculum mappings, and practice links.
- Validation: lint, typecheck, build (63 routes) passed.
- Next: inspect practical-learning and specialized workbench screens for remaining copy/state gaps.
## BATCH 132 (Practical learning UX)
- `app/practical/[courseSlug]/page.tsx`: rebuilt the practical learning hub with clear code-review and privacy-assessment paths, learning-only disclaimer, and actionable empty state.
- `app/practical/[courseSlug]/code/[sampleId]/page.tsx`: clarified the static-analysis purpose, safe execution boundary, and return navigation.
- `components/privacy-assessment-workbench.tsx`: clarified answer sections, placeholders, submission/loading/error states, and reference-score separation from official assessment.
- `components/code-analysis-workbench.tsx`: clarified line selection, weakness/CWE mapping, evidence fields, reference grading, code comparison, and network recovery messaging; preserved API payloads and AI review integration.
- Validation: lint, typecheck, build (63 routes) passed.
- Next: clean specialized-course hub/detail copy and evidence/version hierarchy.
## BATCH 133 (Specialized content UX)
- `app/specialized/[courseSlug]/page.tsx`: rebuilt the specialized learning hub with distinct sections for standards, defect cases, legal articles, written practice, and risk scenarios.
- `app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx`: clarified official-content trust signals, reference dates, version history, related resources, and AI review separation.
- Preserved enrollment guards, content repositories, bookmarks, revisions, related-content links, and risk/written-practice integrations.
- Validation: lint, typecheck, build (63 routes) passed.
- Next: review shared visual tokens and mobile layout behavior across practical/specialized cards and detail panels.
## BATCH 134 (Shared responsive and status polish)
- `app/globals.css`: added shared trust-line, overflow, assessment checklist, choice-row, touch-target, code-workbench, card, and mobile layout rules using existing design tokens.
- Mobile practical/specialized layouts now preserve readable content order, full-width controls, safe code scrolling, and compact panel spacing.
- Restored the `TREE_STATUS` contract marker in `app/admin/curriculum/page.tsx` while preserving activation-readiness behavior.
- Validation: full unit suite 312/312 passed, lint passed, typecheck passed, build passed with 63 routes.
- Browser QA remains unavailable because the in-app browser reports no browser session; visual validation is limited to source/CSS review and production build.
- Next: continue with shared navigation/header and remaining accessibility copy/state audit.
## BATCH 135 (Global navigation accessibility)
- `app/layout.tsx`: added a keyboard-accessible skip link targeting a focusable main-content wrapper.
- `components/site-header.tsx`: replaced the corrupted brand link accessible name with `SECURIUM 홈으로 이동`.
- `app/globals.css`: added visible, high-contrast skip-link focus styling.
- Existing mobile drawer focus trap, Escape handling, backdrop close, active navigation state, and 44px touch targets were preserved.
- Validation: focused auth/landing/mobile tests 16/16 passed, lint passed, typecheck passed, build passed with 63 routes.
- Browser QA remains unavailable because no in-app browser session is available.
- Next: audit remaining form validation and error recovery states across auth, profile, and admin flows.
## BATCH 136 (Auth and settings form UX)
- `components/login-panel.tsx`: connected field errors with `aria-describedby` and gave password visibility controls explicit accessible labels.
- `components/signup-panel.tsx`: connected display-name, email, and password errors to their inputs and clarified password toggle labels.
- `components/learning-settings-form.tsx`: added client-side integer/range validation, field-level error messaging, stable input IDs, and preserved duplicate-submit protection and save feedback.
- Validation: focused auth/runtime tests 25/25 passed, lint passed, typecheck passed, build passed with 63 routes.
- Remaining: admin practical form copy is still partially corrupted and should be cleaned in a dedicated compatibility-preserving pass.
## BATCH 137 (Admin practical form UX)
- `components/admin-practical-forms.tsx`: replaced corrupted visible labels and controls across seven practical entities while preserving every API entity and field name.
- Added shared admin form header/description, required-field indicators, useful placeholders, comma-separated input guidance, disabled saving state, network/API error recovery, and explicit post-save feedback.
- `app/globals.css`: added layout rules for the new admin form grid, heading, checkbox controls, required markers, and mobile single-column behavior.
- Validation: full unit suite 312/312 passed, lint passed, typecheck passed, build passed with 63 routes.
- Next: perform a final repository-wide mojibake/state scan and update the final UX summary.
## BATCH 138 (Final UX copy/state scan)
- Repository-wide user-facing copy scan completed across app/components/lib; no remaining high-confidence mojibake markers were found in source text.
- Replaced remaining admin-facing English empty/status labels in audit logs, ontology, analytics, content revisions, and AI explainability with consistent Korean status language while preserving internal values and filters.
- Validation: full unit suite 312/312 passed, lint passed, typecheck passed, build passed with 63 routes.
- Browser QA remains unavailable because no in-app browser session is available; final verification is source, accessibility, test, and production-build based.
- Remaining lower-priority work: visual screenshot comparison and any copy that depends on live authenticated data.
## BATCH 139 (Final regression verification)
- Ran `git diff --check`; fixed a trailing blank-line issue in `components/design-system-primitives.tsx`. Remaining output is only Git line-ending normalization warnings.
- `npm run db:check` passed.
- `npm run db:postgres:validate` passed: 8 migration files, 78 tables, checksum `3af2f404c6dd1848`.
- Full unit suite, lint, typecheck, and production build remain green from the preceding final scan.
- No additional functional regression found.
## BATCH 140 (React quality pass)
- Applied React best-practices review to the changed TSX surfaces.
- `components/admin-practical-forms.tsx`: delayed reload by 350ms after successful save so the success feedback is visible before the refreshed list appears.
- Validation: targeted UX/domain tests 15/15 passed, lint passed, typecheck passed, build passed with 63 routes.
- No further high-confidence React, accessibility, hook, or API-contract issue found in the reviewed surfaces.
## BATCH 141 (Sites publishing check)
- Read and applied the Sites hosting workflow.
- Existing `.openai/hosting.json` contains project ID `appgprj_6a6699e405b081918cc2408db3e96856`.
- Sites `get_site` returned `project_not_found`; deployment was not attempted and hosting metadata was not changed.
- Code remains locally validated: full unit suite 312/312, lint, typecheck, build, DB check, PostgreSQL migration validation, and diff check passed.
- Next external action requires a valid Sites project ID or explicit instruction to provision a new site and replace the stale hosting metadata.
## BATCH 142 (Hosting identity audit)
- Searched repository, Git history, project analysis, and `.openai/hosting.json` for an alternate Sites project ID or deployment URL.
- No alternate verified identifier exists; the only persisted ID is `appgprj_6a6699e405b081918cc2408db3e96856`, which Sites reports as `project_not_found`.
- Do not replace metadata or create a duplicate site without user direction; deployment remains externally blocked.
## BATCH 143 (E2E execution check)
- Re-ran `npm run test:e2e` with a bounded timeout; it again stalled during Vinext/Vite test-server readiness and timed out after 74 seconds.
- Cleaned only the spawned E2E/test-server processes; unrelated Codex and MCP processes were preserved.
- E2E remains externally/runtime blocked; unit, build, typecheck, lint, DB, migration, and diff checks remain the available passing validation set.
## BATCH 144 (Vercel Production deployment)
- Confirmed the official Production provider is the existing Vercel project `securium`, with GitHub remote `https://github.com/namola78-svg/securium` and `main` as the synchronized branch.
- OpenAI Sites was not used as a deployment condition. `.openai/hosting.json` remains only as repository metadata from the prior workflow; no application source, database schema, UI, or feature code was changed for deployment.
- `npm run test:unit` passed 312/312, lint passed, typecheck passed, and `npm run build` passed with 63 routes.
- Pushed commit `bf2200f14b5655919a50c8fea4fd567442c1e2ef` to GitHub `main`; Vercel Git Integration produced Production deployment `dpl_DCCWaN1bmQSTTvgN61mfUyApkZ54` with Ready status and the `https://securium.vercel.app` alias.
- HTTP smoke checks passed for `/`, `/courses`, `/login`, `/api/health`, and `/api/auth/session`; health reported database `ok`.
- Browser console/runtime inspection remains unavailable because no browser session is available.
## BATCH 145 (Landing page production refinement)
- Reworked `app/page.tsx` landing markup while preserving auth redirect, public catalog lookup, CTA routes, metadata, and existing landing test contracts.
- Refined Hero hierarchy and product preview: compact problem/result/evidence/review story, explicit AI-reference disclaimer, and no invented social proof.
- Corrected the five-step learning chain layout and made the final review outcome visually distinct across desktop, tablet, and mobile.
- Marked dashboard metrics as example UI rather than real learner data, strengthened next-action hierarchy, and improved course card status/metadata/CTA consistency using published course data only.
- Added responsive refinements for 320–1440px ranges, touch-sized actions, mobile stacking, focus-visible preservation, and reduced-motion transition handling in `app/globals.css`.
- Validation: `npm run test:unit` 312/312, lint, typecheck, production build (63 routes), and `git diff --check` passed.
- Browser screenshot/console inspection remains unavailable because no browser session is available. Changes are local and not pushed or deployed; no backend, DB, auth, API, or OpenAI Sites deployment configuration was changed.
## BATCH 146 (Header navigation duplicate rendering fix)
- Root cause: authenticated utility links were rendered unconditionally inside the desktop-visible `.main-nav` for the mobile drawer, while `header-actions` also rendered the first three utility links on desktop. This caused duplicate utility labels after the primary navigation.
- `SiteNav` is not mounted anywhere; `app/layout.tsx` mounts only `SiteHeader`, which mounts one `HeaderControls` instance.
- Wrapped the mobile-only utility map in `.mobile-nav-utility`, hidden by default and exposed with `display: contents` only inside the existing `max-width: 960px` mobile drawer breakpoint.
- Desktop routing, active state, authentication conditions, primary navigation, desktop utility links, mobile drawer, and mobile bottom navigation were otherwise preserved.
- Static verification: one `SiteHeader` mount, no `SiteNav` mount, utility render sites are limited to the mobile drawer and desktop header-actions paths; `북마크`, `오답노트`, `복습`, and `학습 분석` each remain single entries in `lib/ui-nav.ts`.
- Validation: unit 312/312, lint, typecheck, production build (63 routes), and `git diff --check` passed. No browser session was available for live screenshot inspection.
## BATCH 147 (Header fix Vercel deployment)
- Pushed commit `b2b8df9f9877982d4a8140f14d4c936c48a1b1a7` to GitHub `main`.
- Existing Vercel project `securium` deployed the change successfully as `dpl_39o4npFKCtXZPhxDqtDg7VDpTnct` with `Ready` status.
- `https://securium.vercel.app/`, `/api/health`, and `/api/auth/session` returned HTTP 200 after deployment.
- OpenAI Sites was not used. No backend, DB, auth, API, or production environment configuration was changed.
