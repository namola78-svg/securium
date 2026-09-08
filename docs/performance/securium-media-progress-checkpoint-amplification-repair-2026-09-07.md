# Securium Media Progress Checkpoint Amplification Repair

Snapshot date: 2026-09-07  
Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-media-progress-amplification-repair`  
Branch: `fix/media-progress-amplification-repair`  
Authorization: bounded media-progress amplification repair only

## Final status

`SECURIUM_MEDIA_PROGRESS_CHECKPOINT_AMPLIFICATION_REPAIR_PASS_READY_FOR_REVIEW`

Repair decision: `REDUCE_REDUNDANT_MEDIA_PROGRESS_HTTP_CHECKPOINTS_WITH_BOUNDED_COALESCING_AND_NOOP_SUPPRESSION`

Readiness: `MEDIA_PROGRESS_AMPLIFICATION_REPAIRED_INDEPENDENT_REVIEW_REQUIRED`

Primary next gate: `REVIEW_SECURIUM_MEDIA_PROGRESS_CHECKPOINT_AMPLIFICATION_REPAIR`

## Worktree and baseline

| Field | Result |
|---|---|
| Branch | `fix/media-progress-amplification-repair` |
| HEAD | `9756970ce19a64d6ac0e913631193b606dc78e7c` |
| Fresh `origin/main` | `67686548da982cd9f3c11806ac21b95cf4be526a` |
| Ahead/behind | `0 / 1` at final fresh-main verification; initial snapshot was `0 / 0` |
| Initial status | CLEAN |
| P4 on main | PASS; `9756970ce19a64d6ac0e913631193b606dc78e7c` is an ancestor of `origin/main` |
| Production DB | NO |
| Deployment | NO |
| Production traffic/load test | NO |
| Commit/push/PR | NO / NO / NO |

## Writer inventory

Exact production HTTP writer count before and after: **2 / 2**.

| Writer | Client path | HTTP request | Auth and protection | Payload |
|---|---|---|---|---|
| W1 audio | `components/audio-learning-player.tsx` → `AudioLearningItem` | `POST /api/audio/progress` | `assertSameOrigin`, `requireApiUser`, per-user `60/min` rate limit, accessible published audio/enrollment check | `{ audioContentId, currentPositionSeconds, complete }` |
| W2 lecture | `components/lecture-player.tsx` → `LecturePlayer` | `POST /api/lectures/progress` | `assertSameOrigin`, `requireApiUser`, per-user `60/min` rate limit, accessible published lecture/enrollment check | `{ lectureId, currentPositionSeconds, complete }` |

No other media-progress HTTP writer was found in `app/`, `components/`, `lib/`, `db/`, or `tests/`. GET progress handlers are load/detail APIs, not recurring writers.

The exact recurring/event-driven source count remains **3 / 3**:

1. Native audio `timeupdate` events.
2. Browser speech synthesis’ local 1-second `setInterval` position clock.
3. YouTube/Vimeo iframe `message` events (`infoDelivery`/`timeupdate`).

Pause, seek, ended, and explicit completion are boundary events, not additional recurring writers. React cleanup removes the lecture message listener, pending checkpoint timeout, and speech interval.

## Before behavior

- Active checkpoint gate: 15 seconds; first changed event can send immediately because the last-save timestamp starts at zero.
- The client already tracked `lastPersistedRef`, serialized one in-flight request, and retained one latest queued state.
- Forced pause/seek/end paths could bypass equal-state suppression, producing duplicate near-identical HTTP calls.
- Server repositories always performed the progress upsert after reading the current row; equal semantic state was not a database no-op.
- Resume semantics are latest integer-second position, not furthest-watched position. Backward seek is legitimate and remains allowed.
- Completion is sticky in both client and server code.
- No retry backoff existed; a failed request with a queued state could immediately start another attempt.
- No pagehide/visibilitychange flush path existed. That behavior is unchanged; no unreliable unload transport was added.

## Repair

The smallest bounded repair is:

- Change active checkpoint cadence from 15 seconds to **30 seconds**, the shortest cadence that meets the requested 50% steady-state reduction.
- Keep immediate changed pause, seek, ended, and explicit completion flushes.
- Make `force` mean “flush cadence now,” not “bypass semantic equality.” Equal `{ position, complete }` states are suppressed even at lifecycle boundaries.
- Preserve one in-flight request and one latest pending state; intermediate states are not queued.
- Add bounded failure retry scheduling: latest meaningful state remains pending and a failed attempt cannot immediately recurse. Retry delay is at least 1 second and normally the remaining 30-second checkpoint window.
- Add server equal-state no-op suppression in the existing audio and lecture repositories. No schema or API route was added; the response contract remains compatible and reports `idempotentReplay: true` for an equal stored semantic state.
- Add an immediate Vimeo pause flush to match existing native audio and YouTube pause behavior.
- Keep P4 observability unchanged and add no metric dimensions or payload logging.

Changed files: `components/audio-learning-player.tsx`, `components/lecture-player.tsx`, `db/audio-repositories.ts`, `db/lecture-repositories.ts`, the focused media tests, the existing audio/lecture E2E assertions, and `lib/media-progress-checkpoint.ts`.

## Request and persistence model

| Concern | Result after repair |
|---|---|
| HTTP method/routes | Existing POST routes only; no route count change |
| Request authentication | Preserved `requireApiUser` |
| Same-origin/CSRF | Preserved `assertSameOrigin` |
| Rate limit | Preserved `60/minute/user` on each route |
| Client dirty suppression | Compared against last successful/acknowledged `{ position, complete }` |
| Last acknowledged state | `lastPersistedRef`, updated only from a successful response |
| In-flight coalescing | PASS; one active request plus latest pending state |
| Failure behavior | Failed response does not acknowledge; latest state stays pending; bounded retry, no immediate retry chain |
| Retry attempts/backoff | No max-attempt counter; one retry schedule per dirty state, no faster than bounded cadence; no exponential/offline queue |
| Server equal-write suppression | PASS; equal stored position and sticky completion return without an upsert |
| DB write vs HTTP request | Both tracked separately; client cadence/equality suppression reduces HTTP invocations, server no-op only reduces physical mutation |
| API contract | Existing fields/routes preserved; additive truthful `idempotentReplay` behavior |

Server no-op compares equality only. It does not use `position <= stored` and therefore does not break intentional resume rewinds. Incoming progress remains bounded and linked to the authenticated user and resource by existing server checks.

## Semantics and duplication assessment

| Area | Before | After |
|---|---|---|
| Duplicate tabs/windows/player instances | POSSIBLE; no cross-tab coordination | POSSIBLE residual baseline; no distributed lock added |
| Multiple items | Multiple audio items can run independent writers; one writer per mounted item | Unchanged scope; each item is independently bounded |
| Remount | LOW risk; effect cleanup clears timers/listeners, in-flight fetch may finish | LOW; cleanup unchanged and no orphan recurring source introduced |
| Interval + pause/end overlap | Could produce forced equal duplicate | Equal semantic state is suppressed; changed state flushes once and in-flight queue retains latest |
| Seek | Immediate forced save; backward seek allowed | Same product semantics, equal seek suppressed |
| Completion | Immediate/end save and sticky completion | Same, with equal completion duplicate suppressed |
| Pagehide/visibility | No handler; no guaranteed unload flush | Unchanged; no beacon/keepalive contract added |
| Minimum meaningful delta | Integer-second positions; 1 second is the smallest representable change | Unchanged; no arbitrary delta threshold added |
| Resume model | Latest resume-position snapshot | Unchanged; not converted to max/furthest watched |

Cross-tab last-write-wins remains a pre-existing medium data-trust limitation. It was evaluated and deliberately not expanded into distributed locking because the repair does not require new coordination infrastructure and no cross-user authority is introduced.

## Request reduction and cost model

These are steady-state active-playback checkpoint counts, excluding first-event and final-boundary effects:

| Model | Before | After | Reduction |
|---|---:|---:|---:|
| 10 minutes, one writer | 40 | 20 | 50% |
| 1 hour, one writer | 240 | 120 | 50% |
| 1 hour, two writers | 480 | 240 | 50% |
| 1 day, one writer | 5,760 | 2,880 | 50% |
| 100 players, one writer/player, one day | 576,000 | 288,000 | 50% |
| 100 players, two writers/player, one day | 1,152,000 | 576,000 | 50% |

The 30-second cadence is the minimum bounded change meeting the preferred target; 60 seconds was not selected because it would widen interruption recovery staleness without repository evidence that the product accepts that window. Equal boundary suppression can reduce counts further when state does not change.

## Test evidence

| Gate | Result |
|---|---|
| Focused checkpoint/writer tests | PASS, 9/9 (`node --test tests/progress-polling-client.test.ts`) |
| Existing media integration tests | PASS, 12/12 through local D1 harness: audio 5/5, lecture 7/7 |
| Full unit suite | PASS, 448/448 |
| P4 observability suite | PASS, 16/16 underlying `request-observability.test.ts`; the npm wrapper was an orphaned shell and was safely stopped |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS; Next.js build generated 63 routes |
| `db:check` | PASS |
| Migration guard | PASS, 10/10 |
| `git diff --check` | PASS |
| Schema change | 0 |
| Migration change | 0 |
| New skip/only/TODO bypasses | 0 / 0 / 0 |

Focused assertions cover steady playback request bounds, 1-hour and 100-player models, equal state, tiny integer delta, meaningful delta, pause, ended, seek, cleanup/listener behavior, in-flight latest-state coalescing, failure retry bounds, sticky completion, and server equal-state replay behavior. Existing media E2E tests also preserve auth/resource isolation and completion timestamp behavior.

The first direct multi-file Node E2E invocation was not used as evidence because it bypassed the repository D1 harness and failed on missing local D1 binding/vinext startup. The supported local D1 harness then passed all 12 media tests. No production database or remote flag was used.

## Security, data trust, and scope gates

| Review | Result |
|---|---|
| Security Critical / High | 0 / 0 introduced |
| Data Trust Critical / High | 0 / 0 introduced |
| Auth/client authority | Preserved; client only chooses request timing |
| Resource trust | Existing user/resource/course/enrollment checks preserved |
| Stale overwrite | Same mounted writer serialized; cross-tab baseline last-write-wins remains documented |
| Completion regression | 0 introduced; client/server sticky completion preserved |
| Progress loss | No intended semantic loss; integer-second resume preserved, with bounded active checkpoint window widened from 15 to 30 seconds |
| CURRENTNESS mutation | 0 |
| Evidence mutation | 0 |
| Ontology/Skill Graph mutation | 0 |
| Course/content data mutation | 0 |
| UI behavior | No player-control or playback behavior change; cadence copy is generalized so it does not promise the retired 15-second interval |
| New dependencies | 0 |
| P4 contract mutation | 0 |

## Required handoff fields

1. Final Status: `SECURIUM_MEDIA_PROGRESS_CHECKPOINT_AMPLIFICATION_REPAIR_PASS_READY_FOR_REVIEW`
2. Repair Decision: `REDUCE_REDUNDANT_MEDIA_PROGRESS_HTTP_CHECKPOINTS_WITH_BOUNDED_COALESCING_AND_NOOP_SUPPRESSION`
3. Snapshot Date: `2026-09-07`
4. Worktree: as above
5. Branch: `fix/media-progress-amplification-repair`
6. HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
7. Fresh origin/main: `67686548da982cd9f3c11806ac21b95cf4be526a`
8. P4 On Main: PASS
9. Media Writer Count Before: 2
10. Media Writer Count After: 2
11. Writer Paths: audio player → `/api/audio/progress`; lecture player → `/api/lectures/progress`
12. Event Source Count Before: 3
13. Event Source Count After: 3
14. Event Sources: native `timeupdate`; speech `setInterval`; provider iframe `message`
15. Checkpoint Interval Before: 15 seconds
16. Checkpoint Strategy After: 30-second bounded cadence + immediate changed lifecycle flush + equal-state suppression + latest-only coalescing
17. Calls/Hour/Writer Before: 240
18. Calls/Hour/Writer After: 120 steady-state
19. Steady-State Reduction: 50%
20. Calls/Day/Writer Before: 5,760
21. Calls/Day/Writer After: 2,880
22. 100-Player Daily Before: 576,000 one-writer model
23. 100-Player Daily After: 288,000 one-writer model
24. Two-Writer 100-Player Before: 1,152,000
25. Two-Writer 100-Player After: 576,000
26. Duplicate Tab Risk: POSSIBLE residual baseline
27. Remount Risk: LOW; cleanup present
28. Event Overlap Risk: reduced; equal boundary state suppressed
29. Client Dirty Suppression: PASS
30. In-Flight Coalescing: PASS, latest pending state only
31. Last-Acknowledged State: `lastPersistedRef`, success-only
32. Server Equal-Write Suppression: PASS, no-op without schema change
33. Retry Behavior: bounded latest-state retry; no immediate retry chain
34. Completion Behavior: immediate and sticky
35. Pause Behavior: immediate changed flush; equal suppressed
36. Seek Behavior: immediate changed flush; backward resume seek preserved
37. Pagehide Behavior: no existing handler; unchanged
38. Out-of-Order Safety: serialized per mounted writer; cross-tab baseline limitation documented
39. Sticky Completion: PASS
40. Resume Semantics: latest integer-second resume position
41. Minimum Meaningful Delta: 1 second representable
42. Cross-Tab Strategy: none; no distributed lock infrastructure
43. Rate Limit: 60/minute/user unchanged
44. P4 Contract Mutation: 0
45. UI Change: no playback/control change; cadence wording generalized
46. New Dependencies: 0
47. Schema Change: 0
48. Migration Change: 0
49. CURRENTNESS Mutation: 0
50. Evidence Mutation: 0
51. Production DB: NO
52. Deployment: NO
53. Steady Playback Test: PASS, 10-minute model 40 → 20
54. 1-Hour Model: PASS, 240 → 120 per writer
55. 100-Player Model: PASS, 576,000 → 288,000 one-writer daily
56. Equal-State Test: PASS
57. Tiny-Delta Test: PASS at integer-second boundary
58. Meaningful-Delta Test: PASS
59. Pause Test: PASS
60. Ended Test: PASS
61. Seek Test: PASS
62. Pagehide Test: PASS as unchanged no-handler behavior; no new duplicate path
63. Remount Test: PASS source cleanup assertions
64. Two-Tab Test: PASS assessment; coordination not added, residual risk quantified
65. In-Flight Test: PASS
66. Failure Test: PASS bounded retry and dirty preservation
67. Out-of-Order Test: PASS per mounted writer serialization
68. Completion Regression Test: PASS
69. Server No-Op Test: PASS audio and lecture E2E equal replay
70. Request Count Assertions: PASS
71. Timer Cleanup Test: PASS
72. Focused Tests: PASS 9/9
73. Existing Media Tests: PASS 12/12
74. Unit: PASS 448/448
75. Integration: PASS local D1 media 12/12
76. Typecheck: PASS
77. Lint: PASS
78. Build: PASS
79. db:check: PASS
80. Migration Guard: PASS 10/10
81. git diff --check: PASS
82. New Skips/Only/Todo: 0/0/0
83. Security Critical/High: 0/0 introduced
84. Data Trust Critical/High: 0/0 introduced
85. Cost Reduction Assessment: material; 50% steady-state HTTP invocation reduction
86. User Experience Regression: none in playback/control semantics; bounded 30-second persistence window documented
87. Repair Side Effects: server equal-state DB no-op; generalized cadence copy; no route/schema/P4 changes
88. Commit: NO
89. Push: NO
90. PR: NO
91. Critical Blockers: none
92. Readiness Classification: independent review required
93. Repair Report: this file
94. Machine Report: `reports/securium-media-progress-checkpoint-amplification-repair-2026-09-07.json`
95. Markdown SHA-256: recorded in final handoff after artifact creation
96. Machine SHA-256: recorded in final handoff after artifact creation
97. Primary Next Gate: `REVIEW_SECURIUM_MEDIA_PROGRESS_CHECKPOINT_AMPLIFICATION_REPAIR`
