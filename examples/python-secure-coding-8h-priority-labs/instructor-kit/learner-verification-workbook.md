# Learner Verification Workbook: M01–M08

This workbook is for learner-written evidence. Use one record block for each
module. Read the original learner guide first; the links below are the
authority for the requirement, fixed prompt, practical, objectives, questions,
and lab-specific limits. This workbook is a common recording format and does
not replace those originals.

Do not complete a row with only a checkbox or a word such as passed. For every
claim, write the file and function or line you inspected, the command you ran,
and the observed result. Do not copy real secrets, credentials, external
targets, or personal data into this workbook. A model response, model
confidence, formatter result, or green test run alone is not security evidence.

## Module index

| Module | Authority and original learner guide | Existing record/template |
|---|---|---|
| M01 | P01, O01–O04, Q01–Q05 — [learner guide](../m01_trust_boundary/learner.md) | [verification record](../m01_trust_boundary/verification-record.md) |
| M02 | P02, O05–O08, Q06–Q11 — [learner guide](../m02_injection/learner.md) | Use this common block |
| M03 | P03, O09–O12, Q12–Q17 — [learner guide](../m03_deserialization/learner.md) | Use this common block |
| M04 | P04, O13–O16, Q18–Q23 — [learner guide](../m04_files_ssrf/learner.md) | Use this common block |
| M05 | P05, O17–O20, Q24–Q28 — [learner guide](../m05_web_context/learner.md) | [verification record](../m05_web_context/verification-record.md) |
| M06 | P06, O21–O24, Q29–Q32 — [learner guide](../m06_authorization/learner.md) | Use this common block |
| M07 | P07, O25–O28, Q33–Q36 — [learner guide](../m07_secrets_dependencies/learner.md) | Use this common block; Q36 answer is B/2; Runtime authority binding pending |
| M08 | P08, O29–O32, Q37–Q40 — [learner guide](../m08_capstone/learner.md) | [human-review template](../m08_capstone/human-review-template.md) |

## How to complete one record

1. Copy the common record block below once for the current module.
2. Fill the module identity and read the original requirement and fixed
   prompt. Paste or summarize the prompt you actually used; do not treat it as
   proof of safety.
3. Mark Source, Validation, and Sink locations in the supplied draft and
   reference repair. A location must be a path plus a line or function.
4. Run the original focused command. Record the exact command, relevant test
   name, status, response/body/state or other observed output, and why that
   observation is vulnerable, secure, normal, attack, or regression evidence.
5. Inspect the repair diff. Record why each control is appropriate and what it
   preserves.
6. Rerun normal, attack, and regression tests as applicable. Record failures
   honestly; a failed test is not a success record.
7. Write limitations and the final human judgment. The final judgment is about
   this bounded local fixture, not a production approval.

## Reusable record block

Copy this entire section for M01, M02, M03, M04, M05, M06, M07, and M08.

### Record identity

- Module / practical:
- Objectives and questions:
- Learner:
- Date and local environment:
- Original learner guide revision or commit:
- AI used: optional; if used, record the prompt and the changed files:

### Requirement and protected target

- Requirement reviewed:
- Protected asset, behavior, or decision:
- Allowed normal behavior:
- Data or action that must remain untrusted:
- What must not be exposed, executed, changed, or reached:

### Trust boundary

Describe the boundary in words. Name who owns each authority value and what
the local fixture assumes. Do not infer trust from a type, filename, URL
scheme, login state, package lock, scanner result, or AI response.

- Untrusted source boundary:
- Server/application-owned boundary:
- External interpreter, file, network, object, or telemetry boundary:
- Authority owner:
- Assumption not proven by this fixture:

### Source / Validation / Sink locations

Write a path plus function or line for each location. Add rows for every
distinct flow in the module; do not write only a conceptual label.

| Flow or value | Source code location | Validation, policy, or redaction location | Sink code location | What the sink does |
|---|---|---|---|---|
| 1. | | | | |
| 2. | | | | |
| 3. | | | | |
| 4. | | | | |

### Code-generation or repair prompt

- Requirement/prompt text used:
- Constraints I gave the generator or followed manually:
- Files/functions changed:
- Suggestions rejected or changed, and why:
- Evidence I will use instead of model confidence:

### Expected vulnerable behavior

Before running, write the behavior you expect the supplied vulnerable draft to
permit and the security property it should violate. Do not replace this with
the secure result or with a checkbox.

- Expected vulnerable behavior:
- Why it violates the requirement:
- Test or command that should demonstrate it:

### Actual reproduction command and observed result

Record the exact command from the original learner guide, or an exact focused
test command. Include the relevant test name and observed output/status/body,
state transition, marker, log, returned object, or other direct observation.

- Command:
- Test name or input:
- Observed result:
- Why this is vulnerable-draft evidence, secure evidence, or a boundary
  observation:

### Repair rationale

- Control added or retained:
- Source-to-validation-to-sink reason it is placed there:
- Why the control is appropriate for this context:
- Normal behavior intentionally preserved:
- Why reject-everything, client-side hiding, escaping alone, a type check,
  scanner result, or AI confidence would be insufficient here:

### Test evidence after repair

Record each command and its actual result. If a row does not apply, explain why.

| Evidence class | Exact command/test | Observed result | Code or state evidence |
|---|---|---|---|
| Normal/positive behavior | | | |
| Attack/negative behavior | | | |
| Regression/boundary behavior | | | |
| Repair rerun | | | |

### Remaining limitations

- Fixture or synthetic-data limitation:
- OS/Python-version limitation:
- Browser/client limitation:
- Network, DNS, egress, database, identity, provider, registry, CI, or
  production-control limitation:
- Additional evidence needed:

### Human final judgment and basis

Select one, then support it in writing with locations and observations.

- [ ] Accept the bounded local result.
- [ ] Reject the result and record the blocking finding.
- [ ] Need more evidence before deciding.

Decision basis:

- Source/Validation/Sink evidence:
- Attack reproduction evidence:
- Normal and regression evidence:
- Repair-diff review:
- Remaining limitation that affects the decision:

## Module-specific prompts and required connections

These prompts connect the original module instructions to the common record.
They are questions for the learner, not prefilled answers.

### M01 — Trust boundary

Use the [M01 learner guide](../m01_trust_boundary/learner.md) and existing
[M01 record](../m01_trust_boundary/verification-record.md).

- Which request values are Source values, and which value is the server-owned
  ViewerContext?
- Where are allowed fields and bounds validated, and where does the private
  response field become a Sink?
- What did the vulnerable private-flag test actually observe?
- What are the public, unauthorized, and authorized-internal normal cases?
- Which authentication, transport, or provider guarantees are still only
  assumptions?

Focused command:

~~~powershell
python -m unittest m01_trust_boundary.test_m01 -v
~~~

### M02 — Interpreter boundaries

Use the [M02 learner guide](../m02_injection/learner.md).

- Record separate Source/Validation/Sink paths for SQL search, sort structure,
  shell argument handling, and the filter expression.
- Which values are data and which choices are syntax or structure?
- What did the SQL, shell, and evaluator vulnerable tests observe?
- Why is the fixed sort map a structural control rather than a user value?
- Record one false positive and one false negative or database/authorization
  limit.

Focused command:

~~~powershell
python -m unittest m02_injection.test_m02 -v
~~~

### M03 — Deserialization and data access

Use the [M03 learner guide](../m03_deserialization/learner.md).

- Keep the request JSON path and application-owned migration artifact path in
  separate record rows.
- Where are byte size, UTF-8, JSON, duplicate keys, depth, exact fields,
  types, roles, and record count controlled?
- What marker or other observation demonstrates unsafe pickle execution in the
  draft, and what prevents it in the request path?
- What evidence establishes artifact path and digest ownership?
- Why does parameterized SQL not prove authorization, provenance, or business
  policy?

Focused command:

~~~powershell
python -m unittest m03_deserialization.test_m03 -v
~~~

### M04 — Files, uploads, and SSRF

Use the [M04 learner guide](../m04_files_ssrf/learner.md).

- Record the requested file name, resolved path, upload bytes/name/type/size,
  and URL destination as distinct flows.
- What path postcondition proves containment below the authorized root?
- Where is a generated upload name chosen, and what controls remain separate?
- What exact host, port, address, redirect, timeout, and size policy was
  observed?
- Which loopback and mocked-opener results prove application policy only, not
  production egress?

Focused command:

~~~powershell
python -m unittest m04_files_ssrf.test_m04 -v
~~~

### M05 — Web context, CSRF, and safe failure

Use the [M05 learner guide](../m05_web_context/learner.md) and existing
[M05 record](../m05_web_context/verification-record.md).

- Record the HTML comment Source, context-specific encoding Validation, and
  response Sink.
- Record the session cookie, Origin, and CSRF token locations; show how the
  token is tied to the existing server-side session before the state-changing
  Sink.
- For every rejected theme request, write state before and after and the
  response status/body.
- Record safe public error and correlated redacted log observations without
  copying secrets or tracebacks.
- State explicitly that the direct Python HTTP client fixture is not browser
  verification of cookie, SameSite, form, or Origin behavior.

Focused command:

~~~powershell
python -m unittest m05_web_context.test_m05 -v
~~~

### M06 — Authorization and BOLA/IDOR

Use the [M06 learner guide](../m06_authorization/learner.md).

- Build a subject/object/action/tenant decision matrix for owner, same-tenant
  member, unrelated user, same-tenant admin, other tenant, and unauthenticated
  caller.
- Record the object lookup Source, server-owned policy Validation, and data
  read/update Sink.
- What did the vulnerable object-substitution test return to Bob?
- Why is the explicit same-tenant admin rule different from unrestricted IDOR?
- Record pre-auth ID, post-login ID, and revocation observations separately
  from object authorization.

Focused command:

~~~powershell
python -m unittest m06_authorization.test_m06 -v
~~~

### M07 — Secrets, dependencies, and provenance

Use the [M07 learner guide](../m07_secrets_dependencies/learner.md).

- Trace the synthetic token through source, provider, prompt, client, public
  response, operator log, trace, and support export. Do not write the token
  itself.
- Which narrow sink is allowed to receive a credential?
- What did the vulnerable leak tests observe, and why is that not a secure
  result?
- For the synthetic advisory, record owner, dependency path, affected path,
  reachability, and upgrade evidence.
- For the model-suggested package, record source, integrity, owner, build
  context, CI credential exposure, and human-review evidence.
- The repository canonical Q36 answer is now `1` (B/2), merged and verified in
  #147. The default mapping/preflight path requires
  `QUESTION_REVISION_CONTEXT_REQUIRED`; only the fixed candidate context
  projects Q36-v2. Source/approval remains `UNKNOWN`, candidate preflight is
  `BLOCKED`, persistence is `NOT_READY`, and no `humanReviewHash` or canonical
  receipt exists. Record B/2 for content discussion, but do not describe the
  candidate as an authority-issued Runtime revision or claim automated
  scoring/publication readiness.

Focused command:

~~~powershell
python -m unittest m07_secrets_dependencies.test_m07 -v
~~~

### M08 — Capstone

Use the [M08 learner guide](../m08_capstone/learner.md) and existing
[human-review template](../m08_capstone/human-review-template.md).

- Record four Source/Validation/Sink flows: SQL search, filesystem document,
  invoice object authorization, and preview URL.
- Label each vulnerable assertion as attack evidence and separately record
  secure normal and regression evidence.
- Which behavior did the repair preserve that a reject-everything patch would
  not?
- Which facts came from deterministic tests, and which conclusion required
  human inspection?
- Record that mocked approved preview is policy evidence, not production
  network-egress proof.

Focused command:

~~~powershell
python -m unittest m08_capstone.test_m08 -v
~~~

## Handoff note for a learner

Submit the completed records through the delivery owner's chosen local
process. This workbook does not publish results, write to a runtime database,
or create a platform Mastery, Confidence, or Skill State. Preserve the raw
commands and observations so an instructor can review the reasoning.
