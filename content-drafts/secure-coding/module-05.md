# Module 05 — XSS / Output Encoding

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Contextual output encoding → web developer → encode at the sink and avoid unsafe DOM APIs → Servlet/JSP, templates, browser DOM. Related certification: web/application security domain (conceptual only).

## Lesson

Validation asks whether input is allowed; encoding asks how it can be represented safely in a specific output context. HTML text, attributes, URLs, CSS, and JavaScript have different grammars. Prefer framework auto-escaping and safe DOM properties such as `textContent`.

```java
out.write(htmlEncoder.encodeForHtml(userComment));
```

HTML encoding is appropriate only for HTML text. Do not reuse that encoded value in a URL or script context; URL schemes and URL components need their own validation/encoding policy. Removing `<` is a blacklist, not contextual encoding. The encoder name is illustrative; use the approved framework encoder in the real application.

## Exercise

Classify HTML text, an `href`, and a JSON response; name the correct serializer or encoder for each.

## Instructor notes

Encoding late preserves data fidelity and reduces double-encoding mistakes.

## Learner takeaway

Encode for the exact output context, close to the sink.
