# Securium Python 8H Offline Lab Package

Lab source commit: `{{SOURCE_COMMIT}}`

Learner preflight source commit: `{{PREFLIGHT_SOURCE_COMMIT}}`

This archive contains the M01–M08 Python local teaching labs and the
instructor kit from the Securium repository. It is an offline Python exercise
bundle, not a copy of the repository and not a runtime or approval artifact.

## Start here

1. Extract this ZIP into a new directory. The archive does not write anywhere
   outside the directory selected by the extractor.
2. Install Python 3.11 or newer. Git and Node are not required for the Python
   lab commands in this archive.
3. From the package root, check `python --version`.
4. From the package root, run the learner environment preflight:

   ```text
   python preflight/preflight.py
   python preflight/preflight.py --json
   ```

   `PASS` means only that the local probes succeeded. It does not certify
   the full lab suite, browser verification, or classroom delivery. The
   diagnostic uses Python's standard library and does not install software or
   require Node, Git, or Docker.

5. Change into `lab/` and run a focused lab, for example:

   ```text
   python -m unittest m05_web_context.test_m05 -v
   ```

6. Run the complete local discovery after working through the exercises:

   ```text
   python -m unittest discover -s . -p "test_*.py" -v
   ```

7. Record observations in the supplied verification records and learner
   workbook. A green test run is not a substitute for the learner or
   instructor evidence record.

The [lab README](lab/README.md) lists M01–M08. The [instructor
kit](lab/instructor-kit/README.md) contains the teaching sequence, rubric,
runbook, workbook, and rehearsal checklist. The source manifest in this
archive records every included file's size and SHA-256. Those hashes support
integrity comparison for this package; they are not a signature or proof of
publisher authenticity.

## Scope and safety boundaries

- The package uses only the Python standard library and the empty dependency
  declaration in `lab/pyproject.toml`. The tests use fake data, in-memory
  state, temporary files, and loopback-only fixtures.
- The current expectations are 7 focused M05 tests and 50 tests for complete
  discovery. The earlier 6/49 result is historical provenance.
- M05's Python HTTP-client tests are not real-browser verification. The
  separate repository reviewer harness at `verification/m05-browser/` is not
  included here and requires its own Node/Playwright environment. Its recorded
  status remains HTTP `BROWSER_VERIFICATION_PARTIAL` and HTTPS
  `NOT_RUN`.
- Q36's canonical answer is B/2 (`answer: 1`). The default mapping still
  requires `QUESTION_REVISION_CONTEXT_REQUIRED`; the fixed candidate context
  alone projects Q36-v2. Source/approval authority is `UNKNOWN`, candidate
  preflight is `BLOCKED`, persistence is `NOT_READY`, and no
  `humanReviewHash` or canonical receipt exists. This package does not issue
  Runtime authority, approvals, or publication readiness.
- The instructor plan remains 480 training minutes: 350 minutes of Python
  secure coding and 130 minutes of AI/Vibe Coding. Breaks, preparation, and
  contingency time are outside that total. Running tests is not classroom
  rehearsal and does not make classroom delivery ready.

The source lab README contains one documented repository-only reference to
the separate browser harness. The instructor kit also contains a documented
repository-only link to `content-drafts/secure-coding-8h-foundation/manifest.json`
for the authority manifest. Neither repository-only reference is treated as an
offline package file: use the full repository when browser verification or
foundation-authority details are required.
