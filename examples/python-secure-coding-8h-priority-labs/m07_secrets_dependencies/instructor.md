# M07 Instructor Guide

## Demonstration order

1. Start with the P07 scenario: a secret-like source, exception trace,
   transitive advisory, and model-suggested package.
2. Draw Source → Validation/Redaction → Sink for the token. Ask which sink is
   legitimate and which channels are unnecessary propagation.
3. Run the vulnerable failure case. A test that observes a leak is a passing
   reproduction of the teaching weakness, not a secure result.
4. Show the secure provider boundary, the narrow fake credential sink, and the
   stable client error. Confirm that normal task processing still works.
5. Compare scanner-only `ignore`/`clean` decisions with the evidence-based
   dependency and provenance decisions.
6. Require a human review of the repair diff and the residual assumptions:
   this fixture does not prove a real secret manager, package registry,
   scanner, CI isolation, or production log-redaction pipeline.

## Objective checkpoints

- O25 / Q33: first ask whether the sensitive value is needed at all; then
  identify every prompt, source, response, and log path.
- O26 / Q34: an approved provider is only one boundary; redaction and channel
  separation still matter.
- O27 / Q35: a scanner finding is a triage signal. Ownership, dependency path,
  affected path, reachability, and upgrade evidence determine the next action.
- O28 / Q36: source, integrity, owner, build context, and CI credential
  exposure are separate provenance questions. A lockfile or clean scan is not
  proof of safety.

## Common wrong answers

- Put the token in the prompt so a model can configure the service.
- Return the raw exception because operators might need it.
- Redact only the browser response while retaining the raw trace or export.
- Ignore an advisory because the package is transitive or currently appears
  unreachable, without recording evidence and an owner.
- Approve a model-suggested package because its version is locked or a scanner
  is clean.
- Reject every task containing sensitive text, thereby breaking legitimate
  normal behavior instead of controlling the sink.
- Treat this in-memory provider, fake client, or synthetic digest as proof of
  production secret storage, egress, CI, or registry controls.

## Canonical question note

`Q33–Q35` bind to the semantically correct answer positions in the current
foundation JSON. `Q36` currently has `answer: 0`, while its explanation and
the wording identify option 1 (review source, integrity, owner, build context,
and CI exposure) as correct. This lab does not edit canonical foundation
artifacts; integration should repair that answer binding through the separate
content-governance path.

## Check questions

- What is the minimum secret data flow required for the normal feature?
- Which public and operator channels are intentionally different?
- What evidence changes a dependency finding from `REVIEW` to `UPGRADE` or
  `NOT_AFFECTED_REVIEWED`?
- Why is a model suggestion not a package owner or provenance record?
- Which claims remain outside this local lab's evidence?
