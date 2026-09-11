# Assessment Rubric: Observable Review Evidence

This rubric helps an instructor give consistent feedback on the M01–M08
practice. It is not an official qualification, certification examination,
pass/fail threshold, or platform Mastery, Confidence, or Skill State
calculation. Use it to discuss evidence and next practice with the learner.

## Evidence scale

Use 0, 1, or 2 for each criterion. A number without the cited code location
and observed evidence is incomplete.

| Score | Observable meaning |
|---:|---|
| 0 | Not demonstrated, contradicted by the record, or supported only by a claim such as AI confidence or a green formatter. |
| 1 | Partly demonstrated: some correct reasoning or output is present, but a source/sink, boundary, normal case, test, or limitation is missing. |
| 2 | Clearly demonstrated with exact code location, actual command/output or state observation, and a bounded explanation. |

The six criteria have a maximum evidence score of 12 for instructor
conversation only. Do not turn 12 into a universal pass mark. A lower score
may simply identify the next coaching step, and a high score does not approve
production deployment.

## Criteria

### 1. Attack reproduction

Look for:

- a named focused test or exact reproduction command;
- the vulnerable draft behavior observed directly;
- a clear explanation that a passing vulnerable assertion means the intended
  weakness was reproduced, not that the draft is safe;
- a secure comparison where the module provides one.

Examples include M01 client-controlled private exposure, M02 SQL/shell/eval
injection, M03 unsafe pickle marker execution, M04 traversal/upload/loopback
SSRF, M05 raw HTML or client-fixture CSRF, M06 BOLA/session fixation, M07
secret-channel leaks, and M08 all four composed flows.

Award 2 only when the record identifies what changed or was observed. A
learner who merely says the test passed has not shown reproduction.

### 2. Cause explanation

Look for a Source / Validation / Sink trace with path plus function or line,
the interpreter or state-changing sink, and the trust/authority boundary.
The explanation should identify the control failure, not just repeat the
vulnerability name.

Examples:

- M01 distinguishes request data from ViewerContext authority.
- M02 distinguishes data binding from structural allowlisting and parsing.
- M03 separates untrusted request bytes from a server-owned artifact.
- M04 states the containment postcondition and destination policy.
- M05 distinguishes HTML context encoding, session-bound CSRF, and safe
  failure channels.
- M06 names subject, object, action, and tenant.
- M07 traces necessary and unnecessary secret channels and names evidence
  needed for dependency/provenance decisions.
- M08 explains why controls do not substitute for one another.

### 3. Repair appropriateness

Look for a repair that matches the sink and preserves the stated requirement:
server-owned authority, bound data, closed structure, bounded parser,
containment, exact destination policy, context-specific encoding,
session-bound CSRF, server-side authorization, provider/redaction boundary,
evidence-based triage, or provenance review as applicable.

Check for:

- repair placement at or before the relevant sink;
- no reliance on client-side hiding, escaping alone, a filename/extension,
  shell=False alone, a smaller eval namespace, a package lock, a scanner
  clean result, or AI output;
- no unrelated or untested changes;
- no reject-everything patch where normal behavior is required.

### 4. Normal function preservation

Look for actual positive/regression evidence that the intended feature still
works. Examples are public and authorized-internal avatar views, normal search,
allowed filter, JSON import and trusted migration behavior, normal file/upload
and allowed preview, valid theme change, owner/admin document behavior, normal
secret-backed processing, and M08 search/file/invoice/preview paths.

Require the learner to record the observed return value, response, state
transition, or other output. A statement that normal behavior is preserved is
not enough.

### 5. Test evidence

Look for:

- exact command from the original learner guide;
- relevant test name or input;
- actual output/status/body/state/marker/log observation;
- rerun after repair when code was changed;
- separation of normal, attack, regression, and boundary evidence;
- honest treatment of failures and skipped/not-applicable evidence.

The repository's current 50-test compatibility record is context, not a
substitute for the learner's own focused evidence. The earlier 49-test record
is historical provenance for the pre-repair bundle. Do not require a repeat of
all 50 tests merely because this kit was added; run what is proportionate to
actual code changes and rehearsal needs.

### 6. Remaining-limitations awareness

Look for explicit limits and the evidence they would require next. Examples:

- M05's Python HTTP client is not browser verification.
- M04/M08 mocked or loopback networking is not production egress isolation.
- local fixtures do not prove framework hardening, TLS, real identity,
  database permissions, secret management, CI isolation, registry integrity,
  or production log-redaction pipelines.
- compatibility on listed Python/OS versions does not imply all versions,
  macOS, or a learner rehearsal.
- a synthetic digest, fake provider, package advisory, or model suggestion is
  not a production authority record.

A learner may accept the bounded local result while still recording these
limits. That is stronger evidence than claiming universal safety.

## Instructor record

| Criterion | 0 / 1 / 2 | Evidence location and observed basis |
|---|---:|---|
| Attack reproduction | | |
| Cause explanation | | |
| Repair appropriateness | | |
| Normal function preservation | | |
| Test evidence | | |
| Remaining-limitations awareness | | |

Instructor feedback / next practice:

______________________________________________________________________________

______________________________________________________________________________

## Q36 revision boundary

The repository canonical Q36 record now has `answer: 1` (B/2), and #147
merged the correction with verified immutable revision-boundary checks. Use
B/2 when discussing the content and evaluating the learner's reasoning. The
default mapping/preflight path requires `QUESTION_REVISION_CONTEXT_REQUIRED`;
only the fixed candidate context projects Q36-v2. This does not establish
source/approval authority: source and approval remain `UNKNOWN`, candidate
preflight is `BLOCKED`, persistence is `NOT_READY`, and no `humanReviewHash` or
canonical receipt exists. Do not present Q36-v2 as an authority-issued Runtime
revision or as automated scoring/publication evidence. If a score requires
Runtime authority binding, leave that item score unbound rather than inventing
one. Evaluate M07 security reasoning through P07 Source/Validation/Sink
evidence, dependency triage, provenance discussion, tests, and the learner's
human judgment; this does not redefine the rubric as a certification standard.
