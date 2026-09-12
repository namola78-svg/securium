# Securium Forensic Timeline Offline Package

This package is a self-contained, offline copy of the synthetic digital-forensics
timeline lab and its rehearsal documents. It is intended for local study and
facilitator preparation. It is not the whole Digital Forensics Foundation and it
does not declare classroom, publication, or delivery readiness.

## Scope and education status

- The lab accepts only explicitly marked synthetic JSON or CSV records.
- It does not acquire evidence, inspect NTFS/MFT/USN, read operating-system file
  timestamps, recover deleted files, contact a network, access a database, or
  use credentials.
- The Foundation remains [`DRAFT_UNPUBLISHED`](content-drafts/digital-forensics-8h-foundation/manifest.json)
  with `executableLabs: 0`. The current `DF-H06` allocation remains 60 minutes
  and the Foundation total remains 480 minutes.
- The rehearsal kit's 75-minute schedule is a separate, proposed, unmeasured
  rehearsal block. It is not a learner duration or a Foundation allocation.
- The learner workbook, answers, hashes, and ratings are intentionally blank.
  The package does not create canonical registration, a practical approval,
  publication, or delivery readiness.

The fixture-specific facilitator expectation is six records, two tie groups, and
one potential conflict. These values describe the current synthetic fixture only;
they are not findings about a real case or universal rules. A deterministic tie
order is display-only, not causality. A potential conflict is unresolved and not
confirmed contradiction or tampering.

## Run after extraction

Change directory to the extracted package root. No repository checkout,
`PYTHONPATH`, `PYTHONHOME`, network, database, third-party dependency, or
credential is required.

On Windows PowerShell:

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("securium-forensics-timeline-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\fixture.json" `
  --output "$work\report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"

Get-Content "$work\report.json"
```

The same `generate` command supports `--format csv`; analyze the resulting CSV
with the same `analyze` command. The CLI reports `input_sha256`,
`deterministic_result_sha256`, and `report_bytes_sha256`. The input is read-only,
and an existing report or input/output collision is rejected. Use a new report
path for each run. Remove only the exact `$work` directory created by this run
after recording the exercise:

```powershell
Remove-Item -LiteralPath $work -Recurse -Force
```

On Unix-like systems use `python3` and the equivalent exact-path cleanup command.
Do not substitute a repository, evidence, or broad temporary-directory path.

## Extracted test execution

From the extracted package root, run both the standard discovery and the lab's
strict runner:

```text
python -m unittest discover -s examples/digital-forensics-timeline-local-lab -p "test_*.py" -v
python examples/digital-forensics-timeline-local-lab/run_tests.py
```

Use `python3` where that is the local interpreter name. The discovered and
executed test counts are derived from the extracted source; no historical count
is a pass criterion. The runner rejects zero, skipped, failed, or errored tests.

## Rebuild and source-bound verification

The builder, verifier, and their package-boundary tests remain in the repository;
they are not placed in this teaching ZIP. From a clean checkout at the recorded
source commit, write artifacts to a new directory outside that checkout:

```text
python -B examples/digital-forensics-timeline-offline-package/build_offline_package.py build --repository-root . --output-dir <directory-outside-repository> --source-commit <source-commit>
python -B examples/digital-forensics-timeline-offline-package/build_offline_package.py verify --zip <directory-outside-repository>/securium-forensics-timeline-offline-package.zip --manifest <directory-outside-repository>/securium-forensics-timeline-offline-package.manifest.json --repository-root . --source-commit <source-commit> --extract-dir <new-empty-extraction-directory> --report <new-verification-report.json>
```

Use new, empty artifact and extraction paths for every run. Existing ZIPs,
manifests, reports, and extraction directories are never overwritten. A failed
build removes only package files created by that build; a failed extraction
removes only the extraction root created by that verification. Pre-existing
sentinels and unrelated directories are preserved.

`package-manifest.json` is inside the ZIP and describes only the explicit source
allowlist. Each entry records its repository source path, archive path, byte
size, SHA-256, and Git blob identity. The source commit and tree are recorded
separately. The external manifest records the final ZIP size/hash and the
internal manifest hash; neither manifest hashes itself or the final ZIP in a
circular way.

Source-bound verification requires an independently supplied clean trusted
checkout and exact trusted source commit. It reads the allowlisted blobs from
that committed Git tree and checks every source path, archive path, blob ID,
size, SHA-256, extracted bytes, entry set, and Markdown link classification.
Changing payload and both manifests together, or changing recorded commit/path
fields together, remains rejected. Without the trusted source, verification is
rejected rather than reported as a source-verification pass. This verifies
agreement with the specified committed source; it does not establish official
authenticity, signatures, lawful collection, licensing, legal admissibility, or
truth of a synthetic observation.

## Included material and external references

Start with the [lab README](examples/digital-forensics-timeline-local-lab/README.md),
then use the [learner guide](examples/digital-forensics-timeline-local-lab/learner-guide.md),
[instructor guide](examples/digital-forensics-timeline-local-lab/instructor-guide.md),
and the four rehearsal documents below.
The rehearsal directory contains the [instructor runbook](examples/digital-forensics-timeline-local-lab/rehearsal-kit/instructor-runbook.md),
[learner workbook](examples/digital-forensics-timeline-local-lab/rehearsal-kit/learner-workbook.md),
[assessment rubric](examples/digital-forensics-timeline-local-lab/rehearsal-kit/assessment-rubric.md),
and [rehearsal checklist](examples/digital-forensics-timeline-local-lab/rehearsal-kit/rehearsal-checklist.md).

Foundation and the existing [integrity lab](examples/digital-forensics-integrity-local-lab/)
are repository-relative external references and are not copied into this package.
The verifier records them as external rather than claiming they are available
offline.
