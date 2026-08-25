# Learner guide — Developer Secure Coding

## Working rule

Treat every external value as data with a stated grammar. Validate it against what the feature actually accepts, normalize it before comparing when representations can vary, and use a control designed for the sink where the value is used.

Canonicalization resolves representation differences using filesystem-aware rules; normalization is a representation cleanup step and is not, by itself, authorization. BOLA/IDOR is an object-level authorization failure in which a caller can use another object’s identifier. CSRF concerns browser-attached credentials; contextual encoding means encoding for the exact HTML, attribute, URL, or script sink.

## Quick reference

| Risk | Primary habit |
|---|---|
| Injection | Keep data separate from commands, queries, and templates |
| XSS | Encode for HTML text, attribute, URL, or script context |
| File access | Resolve within an approved directory and reject escapes |
| Access control | Enforce ownership/permission on every protected operation |
| Sessions | Rotate identifiers and set Secure, HttpOnly, and suitable SameSite |
| Secrets | Minimize exposure, use a secret manager, redact logs |
| Errors | Give users safe messages; give operators correlated diagnostics |
| Crypto | Choose a reviewed primitive and protect key lifecycle |
| Dependencies | Pin, review, update, and monitor transitive risk |
| APIs | Validate schemas, scope objects, rate-limit, and avoid over-sharing |

## Code-review checklist

1. Identify sources, sinks, trust boundaries, and assumptions.
2. Check type, length, grammar, range, and authorization—not only characters.
3. Check canonicalization/normalization before security comparisons.
4. Check context-specific encoding and parameterization.
5. Check logs, errors, secrets, cookies, and dependency changes.
6. Add tests for accepted, rejected, boundary, and adversarially shaped values.

## Practice journal

For each exercise, record: the original assumption, the abuse case, the narrowest effective control, one false positive, one false negative, and the test that would catch regression.
