# M01 Lab: Secure Python and Vibe-Coding Foundations

Existing authority: `P01` · objectives `O01–O04` · questions `Q01–Q05`.

## Goal

Trace a synthetic Python avatar endpoint from requirement to response sink.
Separate request-controlled public fields from a server-created viewer context,
write a bounded code-generation prompt, review the supplied draft, reproduce
the trust-boundary failure, apply the reference repair, and record a human
re-verification decision with code locations and test evidence.

The files are a provided teaching draft and reference repair. They are not
claimed to be produced by a real AI service. The exercise can be completed
without an LLM or paid account.

## Requirement and fixed AI prompt

The endpoint accepts a display name and public bio for a synthetic avatar. A
public viewer must never receive the private note. A server-side viewer context
may authorize the private note for an intended internal viewer. Request data
must not create or override that security decision. Normal public fields must
remain usable.

> Generate a small standard-library-only Python handler for this requirement.
> Before code, name every Source, Validation, Sink, owner of each value,
> allowed fields, failure behavior, tests, and residual assumptions. Treat
> request fields as untrusted data; obtain the viewer permission from a
> server-owned context and never accept `include_private`, `is_staff`, or a
> model-generated approval flag from the request. Include normal public,
> unauthorized private-flag, authorized internal, invalid-input, and
> regression tests. Do not claim that prompt quality, compilation, or model
> confidence proves security; require human review of code locations and test
> output.

## Learner activity

1. Write the requirement owner table: request client, server handler, viewer
   context, response consumer, and the interpreter/sink at each step.
2. Mark Source / Validation / Sink in `vulnerable.py` and explain why
   `include_private` is not an authority merely because it is a boolean.
3. Run the tests and identify the vulnerable assertion as expected evidence,
   not as an acceptable result.
4. Compare `secure.py` with the prompt and reference repair. Explain why the
   public viewer still receives normal fields and why the private viewer case
   is not “reject everything.”
5. Complete `verification-record.md` with function names, test command and
   output, the repair decision, and one limitation not proven by this fixture.

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m01_trust_boundary.test_m01 -v
```

Expected result: `Ran 5 tests ... OK`. The lab uses only in-memory values and
creates no persistent state, so no reset command is required.

## Expected evidence

The vulnerable draft exposes the synthetic private note when a public request
sets `include_private=True`. The secure repair rejects that extra request field,
uses the server-owned `ViewerContext`, preserves normal public fields, and
allows the explicitly authorized internal case. The reviewer records residual
risk and test evidence rather than accepting the prompt or AI confidence as a
security decision.
