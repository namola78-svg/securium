# M03 Instructor Guide

## Demonstration order

1. Show the P03 scenario and draw two separate paths: request bytes to a parser,
   and an application-owned maintenance artifact to a migration loader.
2. Run the vulnerable pickle test. Pause on the temporary marker assertion:
   the passing assertion means unsafe object construction was reproduced, not
   that the code is acceptable.
3. Compare the secure JSON path: byte limit, UTF-8/JSON parsing, duplicate-key
   rejection, depth, exact fields, type/value policy, and record count are
   separate controls.
4. Run the SQL payload. Explain that parameter binding protects SQL structure,
   but does not establish authorization, provenance, or business validity.
5. Show the trusted artifact false positive. The digest and path are
   server-owned/application-owned assumptions, checked before loading, and the
   path is not request-reachable. Contrast this with the tampered artifact,
   which the secure loader rejects before unpickling.
6. Have learners review the fixed AI prompt, inspect the reference diff, and
   complete a human re-verification decision without using model confidence as
   evidence.

## Common wrong answers

- “The `.pkl` extension is the vulnerability”: the sink is untrusted pickle
  object construction, not the filename suffix.
- “A JSON format is automatically safe”: parser safety still requires an
  explicit schema, size/depth limits, duplicate/unknown-field policy, and
  downstream authorization/integrity decisions.
- “`yaml.safe_load` finishes the job”: safe parsing is only one control; apply
  type, field, size, unknown-field, and business validation afterward.
- “A parser exception is enough”: malformed input handling does not prevent
  unsafe object construction on inputs that parse successfully.
- “Hash whatever digest the request supplies”: a client-controlled expected
  digest proves nothing. The expected value must come from a server-owned
  integrity boundary, and the artifact path must be application-owned.
- “Parameterized SQL proves the import is authorized”: binding separates data
  from SQL syntax; it does not decide who may import, read, or modify records.

## Check questions

- What is the exact object-construction sink in the vulnerable pickle path?
- Which secure checks happen before data reaches the SQLite sink?
- Why are duplicate keys and unknown fields worth rejecting even when JSON
  parsing succeeds?
- What assumption makes the trusted artifact a documented false positive, and
  which single change would make it untrusted again?
- What did the local marker test prove, and what production control did it not
  prove?
