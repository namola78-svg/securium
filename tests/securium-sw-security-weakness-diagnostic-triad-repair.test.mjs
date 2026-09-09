import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateCandidate } from "../scripts/validate-sw-foundation-candidate.mjs";

const candidate = JSON.parse(await readFile("content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json", "utf8"));
const mutated = (mutate) => { const copy = structuredClone(candidate); mutate(copy); return copy; };
const rejects = (value, pattern) => assert.throws(() => validateCandidate(value), pattern);

test("repaired candidate accepts all seven semantic triads", () => {
  assert.equal(validateCandidate(candidate).acceptedDiagnosticTriads.length, 7);
});
test("rejects metadata-only false positive", () => rejects(mutated((c) => delete c.questions.find((q) => q.role === "FALSE_POSITIVE").case), /missing diagnostic case/));
test("rejects empty explanation", () => rejects(mutated((c) => { c.questions[0].explanation = ""; }), /insufficient explanation/));
test("rejects missing answer", () => rejects(mutated((c) => delete c.questions[0].answerKey), /answer key/));
test("rejects missing assumptions", () => rejects(mutated((c) => { c.questions[0].case.assumptions = []; }), /missing assumptions/));
test("rejects category mismatch", () => rejects(mutated((c) => { c.acceptedDiagnosticTriads[0].topic = "XSS"; }), /category mismatch/));
test("rejects duplicate triad role", () => rejects(mutated((c) => { c.questions.find((q) => q.id === "sw-fa-q-iv-s").role = "VULNERABLE"; }), /one vulnerable/));
test("rejects two vulnerable members", () => rejects(mutated((c) => { c.questions.find((q) => q.id === "sw-fa-q-iv-fp").role = "VULNERABLE"; }), /one vulnerable/));
test("rejects false positive without safety reason", () => rejects(mutated((c) => { delete c.questions.find((q) => q.role === "FALSE_POSITIVE").nonExploitabilityReason; }), /false-positive safety/));
test("rejects secure case without actual control", () => rejects(mutated((c) => { c.questions.find((q) => q.role === "SECURE").case.validationOrTransformation = "none"; }), /secure case has no control/));
