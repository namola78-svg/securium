# SECURIUM VERCEL P2 Progress / Media Recurring Request Amplification Audit

Snapshot date: 2026-08-28  
Authorization: `P2_PROGRESS_POLLING_READ_ONLY_AUDIT`

## Final status

`SECURIUM_VERCEL_P2_PROGRESS_POLLING_AUDIT_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION`

The implementation is statically understood and a bounded client-only remediation is available. No implementation was made. The audit uses current worktree code and the local `origin/main` ref. `git fetch origin` was attempted but could not update the linked-worktree `FETCH_HEAD` because the parent `.git/worktrees` metadata is permission-restricted; `origin/main` still resolved to the expected starting SHA.

## Worktree and authority

| Field | Result |
|---|---|
| Worktree | `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-vercel-progress-p2` |
| Branch | `perf/vercel-progress-polling-p2-audit` |
| HEAD | `2a628ff4e8cc6a6c249218874cc72563faadf55b` |
| Fresh `origin/main` | `2a628ff4e8cc6a6c249218874cc72563faadf55b` (fetch attempted; FETCH_HEAD update blocked) |
| Main match | YES |
| Main drift | NONE observed |
| Working tree state | Pre-existing untracked `reports/securium-vercel-p2-progress-polling-audit-2026-08-27.md`; this report is the only new audit artifact. No tracked diff. |
| P0 authority present | YES; HEAD equals expected main authority |
| P1 closed | YES; no P1 work reopened |
| Dependencies present | YES; `node_modules` exists |
| `npm ci` performed | NO |
| Package manifest changed | NO |
| Lockfile changed | NO; SHA-256 `6C8544F142DADB3462B21FED441963176EC80DB661CC19922A4703BD23D86FE0` |

## Scope and counting rule

The exact production HTTP progress writer count is two. The exact production recurring mechanism count is three when independently recurring media/event sources are counted:

1. Native audio `timeupdate` events in `AudioLearningItem` feed the audio writer.
2. Browser speech uses a 1,000 ms `setInterval` in `AudioLearningItem` and feeds the same audio writer.
3. Lecture YouTube/Vimeo `postMessage` playback events in `LecturePlayer` feed the lecture writer.

Each writer also owns one trailing `setTimeout` checkpoint scheduler. That scheduler is not counted as an additional writer or independent source: it only delays the next save already caused by one of the sources above. The production recurring mechanism count is therefore **3**, production writer count **2**, recurring reader count **0**, and test-only recurring mechanism count **0**. The unrelated production mock-exam countdown is an interval but not a media/progress mechanism; test delays are one-shot setup waits, not recurring mechanisms.

## Production recurring-mechanism inventory

| ID | Source path | Function/component | Classification | Runtime reachability | Recurring | Writes server state |
|---|---|---|---|---|---|---|
| RM-1 | `components/audio-learning-player.tsx:298-314` | `AudioLearningItem` native `<audio onTimeUpdate>` | `PROGRESS_WRITE` | Reachable for each `item.audioUrl` audio item while the browser emits media time updates | Yes, media-event driven | Yes, via W1; request rate is gated to 15 s |
| RM-2 | `components/audio-learning-player.tsx:157-166` | `AudioLearningItem.startSpeechTimer` | `PROGRESS_WRITE` | Reachable for browser-voice items (`audioUrl` empty) after successful speech start | Yes, 1,000 ms interval | Yes, via W1; request rate is gated to 15 s |
| RM-3 | `components/lecture-player.tsx:37-55` | `LecturePlayer.receiveMessage` | `PROGRESS_WRITE` | Reachable for an accessible YouTube/Vimeo lecture iframe after accepted provider messages | Yes, provider-event driven | Yes, via W2; request rate is gated to 15 s |

Non-counted runtime hits include capability/focus/admin one-shot timers, the mock-exam one-second countdown, and provider-independent abort timeouts. There is no application `refetchInterval`, `refreshInterval`, heartbeat, `sendBeacon`, `visibilitychange`, `pagehide`, or `beforeunload` progress mechanism. There is no recurring progress GET.

## Exact writers and endpoint graph

| Field | W1 | W2 |
|---|---|---|
| Writer ID | W1 | W2 |
| Source path | `components/audio-learning-player.tsx` | `components/lecture-player.tsx` |
| Component/hook | `AudioLearningItem`; `queueSave`/`persist` | `LecturePlayer`; `queueProgress`/`persistProgress` |
| Route family | `/learn/[courseSlug]/lessons/[lessonId]` audio section | `/lectures/[courseSlug]/[lectureId]` |
| Course/lesson/media context | Published audio content attached to a lesson; one component per `items` entry | One published lecture detail; YouTube or Vimeo iframe |
| Media type | Native audio file or browser speech synthesis | YouTube/Vimeo embedded lecture |
| Classification | `PROGRESS_WRITE` | `PROGRESS_WRITE` |
| Target endpoint | `/api/audio/progress` | `/api/lectures/progress` |
| HTTP method | POST | POST |
| Server handler | `app/api/audio/progress/route.ts:39-55` | `app/api/lectures/progress/route.ts:36-52` |
| Service path | No separate service; route calls `updateAudioProgress` | No separate service; route calls `updateLectureProgress` |
| Repository path | `db/audio-repositories.ts:177-244` | `db/lecture-repositories.ts:407-471` |
| Canonical DB table | `audio_progress` | `lecture_progress` |
| Mount condition | `items.length > 0`; item is mounted for every array entry | Lecture page has an accessible embed; player mounts |
| Activation condition | Native `timeupdate`, or successful browser speech start; explicit pause/seek/end may force save | Accepted provider playback message; end may force save |
| Auth required | Yes; `requireApiUser` | Yes; `requireApiUser` |
| Ownership/access validation | User ID, published active audio/lesson/unit/course, non-cancelled enrollment | User ID, published active lecture/course/subject/topic; free lecture or non-cancelled enrollment |
| Interval | 15,000 ms checkpoint gate; speech source tick is 1,000 ms | 15,000 ms checkpoint gate; provider event frequency is external/unspecified |
| Calls/minute | 4 steady state | 4 steady state |
| Calls/hour | 240 steady state | 240 steady state |
| Start | Not on mount; first accepted playback/timeupdate event causes immediate save because `lastSavedAtRef` starts at 0 | Not on mount; first accepted provider progress message causes immediate save |
| Pause | Explicit UI pause forces one save; native `onPause` only changes UI; browser speech stops its interval | No active pause persistence action; Vimeo pause is subscribed but ignored; provider stopping progress events stops continuing saves |
| Hidden tab | No visibility logic; requests continue if source events continue | Same |
| End | Native audio and speech end force completion save; pending timeout is cleared | Provider end forces completion save; a YouTube message containing both position and ended can produce a boundary duplicate |
| Seek | Immediate forced save of rounded integer position; native audio may then emit timeupdate | No explicit seek API; provider position messages are queued and may be immediately/periodically saved |
| Unmount cleanup | Clears pending timeout, speech interval, speech utterance; no request cancellation/final save | Removes message listener and clears pending timeout; no request cancellation/final save |
| Retry | No automatic retry or backoff; failed fetch only displays an error | Same |
| Offline | Fetch attempts continue when source events invoke queue; no offline queue | Same |

Request payloads are `{ audioContentId, currentPositionSeconds, complete }` and `{ lectureId, currentPositionSeconds, complete }`. Client rounds/bounds positions, and server schema plus duration validation repeats the bounds. Success is `{ result: { <id>, currentPositionSeconds, completed, completedAt, idempotentReplay } }`.

The complete graph for both writers is:

`client source event -> queueSave/queueProgress -> fetch POST -> assertSameOrigin -> requireApiUser -> per-user 60/min rate limit -> Zod parse -> access SELECT -> current progress SELECT -> conditional latest published revision SELECT -> repository INSERT ... ON CONFLICT DO UPDATE -> canonical progress table`.

W1 uses `requireAccessibleAudio` and `audio_progress`; W2 uses `requireAccessibleLecture` and `lecture_progress`. There is no recurring write to `learning_activities`, `user_progress`, `user_course_lesson_progress`, Evidence, competency, badges, or analytics tables.

## Timer and lifecycle matrix

| Lifecycle | W1 audio | W2 lecture |
|---|---|---|
| Mount | Initializes resume position/capability timer; does not save or start checkpointing | Installs `message` listener; does not save or start checkpointing |
| First playback | Native timeupdate or speech interval tick; first save is immediate, then 15 s gate | First accepted provider position message; first save is immediate, then 15 s gate |
| Active playback | Source events update desired position; at most one trailing checkpoint timer; changing position does not suppress requests | Provider messages update desired position; at most one trailing checkpoint timer |
| Pause | Explicit button: one forced POST. Native pause event: UI state only. Speech pause: interval stopped, then forced POST | No explicit persistence on provider pause; a pending timeout may fire once; no continuing stream once provider events stop |
| Hidden tab | No Page Visibility API; code does not suppress. If source continues, requests continue | Same |
| End | Forced completion POST; pending timer cleared. Speech `onend` also stops interval | Forced completion POST; potential same-message position/end duplicate at boundary |
| Unmount/navigation | Timers/listeners cleaned; in-flight fetch remains; no final save | Listener/timer cleaned; in-flight fetch remains; no final save |

Pause classification is **CONDITIONAL**. A one-hour pause creates no continuing cadence after source events stop, but can create one pending callback and/or one explicit final save. The current audio UI pause creates one forced request; lecture provider pause has no forced save. Hidden-tab classification is **CONDITIONAL**: no code-controlled suppression exists, so if the browser/provider continues delivering progress events, requests continue; browser throttling is not treated as application logic.

Timer leak risk: **LOW**. Cleanup is present, but in-flight requests cannot be cancelled and unmount has no guaranteed final checkpoint. Successful-save feedback-loop risk: **LOW**; success updates completion/message state but does not restart an effect or create another save. Retry amplification risk: **NONE** for automatic retries. Offline amplification risk: **LOW** because no retry loop exists, although events can continue attempting requests while offline.

## Media events

| Event | Available | Currently used | Current persistence action |
|---|---|---|---|
| `play` | Yes | Implicitly through player controls/provider | Starts native media or speech; no direct progress POST |
| `pause` | Yes | Audio UI/native event; Vimeo subscription | Audio explicit pause forces save; native pause/provider pause otherwise only changes state |
| `timeupdate` | Yes | Native audio and Vimeo | Updates position and queues checkpoint |
| `ended` | Yes | Native audio, speech `onend`, Vimeo | Forces completion save |
| `seeking` | Yes | No | None |
| `seeked` | Yes | No; UI seek buttons call helper | UI seek forces immediate save; no dedicated event handler |
| `visibilitychange` | Yes | No | None |
| `pagehide` | Yes | No | None |
| `beforeunload` | Yes | No | None |
| unmount | React lifecycle | Yes | Cleanup only; no final save |

## Pause, hidden, end, seek, and duplicate behavior

### Unchanged state

Unchanged client request suppression: **NO**. There is no equality or threshold check against the last successful payload. The audio speech timer keeps advancing position; native/provider events queue based on elapsed time, not material change. Explicit pause/end/seek calls are forced.

Unchanged server write suppression: **NO**. Both repositories first read the current row, compute sticky completion, and execute an upsert regardless of semantic equality. Equal progress still updates `lastPlayedAt`; audio also updates `updatedAt`. `completedAt` is preserved once set. There is no append-only event generated by these writes.

Seek-forward, seek-backward, and large seek all use the current integer position and may move the snapshot backward. Audio UI seek saves immediately. Lecture position changes wait for the 15 s gate unless an end/complete path forces a save. A stale in-flight request can complete after a newer request and overwrite position because there is no client request cancellation or server version/timestamp guard. Completion itself cannot regress because repositories use `current.completed || input.complete`.

Duplicate writer risk: **CONDITIONAL** for the same logical record across multiple tabs or duplicate mounts; **NO** between W1 and W2 because they target different media types/tables/keys. A normal lecture detail mounts at most one lecture writer. A lesson can render multiple audio items, so maximum concurrent writer count per page is **UNKNOWN** statically and is data-dependent on `items.length`.

## Database operation model

For one normal POST, excluding auth/rate-limit implementation internals:

| Writer state | Access SELECT | Current-row SELECT | Revision SELECT | INSERT statements | UPDATE statements | UPSERT statements |
|---|---:|---:|---:|---:|---:|---:|
| New/incomplete audio or lecture | 1 | 1 | 1 | 0 | 0 | 1 |
| Existing incomplete audio or lecture | 1 | 1 | 1 | 0 | 0 | 1 |
| Already completed audio or lecture | 1 | 1 | 0 | 0 | 0 | 1 |

Thus DB reads are **2-3 SELECTs per timer request**, one upsert statement, and no separate INSERT/UPDATE statement. The upsert physically inserts a new row or updates the unique-key row. Audio additionally resolves the latest published content revision until completion; lecture does the analogous lecture revision lookup. Side effects are position, sticky completion, `completedAt` on first completion, `lastPlayedAt`, audio `updatedAt`, and content revision association. No Evidence, learning activity, analytics, or competency side effect is coupled to the timer request.

## Canonical progress, completion, and resume semantics

Canonical model: **LATEST_STATE_SNAPSHOT**. Canonical authorities are `audio_progress(user_id, audio_content_id)` and `lecture_progress(user_id, lecture_id)`, each with a unique user/media key. This is not an append-only event log and not a snapshot-plus-event model.

Completion is client-requested but server-authorized: the client can send `complete: true`, but the server requires the position to be within the final allowed portion. Audio allows the final `max(5 seconds, ceil(5%))`; lecture uses the corresponding video-provider service rule. Repeated completion is sticky and cannot regress. Media `ended` always sends a completion checkpoint. Reducing recurring writes is safe only if end/final completion and server threshold validation remain intact.

Resume uses the saved integer `currentPositionSeconds`, loaded server-side with the media detail and applied to native audio `currentTime` or video embed initialization. Cross-device resume is supported through the account-scoped snapshot. Position precision is one second after client rounding. No explicit maximum acceptable unsaved-progress window is defined in tests, docs, or product logic: **UNKNOWN**. The UI copy describes 15-second updates, but that does not establish a product loss requirement.

## Scaling model

The steady-state rate for either writer is `15,000 ms -> 4 calls/minute -> 240 calls/hour`. The first accepted event can add one immediate call; forced pause/seek/end calls and provider boundary duplicates can add extra calls. The tables below show the steady checkpoint model and identify boundary extras separately.

| One writer | HTTP requests | route executions | DB writes | DB SELECTs |
|---|---:|---:|---:|---:|
| 10 min active | 40 | 40 | 40 | 80-120 |
| 30 min active | 120 | 120 | 120 | 240-360 |
| 60 min active | 240 | 240 | 240 | 480-720 |

For either writer, 30 minutes active plus 30 minutes paused is **120 continuing requests plus up to one boundary request** under current code. A one-hour hidden period is **240 requests if source events continue**, otherwise fewer based on provider/browser behavior; there is no application suppression. Thirty minutes visible plus thirty minutes hidden is **240 requests** in the continuing-event model.

### Multi-tab model for one logical media item

Each tab has an independent client writer. Theoretical steady counts for one hour are:

| Tabs | Calls/hour |
|---:|---:|
| 1 | 240 |
| 2 | 480 |
| 5 | 1,200 |
| 10 | 2,400 |

Last-write-wins applies. Older or delayed requests can overwrite a newer position because no sequence/version comparison exists. Multiple audio items on one lesson page multiply the same rate per active item; no static maximum can be proved.

### Learner-hour scaling

Assuming one active media writer per learner-hour:

| Active learner-hours | Requests |
|---:|---:|
| 100 | 24,000 |
| 1,000 | 240,000 |
| 10,000 | 2,400,000 |
| 100,000 | 24,000,000 |

For 3,020,000 requests: `3,020,000 / 240 = 12,583.33` active learner-hours. Over the approximately six-day historical window this is `2,097.22` learner-hours/day and `87.38` continuously active equivalent learners (`12,583.33 / 144`). This is numerical plausibility only, not a historical attribution.

Historical progress root cause proven: **NO**.  
Progress scalable contributor: **YES**.  
Progress-only 3M plausibility: **HIGH** numerically, because the required aggregate usage is feasible; direct Vercel telemetry and traffic attribution are still absent.

Current architecture classification: **HIGH_AMPLIFICATION_RISK** at aggregate scale. The per-session model is simple, but each active writer makes 240 route executions/hour and 240 upserts/hour, with 2-3 repository SELECTs per request, no unchanged-state suppression, no visibility suppression, and independent multi-tab multiplication.

## Remediation options

| Option | Evaluation |
|---|---|
| A. Longer checkpoint interval | Reduces active requests in inverse proportion to interval, but exact acceptable loss window is unknown; worsens resume precision, tab-close loss, and cross-device lag. Do not choose an arbitrary interval. |
| B. Dirty-state suppression | Safe and bounded if based on last successfully persisted semantic payload. Eliminates identical pause/end/boundary requests; active changing positions still checkpoint. Reduces requests and DB writes without changing server semantics. |
| C. Play-state-aware timer | Preferred safety improvement for pause: run recurring checkpointing only while actually playing, stop on pause/end, and issue one final save when needed. Requires consistent YouTube/Vimeo pause/play state handling. |
| D. Visibility-aware suppression | Useful cost reduction for hidden tabs, but hidden transition delivery is not guaranteed and cross-device freshness is delayed. Not required for the first bounded change. |
| E. Event checkpoints | Pause and ended are meaningful; seeked is meaningful for explicit UI seeks; visibility/pagehide are best effort; unmount is not reliable network delivery. Use as a supplement. |
| F. Throttle/debounce | Current behavior is a periodic checkpoint/throttle hybrid. Debounce-only risks losing progress until inactivity/end. Preserve periodic active checkpoints and add dirty gating. |
| G. `sendBeacon` | Only relevant to best-effort pagehide. Current JSON/auth/same-origin route semantics need explicit compatibility and CSRF review; it is not needed for the first bounded change. |
| H. Server write suppression | Could skip equal upserts after the existing current-row SELECT, but still costs route/auth/SELECT work and changes timestamp semantics. Lower request/function benefit than client suppression. |
| I. Batching | Low benefit for normally one active record and adds protocol complexity. Do not use. |

Do not use WebSockets, SSE, queues, Kafka, a new database, a new Evidence pipeline, or schema redesign: current evidence does not show bounded client changes are insufficient.

## Recommended bounded design

Preferred P2 architecture: **play-state-aware checkpointing plus client dirty-state suppression plus final event checkpointing**. Keep the proven 15,000 ms active-playback checkpoint cadence; stop recurring writes while paused; save a changed checkpoint on explicit pause and ended; suppress a payload equal to the last successfully persisted payload; preserve all existing auth, ownership, server duration, sticky-completion, and revision logic. Treat hidden-tab/pagehide behavior as a separate best-effort decision unless product semantics establish a requirement.

This is preferred over an arbitrary longer interval because the loss window is unknown; over server-only suppression because requests/functions remain; over WebSockets/queues because there is one snapshot per active media item; and over Evidence redesign because these timer writes do not currently create Evidence or learning events.

Minimum required mutation layer: **client-only**, specifically the two player components. API and repository changes are not required for the recommended request-reduction path. Future API/repository changes are optional only if a separate decision is made to add transport compatibility or server equal-write suppression.

Recommended split: **ONE_BOUNDED_P2_PR**. Both writers share the same checkpoint pattern and can be changed and tested together. A split is only warranted if provider-specific lecture pause state cannot be made safe alongside the audio lifecycle.

### Theoretical before/after

For active playback, dirty state changes every checkpoint, so request counts do not fall under the unchanged 15-second cadence. The after counts below assume one final changed pause/end checkpoint where applicable and no boundary duplicate.

| Session | Before requests | After requests | Before DB writes | After DB writes |
|---|---:|---:|---:|---:|
| 10 min active | 40 | 40 | 40 | 40 |
| 30 min active | 120 | 120 | 120 | 120 |
| 60 min active | 240 | 240 | 240 | 240 |
| 30 min active + 30 min paused | 120 + up to 1 | 120 + at most 1 changed final checkpoint | 120 + up to 1 | 120 + at most 1 changed final checkpoint |

The meaningful theoretical reduction is during paused/unchanged intervals and duplicate boundary calls, not changing active playback. Each removed request removes one route execution and one upsert; its repository reads are avoided as well.

Expected HTTP request reduction: **MEDIUM** overall, **HIGH** during paused/unchanged periods.  
Expected function invocation reduction: **MEDIUM**.  
Expected DB write reduction: **MEDIUM** overall, **HIGH** during paused/unchanged periods.  
Expected CPU reduction: **MEDIUM**.

UX risk ratings for the recommended design: resume position **LOW**; completion **LOW**; progress bar **LOW**; cross-device sync **LOW-MEDIUM**; tab-close loss **LOW-MEDIUM**. The active checkpoint cadence remains unchanged; pause/end checkpoints improve normal correctness, while unload delivery remains best effort.

## Future exact candidate files (do not modify in this audit)

| Candidate file | Classification | Reason |
|---|---|---|
| `components/audio-learning-player.tsx` | `CLIENT_TIMER`, `CLIENT_MEDIA_EVENT` | Stop/start speech/checkpoint lifecycle, dirty-state gate, pause/end final save |
| `components/lecture-player.tsx` | `CLIENT_TIMER`, `CLIENT_MEDIA_EVENT` | Provider play/pause/end state, checkpoint lifecycle, dirty-state gate |
| `app/api/audio/progress/route.ts` | `API_ROUTE` | Only if transport or response contract needs review; not required by preferred design |
| `app/api/lectures/progress/route.ts` | `API_ROUTE` | Only if transport or response contract needs review; not required by preferred design |
| `db/audio-repositories.ts` | `REPOSITORY` | Only for optional server equal-write suppression; not required by preferred design |
| `db/lecture-repositories.ts` | `REPOSITORY` | Only for optional server equal-write suppression; not required by preferred design |
| `tests/audio-domain.test.ts`, `tests/lecture-domain.test.ts` | `TEST` | Server completion, bounds, and persistence contract coverage |
| `tests/audio-e2e.test.mjs`, `tests/lecture-e2e.test.mjs`, focused client tests to be added | `TEST` | Authenticated/local lifecycle and endpoint behavior |
| Future P2 design note | `DOCUMENTATION` | Record product loss-window decision and lifecycle contract if required |

No schema, migration, Evidence, governance, P0, P1, or Vercel file belongs in the bounded implementation.

## Security, data trust, and invariants

Security classification: **Security Medium**. Current auth and ownership enforcement are present. The main security invariant is to preserve `requireApiUser`, same-origin checks, schema validation, published/active/enrollment/resource identity checks, and server-side duration/completion validation. Do not introduce unauthenticated beacon acceptance or client authority escalation.

Data trust classification: **Data Trust High**. Completion is sticky and server-threshold validated, but position is mutable and stale in-flight or multi-tab writes can regress the resume snapshot. Future code must preserve the same user/media key, avoid stale overwrite where possible, never regress irreversible completion, and never duplicate canonical learning activity. Current stale-write protection is **not enforced** and requires tests; sticky completion and resource ownership are enforced.

Resource amplification classification: **Resource Amplification High**.  
Cost risk classification: **Cost Risk High** based on request/upsert architecture, not billing speculation.

## Future focused test plan

Future tests should use deterministic fake timers where possible. Existing test tooling supports Node test execution, but no client fake-timer library was identified in the repository; introduce the smallest test-local clock abstraction or fake-clock facility only with implementation authorization. Do not wait real 15 seconds.

Required cases:

- writer starts only after correct media/provider play or progress lifecycle;
- writer stops on pause and end, and does not leak on route change/unmount;
- hidden-tab policy is explicit and does not rely on browser throttling;
- resume position is loaded and applied with one-second precision;
- ended persists completion and a legal final position;
- explicit forward/backward/large seek persists the intended position;
- no duplicate writer for one mounted media item;
- dirty-state suppression occurs only after successful persistence;
- unchanged progress produces no redundant client request when suppression is enabled;
- pause/end final checkpoint is sent once when state changed;
- completion cannot regress;
- stale-write behavior is tested for two out-of-order requests;
- multi-tab behavior is documented/tested where deterministic;
- 401/403 do not retry or weaken auth;
- network failure/offline does not create an unbounded retry loop;
- server new progress persists, equal progress follows the chosen contract, newer progress persists, and stale progress follows the chosen protection;
- completion transition persists and already-completed state cannot regress;
- canonical table/key/resource invariants remain intact.

Fake Timer Support Available: **PARTIAL**. The repository has timer-based components and Node tests but no established client fake-timer dependency was found. Recommended strategy: inject or wrap the checkpoint clock and use deterministic fake-clock tests; do not use real 15-second waits.

## Localhost-only browser QA plan

Use Playwright MCP if available, or the existing localhost browser harness. Authentication is required for progress writes. Use only a real existing non-production authenticated session; do not synthesize users, cookies, tokens, sessions, or roles. If such a session is unavailable, classify browser QA as `BLOCKED_AUTH_SESSION`. Never access `securium.vercel.app` for this work.

Representative future flow: open the applicable local media-learning page; start playback; observe requests; remain active for at least two checkpoint windows; pause; verify continuing requests stop and only the intended final checkpoint occurs; resume and verify restart; seek and verify checkpoint; hide/show where supported; reach or simulate legitimate end; navigate away; reopen; verify resume/completion. Expected assertions for the recommended design: active playback remains approximately four requests/minute per writer; after pause no continuing periodic requests; a changed pause/end state creates at most one final save; unchanged duplicate state creates none; two tabs produce approximately 480 calls/hour in the unoptimized baseline and remain independently scoped; completion is persisted by the server threshold.

Production Request Generated Intentionally: **NO**.  
Production Connection: **NO**.  
Production DB Connection: **NO**.  
Database Write: **0**. Local disposable D1 activity was used only by the existing media E2E harness; no production database was touched.

## Baseline validation

| Check | Status | Evidence |
|---|---|---|
| Typecheck | `PASS` | `npm.cmd run typecheck` exit 0 |
| Lint | `PASS` | `npm.cmd run lint` exit 0 |
| Focused existing progress/media tests | `PASS` | Audio, lecture, and course-lesson domain tests: 11/11 |
| Focused media E2E | `PASS` | Existing audio and lecture E2E suite completed against disposable local D1; no production connection |
| Baseline unit | `NOT_RUN` | Full unit suite not required for this read-only audit |
| Baseline integration | `NOT_RUN` | Full integration suite not required |
| Build | `PASS` | `npm.cmd run build` exit 0 |

## Required firewalls and mutation record

| Area | Changed? |
|---|---|
| P0 | NO |
| P1 | NO |
| Polling/timers/media events | NO |
| Auth/authorization/ownership | NO |
| API implementation | NO |
| Repository/DB implementation | NO |
| Schema/migration | NO |
| Evidence/learning records | NO |
| Governance/CS1A/receipts | NO |
| Vercel/P3/P4 | NO |
| Course, lesson, question, practical, progress, completion content | NO |
| Package manifest | NO |
| Lockfile | NO |
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Deployment | NO |

Credential Printed Count: **0**.  
Secret Printed Count: **0**.

## Required final result fields

- Recurring Mechanism Count: **3**
- Production Recurring Mechanism Count: **3**
- Recurring Writer Count: **2**
- Recurring Reader Count: **0**
- Test-Only Recurring Mechanism Count: **0**
- Duplicate Writer Risk: **CONDITIONAL** across tabs/duplicate mounts; **NO** between audio and lecture records
- Maximum Concurrent Writer Count Per Page: **UNKNOWN**; audio item count is data-dependent
- 1 tab calls/hour: **240** per active writer
- 2 tabs calls/hour: **480**
- 5 tabs calls/hour: **1,200**
- 10 tabs calls/hour: **2,400**
- Unchanged Client Request Suppression: **NO**
- Unchanged Server Write Suppression: **NO**
- DB SELECT per timer request: **2-3**
- DB INSERT per timer request: **0 statements**
- DB UPDATE per timer request: **0 statements**
- DB UPSERT per timer request: **1**
- Other side effects: timestamps, sticky completion, first completion timestamp, revision association
- Canonical Progress Model: **LATEST_STATE_SNAPSHOT**
- Canonical Progress Authority: `audio_progress` and `lecture_progress`, unique per user/media
- Completion Semantics: server threshold validation plus media-ended/client completion request; sticky completion
- Resume Semantics: integer seconds, server-loaded and applied to media/embed
- Cross-Device Resume: **YES** through account-scoped snapshots
- Maximum Acceptable Loss Window: **UNKNOWN**
- 10m active requests: **40** per writer
- 30m active requests: **120** per writer
- 60m active requests: **240** per writer
- 30m active + 30m paused requests: **120 + up to 1 boundary**
- 30m active + 30m hidden requests: **240 if source events continue**
- 100 learner-hours calls: **24,000**
- 1,000 learner-hours calls: **240,000**
- 10,000 learner-hours calls: **2,400,000**
- 100,000 learner-hours calls: **24,000,000**
- 3.02M required learner-hours: **12,583.33**
- 3.02M required learner-hours per day over six days: **2,097.22**
- 3.02M equivalent continuous learners: **87.38**
- Historical Progress Root Cause Proven: **NO**
- Progress Scalable Contributor: **YES**
- Progress-only 3M plausibility: **HIGH** numerically, not historical proof
- Current Architecture Classification: **HIGH_AMPLIFICATION_RISK**
- Recommended Bounded Architecture: play-state-aware timer + dirty-state suppression + pause/end final checkpoint
- Minimum Required Mutation Layer: **client-only**
- Recommended P2 Split: **ONE_BOUNDED_P2_PR**
- Expected request/function/DB/CPU effect: **MEDIUM overall**, higher for paused/unchanged periods
- Security classification: **Security Medium**
- Data trust classification: **Data Trust High**
- Resource amplification classification: **Resource Amplification High**
- Cost classification: **Cost Risk High**
- Ready For Client Timer Remediation: **YES, pending authorization**
- Ready For Media Event Remediation: **YES, pending authorization**
- Ready For API Remediation: **NO change required; optional only**
- Ready For Repository/DB Remediation: **NO change required; optional only**
- Ready For Bounded P2 Implementation: **YES, pending authorization**
- Ready For P3 Build-Churn Audit: **NO; separate scope**
- Ready For P4 Observability Design: **NO; separate scope**
- Reports Written: this report plus pre-existing 2026-08-27 report

Remaining preconditions: authorize the bounded implementation; product owner may optionally define the acceptable loss window before changing the 15-second cadence; retain a real non-production authenticated session for future browser QA. Recommended next step: `AUTHORIZE_P2_PROGRESS_POLLING_BOUNDED_IMPLEMENTATION`.

## CURRENT PROGRESS TRAFFIC

Exactly two production recurring HTTP writers exist. Three production recurring sources feed them: native audio `timeupdate`, browser-voice 1,000 ms speech ticks, and lecture-provider messages. Both writers use a proven 15,000 ms checkpoint gate and produce 4 requests/minute or 240 requests/hour in steady state per active writer. The prior approximately 240 calls/hour estimate is **refined and confirmed for the steady HTTP checkpoint rate**, with first-event, pause/seek/end, and provider-boundary extras possible. It is not a claim that every source event causes an HTTP request.

## LIFECYCLE

During play, accepted media/provider events update position and checkpoint every 15 seconds. During pause, audio’s explicit pause button forces one save and browser speech stops its interval; native audio pause and lecture provider pause do not consistently force a save, and an already queued timeout can fire once. Hidden tabs have no application suppression, so requests continue if events continue. Seek saves immediately for the audio UI; lecture seeks depend on provider messages and the 15-second gate. End forces a completion save and stops speech/clears pending scheduling; YouTube boundary messages can duplicate. Unmount/navigation cleans timers/listeners but does not cancel in-flight fetches or perform a final save. Avoidable recurring traffic is paused/unchanged/boundary traffic and hidden-tab traffic when media continues producing events.

## DATABASE COST

One recurring POST executes same-origin and authenticated API checks, rate limiting, schema parsing, an access/ownership SELECT, a current progress SELECT, and usually a latest published revision SELECT, followed by one upsert into `audio_progress` or `lecture_progress`. Unchanged progress still creates both the HTTP request and a persistence upsert; timestamps churn even when position/completion are unchanged. No Evidence or learning-activity write is coupled to the timer.

## SCALING

The exact steady rate is 240 requests per active learner-hour per writer: 100 learner-hours = 24,000; 1,000 = 240,000; 10,000 = 2,400,000. Approximately 12,583.33 active learner-hours would numerically reach 3.02M requests, equal to approximately 2,097.22 learner-hours/day or 87.38 continuously active learners over six days. This is numerical plausibility, not historical proof.

## ROOT-CAUSE RELATIONSHIP

Historical Progress Root Cause Proven: **NO**.  
Progress Scalable Contributor: **YES**.  
The recurring architecture is a credible scalable contributor, but the historical source of 3.02M invocations remains unknown without direct telemetry and traffic attribution.

## CORRECTNESS

The completion invariant is server-validated threshold completion and sticky non-regression. The resume invariant is an account-scoped integer-second latest snapshot per user/media record, with cross-device loading. Maximum acceptable loss window: **UNKNOWN**. Optimizations must preserve auth, ownership, media identity, completion monotonicity, and protection against stale position overwrites; stale-write protection is currently missing and needs future tests.

## RECOMMENDED REMEDIATION

Use one bounded client PR: keep 15-second active checkpoints, make scheduling explicitly play-state-aware, suppress unchanged payloads after successful save, and perform one changed final checkpoint on pause and ended. This avoids choosing an arbitrary product loss window, retains active resume precision, and removes unnecessary paused/duplicate requests. Server-only suppression leaves route/function traffic; WebSockets and queues add architecture without evidence of need; an Evidence redesign is unrelated to these snapshot writes.

## EXPECTED EFFECT

For changing active playback, theoretical before/after requests and DB writes remain 40/120/240 for 10/30/60 minutes. For 30 active plus 30 paused minutes, current behavior is 120 active requests plus up to one boundary request; the bounded design is 120 active requests plus at most one changed final checkpoint, with no continuing paused cadence. Every removed request also removes one route execution and one upsert. These are theoretical effects, not measured production savings.

## IMPLEMENTATION SCOPE

Candidate implementation files are `components/audio-learning-player.tsx` and `components/lecture-player.tsx`, classified as `CLIENT_TIMER` and `CLIENT_MEDIA_EVENT`. Focused tests belong in the existing audio/lecture domain and E2E test areas. API/repository files are optional review points only, not required by the preferred client-only design. Recommended scope: **ONE_BOUNDED_P2_PR**.

## NOT ADDRESSED

Unknown external traffic source; bot/crawler attribution; P1 force-dynamic (closed); 574-build churn; historical Vercel telemetry; Vercel external account block.

## NEXT GATE

`AUTHORIZE_P2_PROGRESS_POLLING_BOUNDED_IMPLEMENTATION`
