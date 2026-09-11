# Offline Python 8H package builder

`build_offline_package.py` creates a deterministic ZIP from the committed
`examples/python-secure-coding-8h-priority-labs/` tree. It uses only Python's
standard library and an explicit 61-file lab allowlist plus one separately
provenance-bound learner preflight support file. It rejects symlinks,
unexpected files, source modifications, path traversal, existing output files,
and output paths inside the repository.

Generated ZIPs, manifests, extraction directories, and reports must remain
outside the worktree. They are deliberately not committed.

## Build

From the repository root, choose an output directory outside the worktree:

```powershell
python verification/python-8h-offline/build_offline_package.py build `
  --output-dir 'C:\Users\user\Documents\Codex\artifacts\securium-python-8h-offline'
```

The builder records the last non-merge source commit that changed the lab tree,
following the proposed-head parent when run on a pull-request merge ref. It
also records the source file list, byte sizes, SHA-256
digests, archive member list, archive size, and archive SHA-256 in an adjacent
manifest. It normalizes member ordering, timestamps, permissions, and DEFLATE
settings so repeated builds from identical input bytes have the same hash. It
also compares every packaged working-tree byte with the corresponding Git blob
from the recorded source commit; line-ending or checkout conversion is a
build failure, not silently normalized payload.
The SHA-256 is an integrity comparison for the reviewed bytes, not a
signature or proof of publisher authenticity. Hash equality is claimed only
within the same source bytes and build environment; it is not assumed across
different Python, zlib, operating-system, or checkout environments.

## Verify an extracted copy

Use a new extraction directory. Spaces and non-ASCII characters are valid:

```powershell
python verification/python-8h-offline/build_offline_package.py verify `
  --archive 'C:\path\securium-python-8h-offline-lab-COMMIT.zip' `
  --manifest 'C:\path\securium-python-8h-offline-lab-COMMIT.manifest.json' `
  --extract-dir 'C:\temp\오프라인 Python 실습 검증' `
  --report 'C:\path\securium-python-8h-offline-verification.json'
```

Verification validates the archive and manifest, safely extracts only the
archive's own paths, checks Markdown links, clears `PYTHONPATH`/`PYTHONHOME`,
also runs the extracted `preflight/preflight.py` diagnostic, then
runs M01–M08 focused commands plus full discovery, records the actual test
counts, and removes the extraction directory even after a test failure. It
does not run the separate browser harness and does not claim browser or
classroom-delivery readiness.

The CI workflow explicitly disables Git's automatic line-ending conversion
before the build. Local builds use the same byte contract: a checkout whose
working-tree bytes do not match the recorded Git blobs fails rather than
silently producing a different package.

## CI contract

`.github/workflows/python-8h-offline-package.yml` runs the same contract on
Windows and Linux with Python 3.11 and 3.14. Each matrix job builds twice in
temporary directories outside the checkout, compares the ZIP bytes and
SHA-256, verifies an extraction under a path containing spaces and non-ASCII
characters, and checks M01–M08 plus 50-test discovery. It also exercises
tamper rejection, repository-internal output rejection, overwrite rejection,
and extraction cleanup. The matrix also runs the packaged preflight from the
extracted package root; its regression count is reported separately from the
lab test count. The workflow installs Python and checks out the
repository as CI prerequisites; the extracted labs themselves use only the
Python standard library and no package-manager download. ZIPs and manifests
are not committed or uploaded as CI artifacts.
