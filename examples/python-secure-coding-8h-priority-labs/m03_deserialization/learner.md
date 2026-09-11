# M03 Lab: Data Access, Deserialization, and Code Execution

Existing authority: `P03` · objectives `O09–O12` · questions `Q12–Q17`.

## Goal

Review an import boundary that accepts request data and a legacy application
artifact. Keep SQL values separate from SQL syntax, parse request JSON as
bounded data, reject request-controlled pickle/object construction, and state
the narrow assumptions required for any application-owned maintenance artifact.

This standard-library lab chooses JSON for request data. It does not install
PyYAML. The YAML decision remains: if a real service accepts YAML, use a safe
data parser and apply the same type, field, size, and unknown-field policy;
format selection alone is not a security proof.

## Requirement and fixed AI prompt

The synthetic import endpoint accepts a bounded JSON document with records named
by the fields `name` and `role`, writes valid records to a local SQLite data
store, and has a separate legacy migration path for an application-owned,
integrity-checked artifact. Request bytes must never reach pickle or unsafe
object construction. The normal feature must continue to import and search
records.

> Generate a standard-library-only Python repair for this fixture. Treat request
> bytes as untrusted Source data. Parse JSON with a bounded size/depth policy,
> reject duplicate or unknown fields, validate the exact record types and role
> allowlist, and bind SQL values as parameters. Never load request bytes with
> pickle. For the separate maintenance artifact, require a server-owned
> digest, an application-owned resolved path, and the same data-shape checks;
> state why this narrow integrity boundary is not a general pickle rule. Add
> normal, malformed, oversized, deeply nested, pickle-marker, SQL-injection,
> tamper, and regression tests. Do not use real files, credentials, network,
> shell commands, or an AI response as security evidence.

## Learner task

1. Mark the request bytes, parser, schema validation, SQL operation, and object
   construction as Source / Validation / Sink.
2. Run `test_m03.py` and explain why the marker created by the vulnerable
   pickle path is expected teaching evidence.
3. Compare `parse_request_secure` with the vulnerable parser. Identify the
   distinct controls for format, type, fields, size, depth, and SQL binding.
4. Review the trusted migration artifact path. Identify which assumptions make
   it a false positive for this narrowly isolated maintenance flow and why a
   client-controlled path or digest would invalidate the conclusion.
5. Review the diff as a person, rerun normal/attack/regression tests, and record
   one residual risk that this local fixture does not prove.

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m03_deserialization.test_m03 -v
```

Expected result: `Ran 6 tests ... OK`. The SQLite databases and marker files
are created under temporary directories or memory and are cleaned up by each
test; no reset command is required.

## Expected evidence

The vulnerable pickle payload creates only the test's temporary marker file;
the secure request parser rejects the same bytes before object construction.
The secure parser rejects extra fields, oversized/deep input, and malformed
data while accepting a normal record. Parameterized search rejects the SQL
payload without breaking normal search. A trusted application-owned artifact
loads only with the server-owned digest, while a tampered artifact is rejected
before `pickle.loads`.
