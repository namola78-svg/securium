# Module 13 — Secure API Coding

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

API boundary hardening → API developer → schema validation, object authorization, abuse controls, safe responses → HTTP, JSON, OpenAPI, rate limiter. Related certification: API/application security domain (conceptual only).

## Lesson

Validate content type and schema, bound collection sizes and processing time, authenticate the caller, authorize every object, and return only needed fields. Avoid mass assignment by binding to an explicit input DTO rather than a persistence entity. Test BOLA/IDOR by attempting to use a valid caller identity with another user’s object identifier; the server must deny it. Use consistent status behavior without leaking protected-resource existence. Rate limits should reflect identity, resource cost, and failure patterns.

## Exercise

Review `PATCH /users/{id}` that binds JSON to `User`. Define an input DTO, authorization rule, writable-field allowlist, and response projection.

## Instructor notes

Ask whether an “internal” route is reachable from an untrusted client or network.

## Learner takeaway

An API contract is a security boundary: constrain input, object scope, cost, and output.
