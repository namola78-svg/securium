# Learner Workbook: Synthetic Forensics Timeline Lab

Use this workbook with the [lab README](../README.md) and [learner guide](../learner-guide.md).
It is intentionally blank: do not copy expected answers, hashes, scores, or another learner's
results into it. Record the actual command, path, output, report field, and explanation from
your own synthetic run.

This is a local educational analysis of invented records. It is not disk acquisition, an
NTFS/MFT/USN parser, a real incident reconstruction, legal proof, or a platform assessment.

## 1. Run identity and safety

| Field | Your record |
| --- | --- |
| Learner | |
| Facilitator | |
| Date and timezone | |
| Repository revision | |
| Operating system/version | |
| Shell/version | |
| Python version/executable | |
| Lab path | `examples/digital-forensics-timeline-local-lab/` |
| Temporary work path created for this run | |
| Why this input is synthetic and local-only | |

Before proceeding, confirm in your own words that you will not use a real user file, disk,
credential, network target, database, or incident record.

## 2. Execute the supported flow

Create a new temporary directory and use a fixed analysis time so the report can be compared
within this run. Run the commands from the repository root; replace only the temporary path.

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path $env:TEMP ("securium-forensics-timeline-learner-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\fixture.json" `
  --output "$work\report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"
```

Record the exact commands and exit codes:

| Action | Actual command/path | Exit code | Actual output or report location |
| --- | --- | ---: | --- |
| Generate JSON | | | |
| Analyze JSON | | | |
| Generate CSV | | | |
| Analyze CSV | | | |

Use a separate output filename for every report. Do not overwrite an existing report or the
repository's files.

## 3. Keep the three times separate

| Time | Actual value/location | Meaning and limitation |
| --- | --- | --- |
| Fixture creation time | | When the synthetic record bundle was generated. |
| Observed event time | | What the source record says it observed; preserve the original string. |
| Analysis run time | | When the analysis command ran; it is not an event time. |

## 4. Timestamp normalization ledger

Copy actual values from the fixture/report. Do not infer a missing timezone from the computer
that runs the lab.

| Event ID | Source ID | Synthetic file ID | Event type | Original timestamp | Offset | UTC value | Timestamp meaning/source | Report location |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |

Answer with evidence:

| Question | Your explanation and event/report evidence |
| --- | --- |
| Which records have different offsets but the same UTC instant? | |
| What does UTC normalization change? | |
| What does it not prove about clock accuracy? | |
| Which time precision is actually present? | |

## 5. Ties, conflicts, and uncertainty

| UTC instant or group | Event IDs in the report | Deterministic display/tie-break observed | What cannot be concluded about order | Evidence location |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

Complete this sentence without treating the display order as history:

> The tie-break order is for ________________________________, not proof of ________________________________.

| Potential conflict or gap | Direct observation | Plausible alternatives | Additional evidence needed | Report location |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |
| | | | | |

Do not describe a conflict as confirmed tampering, a clock difference as confirmed deception,
or a missing record as proof that an event did not happen.

## 6. Boundary cases

Use a copy of the generated fixture for each edit. Keep the original fixture unchanged.
The existing guide/test contract covers timezone omission, invalid timestamp, duplicate event
identity, non-synthetic scope, malformed/oversized input, and path/overwrite boundaries.

| Case | Copy/path used | Change made | Actual exit code | Actual error meaning | Original preserved? | Evidence location |
| --- | --- | --- | ---: | --- | --- | --- |
| Missing timezone | | | | | | |
| Invalid timestamp | | | | | | |
| Duplicate event identity | | | | | | |
| Non-synthetic scope or malformed input | | | | | | |
| Oversized field/input | | | | | | |
| Existing output / input-output collision | | | | | | |
| Symlink/reparse case, if actually permitted | | | | | | |

An expected rejection must have a non-zero exit code and a recorded reason. A platform or
permission limitation is `NOT_RUN`/`UNKNOWN`, not a successful boundary result.

## 7. Hash roles and reproducibility

| Hash or metadata | Actual value | Bytes or result covered | What the comparison can support | What it cannot prove |
| --- | --- | --- | --- | --- |
| `input_sha256` | | | | |
| `deterministic_result_sha256` | | | | |
| `report_bytes_sha256` | | | | |
| `analysis_run_at` | | | | |

If you repeat the same input with the same fixed analysis time, record the comparison. If you
change the analysis time, record which metadata or report bytes change. A hash does not prove
source authenticity, a signature, lawful collection, legal sufficiency, or that the recorded
event is true.

| Repetition | Input/report paths | Values compared | Same/different | Explanation |
| --- | --- | --- | --- | --- |
| Same input and fixed analysis time | | | | |
| Same logical records in JSON and CSV | | | | |
| Different analysis time | | | | |

## 8. Final human explanation

| Prompt | Your answer with concrete evidence |
| --- | --- |
| What facts are directly observed in the records? | |
| What is only a hypothesis or possible interpretation? | |
| Which conclusion must remain unresolved? | |
| What independent source or context would you request next? | |
| Which boundary did you not run, and why? | |
| What did you learn about source, validation, and sink/output handling? | |

## 9. Cleanup and handoff

| Field | Your record |
| --- | --- |
| Exact temporary directory created by me | |
| Cleanup command used | |
| Cleanup exit code/result | |
| Existing repository/report files preserved? How verified? | |
| Remaining question or help requested | |

Remove only the temporary directory created for this run. This workbook records learning
evidence; it is not an official exam score, mastery state, canonical practical result, or
delivery approval.
