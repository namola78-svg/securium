# Assessment Rubric: Synthetic Forensics Timeline Rehearsal

## Use and limits

This is an instructor observation aid for a future rehearsal of one independent synthetic
local lab. It is not an official exam, certification, pass threshold, canonical assessment,
mastery calculation, Confidence value, competency evidence, or Skill State update. Do not
connect its ratings to the platform.

The existing [lab README](../README.md), [learner guide](../learner-guide.md),
[instructor guide](../instructor-guide.md), and [learner workbook](learner-workbook.md)
remain the exercise references. A rating is meaningful only when tied to the learner's actual
command, path, output, report field, or explanation.

## Rating language

| Rating | Observable meaning |
| ---: | --- |
| 0 | Not observed, contradicted by the record, or unsafe action requiring a stop. |
| 1 | Partial or prompted performance; an important value, boundary, or limitation is missing. |
| 2 | Complete and accurate evidence is recorded with limited prompting. |
| 3 | Complete, accurate, and independently explained with a relevant limitation or alternative. |

These ratings describe this rehearsal record only. Do not sum them into an official result.

## Observable dimensions

| Dimension | Look for | Evidence to cite |
| --- | --- | --- |
| 1. Reproducible local execution | Learner uses a fresh temporary path, runs the supported JSON/CSV flow, records commands and exit codes, and preserves existing outputs. | |
| 2. Source and time semantics | Learner distinguishes event/source/file identity, fixture creation time, observed event time, and analysis run time; original timestamps are retained. | |
| 3. Normalization and precision | Learner applies stated offsets, records UTC without discarding the original, and explains that normalization does not prove clock accuracy or add precision. | |
| 4. Tie, conflict, and uncertainty reasoning | Learner treats deterministic tie-break as display-only, does not infer causality, and separates source conflict/clock skew possibilities from confirmed tampering. | |
| 5. Negative-case and preservation reasoning | Learner reproduces or records supported rejection cases, uses copies, distinguishes expected non-zero failure from tool failure, and checks original/output preservation. | |
| 6. Hash and reproducibility scope | Learner distinguishes raw input, deterministic result, and report-byte hashes and states the provenance/authenticity/legal limits of each. | |
| 7. Evidence request and communication | Learner identifies a concrete additional source/context request and records observation, hypothesis, alternative, and unresolved question separately. | |

## Rehearsal record

| Field | Record |
| --- | --- |
| Learner | |
| Facilitator | |
| Date and timezone | |
| Revision/environment | |
| Workbook reviewed | |
| Cases actually run | |
| Cases not run and reason | |

| Dimension | Rating (0–3) | Concrete evidence location/quote | Prompting or help used | Follow-up |
| --- | ---: | --- | --- | --- |
| 1. Reproducible local execution | | | | |
| 2. Source and time semantics | | | | |
| 3. Normalization and precision | | | | |
| 4. Tie, conflict, and uncertainty reasoning | | | | |
| 5. Negative-case and preservation reasoning | | | | |
| 6. Hash and reproducibility scope | | | | |
| 7. Evidence request and communication | | | | |

Do not leave only a number. Cite the actual event ID, report field, path, output line,
command, or learner explanation supporting the observation.

## Safety stop conditions

Stop and record the event if:

- real data, a credential, browser record, disk image, user path, incident material, or
  external network target is introduced;
- the learner edits the original fixture or an existing report;
- a tie-break is presented as actual event order or causation;
- a source conflict or clock skew is presented as confirmed tampering;
- a hash is presented as proof of authenticity, signature, lawful collection, or legal proof;
- a timezone is silently guessed from the execution computer; or
- an unavailable platform-specific symlink/reparse case is marked PASS without execution.

These are facilitation stop conditions, not an automatic numeric score. Preserve the
synthetic materials, record the path and observation, and follow the runbook recovery steps.

## Instructor synthesis

| Prompt | Instructor record with evidence |
| --- | --- |
| Strongest direct observation recorded | |
| Most important misconception corrected | |
| Best example of fact vs hypothesis separation | |
| Additional evidence request that was most concrete | |
| Boundary not run or needing another platform | |
| Wording/command that should be revised | |
| Recommended next learning activity | |

The only status this rubric may support is an observed rehearsal record for this independent
lab. It does not support Foundation publication, executable-lab registration, official exam
status, mastery/Skill State, or classroom/platform delivery readiness.
