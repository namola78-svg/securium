# M02 Instructor Guide

## Demonstration order

1. Show `search_users_vulnerable`: the Source is `name_filter`, validation is
   absent, and the SQL `WHERE` clause is the Sink/interpreter.
2. Run the injection test and pause on the assertion that the vulnerable path
   returns three rows. This is an expected teaching result.
3. Show that the secure query binds values but still maps structural SQL
   choices separately.
4. Use the platform-specific shell payload. Ask which characters become shell
   syntax, then compare the secure output, where the complete string is one
   process argument.
5. Show that restricting `eval` globals is not the lesson's security boundary;
   the reference repair removes code interpretation and accepts a tiny grammar.

## Common wrong answers

- “Remove quotes or semicolons before SQL”: this is not parameter binding.
- “`split()` makes a shell command safe”: it does not define executable,
  argument, authorization, timeout, or resource policy.
- “`shell=False` alone makes any executable safe”: the executable and every
  argument still need an explicit policy.
- “A smaller `eval` globals dictionary is a complete sandbox”: it is not a
  general security boundary.

## Check questions

- What does the database interpret, and which part must remain structure?
- Which value is allowed to select a column, and who owns that map?
- What normal behavior proves the repair did not merely reject everything?
- What security decision is still outside this lab? (Authorization and DB
  privilege are not established by parameterization.)
