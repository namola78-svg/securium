# Module 03 — Injection / Code Injection

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Instruction/data separation → developer → safe interpreters and parameterized APIs → Java regex, template engines, process APIs. Related certification: application-security domain (conceptual only).

## Lesson

Injection occurs when data crosses a boundary and is reinterpreted as instructions. Use APIs that keep the two channels separate, then validate business constraints. `replace` treats its search as literal text; `replaceAll` treats its search as a regex and interprets replacement metacharacters.

```java
text.replace(".", "");
text.replaceAll("\\.", "");
text.replaceAll("[', \\[]", "");
text.replaceAll("[()\\-'\\[\\]:,*/]", "");
```

The first two can intend the same result, but an unescaped `.` in `replaceAll` matches almost any character. Character-class examples are blacklist filters: they may create false positives and still leave dangerous syntax. For user-supplied regex, use a literal API or quote the pattern. For processes, pass an argument list instead of building a shell command.

## Exercise

Replace a free-form sort expression with a map from approved names to fixed expressions. Add a test for an unknown name.

## Instructor notes

Ask which interpreter sees the value next; a value safe for SQL may be unsafe for HTML.

## Learner takeaway

Use the sink’s safe API; do not delete a few characters and call a language neutralized.
