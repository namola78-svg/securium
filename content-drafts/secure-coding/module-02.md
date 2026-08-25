# Module 02 — Input Validation / Allowlist

Time: 30 minutes

## Concept → Role → Skill → Tool/Technology

Allowlist validation → application developer → schema, type, length, range, and grammar validation → Java `String.matches`, Bean Validation. Related certification: secure software development domain (conceptual only).

## Lesson

An allowlist describes valid input for one feature. It is stronger than removing known-dangerous characters because it rejects values outside the required grammar. Validate type, length, and range as well as characters. Where representations vary, normalize safely before comparing. Record false positives (valid input rejected) and false negatives (invalid input accepted).

```java
if (src.matches("[\\w]*") == false) return invalid();
if (!userSN.matches("[\\w\\s]*")) return invalid();
```

These allow word characters, or word characters plus whitespace, and permit the empty string because `*` means zero or more. A required field may need `+` or a separate required check. `\\w` is a regex escape represented inside a Java string; Java-string escaping and regex escaping are separate layers. Unicode and business-specific names may make this allowlist too narrow.

```java
value = value.replace("<", ""); // blacklist-style removal; not XSS protection
```

Filtering can corrupt legitimate data and miss a dangerous alternate interpretation. It is not contextual output encoding.

## Exercise

Write tests for empty, ASCII, Unicode, overlong, and line-break username inputs. State which are valid before writing the regex.

## Instructor notes

Ask learners to explain why a cleaned value differs from the user’s value and why that matters for auditability.

## Learner takeaway

Define valid input first; enforce the smallest grammar that supports the feature.
