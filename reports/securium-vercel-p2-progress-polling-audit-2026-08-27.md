# SECURIUM VERCEL P2 Progress / Media Recurring Request Amplification Audit

Snapshot date: 2026-08-27  
Authorization: `P2_PROGRESS_POLLING_READ_ONLY_AUDIT`

## Status and scope

Final status: `SECURIUM_VERCEL_P2_PROGRESS_POLLING_AUDIT_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION`

This is a source audit from fresh `origin/main`. No application code, timer, media event handling, API route, repository, database, Vercel setting, governance artifact, or content was changed. The only file written is this report.

Preconditions:

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-vercel-progress-p2`
- Branch: `perf/vercel-progress-polling-p2-audit`
- HEAD: `2a628ff4e8cc6a6c249218874cc72563faadf55b`
- Fresh `origin/main`: `2a628ff4e8cc6a6c249218874cc72563faadf55b`
- Main match: YES
- P0 authority present: YES (`2a628ff4e8cc6a6c249218874cc72563faadf55b`)
- P1 closed: YES
- Working tree clean before audit: YES
- `package.json` changed: NO
- Lockfile changed: NO (SHA-256 unchanged: `6C8544F142DADB3462B21FED441963176EC80DB661CC19922A4703BD23D86FE0`)
- Production database connection: NO

## Exact recurring writer inventory

Exact recurring mechanism count: 2. Exact recurring progress writer count: 2. Unrelated `setTimeout`/`setInterval` uses (focus timers, admin timeouts, mock-exam countdown, browser speech timer, tests) are not recurring progress/media request writers.

| Writer | Source and caller | Classification | Media | Endpoint and method | Configured interval | Steady calls/hour |
|---|---|---|---|---|---:|---:|
| W1 | `components/audio-learning-player.tsx`, `AudioLearningItem` | `PROGRESS_WRITE` | Audio file or browser speech | `/api/audio/progress`, POST | 15,000 ms | 240 |
| W2 | `components/lecture-player.tsx`, `LecturePlayer` | `PROGRESS_WRITE` | YouTube/Vimeo iframe lecture | `/api/lectures/progress`, POST | 15,000 ms | 240 |

Both use a trailing `setTimeout`, not a free-running `setInterval`: playback events update a desired position, and the first event sends immediately because `lastSavedAtRef` starts at zero; subsequent saves are gated at 15,000 ms. Therefore 240/hour is the steady-state checkpoint rate. A short session can have one extra first-event request and an end/pause final-save request at timing boundaries.

There is no recurring progress read. The GET handlers for audio and lecture progress are load/detail APIs and are not called by the recurring writers.

## Call graph and payloads

### W1 audio

`AudioLearningItem` → `POST /api/audio/progress` → `assertSameOrigin` → `requireApiUser` → per-user rate limit (60/min) → `audioProgressSchema` → `updateAudioProgress` → `requireAccessibleAudio` → `SELECT audio_contents` joined to lesson, learning unit, course, enrollment → `SELECT audio_progress` current row → conditional `SELECT` latest published content revision when not already complete → one `INSERT ... ON CONFLICT DO UPDATE` on `audio_progress`.

Payload: `{ audioContentId, currentPositionSeconds, complete }`; position is rounded and bounded by the server to the audio duration. Approximate JSON size is 70–140 bytes for ordinary UUID-like IDs and small numeric fields; exact size varies with IDs.

Response: `{ result: { audioContentId, currentPositionSeconds, completed, completedAt, idempotentReplay } }` on success. Auth is required; same-origin and enrollment/published/active ownership checks apply.

### W2 lecture

`LecturePlayer` → `POST /api/lectures/progress` → `assertSameOrigin` → `requireApiUser` → per-user rate limit (60/min) → `lectureProgressSchema` → `updateLectureProgress` → `requireAccessibleLecture` → `SELECT lectures`/course/enrollment access data → `SELECT lecture_progress` current row → conditional `SELECT` latest published lecture revision when not already complete → one `INSERT ... ON CONFLICT DO UPDATE` on `lecture_progress`.

Payload: `{ lectureId, currentPositionSeconds, complete }`; position is rounded and bounded by lecture duration. Approximate JSON size is 65–135 bytes for ordinary UUID-like IDs. Response is `{ result: { lectureId, currentPositionSeconds, completed, completedAt, idempotentReplay } }`. Auth, same-origin, published/access, and enrollment checks apply.

Neither recurring endpoint writes `learning_activities`, `user_progress`, `user_course_enrollments`, Evidence, `CompetencyEvidence`, `user_skill_state`, badges, or analytics rows. Those are completion/event paths elsewhere, not ordinary audio/lecture progress ticks.

## Timer lifecycle matrix

| Condition | W1 audio | W2 lecture |
|---|---|---|
| Starts on component mount | NO; mount only initializes capability/position | NO; mount only installs `message` listener |
| Starts after authentication | Authentication gates persistence; no separate timer start | Same |
| Starts after lesson/media load | NO; playback event is required | NO; accepted iframe playback message is required |
| Starts after first playback event | YES (`timeupdate` or browser-speech 1-second tick) | YES (accepted provider message) |
| Active playing | Checkpoint save every 15,000 ms after first event | Same |
| Pause | User pause button forces one save; native audio `onPause` only changes UI and does not itself force/clear a pending timer | Provider pause is subscribed for Vimeo but not acted upon; YouTube pause state is not acted upon |
| Paused media writes continue | NO recurring stream, but a previously scheduled trailing timeout can fire once; explicit pause button also sends one immediate save | NO recurring stream after provider stops time messages, but a pending timeout can fire once |
| Hidden tab | NO Page Visibility code; if media/provider events continue, writes continue | Same |
| Window blurred | No code handling; behavior follows media/provider events | Same |
| Media ended | Immediate forced completion save; pending timeout cleared | Immediate forced completion save; pending timeout cleared; YouTube `infoDelivery` can expose both a position and ended state in one message, so a boundary duplicate is possible if the position branch already fires |
| Route change/component unmount | Timeout/listener cleanup present | Timeout/message-listener cleanup present |
| Network offline | Fetch attempts continue when playback events call the queue; no offline queue/retry | Same |
| Logout/auth failure | No timer stop/redirect/retry in these components; unauthenticated prop blocks W2 queue, but an existing W1 request can fail and playback events can continue | Same, with `authenticated` checked before enqueue |
| Lesson/media changes | Effect cleanup is keyed to item/lecture ID; old timeout is cleared | Same |

Hidden-tab writes continue: `CONDITIONAL` in the strict code-controlled sense. There is no visibility check, so if the media source continues producing accepted playback events, the writer continues; browser timer throttling is not treated as a correctness or cost control. Paused writes continue: `CONDITIONAL`, limited to a pending timeout or explicit final save, not a continuing cadence. Writes after end: `CONDITIONAL`; the end handler forces a final save, but the exact provider message boundary can produce a duplicate W2 call. Final progress is normally attempted before cleanup; unload reliability is not guaranteed because there is no unload/pagehide persistence path.

Timer leak risk: `LOW`. Both components clear their pending timeout; W2 removes its `message` listener; W1 also clears its speech timer and speech synthesis. The remaining risk is in-flight fetches and a pending callback already executing, not an unbounded timer/listener leak.

Duplicate writer risk for the same media item: `NO` by current route/component composition. W1 and W2 target different media tables/items and are not two writers for the same item. Multiple audio items can be rendered from the lesson `items` array, so concurrent audio writers per page are data-dependent. Maximum concurrent writer count per page: `UNKNOWN` statically; it equals the number of mounted audio items plus at most one lecture player on its lecture detail route, subject to route composition.

## Database operation model

For one ordinary recurring POST, excluding auth/rate-limit implementation internals:

| Writer | SELECT | INSERT | UPDATE | UPSERT statement | Other |
|---|---:|---:|---:|---:|---:|
| W1 audio, incomplete | 3 | 0 | 0 | 1 | 0 |
| W1 audio, already complete | 2 | 0 | 0 | 1 | 0 |
| W2 lecture, incomplete | 3 | 0 | 0 | 1 | 0 |
| W2 lecture, already complete | 2 | 0 | 0 | 1 | 0 |

The upsert may physically take the insert or conflict-update branch, but it is one write statement. On every normal tick it updates persisted position, last-played timestamp, and updated timestamp where present (`audio_progress.updated_at`; lecture uses `last_played_at`). Repeating the same position is semantically idempotent for identity/completion, but is not write-suppressed: timestamps still change and the database is still touched. No unchanged client request suppression or unchanged server write suppression exists.

Canonical progress is latest-state snapshot storage: `audio_progress` and `lecture_progress` hold one row per user/media unique key. It is not an event log. Completion is sticky (`current.completed || input.complete`); completion timestamps are preserved on replay. Position itself is not monotonic in the media writers and can move backward after seeking. Ordinary ticks do not create duplicate learning activities. Completion side effects are not part of these two repositories.

Security/data trust: same-origin, authenticated-user, schema validation, published/active/access/enrollment ownership checks, server-side duration bounds, and sticky completion are preserved. Client-forged positions are bounded/validated server-side. No optimization should weaken these checks. CSRF protection is same-origin based; `sendBeacon` would need equivalent same-origin/auth semantics and route compatibility.

## Scaling and session models

Steady-state source rate: 4 calls/minute = 240 calls/hour per active writer. Tables below use the code-derived checkpoint count and exclude a possible first-event `+1` and final-save boundary duplicate.

| Active playback | Recurring HTTP requests | Route handler executions | DB reads | DB writes |
|---:|---:|---:|---:|---:|
| 10 min | 40 | 40 | 80–120 | 40 |
| 30 min | 120 | 120 | 240–360 | 120 |
| 60 min | 240 | 240 | 480–720 | 240 |

One active hour therefore contributes 240 recurring requests, 240 route invocations, 480–720 repository SELECT operations, and 240 upsert writes. A paused hour contributes 0 continuing cadence calls, with at most one already-queued call and/or one explicit pause final save. A hidden hour contributes 240 if provider/media events continue, otherwise fewer according to browser/provider behavior; code does not suppress it.

Paused-session model: 30 minutes active + 30 minutes paused = 120 recurring calls plus at most one pause/queued boundary call. Background-tab model: 30 minutes active + 30 minutes hidden = 240 calls if code continues receiving events (120 active + 120 hidden).

Daily code-neutral usage scenarios, assuming one active media writer and no boundary extras: 1 hour/day = 240 calls; 2 hours/day = 480; 4 hours/day = 960. These are not claims about actual user behavior.

| Aggregate active learner-hours | Calls |
|---:|---:|
| 100 | 24,000 |
| 1,000 | 240,000 |
| 10,000 | 2,400,000 |

3.02M invocations would require approximately `3,020,000 / 240 = 12,583.33` active media learner-hours, or about 86.69 continuously active equivalent learners over six 24-hour days. Progress polling alone is therefore numerically `HIGH` plausibility as a scalable contributor, but it is not proven as the historical root cause without direct Vercel telemetry and traffic attribution.

## Remediation comparison

- Option A, longer interval: lowers active-playback requests approximately in inverse proportion to the interval, but increases crash/tab-close resume loss and progress-bar staleness. Low implementation complexity; exact acceptable interval is `UNKNOWN` from repository tests/docs.
- Option B, dirty-state suppression: currently feasible with client last-successful-payload state. It suppresses repeated identical positions/completion states, but during active playback positions change, so the largest benefit is paused/end/provider duplicate suppression. Low-to-medium complexity.
- Option C, play-state-aware timer: safest bounded reduction for paused media. Start/checkpoint only while actually playing; stop on pause/end and perform a final save. Requires consistent provider play/pause state handling, especially YouTube messages. Medium complexity.
- Option D, visibility-aware timer: can stop hidden-tab checkpoints and optionally attempt a final save on visibility transition. Reduces hidden-tab amplification but risks losing the last hidden transition and does not guarantee page termination delivery. Medium complexity.
- Option E, event-based final save: pause and ended are useful; pagehide/visibilitychange are best-effort only. Unmount is not a reliable network-delivery guarantee. Appropriate as a supplement, not the sole persistence mechanism.
- Option F, batching: low value for one active media item because there is no natural multi-event consumer requirement; adds protocol complexity.
- Option G, `sendBeacon`: potentially useful for best-effort pagehide, but current POST handlers expect fetch-style request semantics, auth cookies/same-origin behavior, and JSON; beacon payload/auth/CSRF behavior must be verified before use. Not a substitute for normal checkpoints.
- Option H, debounce/throttle: debounce risks delaying all progress until inactivity/end; the current periodic checkpoint is a throttle/checkpoint hybrid and is the semantically appropriate base. Dirty-state gating should supplement it.
- Option I, server write suppression: would require a compare read (already present in these repositories) and conditional update logic. It can reduce physical writes for equal state, but still incurs route and SELECT cost and timestamp semantics would change. Medium complexity and lower request/function benefit.

Product requirement evidence: code and UI copy explicitly describe 15-second playback-position persistence and resume behavior; completion is threshold/end based and server validated. No repository test or product document defines a maximum acceptable unsaved-progress window. Resume precision is therefore evidenced qualitatively, but the maximum loss window is `UNKNOWN`.

## Recommended bounded design and future files

Recommended architecture: keep the 15,000 ms checkpoint cadence for actively playing media, add play-state-aware scheduling and client dirty-state suppression, force one final save on pause and ended, and preserve all existing server validation/auth/ownership logic. Treat hidden-tab/pagehide final saves as best-effort follow-up work only after browser delivery and auth semantics are tested. This is the smallest safe architecture because it reduces paused/duplicate amplification without choosing an unapproved larger loss window or redesigning evidence/event architecture.

Recommended split: one bounded P2 implementation PR, P2-A, because the two writers share the same checkpoint pattern and can be tested together. No P2-B split is required unless provider-specific lecture pause handling proves unsafe to land with audio in one change.

Exact likely future candidate files:

- `components/audio-learning-player.tsx` — `CLIENT_TIMER`, `CLIENT_MEDIA_EVENT`
- `components/lecture-player.tsx` — `CLIENT_TIMER`, `CLIENT_MEDIA_EVENT`
- `app/api/audio/progress/route.ts` — `API_ROUTE` (only if final-save transport requires route compatibility review)
- `app/api/lectures/progress/route.ts` — `API_ROUTE` (same constraint)
- `db/audio-repositories.ts` — `REPOSITORY` (only for optional server write suppression)
- `db/lecture-repositories.ts` — `REPOSITORY` (only for optional server write suppression)
- focused future client/lifecycle tests near the existing media tests — `TEST`
- `tests/audio-e2e.test.mjs` and existing lecture/rendered HTML coverage — `TEST`

The recommended client-only bounded change has theoretical active-playback counts unchanged: 40/120/240 for 10/30/60 minutes, because dirty positions change while playing. Its reduction is high for paused and duplicate boundary requests: the paused cadence is reduced to zero after the final save, and identical duplicate ticks are suppressed. Expected DB write reduction is `MEDIUM` overall and `HIGH` for paused/unchanged periods; expected function invocation effect is `MEDIUM` because each removed client request removes one route invocation, while active playback remains at the existing cadence. These are theoretical effects, not production savings claims.

## UX, security, data trust, and focused test plan

Risk ratings for the recommended design:

- Resume-position precision: LOW if the 15-second active checkpoint remains; pause final save improves it.
- Completion risk: LOW if ended/final completion remains forced and server threshold checks remain.
- Cross-device synchronization: LOW-to-MEDIUM; active checkpoint cadence remains unchanged, while hidden-tab suppression may delay updates until visible/final save.
- Tab-close loss: LOW-to-MEDIUM; unchanged for ordinary active checkpoints, but pagehide delivery is best effort and must not be treated as guaranteed.
- Security critical: preserve same-origin, auth, schema, ownership/enrollment, publication, and server duration checks.
- Security high: do not introduce unauthenticated beacon acceptance or weaken route validation.
- Data trust critical: never decrease completed state, write to a different lesson/media key, or create completion activity from a periodic tick.
- Data trust high: preserve unique-key upserts, sticky completion, and course/media ownership scope.

Future focused tests: timer starts only after play/timeupdate; timer stops on pause and end; hidden-tab policy is explicit; final save on pause/end; no duplicate writer; dirty-state suppression after successful save; completion remains forced; cleanup on unmount/route change; auth failure does not create a retry loop; offline behavior is bounded; server persistence keeps ownership, bounds, sticky completion, and completion timestamp semantics.

Future localhost-only browser QA: play media and observe requests for at least 30 seconds; pause and verify no continuing periodic requests; resume; seek; hide/show tab where supported; end; navigate away; verify request counts and resume position. Use only localhost, never production.

## Baseline gates and governance firewalls

- Typecheck: PASS (`npm run typecheck`)
- Lint: PASS (`npm run lint`)
- Focused CourseLesson progress tests: PASS, 3/3 (`tests/course-lesson-progress-domain.test.ts`)
- Focused audio E2E: NOT PASS / ENVIRONMENT BLOCKED, 0/5; local harness returned `DATABASE_PROVIDER_CONFIGURATION_INVALID` because the Cloudflare D1 binding was unavailable. No production DB was used.
- Build: PASS (`npm run build`)
- Full unit/integration suite: NOT RUN (optional and unnecessary for this read-only audit)

Required firewalls: P0 changed NO; P1 changed NO; polling changed NO; database write 0; Vercel changed NO; P3/build/deployment settings changed NO; governance policy/human decision/actor-audit/receipt changed NO; course/question/lesson/ontology/evidence content changed NO. Commit: none. Push: none. PR: none. Deployment: none. Production connection: none.

Ready for bounded P2 implementation: YES, authorization still required. Ready for P3: NO / out of scope. Ready for P4: NO / out of scope.

Remaining preconditions: obtain explicit bounded P2 implementation authorization; define or confirm the acceptable progress-loss window if cadence is ever changed; provide a local D1-capable harness for the blocked audio E2E rerun.

## Required final result

- Recurring mechanism count: 2
- Recurring writer count: 2
- Endpoint count: 2 recurring POST endpoints (plus non-recurring GET handlers)
- Server handler paths: `app/api/audio/progress/route.ts`, `app/api/lectures/progress/route.ts`
- Repository paths: `db/audio-repositories.ts`, `db/lecture-repositories.ts`
- DB tables: `audio_progress`, `lecture_progress`, plus access/revision read tables
- DB SELECT/request: 2–3
- DB INSERT/request: 0 as a statement classification
- DB UPDATE/request: 0 as a statement classification
- DB UPSERT/request: 1
- Unchanged client request suppression: NO
- Unchanged server write suppression: NO
- One active hour: 240 requests, 240 function invocations, 480–720 SELECTs, 240 writes
- Paused hour: 0 continuing recurring calls; at most one pending/final boundary call
- Hidden hour: 240 if playback/provider events continue
- 100 learner-hours: 24,000 calls; 1,000: 240,000; 10,000: 2,400,000
- 3M required learner-hours: 12,583.33 at 240/hour
- Progress-only 3M plausibility: HIGH numerically; not historical proof
- Current classification: `HIGH_AMPLIFICATION_RISK` for aggregate scale, with low per-session complexity
- Product progress accuracy requirement: preserve resumable playback position and server-validated completion; exact loss window UNKNOWN
- Expected request reduction: high for paused/unchanged duplicate traffic, none for changing active positions under unchanged 15-second cadence
- Expected DB write reduction: MEDIUM overall, HIGH for paused/unchanged periods
- Expected function invocation effect: MEDIUM
- Commit/push/PR/deployment: none
- Reports written: `reports/securium-vercel-p2-progress-polling-audit-2026-08-27.md`

## Final summary

CURRENT PROGRESS TRAFFIC

Exactly two recurring writers exist. Each uses a 15,000 ms checkpoint gate and produces 240 steady-state requests/hour per active media writer, with a possible first-event and final-save boundary extra.

LIFECYCLE

Writes begin on accepted playback/timeupdate events, continue during active play, have no code-controlled hidden-tab suppression, stop as a continuing cadence when media events stop, force a save on explicit audio pause/end and media end, and clean pending timers/listeners on unmount. A pending timeout can still fire once after pause; lecture provider pause handling is incomplete.

DATABASE COST

Each recurring tick authenticates/validates, performs 2–3 SELECTs including access/current state and sometimes content revision, then executes one progress upsert. Equal values are not suppressed, so timestamps and DB workload still churn.

SCALING

The code produces 240 requests per active learner-hour. Approximately 12,583.33 active learner-hours would produce 3.02M requests; this is numerically plausible at aggregate scale.

ROOT-CAUSE RELATIONSHIP

P2 is a proven scalable contributor and amplification risk, not a proven historical root cause of any observed invocation total without direct Vercel telemetry, traffic source, and bot attribution.

RECOMMENDED REMEDIATION

Authorize one bounded P2 implementation that keeps 15-second active checkpoints, adds play-state-aware scheduling and dirty-state suppression, and performs final saves on pause/end while retaining all server security and completion validation.

EXPECTED EFFECT

For changing active playback, theoretical request counts remain 40/120/240 over 10/30/60 minutes. The reduction comes from eliminating paused cadence and unchanged/duplicate requests; each removed request should remove one route invocation and one upsert, while repository reads remain avoided only when the request itself is avoided. No production savings claim is made.

NOT ADDRESSED

Unknown external traffic source; bot attribution; P1 `force-dynamic`; 574 build churn; historical Vercel telemetry.

NEXT GATE

`AUTHORIZE_P2_PROGRESS_POLLING_BOUNDED_IMPLEMENTATION`
