# Securium Media Progress Server No-op and Player Identity Repair

## Decision

- Final Status: `SECURIUM_MEDIA_PROGRESS_SERVER_NOOP_AND_PLAYER_IDENTITY_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
- Repair Decision: `CLOSE_SERVER_REVISION_AWARE_NOOP_AND_SEMANTIC_PLAYER_IDENTITY_BLOCKERS`
- Snapshot Date: 2026-09-08 (Asia/Seoul)
- Primary Next Gate: `REVIEW_SECURIUM_MEDIA_PROGRESS_SERVER_NOOP_AND_PLAYER_IDENTITY_REPAIR`
- Scope: bounded data-integrity repair only; the existing 30-second checkpoint reduction is preserved.

## Baseline and scope

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-media-progress-amplification-repair`
- Branch: `fix/media-progress-amplification-repair`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `67686548da982cd9f3c11806ac21b95cf4be526a`
- Ahead/behind: `0/1`; no rebase or merge performed.
- Main drift: `NON_CONFLICTING_DRIFT`.
- P4 commit `9756970ce19a64d6ac0e913631193b606dc78e7c` is contained by fresh `origin/main`.
- Initial state was dirty with the prior implementation/review artifacts. The final tracked diff is limited to the media progress writers, their repositories, the lecture page boundary, and focused tests. No schema, migration, Evidence, CURRENTNESS, or P4 files changed.
- Previous implementation artifact hashes remained exact: implementation Markdown `04486A034E78E5D3310C735B4BA77B28E16797FEFA28C9E1C81FA560C756FA1B`; implementation JSON `984AEC871A38C4D9DC6DDE66790311A92ACA891D2F31DFBDFF569EAAE8C256E5`.
- Previous final-review artifact hashes remained exact: Markdown `72044D1EF765A6547188CDE700E4531EF63AA71AA851396A47E4CCB2288F51E0`; JSON `C1A00C7E611D2174373D342B1639ADE85E97FFBEB178D96B608F35D3F725AA5C`.

## Blocker results

### BLOCKER-01 — server no-op omitted `contentRevisionId`

Result: **CLOSED**.

Both `updateAudioProgress` and `updateLectureProgress` now resolve the canonical latest published revision before the no-op decision. The semantic comparison is position, completion, and the resolved `contentRevisionId`. The lookup is already scoped by authenticated learner and the validated audio/lecture identity after the existing access check. The client cannot supply a revision hint that becomes authoritative.

Consequences:

- same learner/item, same position, same completion, same revision → no persistent mutation;
- same position and lecture with revision A → revision B → write;
- NULL → revision and revision → NULL → write when that canonical transition is produced;
- NULL → NULL → no-op;
- changed position or completion → write;
- completed rows retain their established revision and sticky completion semantics.

`contentRevisionId` already existed in both progress tables, so schema change, migration change, and historical migration mutation are all zero.

### BLOCKER-02 — LecturePlayer lacked a proven reuse boundary

Result: **CLOSED**.

The lecture page now gives `LecturePlayer` a stable semantic React key:

`learner identity + lecture ID + latest published content revision ID`

The page passes both the latest canonical revision and the persisted progress revision. A revision mismatch for uncompleted progress forces the first legitimate checkpoint even when the numeric position is unchanged. A completed record remains sticky and is not rebound to a later revision.

The player cleanup clears its pending timer, removes the message listener, marks the instance unmounted, and prevents a late response from draining queued state or updating the new UI. Same-key ordinary rerenders preserve state and do not create a new writer. A different lecture or revision changes the key and creates a fresh player instance.

## Semantic and race review

- Semantic progress identity: authenticated learner + canonical lecture/audio item; for lecture display/reuse, latest published `contentRevisionId` is included in the player key. The server derives revision from canonical content state rather than trusting the caller.
- Server no-op predicate: scoped canonical learner/item row plus normalized position, sticky completion, and canonical revision ID.
- Revision contract: nullable persisted field. Equality uses explicit `===`-equivalent null/string semantics, not truthiness. Missing or malformed caller-supplied revision fields are not accepted as canonical API input; the server resolves the revision.
- Completion: `current.completed || input.complete` remains sticky. Completion transitions are not suppressed when position is unchanged, and completion flushes remain immediate.
- Lecture reuse: Lecture A/revision 1 → Lecture B/revision 1 resets; Lecture A/revision 1 → Lecture A/revision 2 resets and performs the first revision-aware checkpoint when needed.
- Ordinary rerender: same learner, lecture, and revision key remains stable; no reset amplification.
- Pending/stale response: an old instance may finish its already-issued HTTP request, but cannot drain a follow-up queue or mutate the mounted replacement UI. The request remains lecture/user scoped server-side.
- In-flight coalescing: one request at a time; newer state replaces the single pending state. Completion and the latest rewind/seek state are retained as the latest necessary state.
- Failure: acknowledgement state updates only after a successful response. Failure retains the required state and schedules one bounded retry opportunity; no immediate recursion or unbounded retry chain.
- Cross-user and cross-lecture safety: existing authentication/access checks and user/item predicates remain unchanged; no client authority was added.

## Performance preservation

The existing shared checkpoint constant remains `30_000` ms. No new periodic writer was added.

These are MODEL / NOT OBSERVED PRODUCTION TRAFFIC:

| Model | Before (15s) | After (30s) | Reduction |
| --- | ---: | ---: | ---: |
| 10 minutes, one writer | 40 | 20 | 50% |
| One writer/hour | 240 | 120 | 50% |
| One writer/day | 5,760 | 2,880 | 50% |
| 10 writers/day | 57,600 | 28,800 | 50% |
| 100 writers/day | 576,000 | 288,000 | 50% |
| 1,000 writers/day | 5,760,000 | 2,880,000 | 50% |

For 100 players with two continuously active writers each: 1,152,000 → 576,000 modeled requests/day. Boundary events such as pause, seek, completion, and bounded failure recovery are additional legitimate writes and are not counted as steady cadence.

The server no-op removes the DB mutation after an HTTP request has arrived; it does not remove the HTTP invocation. The client cadence, dirty gate, revision gate, and in-flight coalescing are therefore the primary invocation-reduction layers.

The ordinary single-writer rate remains far below the existing 60/minute/user rate limit. The rate limit is retained and is not treated as aggregate cost protection.

## Validation

- Focused media progress tests: **15/15 PASS**.
- Independent amplification model: **9/9 PASS**; 15s → 30s and 240 → 120 requests/hour/writer.
- Local media/audio/lecture D1 regression suite: **14/14 PASS** (12 existing plus 2 revision-transition tests).
- P4 observability regression: **16/16 PASS**; contract and route coverage unchanged.
- Unit suite: **448/448 PASS**.
- Relevant local integration suite: **59/59 PASS**; migration guard in the integration command: **10/10 PASS**.
- Typecheck: **PASS**.
- Lint: **PASS**.
- Build: **PASS**.
- `db:check`: **PASS**.
- Migration guard: **10/10 PASS**.
- `git diff --check`: **PASS**.
- New `skip`/`only`/`TODO`: **0/0/0**.

Focused coverage includes identical state, changed progress, changed completion, revision transitions including NULL boundaries, malformed caller hints, same-identity rerender stability, lecture/revision reuse, stale unmount behavior, and cadence bounds. Local D1 tests prove revision A → B and NULL transitions cause a write when the canonical revision changes, while equal replay is a no-op.

## Risk and non-goals

- Security Critical/High: **0/0**.
- Data Trust Critical/High: **0/0**.
- UI/UX regression: none observed; play, pause, seek, resume, and completion controls are unchanged.
- Pagehide: no handler remains; this repair does not claim unload persistence.
- Cross-tab coordination: none added. Duplicate tabs remain a bounded residual risk; server no-op protection reduces equal DB mutations but cannot remove their HTTP invocations or resolve conflicting latest states globally.
- Dynamic SSR and bot/crawler amplification remain separate, unmeasured risks.
- Historical Aug 21–26 usage-spike root cause remains **UNRESOLVED**. This repair reduces a plausible recurrence path and does not establish historical causation for the approximately 2.98M function invocations / 2.47M edge requests.
- Vercel production observation remains unavailable while the account restriction remains; future P4 production observation is required after that restriction is resolved.
- Evidence mutation: 0. CURRENTNESS mutation: 0. Schema/migration change: 0/0. Production DB, deployment, production traffic, and production load test: NO.

## Publication boundary

- Implementation mutation: present and limited to this bounded repair plus focused tests.
- Commit: NO. Push: NO. PR: NO.
- Future publication must be prepared from fresh `origin/main`; this worktree is one commit behind and must not be published directly.
- P0/P1/P2: **0/0/0**.
- Remaining work: independent final rereview, then clean-main publication preparation if approved.

## Report identity

- Repair report: `docs/performance/securium-media-progress-server-noop-and-player-identity-repair-2026-09-08.md`
- Machine report: `reports/securium-media-progress-server-noop-and-player-identity-repair-2026-09-08.json`
- Report SHA-256 values are calculated after both files are written and reported with the handoff.
