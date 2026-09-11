# Securium Forensic Integrity Offline Package

This package is a self-contained, offline copy of the independent synthetic
forensic-integrity local lab and its rehearsal materials. It is intended for
local study and facilitator preparation after extraction; it is not the whole
digital-forensics course and it does not declare classroom delivery readiness.

## Status and scope

- Foundation: `DRAFT_UNPUBLISHED`; `executableLabs=0`.
- DF-H02 allocation: 60 minutes in the Foundation.
- The rehearsal kit's 75-minute schedule is a separate proposed facilitator
  rehearsal, not a measured learner duration and not a change to the 60-minute
  allocation.
- All evidence is synthetic. This package performs no real disk acquisition,
  physical write-blocker validation, investigation, signature verification, or
  identity verification.
- Hash equality compares the bytes that were read. It does not prove source
  authenticity, lawful collection, prior integrity, legal admissibility, or
  the trustworthiness of the manifest. The lab does not claim TOCTOU
  protection.

The package contains the lab implementation, CLI, tests, learner and
instructor guides, and the four rehearsal-kit documents. The package builder
and its tests remain in the source repository and are intentionally not
included in this ZIP.

## Run after extraction

Change directory to the extracted package root. No repository checkout,
`PYTHONPATH`, `PYTHONHOME`, network, database, third-party dependency, or
credential is required.

On Windows PowerShell:

```powershell
$workspace = python examples/digital-forensics-integrity-local-lab/cli.py prepare --recorded-at 2026-01-01T00:00:00Z | ConvertFrom-Json
$normalReport = "reports\\normal.json"
python examples/digital-forensics-integrity-local-lab/cli.py verify --workspace $workspace.workspace --report $normalReport
python examples/digital-forensics-integrity-local-lab/cli.py tamper --workspace $workspace.workspace --path working-copy/host-alpha/events/authentication.log
$tamperedReport = "reports\\tampered.json"
python examples/digital-forensics-integrity-local-lab/cli.py verify --workspace $workspace.workspace --report $tamperedReport
python examples/digital-forensics-integrity-local-lab/cli.py cleanup --workspace $workspace.workspace
```

The PowerShell example is intentionally a guide to the existing CLI contract;
read the lab README and guides for the exact returned fields and for the
missing-file scenario. The normal verification exits `0`; a detected tamper
or missing file is an expected rejected result and exits nonzero. On Unix-like
systems use `python3` in the same commands. The CLI's `prepare` command
creates its own temporary workspace; use the returned workspace and report
paths rather than substituting a source or evidence directory.

To run the packaged test discovery from the extracted root:

```text
python -m unittest discover -s examples/digital-forensics-integrity-local-lab -p "test_*.py" -v
```

Use `python3` where that is the local interpreter name. The test count is
defined by the extracted source and may change; do not treat a historical
count as a pass criterion. A platform-specific test may be skipped only when
the package explicitly records the platform limitation.

## Rebuild from a source checkout

The builder is kept in the source repository, not in this extracted package.
From a clean checkout at the recorded source commit, give it a new output
directory outside that repository:

```text
python -B examples/digital-forensics-integrity-offline-package/build_offline_package.py build --repository-root . --output-dir <directory-outside-repository> --source-commit <source-commit>
python -B examples/digital-forensics-integrity-offline-package/build_offline_package.py verify --zip <directory-outside-repository>/securium-forensics-integrity-offline-package.zip --manifest <directory-outside-repository>/securium-forensics-integrity-offline-package.manifest.json --extract-dir <new-disposable-extraction-directory> --report <new-verification-report.json>
```

Use a new, empty artifact and extraction directory for each run. The builder
refuses to replace an existing ZIP, manifest, or report; a failed verification
does not turn an expected rejection into a success.

## Included material

Start with the [lab README](examples/digital-forensics-integrity-local-lab/README.md),
then use the [learner guide](examples/digital-forensics-integrity-local-lab/learner-guide.md)
and [instructor guide](examples/digital-forensics-integrity-local-lab/instructor-guide.md).
The rehearsal documents are the [instructor runbook](examples/digital-forensics-integrity-local-lab/rehearsal-kit/instructor-runbook.md),
[learner workbook](examples/digital-forensics-integrity-local-lab/rehearsal-kit/learner-workbook.md),
[assessment rubric](examples/digital-forensics-integrity-local-lab/rehearsal-kit/assessment-rubric.md),
and [rehearsal checklist](examples/digital-forensics-integrity-local-lab/rehearsal-kit/rehearsal-checklist.md).

The original documents retain repository-relative references to the Foundation
where relevant. Those references are external to this package: the Foundation
is not copied into the ZIP, and an extracted package does not claim that the
Foundation is available offline. The package verifier records such references
separately from package-relative links.

## Package integrity files

`package-manifest.json` is inside the ZIP. It describes the allowlisted source
entries, their sizes and SHA-256 digests, the source commit, and the fixed ZIP
construction settings. It deliberately does not hash itself or the final ZIP;
this avoids a circular digest.

The external manifest beside the ZIP records the final ZIP size and SHA-256,
and points to the internal manifest by its package-relative name. Verify the
ZIP against that external manifest before extraction, then verify the internal
entry set and each entry's bytes. These manifests are integrity records, not
signatures, provenance evidence, or proof that the source commit itself is
trustworthy.

The builder refuses to overwrite an existing ZIP, manifest, or report. It
rejects unsafe archive names, duplicate or case-fold-colliding entries,
symlink/reparse paths, and source bytes that do not match the requested Git
commit. Reproducibility is verified only for the same source bytes and builder
environment; cross-version Python, zlib, operating-system, or filesystem
byte identity is not claimed without separate evidence.

This package preserves the lab's educational boundary: generated evidence is
synthetic, custody notes are educational records rather than signed or
identity-authenticated chain-of-custody records, ordinary copying is not
forensic acquisition, and cleanup is limited to the lab-owned workspace.
Actual learner or facilitator rehearsal, canonical practical registration,
publication, and delivery readiness remain incomplete.
