# M02 Lab: Validation and Interpreter-Boundary Review

Existing authority: `P02` · objectives `O05–O08` · questions `Q06–Q11`.

## Goal

Review one request value at each of three interpreters: SQL, a shell, and the
Python evaluator. Define the accepted grammar, separate values from syntax,
run the attack and normal tests, and explain the remaining assumptions.

## Requirement and fixed AI prompt

Build a local search helper that accepts a name filter and one of two sort
choices. It must query the supplied SQLite fixture, run a fixed local helper
process without shell interpretation, and support a small data-shaped filter.
Reject unknown structure. Do not use escaping as a replacement for SQL
parameter binding, `shell=True`, `eval`, or `exec`. Add normal, attack,
boundary, and regression tests.

Prompt to an AI assistant:

> Generate a standard-library-only Python repair for this local fixture. Keep
> SQL values bound as parameters; map `name` and `id` to constant SQL
> fragments; pass the sort value as one argument to a fixed executable with
> `shell=False`; parse only `field == literal`. Include positive, injection,
> unknown-sort, and regression tests. State every Source, Validation, Sink,
> assumption, and limitation. Never claim the AI output is security evidence.

## Learner task

1. Mark the Source, Validation, and Sink in `vulnerable.py`.
2. Run `test_m02.py` and explain why each vulnerable assertion is expected to
   demonstrate a failure.
3. Compare the secure functions with the requirements.
4. Ask for or write a repair, then run the same tests again.
5. Record one false positive (a fixed sort map) and one false negative or
   residual concern (database permissions and authorization are outside this
   fixture).

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m02_injection.test_m02 -v
```

Expected result: `Ran 5 tests ... OK`. The tests use an in-memory database and
create no persistent state, so no reset command is required.

## Expected evidence

The vulnerable SQL payload returns all three rows and the vulnerable shell
payload prints `INJECTED`. The secure SQL path returns no rows for the payload,
the secure process prints the entire payload as data, and the restricted
filter parser rejects code.
