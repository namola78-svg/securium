# Assessment Rubric: Integrity Lab Rehearsal

## Use and limits

This is an instructor observation aid for one independent synthetic local
lab. It is not an official certification or examination rubric, does not
define a pass threshold, and must not be connected to platform Mastery,
Confidence, competency, or Skill State. Record evidence and coaching needs;
do not turn the total into a product status.

The existing [lab README](../README.md), [learner guide](../learner-guide.md),
[instructor guide](../instructor-guide.md), and [test module](../test_lab.py)
remain the source for the exercise contract. This rubric evaluates observable
reasoning and safe operation of that contract. It does not add a new
canonical objective or require a learner to implement production forensic
software.

## Rating language

Use one rating per dimension and cite the learner's actual command, path,
output, report, explanation, or cleanup observation.

| Rating | Observable meaning |
|---:|---|
| 0 | Not observed, contradicted by the record, or unsafe action requiring an immediate stop |
| 1 | Partial or prompted performance; important path, output, or reasoning is missing |
| 2 | Complete and accurate evidence is recorded with limited prompting |
| 3 | Complete, accurate, and independently explained with the relevant limitation or alternative made explicit |

These levels describe the quality of this rehearsal record only. They are not
grades, certification results, or platform state.

## Observable dimensions

| Dimension | Look for | Evidence to cite |
|---|---|---|
| 1. Reproducible command use and attack reproduction | Learner uses a fresh printed workspace, runs the normal case, reproduces tamper and missing-file behavior, and records actual exit codes and outputs. | |
| 2. Evidence-role separation and preservation | Learner distinguishes synthetic `original/` from `working-copy/`, does not edit the original, and shows an observed path/hash or before/after record supporting preservation. | |
| 3. Validation and failure-cause explanation | Learner explains the difference between a missing file, byte/size/hash mismatch, unsafe path, malformed record, and custody-field failure using report evidence. | |
| 4. Safe remediation or correction reasoning | When asked how to correct the exercise state, learner starts fresh or makes only an allowed synthetic record edit, chooses a new report path, and does not propose broad deletion, a mock, or an original-file edit. Any suggested code change stays within the existing contract. | |
| 5. Normal behavior and test evidence | Learner shows the untouched comparison and custody observations before negative cases, and explains which test or actual report supports the conclusion. | |
| 6. Cleanup safety | Learner cleans only printed, generated workspaces, understands marker/owner/path binding, and records outside-sentinel/original preservation without touching unrelated paths or processes. | |
| 7. Interpretation and residual limits | Learner states that hash equality is scoped byte comparison, not provenance/authenticity; custody JSON is not identity/signature proof; copy is not acquisition/write blocking; and TOCTOU is not defended. | |

## Record for this learner

| Field | Record |
|---|---|
| Learner | |
| Facilitator | |
| Date and environment | |
| Workbook reviewed | |
| Rehearsal revision | |
| Any case marked not run and reason | |

| Dimension | Rating (0–3) | Concrete evidence location or quotation | Prompting/help used | Follow-up |
|---|---:|---|---|---|
| 1. Reproducible command use and attack reproduction | | | | |
| 2. Evidence-role separation and preservation | | | | |
| 3. Validation and failure-cause explanation | | | | |
| 4. Safe remediation or correction reasoning | | | | |
| 5. Normal behavior and test evidence | | | | |
| 6. Cleanup safety | | | | |
| 7. Interpretation and residual limits | | | | |

Do not leave only the numeric rating. If a rating is recorded, identify the
actual path, report field, output line, command, or learner explanation that
supports it.

## Safety stop conditions

These are facilitation stop conditions, not an automatic fail score:

- real data, credentials, browser records, disk images, or incident material
  is introduced;
- the learner edits `original/`, targets a pre-existing user directory, or
  proposes deleting an unrelated path;
- the learner treats an unavailable symlink/reparse check as PASS;
- the learner treats a non-zero negative-case exit as a tool failure without
  reading its report;
- the learner presents a hash match, custody JSON, normal file copy, or
  read-only code path as proof of provenance, legal sufficiency, forensic
  acquisition, or hardware write blocking; or
- the learner attempts to change OS security settings or terminate unrelated
  processes to make a case pass.

Record the stop, preserve the synthetic workspace/sentinel, and follow the
runbook's [recovery sequence](instructor-runbook.md#stop-recover-and-clean-up).
Do not repair the record by inventing a result.

## Instructor synthesis

Use the following prompts after the ratings. Keep answers tied to recorded
observations rather than intuition:

1. Which observation best shows that the original remained unchanged?
2. Which error identifies the failure cause rather than merely reporting
   `REJECTED`?
3. What did the matching hash establish under this lab's algorithm and scope?
4. What independent source would be needed for a provenance or authenticity
   claim, and is it present here?
5. Why was the cleanup target limited to the generated workspace?
6. Which boundary was not tested because of platform policy or environment?

| Synthesis prompt | Instructor record |
|---|---|
| Strongest observed capability | |
| Most important misconception corrected | |
| Boundary needing another demonstration | |
| Evidence that normal function was preserved | |
| Evidence that cleanup was safe | |
| Remaining limitation communicated by learner | |
| Recommended next learning activity | |

## Status statement

The instructor may record that this learner completed an observed rehearsal
record for this independent local lab. Do not translate that statement into
Foundation publication, canonical practical registration, legal qualification,
delivery readiness, Mastery, Confidence, or Skill State.
