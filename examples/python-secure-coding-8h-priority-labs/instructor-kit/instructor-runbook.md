# Instructor Runbook: M01–M08

## How to use this runbook

This is a planned facilitation sequence for the eight existing labs. Read the
original module instructor and learner guides before teaching; this runbook
points to them and adds delivery order, evidence prompts, and timing. The
minute values are planning values from the manifest, not measured learner
durations.

The teaching loop is:

Requirements -> bounded AI prompt -> generated/draft Python -> Source /
Validation / Sink review -> attack and normal tests -> repair -> human
re-verification

An AI answer, confidence score, clean formatter, or green test run is never
the sole security authority. The person facilitating the class must ask for
code locations and observed output.

## Before the session

1. Read the [common README](../README.md), the [manifest](../../../content-drafts/secure-coding-8h-foundation/manifest.json),
   and each original module guide.
2. Work from the lab bundle directory:

~~~powershell
Set-Location <path-to-repository>\examples\python-secure-coding-8h-priority-labs
python --version
~~~

   If the local setup requires a specific interpreter, follow the common
   README's virtual-environment command. Do not create a real credential,
   install a vulnerable dependency, contact an external service, or use
   runtime DB/credential infrastructure.
3. Explain that the manifest describes 8 SPEC_ONLY practicals and that the
   local files are bounded teaching fixtures. Do not promise production
   hardening.
4. Give each learner the [verification workbook](learner-verification-workbook.md).
   A learner may use the existing module record directly, but the common
   workbook is the collection format for this delivery.

## Commands and test handling

Run each command from the bundle directory. These are the actual focused
commands in the original learner guides:

| Module | Focused command |
|---|---|
| M01 | python -m unittest m01_trust_boundary.test_m01 -v |
| M02 | python -m unittest m02_injection.test_m02 -v |
| M03 | python -m unittest m03_deserialization.test_m03 -v |
| M04 | python -m unittest m04_files_ssrf.test_m04 -v |
| M05 | python -m unittest m05_web_context.test_m05 -v |
| M06 | python -m unittest m06_authorization.test_m06 -v |
| M07 | python -m unittest m07_secrets_dependencies.test_m07 -v |
| M08 | python -m unittest m08_capstone.test_m08 -v |

The original aggregate command is:

~~~powershell
python -m unittest discover -s . -p 'test_*.py' -v
~~~

The repository's latest compatibility record reports Ran 49 tests ... OK
for its listed Windows PowerShell/Linux Bash and Python 3.11/3.14 matrix. A
focused command should report the module's own test count; exact elapsed time
is environment-dependent. If a learner changes code, require the focused test
and then the aggregate command as appropriate. Test output is evidence for
the fixture only.

Important interpretation boundaries:

- M05 sends a Cookie header and other headers through a Python HTTP client.
  It is not a real-browser test and does not establish SameSite, browser form
  submission, or browser Origin behavior.
- M04 and M08 use loopback and mocked resolver/opener paths. They prove the
  application policy exercised by the fixture, not production DNS rebinding
  resistance or egress isolation.
- The compatibility record does not imply Python 3.12/3.13, macOS, or learner
  rehearsal has been verified.

## Time plan

The plan below sums to the manifest values. Breaks, lunch, room setup,
preparation, and contingency are outside the 480 training minutes and are not
silently inserted into a module. A delivery owner must schedule them
separately. No actual learner time is claimed.

| Module | Framing | Explain/demo | Learner practice | Review | Close | Total |
|---|---:|---:|---:|---:|---:|---:|
| M01 | 8 | 15 | 20 | 7 | 5 | 55 |
| M02 | 8 | 17 | 25 | 10 | 5 | 65 |
| M03 | 8 | 17 | 25 | 10 | 5 | 65 |
| M04 | 8 | 17 | 25 | 10 | 5 | 65 |
| M05 | 7 | 15 | 20 | 8 | 5 | 55 |
| M06 | 8 | 15 | 22 | 10 | 5 | 60 |
| M07 | 7 | 15 | 20 | 8 | 5 | 55 |
| M08 | 8 | 17 | 22 | 8 | 5 | 60 |
| **Total** | **62** | **128** | **179** | **71** | **40** | **480** |

The manifest category totals are Python secure coding 350 minutes and
AI/Vibe Coding 130 minutes. The phase table is a facilitation allocation and
does not redefine those category totals.

## M01 — Secure Python and Vibe-Coding Foundations

Authority: M01, T01, P01, objectives O01, O02, O03, O04, questions Q01, Q02,
Q03, Q04, Q05.
Original material: [learner](../m01_trust_boundary/learner.md) and
[instructor](../m01_trust_boundary/instructor.md). Planned time: 55 minutes
(45 Python / 10 Vibe); local phase plan 8 / 15 / 20 / 7 / 5.

### Goal and prerequisites

Learners should identify a server-owned viewer context, separate request data
from authority, constrain a response schema, and re-verify a repair. Assume
basic Python functions, dictionaries, unit-test reading, and the idea of a
request/response boundary. No web framework is required.

### Core explanation

Use models.py:9 (AvatarProfile) and models.py:16 (ViewerContext) to name the
protected private note and the server-owned authorization context. In the
draft, trace request fields into vulnerable.py:17
(render_avatar_vulnerable). In the reference, trace bounded request validation
at secure.py:21 (_validate_request) into secure.py:39
(render_avatar_secure). The client request must not create is_staff,
include_private, or equivalent authority.

### Demonstration and actual command

1. Read the requirement and ask learners to draw Source (request fields) ->
   Validation/authority (server context and allowed schema) -> Sink (response
   fields).
2. Open the referenced model, draft, and reference locations above and run:

~~~powershell
python -m unittest m01_trust_boundary.test_m01 -v
~~~

3. Point out the test
   test_client_private_flag_exposes_draft_data_but_secure_rejects_it and
   the two normal/regression tests. A passing vulnerable assertion records the
   intended teaching weakness; it is not evidence that the draft is safe.
4. Compare public, unauthorized, and explicitly authorized internal context.
   Have learners inspect the repair diff and run the focused tests again.

### Learner practice

Learners complete the M01 section of the workbook: owner table, code locations,
request-controlled versus server-owned values, vulnerable observation, repair
reason, normal/attack/regression output, and residual fixture limits. Require
them to record the exact test name and observed status rather than checking a
box.

### Discussion and review questions

- Which function owns the decision to include the private field?
- Where are display_name and bio bounded, and what is the response sink?
- Why does a UI that hides a field fail to protect the data?
- What evidence separates public, unauthorized, and authorized internal views?
- Which authentication, transport, or provider controls are outside this lab?

### Wrong turns, sticking points, and hints

If a learner says a Boolean is harmless, ask who owns the meaning of that
Boolean. If they hide the field only in the UI, ask whether the response still
contains it. If they reject every request, ask them to preserve the normal
public and authorized internal cases. If they cite model confidence, ask for a
source location and a test observation.

### End-of-module learning result

The learner can name the protected field, identify request Source and response
Sink, show the server-owned authority decision, reproduce the vulnerable
private-field exposure, and explain a repair using code and test evidence.

## M02 — Input Validation and Interpreter Boundaries

Authority: M02, T02, P02, objectives O05, O06, O07, O08, questions Q06, Q07,
Q08, Q09, Q10, Q11.
Original material: [learner](../m02_injection/learner.md) and
[instructor](../m02_injection/instructor.md). Planned time: 65 minutes
(50 Python / 15 Vibe); local phase plan 8 / 17 / 25 / 10 / 5.

### Goal and prerequisites

Learners should distinguish data values from interpreter structure across SQL,
shell, and a Python expression language. Assume basic SQL, subprocess
concepts, string parsing, and exception assertions.

### Core explanation

Trace SQL input through vulnerable.py:27
(search_users_vulnerable) to the SQL sink; trace the sort argument through
vulnerable.py:41 (run_sort_vulnerable) and the expression through
vulnerable.py:54 (evaluate_filter_vulnerable). Compare bound SQL values,
the fixed structural map in secure.py:15 (search_users_secure) and
secure.py:34 (run_sort_secure), and the restricted parser at
secure.py:47 (evaluate_filter_secure). Explain that shell=False alone,
escaping quotes, or smaller eval globals does not solve the general
boundary problem.

### Demonstration and actual command

1. Ask learners to label the same untrusted value's interpreter and sink in
   each path.
2. Run:

~~~powershell
python -m unittest m02_injection.test_m02 -v
~~~

3. Pause at test_vulnerable_sql_injection_changes_the_result,
   test_vulnerable_shell_injection_executes_extra_command, and
   test_vulnerable_eval_executes_code_but_secure_parser_rejects_it.
4. Show that normal search and allowed filter behavior remain available; show
   that unknown structural choices fail closed. Ask learners to compare the
   reference and their bounded repair, then rerun the command.

### Learner practice

Learners fill three Source/Validation/Sink rows, record the injection test
names and output, explain the difference between a fixed sort map and a data
parameter, and document one false positive and one false negative or
authorization/DB-privilege limit.

### Discussion and review questions

- What part of the SQL statement is data, and what part is structure?
- Which owner controls the allowed name/id sort mapping?
- Why can a safe normal value still need binding?
- Why is a restricted eval namespace not a parser?
- What does this fixture not prove about database authorization or process
  isolation?

### Wrong turns, sticking points, and hints

If a learner escapes quotes, ask how the value behaves in another parser.
If they rely on shell=False, ask whether shell metacharacters can still alter
the intended argument or whether the command itself is fixed. If they shrink
eval globals, ask whether Python syntax still constructs or accesses objects.
If they reject all input, ask them to preserve the allowed sort and filter
cases.

### End-of-module learning result

The learner can identify three interpreter sinks, explain why parameterization
and closed structural maps address different risks, reproduce each intended
draft weakness, and show normal and rejected secure behavior with test output.

## M03 — Data Access, Deserialization, and Code Execution

Authority: M03, T03, P03, objectives O09, O10, O11, O12, questions Q12, Q13,
Q14, Q15, Q16, Q17.
Original material: [learner](../m03_deserialization/learner.md) and
[instructor](../m03_deserialization/instructor.md). Planned time: 65 minutes
(50 Python / 15 Vibe); local phase plan 8 / 17 / 25 / 10 / 5.

### Goal and prerequisites

Learners should separate an untrusted request parser from a narrowly bounded,
integrity-checked application-owned migration artifact. Assume JSON, SQLite,
exception handling, and basic file/path concepts.

### Core explanation

Use vulnerable.py:29 (parse_request_vulnerable) and
vulnerable.py:35 (load_pickle_request_vulnerable) to show the request
boundary and code-execution sink. Compare the secure parser at
secure.py:100 (parse_request_secure), record validation at
secure.py:73 (_records_from_object), SQL insertion at
secure.py:119 (insert_records_secure), and the separate migration loader
at secure.py:144 (load_trusted_migration_artifact). Explain size, UTF-8,
JSON, duplicate-key, depth, exact-field, type, role, count, digest, path, and
post-load shape controls as separate decisions.

### Demonstration and actual command

1. Draw two paths: request bytes -> JSON validation -> parameterized data
   access; application-owned artifact -> path/digest checks -> legacy loader.
2. Run:

~~~powershell
python -m unittest m03_deserialization.test_m03 -v
~~~

3. Read test_untrusted_pickle_executes_marker_but_request_parser_rejects_it.
   The marker is a deliberate proof that the vulnerable loader executed; it is
   not a successful secure outcome.
4. Compare malformed/oversized/deep/extra-field rejection with normal import
   and search. Then discuss why SQL parameterization does not grant
   authorization or artifact provenance.

### Learner practice

Learners record separate Source/Validation/Sink rows for request JSON, SQL
search, and the maintenance artifact. They record the marker observation,
schema boundary observations, digest/path assumptions, repair rationale, and
normal/attack/regression test output.

### Discussion and review questions

- Where is arbitrary object construction possible in the vulnerable flow?
- Which checks occur before SQL insertion?
- Why are duplicate and unknown fields relevant even when JSON is used?
- What makes the maintenance artifact a different trust boundary?
- What assumption would invalidate the synthetic digest or application-owned
  path?

### Wrong turns, sticking points, and hints

If a learner trusts a .pkl extension, ask who controls the bytes. If they say
JSON is automatically safe, ask which schema and resource limits are enforced.
If they use yaml.safe_load or rely only on parser exceptions, ask what exact
fields, types, depth, and values are allowed. If they use a client digest, ask
who owns the reference digest.

### End-of-module learning result

The learner can explain why request pickle loading is an execution sink, show
the bounded JSON path, describe why the trusted artifact exception is narrow,
and support the repair with marker, rejection, normal, and SQL test evidence.

## M04 — Files, Uploads, and SSRF

Authority: M04, T04, P04, objectives O13, O14, O15, O16, questions Q18, Q19,
Q20, Q21, Q22, Q23.
Original material: [learner](../m04_files_ssrf/learner.md) and
[instructor](../m04_files_ssrf/instructor.md). Planned time: 65 minutes
(50 Python / 15 Vibe); local phase plan 8 / 17 / 25 / 10 / 5.

### Goal and prerequisites

Learners should prove filesystem containment, separate upload naming/type/size
controls, and bound outbound destinations. Assume pathlib, temporary files,
URLs, DNS concepts, and basic HTTP.

### Core explanation

Trace the file read at vulnerable.py:9 (read_file_vulnerable), client-selected
upload path at vulnerable.py:15 (store_upload_vulnerable), and URL fetch at
vulnerable.py:28 (fetch_url_vulnerable). Compare secure.py:16
(resolve_under), secure.py:32 (store_upload_secure), and secure.py:102
(fetch_url_secure). The secure URL policy is not just a scheme check: it uses
exact host/port/address, no redirects, timeout, and response-size bounds.

### Demonstration and actual command

1. Show the temporary upload root and its sibling/private file. Ask for the
   postcondition that must hold after resolution.
2. Run:

~~~powershell
python -m unittest m04_files_ssrf.test_m04 -v
~~~

3. Pause at path traversal, client-path upload, and loopback SSRF tests. Then
   show the mocked allowed destination and the final-destination/oversize
   rejection tests.
4. Explain that a generated filename is an additional storage control, not a
   substitute for containment, type, and size validation.

### Learner practice

Learners record the base directory and sibling boundary, the requested name
and generated name locations, the exact URL policy, and observations from both
loopback and mocked-opener tests. They must state which observations are policy
evidence and which production controls remain unverified.

### Discussion and review questions

- What postcondition proves a file remains under the authorized root?
- Why is stripping .. or / weaker than resolving and checking containment?
- Why are extension/MIME checks separate from storage naming?
- Why is https alone insufficient for SSRF prevention?
- What does a fake resolver/opener not prove about deployment egress?

### Wrong turns, sticking points, and hints

If a learner strips characters, ask about encoded or alternate path forms.
If they trust an extension or MIME value, ask whether it controls where bytes
are written. If they allow the first URL after one check, ask about redirects
and final destinations. If they cite the local server as proof, ask what the
mock bypasses.

### End-of-module learning result

The learner can reproduce traversal, unsafe upload naming, and loopback SSRF,
explain separate path/upload/network controls, and verify normal file/upload
behavior plus bounded mocked fetch behavior.

## M05 — Web Output, CSRF, Exceptions, and Logging

Authority: M05, T05, P05, objectives O17, O18, O19, O20, questions Q24, Q25,
Q26, Q27, Q28.
Original material: [learner](../m05_web_context/learner.md),
[instructor](../m05_web_context/instructor.md), and the existing
[verification record](../m05_web_context/verification-record.md). Planned
time: 55 minutes (40 Python / 15 Vibe); local phase plan 7 / 15 / 20 / 8 / 5.

### Goal and prerequisites

Learners should select encoding for an HTML text sink, require a session-bound
CSRF token and trusted Origin for an ambient-cookie state change, distinguish
failure classes, and keep client/operator channels safe. Assume HTTP method,
cookie, HTML, and exception basics.

### Core explanation

Use vulnerable.py:25 (VulnerableService.handle) and vulnerable.py:37
(_handle) to locate the raw HTML and state-changing paths. Compare
secure.py:29 (SecureService.handle), secure.py:41 (_handle), and
secure.py:84 (_safe_failure). The secure contract includes HTML text escaping,
exact Origin policy, constant-time session-token comparison, allowlisted
themes, distinct 401/403/400/405/500 responses, and a correlation ID with
redacted operator logging.

### Demonstration and actual command

1. Run the focused test command:

~~~powershell
python -m unittest m05_web_context.test_m05 -v
~~~

2. Show the raw draft comment versus the escaped secure response.
3. Reproduce the cross-site request with Alice's cookie and attacker Origin.
   Show status and state before/after; a passing draft assertion records the
   weakness.
4. Compare missing, random, and other-session tokens, valid trusted-origin
   change, failure classes, and safe failure logs.
5. Explicitly say this is a direct Python HTTP client fixture, not browser
   verification. Collect the existing record fields in the common workbook.

### Learner practice

Learners record comment, cookie, Origin/token, and exception Source/Validation/
Sink locations. For every rejected theme request they write the state before
and after and the response status/body. They also record the correlation ID
and the redacted log observation without copying sensitive values.

### Discussion and review questions

- Which value is the HTML text Source and which code line is its Sink?
- Why is a POST still CSRF-relevant when the browser sends an ambient cookie?
- What proves a token belongs to Alice's session rather than merely being
  non-empty?
- Which evidence separates 401, 403, 400, 405, and 500 here?
- What does the client fixture leave unknown about SameSite and browser forms?

### Wrong turns, sticking points, and hints

If a learner says POST cannot be CSRF-ed, return to ambient credentials. If
any non-empty token is accepted, ask for the server-side session relation. If
they call HTML escaping universal validation, ask which output context is being
protected. If they return a traceback, ask what a public client needs versus
what a correlated operator log may need. If they reject all POSTs, ask them
to preserve the valid trusted-origin light/dark transition.

### End-of-module learning result

The learner can distinguish output encoding from input validation, reproduce
the client-fixture CSRF weakness, show zero state mutation for denied requests,
preserve valid changes, and state the browser-verification limitation.

## M06 — Authentication, Authorization, and BOLA/IDOR

Authority: M06, T06, P06, objectives O21, O22, O23, O24, questions Q29, Q30,
Q31, Q32.
Original material: [learner](../m06_authorization/learner.md) and
[instructor](../m06_authorization/instructor.md). Planned time: 60 minutes
(40 Python / 20 Vibe); local phase plan 8 / 15 / 22 / 10 / 5.

### Goal and prerequisites

Learners should separate authentication from object authorization, make a
subject/object/action/tenant decision, default unknown actions to deny, and
rotate a pre-authentication session ID. Assume dictionaries, exceptions, and
basic login/session concepts.

### Core explanation

Use vulnerable.py:26 (get_document_vulnerable), vulnerable.py:38
(update_document_vulnerable), and vulnerable.py:49 (login_vulnerable).
Compare the policy at secure.py:15 (_allows), secure operations at
secure.py:27 and secure.py:38, and session rotation at secure.py:51
(login_secure). Authentication is necessary but is not permission to retrieve
an arbitrary object. An explicit same-tenant admin rule is an allowlisted
policy case, not proof that every cross-owner request is allowed.

### Demonstration and actual command

1. Build a matrix for owner, same-tenant member, unrelated user, same-tenant
   admin, other tenant, and unauthenticated caller.
2. Run:

~~~powershell
python -m unittest m06_authorization.test_m06 -v
~~~

3. Pause at test_vulnerable_login_only_check_allows_idor_but_secure_denies
   and distinguish returned data from authorization evidence.
4. Show default deny for unknown action/tenant boundary, the explicit
   same-tenant admin case, and pre-auth ID rejection after secure login.

### Learner practice

Learners complete the decision matrix, record the BOLA reproduction and secure
denial, explain the admin exception, and record old/new session identifiers
and revocation observations. They must cite _allows and the sink caller.

### Discussion and review questions

- Where is the server-owned permission decision made?
- Which test demonstrates object substitution rather than only a normal owner
  case?
- Why must tenant scope be part of the admin rule?
- What does session rotation protect, and what does it not replace?

### Wrong turns, sticking points, and hints

If logged-in means allowed, ask for object owner and tenant. If an integer or
opaque ID is treated as authorization, ask who can substitute it. If they hide
the button, ask whether the API still checks. If they make admin global, ask
which tenant boundary the rule must preserve. If they rotate the session but
skip object authorization, separate the two controls.

### End-of-module learning result

The learner can demonstrate the BOLA boundary, state the policy inputs, explain
the bounded admin exception, and show session rotation with code and test
evidence.

## M07 — Secrets, Dependencies, and Supply-Chain Review

Authority: M07, T07, P07, objectives O25, O26, O27, O28, questions Q33, Q34,
Q35, Q36.
Original material: [learner](../m07_secrets_dependencies/learner.md) and
[instructor](../m07_secrets_dependencies/instructor.md). Planned time: 55
minutes (35 Python / 20 Vibe); local phase plan 7 / 15 / 20 / 8 / 5.

### Goal and prerequisites

Learners should minimize secret propagation, separate provider and credential
sinks, redact client/operator/support channels, triage dependency findings with
evidence, and review package provenance. Assume exception/log concepts and
basic dependency lifecycle vocabulary.

### Core explanation

Use vulnerable.py:21 (VulnerableService.process), vulnerable.py:34
(scanner_only_dependency_decision), and vulnerable.py:45
(scanner_only_package_approval) to show unnecessary propagation and
scanner-only decisions. Compare secure.py:73 (build_prompt_secure),
secure.py:91 (SecureService.process), secure.py:109 (support_export),
secure.py:145 (triage_dependency), and secure.py:206
(review_package_provenance). The credential may reach only the narrow fake
client sink at secure.py:65 (LocalServiceClient.execute).

### Demonstration and actual command

1. Draw the token Source -> provider/redaction -> prompt, response, log, trace,
   support, and fake-client sinks. Ask which paths are necessary.
2. Run:

~~~powershell
python -m unittest m07_secrets_dependencies.test_m07 -v
~~~

3. Show the vulnerable leak tests as reproduction evidence, then compare
   normal processing, stable public failure, redacted logs/export, and narrow
   credential supply.
4. Compare scanner-only ignore/clean decisions with REVIEW, UPGRADE, and
   bounded NOT_AFFECTED_REVIEWED evidence.
5. Require human review of the repair diff and residual assumptions.

### Q36 handling

User approval of the Q36 answer-binding correction is complete. At this PR
head, the canonical answer application, immutable revision binding, and
verification are not confirmed. Until those states are separately confirmed,
do not use Q36 as a confirmed-answer key, do not score it, and do not present
an answer position as authoritative. Record the exclusion in the workbook or
instructor notes. The impact is that the M07 item-level question set is
incomplete for Q36; it must not be silently replaced by a guessed item score.
O28 can still be discussed and observed through P07 provenance evidence,
review questions, and human reasoning, but that practical evidence is not a
substitute canonical answer or a certification rule. Do not edit the
canonical Q36 content or approval artifact here.

### Learner practice

Learners record every token channel, the provider/client boundary, the
dependency evidence needed for a decision, and the provenance gaps in the
model-suggested package. They record Q36 as an approved correction whose
canonical application, revision binding, and verification remain pending, and
exclude it from scoring rather than entering a guessed answer.

### Discussion and review questions

- What is the minimum secret data flow for normal processing?
- Which channel may receive the credential, and which channels must not?
- What evidence changes a dependency disposition from REVIEW to UPGRADE or
  NOT_AFFECTED_REVIEWED?
- Why is a model suggestion not a package owner or provenance record?
- Which production claims remain outside the local fake provider, scanner,
  registry, CI, and log pipeline?

### Wrong turns, sticking points, and hints

If a learner puts the token in a prompt, ask whether the feature truly needs
it there. If they redact only the browser response, ask about trace and
support export. If they ignore transitive findings or approve a locked package,
ask for owner, path, reachability, upgrade, source, integrity, build, and CI
evidence. If they reject every task with sensitive text, ask them to preserve
normal processing with a narrow provider boundary.

### End-of-module learning result

The learner can show the intended leak, explain why passing leak assertions are
not secure results, trace the narrow credential sink, make an evidence-based
dependency/provenance decision, and accurately leave Q36 unscored pending
canonical application, revision binding, and verification.

## M08 — Vibe-Coding Capstone and Human Re-verification

Authority: M08, T08, P08, objectives O29, O30, O31, O32, questions Q37, Q38,
Q39, Q40.
Original material: [learner](../m08_capstone/learner.md),
[instructor](../m08_capstone/instructor.md), and the existing
[human-review template](../m08_capstone/human-review-template.md). Planned
time: 60 minutes (40 Python / 20 Vibe); local phase plan 8 / 17 / 22 / 8 / 5.

### Goal and prerequisites

Learners should complete the full requirement-to-human-review loop across SQL,
filesystem, object authorization, and outbound URL flows. Assume M01–M07
Source/Validation/Sink reasoning and unit-test reading.

### Core explanation

Trace the four vulnerable sinks at vulnerable_app.py:24 (search),
vulnerable_app.py:27 (read_document), vulnerable_app.py:30 (get_invoice),
and vulnerable_app.py:33 (preview). Compare secure_app.py:36,
secure_app.py:39, secure_app.py:42, and secure_app.py:45 in the secure
application. The capstone is a composition exercise: parameterized SQL does
not replace authorization, a path check does not replace URL policy, and a
mocked preview does not prove production egress isolation.

### Demonstration and actual command

1. Give the fixed requirement and allow the prompt-writing checkpoint. Ask for
   a Source/Validation/Sink map before opening the secure reference.
2. Run:

~~~powershell
python -m unittest m08_capstone.test_m08 -v
~~~

3. Run or discuss the vulnerable assertions separately: SQL, path, IDOR, and
   loopback SSRF. Label each as intended evidence of the draft weakness.
4. Compare secure normal cases first, then attack cases, then the mocked
   approved preview. Inspect any AI repair diff for unrelated or untested
   changes and collect a human decision.

### Learner practice

Learners complete one consolidated M08 record with four flow rows, normal and
attack observations, repair rationale, regression evidence, residual
deployment assumptions, and the final human decision. They must identify which
facts came from deterministic tests and which judgment was made by a person.

### Discussion and review questions

- Which test is positive, which is negative, and which is regression evidence?
- What did the secure code preserve that a reject-everything patch would not?
- Which decisions require human review beyond test output?
- What deployment controls are needed for real network egress and object
  authorization?

### Wrong turns, sticking points, and hints

If a learner approves concise generated code, ask for exact source and tests.
If they fix only the scanner-named line, ask for equivalent flows. If they
equate bound SQL with authorization, return to subject/object/action. If they
allow localhost because the fixture is local, ask which production target
policy is intended. If they cite a fake opener as egress isolation, ask what
the mock bypasses.

### End-of-module learning result

The learner can complete a bounded end-to-end review, reproduce all four draft
weaknesses, preserve all normal secure paths, document test evidence and
limitations, and make a human accept/reject/needs-more-evidence decision.

## Close-out and handoff

At the end of each module, collect the workbook page or its electronic
equivalent. The minimum evidence is a code location, a real command, an
observed result, an explanation, and a residual limitation. Use the rubric for
feedback; do not map its evidence scale to platform Mastery, Confidence, or
Skill State.

This package reaches SECURIUM_PYTHON_8H_INSTRUCTOR_KIT_READY_FOR_REHEARSAL.
It does not report that an instructor/student rehearsal has happened or that
the complete delivery is ready. Rehearsal, scheduling, accessibility checks,
and canonical Q36 application, revision binding, and verification remain
delivery-owner work.
