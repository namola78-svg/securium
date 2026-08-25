# Module 06 — Path Traversal / File Handling

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Canonicalized path containment → backend developer → normalize, resolve, constrain, and authorize file operations → Java NIO `Path`, Servlet multipart APIs. Related certification: system/application security domain (conceptual only).

## Lesson

Separators, dot segments, encoded bytes, symbolic links, and platform rules can make a raw string check disagree with the path the operating system opens. Normalize using the platform API, resolve against an approved directory, verify containment after resolution, and use a server-generated storage name where possible.

### Example labels: vulnerable filter and corrected defense

VULNERABLE/INCOMPLETE FILTER — do not use as the complete defense:

```java
if (name.indexOf('\\') > -1 || name.indexOf('/') > -1) return invalid();
if (name.matches(".*\\\\.\\\\..*")) return invalid();
```

The separator test and parent-segment regex reject some obvious forms, but they are blacklist-style checks. Encoded traversal, mixed separators, alternate dot forms, symlinks, OS differences, and time-of-check/time-of-use races can create false negatives. They can also reject legitimate names, creating false positives.

Representation note — keep these layers distinct:

```text
Regex pattern: .*\\.\\..*
Java source literal representation requested for this lesson: ".*\\\\.\\\\..*"
```

The four-backslash form above is the Java-source literal as serialized through this Markdown/JSON authoring representation. After that transport layer is decoded, the compiler-facing Java source is:

```java
String parentSegmentPattern = ".*\\.\\..*";
boolean hasParentSegment = name.matches(parentSegmentPattern);
```

The regex engine receives `.*\\.\\..*`, where `\\.` means a literal dot. The intended meaning is “some text containing the literal sequence `..`,” not “a complete traversal proof.” Keep a unit test for the compiler-facing source form.

CORRECTED DEFENSE HIERARCHY:

1. Constrain input to an approved identifier or filename grammar where possible.
2. Resolve the candidate against the intended base directory.
3. Normalize/canonicalize the path using filesystem-aware APIs.
4. Verify the resolved path remains inside the normalized allowed base.
5. Apply OS/filesystem-aware checks, including symlink and race-resistant handling where required.
6. Reject unexpected encodings and alternate forms before file access.

For example, `base.resolve(name).normalize()` is only an intermediate operation; it must be followed by a containment comparison and authorization. `getRealPath()` may be unavailable or deployment-specific. `getOriginalFilename()` is client-controlled metadata and must not become a filesystem path. Store uploads outside executable/static roots and constrain size and type.

`getRealPath()` may be unavailable or deployment-specific. `getOriginalFilename()` is client-controlled metadata and must not become a filesystem path. Store uploads outside executable/static roots and constrain size and type.

## Exercise

Rewrite an upload handler using `getOriginalFilename()`. List one false positive and one false negative of separator rejection.

## Instructor notes

Explain normalization before comparison and the time-of-check/time-of-use gap. Do not test against real sensitive files.

## Learner takeaway

A filename is metadata, not permission. Resolve and authorize the final filesystem object.
