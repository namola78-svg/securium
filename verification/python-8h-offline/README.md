# Offline Python 8H package builder

`build_offline_package.py` creates a deterministic ZIP from the committed
`examples/python-secure-coding-8h-priority-labs/` tree. It uses only Python's
standard library and an explicit 61-file allowlist. It rejects symlinks,
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

The builder records the source commit, source file list, byte sizes, SHA-256
digests, archive member list, archive size, and archive SHA-256 in an adjacent
manifest. It normalizes member ordering, timestamps, permissions, and DEFLATE
settings so repeated builds from identical input bytes have the same hash.

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
runs M01–M08 focused commands plus full discovery, records the actual test
counts, and removes the extraction directory even after a test failure. It
does not run the separate browser harness and does not claim browser or
classroom-delivery readiness.
