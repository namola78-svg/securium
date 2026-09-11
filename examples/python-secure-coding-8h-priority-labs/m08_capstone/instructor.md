# M08 Instructor Guide

## Demonstration order

1. Give learners the fixed requirement and 5-minute prompt-writing checkpoint.
2. Ask for a Source/Validation/Sink map before opening the secure reference.
3. Run each vulnerable assertion separately: SQL, path, IDOR, then loopback
   SSRF. Explain that a passing vulnerable assertion means the fixture
   reproduced the intended weakness.
4. Compare the secure app's controls and run normal cases before attack cases.
5. Have learners review an AI repair diff, reject any unrelated or untested
   change, and record the final human decision.

## Common wrong answers

- Approving because the generated code is concise or the model says “secure”.
- Fixing only the line named by a scanner instead of tracing equivalent flows.
- Treating a parameterized SQL query as proof of object authorization.
- Allowing localhost in a production-style SSRF policy because the test server
  is local.
- Treating the fake resolver/opener as proof of real network egress control.

## Check questions

- Which test is positive, which is negative, and which is a regression test?
- What did the secure code preserve that a “reject everything” patch would not?
- Which evidence came from deterministic tests and which decision required a
  human reviewer?
- What residual controls must be supplied by deployment infrastructure?
