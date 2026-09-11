# M08 Lab: Vibe-Coding Capstone and Human Re-verification

Existing authority: `P08` · objectives `O29–O32` · questions `Q37–Q40`.

## Goal

Run the complete local loop on a small generated-style Python application:
requirement → prompt → generated vulnerable code → Source/Validation/Sink
review → attack/normal tests → repair → human re-verification. The application
combines SQL, filesystem, object authorization, and outbound URL flows.

## Fixed requirement and prompt

The mini-application searches local users, reads a document below a trusted
root, previews an approved service URL, and returns an invoice only when the
server-side subject-object-action policy grants access. Values must remain
data, uploads/files must remain under the authorized root, destinations must
be bounded, and normal behavior must remain intact.

> Generate a standard-library-only Python implementation for this local
> requirement. Before code, list Sources, Validations, Sinks, trust
> assumptions, positive tests, negative tests, and residual risk. Use bound SQL
> values and a closed structural map; prove resolved path containment; use
> exact host/address/redirect/timeout/size policy for preview; enforce object
> authorization server-side. Do not use real targets, credentials, or an LLM
> response as security evidence.

## Learner task

1. Review `vulnerable_app.py` and mark all four Source → Sink flows.
2. Run the tests and label each vulnerable assertion as expected evidence.
3. Compare `secure_app.py` with the prompt acceptance criteria.
4. Ask an AI for a repair if available, or use the reference repair manually.
5. Inspect the diff, rerun all tests, and complete a human decision:
   accepted controls, preserved normal behavior, residual risks, and evidence
   gaps.

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m08_capstone.test_m08 -v
```

Expected result: `Ran 6 tests ... OK`. The database, files, fake response, and
loopback server are cleaned up by each test; no reset command is required.

## Expected evidence

The vulnerable app demonstrates SQL injection, path traversal, IDOR, and a
loopback SSRF in bounded fixtures. The secure app returns the normal search,
file, invoice, and mocked approved-preview results while rejecting the same
attack inputs. The mocked approved-preview result must be described as policy
evidence, not proof of production egress isolation.
