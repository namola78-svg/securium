# Instructor Runbook: Synthetic Forensics Timeline Lab

## Purpose and status

This runbook prepares a facilitator for a future human-led rehearsal of the independent
synthetic lab at [`../`](../README.md). It is not a record that a learner or class has
completed the lab. No real disk, user file, incident record, personal data, credential,
network target, or database is allowed.

The Foundation remains [`DRAFT_UNPUBLISHED`](../../../content-drafts/digital-forensics-8h-foundation/manifest.json)
with `executableLabs: 0`. This kit does not create a canonical practical, change
`DF-H06-P01`, issue an approval, or establish classroom or platform readiness.

Reuse the existing [learner guide](../learner-guide.md), [instructor guide](../instructor-guide.md),
and [lab README](../README.md) for the executable contract. This runbook adds pacing,
facilitation prompts, and evidence-recording guidance; it intentionally does not duplicate
the implementation guide or invent commands.

## Foundation traceability

| Existing reference | Role in this rehearsal | Boundary |
| --- | --- | --- |
| `DF-H06-O01` | Separate event identity, source identity, and synthetic file identity. | Do not infer a real filesystem path or actor. |
| `DF-H06-O02` | Preserve the original timestamp and inspect the UTC-normalized view. | UTC conversion does not establish clock accuracy. |
| `DF-H06-O03` | Build a source-linked, deterministic display timeline. | A display order is not a causal or definitive event order. |
| `DF-H06-O04` | Record gaps, conflicts, clock limits, and evidence requests. | A conflict is not proof of tampering; absence is not proof of absence. |
| `DF-H06-P01` | Existing conceptual practical reference: Network and log timeline construction. | It remains `SYNTHETIC_SPEC_ONLY`; no executable registration is performed here. |
| `DF-H06-Q01`–`DF-H06-Q05` | Existing question references only. | This rubric is not an official assessment or mastery rule. |

## Time model

The current Securium Foundation manifest assigns `DF-H06` **60 minutes** and the course total
**480 minutes**. The manifest says breaks and administration are excluded from those values. The table below
is a **proposed 75-minute facilitator rehearsal block**, not a measured learner duration or
an official course allocation. Breaks, lunch, room setup, account setup, and administration
remain separate.

| Rehearsal stage | Proposed minutes | Purpose |
| --- | ---: | --- |
| Environment and safety gate | 10 | Confirm Python, paths, synthetic-only scope, and clean output directory. |
| Normal JSON and CSV run | 15 | Generate, analyze, inspect report fields, and compare supported formats. |
| Timestamp, tie, and conflict interpretation | 15 | Practice original/UTC reasoning and uncertainty language. |
| Invalid input and overwrite boundaries | 15 | Rehearse copy-only negative cases and output preservation. |
| Learner recording and facilitator review | 15 | Use the workbook and rubric evidence prompts. |
| Cleanup and handoff | 5 | Remove only the facilitator-created temporary directory and record gaps. |
| **Total proposed rehearsal block** | **75** | **Not an official Foundation time.** |

Do not use the lab's automated test duration as learner time. Do not report this proposal as
an actual human rehearsal until the checklist has been completed with measured observations.

## Preparation

1. Check out the intended revision and record the repository revision, OS, shell, Python
   executable, and Python version in [`rehearsal-checklist.md`](rehearsal-checklist.md).
2. Confirm Python `>=3.11` and the standard-library-only dependency boundary. The existing
   compatibility evidence covers Windows/Linux × Python 3.11/3.14, but it is not evidence
   that a person completed this rehearsal.
3. Use a new temporary directory owned by this run. Do not reuse a learner's directory or
   any pre-existing report. The learner workbook must start blank.
4. Read the [learner guide](../learner-guide.md) and [instructor guide](../instructor-guide.md)
   before demonstrating a negative case. The guides define the supported CLI; this kit does
   not add a mutation command, browser step, or forensic collector.
5. State the three different times before running anything: fixture creation time, observed
   event time, and analysis run time.

## Rehearsal sequence

### 1. Safety and boundary briefing

Ask the learner to state what is in scope: synthetic JSON/CSV records and a temporary output
directory only. Confirm that the lab does not inspect OS file timestamps, collect a disk image,
parse NTFS/MFT/USN, recover deleted files, contact a network target, or prove a real incident.

Stop before execution if real data or a user-owned path has been selected.

### 2. Normal JSON run

Use a fresh path and the documented command. A unique temporary path is preferred for an
actual rehearsal; the following is the same supported flow as the existing guides:

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path $env:TEMP ("securium-forensics-timeline-instructor-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\fixture.json" `
  --output "$work\report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"
```

Have the learner record actual output, exit codes, and report paths in the workbook. The
expected observations for the facilitator are:

- six synthetic records are generated;
- fixture creation, observed event, and analysis run times are separate fields/meanings;
- `evt-001` (`09:00 +09:00`) and `evt-003`/`evt-005` (`00:00Z`) share one UTC instant;
- `evt-002` and `evt-004` share another UTC instant;
- original timestamps and timestamp meanings remain in report records; and
- the report exposes tie groups, observed facts, potential conflicts, interpretation limits,
  and additional evidence requests.

For this synthetic fixture, the expected report counts are two tie groups and one potential
conflict. These are fixture-specific observations for facilitator comparison, not findings
about a real event and not evidence that a learner completed the exercise.

Treat these as facilitator expectations to compare with the learner's actual output, not as
a prefilled learner answer.

### 3. CSV equivalence check

Run the existing documented `generate --format csv` and `analyze` commands in a different
output path, using the same fixed creation and analysis times. Ask:

- Which fields are logically equivalent between JSON and CSV?
- Which hash represents the raw input bytes, and should raw JSON and raw CSV hashes be the
  same? (No: different serialized bytes may legitimately produce different raw hashes.)
- Does the normalized timeline preserve the same event identities, UTC instants, and tie
  groups?

Do not claim byte-level identity between JSON and CSV. Compare only the normalized result
properties the lab documents.

### 4. Timestamp, tie, and conflict discussion

Ask the learner to fill the workbook's normalization ledger before explaining the answer.
Use these questions:

1. What did the source actually record, and where is that value preserved?
2. Why does applying the stated offset change the display instant without proving that the
   source clock was accurate?
3. What is the tie-break key used for, and what cannot it establish?
4. Why does a same-source/file/UTC group with different event descriptions require source
   documentation or independent corroboration rather than an instructor-selected winner?
5. What additional evidence would address clock configuration, retention, parser version,
   or source visibility?

Expected reasoning: the stable tie-break makes output reproducible; it is not an observed
sequence. A potential conflict or clock skew is an uncertainty to investigate, not a finding
of fabrication. Timestamp records alone do not establish user action, intent, ownership, or
causation.

### 5. Negative cases and preservation

Use a copy of the generated fixture for each negative case; never edit the original fixture.
The existing learner guide and tests define these supported cases:

- missing timezone or invalid timestamp;
- duplicate event identity;
- non-synthetic scope or malformed JSON;
- oversized field/input;
- existing output/report path; and
- input/output path collision or unsafe link/reparse path where the platform permits testing.

The learner should record the command, non-zero exit code, concise error meaning, and whether
the original fixture and any pre-existing report were preserved. A negative case is not a
failure of the lab merely because it exits non-zero; the expected behavior is explicit
rejection. A platform permission error for a symlink/reparse scenario is not a successful
security-boundary test and must be recorded as such.

### 6. Hash roles and human review

Ask the learner to identify all three documented values:

- `input_sha256`: hash of the raw input bytes;
- `deterministic_result_sha256`: hash of the documented analysis result, excluding dynamic
  report metadata as specified by the lab; and
- `report_bytes_sha256`: hash of the exact report bytes.

Any report-byte equality claim is limited to the same input bytes and the same fixed
`--analysis-run-at` value. Do not generalize it to reports produced with different analysis
times.

Ask what each comparison covers and what it does not prove. A matching hash here does not
prove source authenticity, signature, lawful collection, legal admissibility, or truth of an
event. The synthetic report is not a custody record or an actual forensic finding.

## Prompt bank and hints

| Learner question or misconception | Facilitator prompt |
| --- | --- |
| “The first row happened first.” | If the input array is reordered, what remains stable and why? |
| “UTC proves the clock was correct.” | What does normalization know about the source clock configuration? |
| “The event ID tie-break proves causality.” | Is the key observed in the source or added for display reproducibility? |
| “A missing proxy record proves no transfer.” | What retention or visibility gap could explain the absence? |
| “A conflict means someone altered the record.” | What independent corroboration or source documentation is missing? |
| “The report hash proves authenticity.” | Which bytes were hashed, and where is signer/provenance evidence? |
| “Timezone omission can use my PC setting.” | What source evidence authorizes that assumption? |
| “A generated report can be overwritten for convenience.” | What does exclusive creation protect, and which new path should be used? |

Do not supply the learner's final wording before they record the relevant event/report
location. The required evidence is a cited path, field, output, or explanation, not a checkbox.

## Stop, recover, and clean up

Stop immediately if a real path, real evidence, credential, network target, or user data is
introduced; if the original fixture is modified; or if a learner attempts broad deletion or
process termination. Record the event and preserve the synthetic materials for review.

For a normal rehearsal, clean only the exact `$work` directory created by this run after the
learner has recorded its path and hash observations. Do not use a broad recursive command on
`$env:TEMP`, the repository, or a user directory. If cleanup rejects the path, leave it in
place and record the error for the checklist rather than substituting an unrestricted delete.

## Handoff record

Complete the checklist and rubric with actual observations. Record:

- which commands and negative cases were actually run;
- environment and measured stage durations;
- blocked or platform-specific cases;
- wording or command corrections proposed; and
- remaining human rehearsal work.

An observed rehearsal may be recorded as an observed rehearsal of this independent lab only.
It must not be converted into Foundation publication, executable-lab registration, an
official exam result, mastery/Skill State, or delivery readiness.
