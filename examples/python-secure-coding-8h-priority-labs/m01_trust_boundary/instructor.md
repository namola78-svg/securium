# M01 Instructor Guide

## Demonstration order

1. Start with the requirement and ask learners who owns `display_name`, `bio`,
   `include_private`, and `ViewerContext.can_view_private`.
2. Draw Source → Validation → Sink before opening the reference repair. The
   source is request data; the sensitive sink is private-field projection into
   the response; the authority for that projection is server-side context.
3. Run the vulnerable attack test. Explain that the passing assertion proves
   the draft leaks a synthetic private field; it is not a successful security
   test.
4. Show the secure repair: exact request schema, bounded text validation, and
   policy from `ViewerContext`, not from a request flag. Run public and internal
   cases to prove normal behavior remains.
5. Have learners inspect the fixed prompt, compare the diff, rerun tests, and
   fill the verification record with locations, output, and residual risk.

## Common wrong answers

- “A boolean is safe because it cannot contain code”: trust is about who owns
  the decision, not only the value's type.
- “Hide the private field in the UI”: the server response is the security sink;
  client presentation is not an authority boundary.
- “Accept `is_staff` or `include_private` after JSON parsing”: parsing does not
  make client data server authorization.
- “Reject every request to pass the negative test”: the secure code must retain
  normal public behavior and the explicitly server-authorized internal case.
- “The prompt says secure, so the output is approved”: prompt quality is a
  review aid; code locations, targeted tests, and a human decision are evidence.

## Check questions

- Who owns each value, and what exact line first treats it as an authority?
- Where is the vulnerable Source and where is the private-field Sink?
- Which test demonstrates impact, and which tests demonstrate preserved normal
  behavior?
- Why is `ViewerContext` different from a request field with the same boolean?
- What did this local fixture not prove about authentication, transport, or a
  real application identity provider?
