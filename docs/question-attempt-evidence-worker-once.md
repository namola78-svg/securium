# Manual QUESTION_ATTEMPT Evidence execution

`run-question-attempt-evidence-once.mjs` is a disposable-only, one-shot
entrypoint for the bounded executor merged in #153. It claims at most one
eligible ordinary `QUESTION_ATTEMPT` `EVENT` request and then exits. It does
not poll, loop, schedule, retry automatically, dispatch a worker, or process
`SW/Foundation`, `USER`, `FULL`, or mock requests.

The runner does not load `.env`, `DATABASE_URL`, `DIRECT_URL`, or Cloudflare
runtime bindings implicitly. A target and fixture must be supplied explicitly.
It never prints the connection URL, credentials, source payload, or learner
answer.

## Disposable D1

The fixture owner must first create a local Miniflare D1 persist directory with
the current schema and pending request. The runner does not apply migrations or
create a request.

```text
node node_modules/tsx/dist/cli.mjs scripts/run-question-attempt-evidence-once.mjs --local-disposable --provider=d1 --d1-persist-to=<absolute-local-persist-dir> --d1-database=<local-d1-database-identity>
```

When the fixture was prepared through `scripts/run-wrangler.mjs`, the runner
reuses its `<persist>/v3/d1` state and the configured local D1 database ID
(`00000000-0000-4000-8000-000000000000` in this repository). Direct Miniflare
fixtures may use their own database identity.

## Disposable PostgreSQL

The fixture owner must create a PostgreSQL container with a loopback-only
published port and the label
`com.securium.evidence-once.owner=<owner-token>`. The three environment
variables are required; the runner verifies that the container is running, the
owner label matches, and the URL port is the container's `127.0.0.1` mapping.

```text
SECURIUM_EVIDENCE_ONCE_POSTGRES_URL=<loopback-url>
SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER=<owned-container-id-or-name>
SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER=<owner-token>
node node_modules/tsx/dist/cli.mjs scripts/run-question-attempt-evidence-once.mjs --local-disposable --provider=postgres
```

## Result and exit codes

The command emits one JSON result containing only status, request ID, projection
outcome/count, and error class.

| Result | Exit code | Meaning |
| --- | ---: | --- |
| `NO_REQUEST` | 0 | No eligible request was available; no mutation was made. |
| `COMPLETED` | 0 | One request completed after projection/handoff transaction and completion CAS. |
| `REPLAY` | 0 | The existing request/projection contract identified an exact replay. |
| `CLAIM_LOST` | 75 | The lease/fence was lost; the request is not reported completed by this process. |
| `RETRYABLE_FAILURE` | 75 | Existing retry contract classified the failure as retryable. |
| `FAILED` | 1 | Source, revision, mapping, or other terminal contract failure. |
| configuration/target error | 2 | Target was not an explicitly allowed disposable fixture. |

After a non-zero result, inspect the request's existing status and error class
before deciding whether to invoke the same command again. The command itself
does not perform automatic retry. A second manual invocation uses the existing
lease, replay, and fencing contract. `MASTERY_RECOMPUTE_REQUIRED` handoffs may
be created by the existing projection transaction, but mastery calculation is
not performed.

This is not an operational worker or managed Runtime validation. Scheduler,
cron, deployment, production/shared database access, historical backfill, and
mastery/Skill State computation remain separate work.
