# Instructor guide — Developer Secure Coding

## Facilitation stance

Keep the discussion anchored in data flow: source, trust boundary, transformation, sink, and failure behavior. Ask learners what an attacker controls, what the application assumes, and where the assumption is enforced. Do not turn the class into a catalog of payloads.

## Suggested rhythm

For each module: 5 minutes of framing, 10–20 minutes of explanation and code reading, 5–10 minutes of pair work, then a short debrief. Have learners state both a false-positive and a false-negative for at least one control.

## Instructor prompts

- “What is the input’s type and grammar, not just its value?”
- “At which context does this string become meaningful?”
- “What happens after normalization?”
- “If this check is bypassed, what server-side control still protects the resource?”
- “What would be safe to log, and who can read it?”

For Module 06, write the regex pattern and Java string representation on separate lines, then run a tiny unit test before discussing limitations. Contrast allowlist validation with blacklist filtering, and require learners to name normalization, canonicalization, base containment, encoding, and symlink/OS considerations. For Module 05, ask which output context receives the value. For Modules 07 and 13, debrief authentication, authorization, default deny, and BOLA/IDOR with an ownership matrix.

## Common misconceptions to correct

Allowlist validation is not the same as stripping punctuation. Encoding is not validation. Authentication does not imply authorization. A hash is not encryption. A cookie flag is not a permission check. A dependency scanner is not a substitute for patch ownership. Logging an entire request is rarely an incident-response win.

## Lab handling

Use synthetic values only. Review changes as diffs. Require learners to explain why a fix works and what assumptions remain. If a learner proposes a blacklist, ask them to name an input that is valid but rejected and an input that is dangerous but accepted.

## Review rubric for the practical

Look for: correct trust-boundary identification; contextual control selection; normalization before validation where relevant; server-side authorization; safe failure behavior; tests for malformed, boundary, and legitimate inputs; and a prioritized explanation. This rubric is instructional guidance only and is not an evaluation-model change.
