# M07 Lab: Secrets, Dependencies, and Supply-Chain Review

Canonical authority: `M07` / `T07` · practical `P07` · objectives `O25–O28` · questions `Q33–Q36`.

## Goal

Review a synthetic Python service from requirement to human re-verification.
Keep secrets out of prompts, source, responses, logs, traces, and support
exports; make dependency findings actionable; and review package provenance
without treating a scanner result or a model suggestion as authority.

This lab is intentionally local-only. The token, package names, advisory, and
integrity digest are fake fixtures. No package is installed, no lockfile is
changed, and no external AI, scanner, network, secret manager, or production
data is used.

## Requirement and fixed prompt

The service must process a normal task using a credential held by an approved
provider. The credential may reach only the narrow fake service-client sink.
It must not appear in prompts, generated source, public responses, operator
logs, traces, or support exports. A dependency finding must result in a
decision backed by owner, dependency path, affected path, reachability, and
upgrade evidence. A model-suggested package needs source, integrity, owner,
build context, CI-credential review, and human review.

> Implement a standard-library-only repair for this local fixture. Trace every
> secret Source → Validation/Redaction → Sink flow. Preserve successful task
> processing, use an injected approved secret-provider interface, redact
> operator channels, and return a stable public error. Treat scanner output as
> a triage signal. Require dependency ownership, reachability, affected-path,
> and upgrade evidence, then review package source, integrity, owner, build
> context, and CI credential exposure. Do not install a package, edit a
> lockfile, call a service, copy a secret into a prompt, or accept model output
> as security evidence.

## Learner task

1. Mark the sources, validation/redaction points, and sinks in `vulnerable.py`.
2. Run the vulnerable assertions and explain why a passing assertion is
   evidence that the intended weakness was reproduced.
3. Compare `secure.py` with the prompt, including the approved credential sink
   and the stable public error contract.
4. Triage the synthetic advisory. Explain why `REVIEW` is safer than silently
   ignoring a finding with missing evidence.
5. Review the model-suggested package and identify the provenance gaps.
6. Ask an AI for a repair if one is available, or apply the reference repair
   manually. Inspect the diff, rerun tests, and record residual assumptions.

## Run and reset

From the lab bundle directory:

```powershell
python -m unittest m07_secrets_dependencies.test_m07 -v
```

Run all labs with:

```powershell
python -m unittest discover -s . -p "test_*.py" -v
```

All state is in memory. Each test creates fresh fixtures, so no reset command
is required. Do not create a real `.env`, install a vulnerable package, or use
a real credential to extend the exercise.

## Expected evidence

The vulnerable path leaks the fake token into a prompt, public error, and
operator log; the secure path preserves normal processing and keeps the token
out of those channels while allowing it at the narrow fake credential sink.
The vulnerable scanner path ignores an under-specified finding and approves a
clean model-suggested package. The secure path requires reviewable evidence
and preserves explicit upgrade and bounded-not-affected decisions.
