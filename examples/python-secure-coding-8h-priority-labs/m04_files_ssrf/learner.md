# M04 Lab: Files, Uploads, and SSRF

Existing authority: `P04` · objectives `O13–O16` · questions `Q18–Q23`.

## Goal

Protect a document service from path traversal, unsafe upload storage, and
server-side request forgery. Treat filenames, upload metadata, and URLs as
untrusted Sources. Verify the final filesystem object and network destination,
not merely the spelling of the input.

## Requirement and fixed AI prompt

The service may read a document below its upload directory, store a bounded
text or PNG upload, and fetch only an explicitly approved HTTPS service. It
must generate storage names, resolve and check containment, enforce size/type
policy, reject non-global resolved addresses, block implicit redirects, bound
timeouts and response size, and keep all tests local or mocked.

> Repair the supplied Python fixture using only the standard library. For file
> paths, resolve the trusted base and candidate and prove containment before
> the sink. For uploads, ignore the client filename as a storage authority and
> check size plus content/type policy. For SSRF, enforce scheme, exact host,
> port, resolved address, redirect, timeout, and response-size policy. Add
> traversal, upload, loopback, redirect, and normal regression tests. Explain
> which egress controls remain outside this local fixture.

## Learner task

1. Run the M04 tests and identify the vulnerable path/file and URL sinks.
2. Explain why an extension or `https` prefix is not an authorization policy.
3. Compare `resolve_under` with lexical string filtering.
4. Inspect the injected resolver/fake opener in the normal SSRF test and state
   what it proves and what a production egress control must still prove.
5. Re-run all tests after the repair and record the positive, attack, and
   boundary evidence.

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m04_files_ssrf.test_m04 -v
```

Expected result: `Ran 6 tests ... OK`. Temporary directories and the loopback
server are cleaned up by each test; no reset command is required.

## Expected evidence

The vulnerable code reads a synthetic file outside the upload base, writes a
client-selected path, and reaches a loopback-only fixture. The secure code
rejects the escape and loopback destination, stores under a generated name,
and preserves normal file and bounded fetch behavior.
