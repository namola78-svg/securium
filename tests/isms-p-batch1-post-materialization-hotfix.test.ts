import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeLessonContent } from "../components/safe-lesson-content.tsx";
import { buildCppgCourseTheoryDraftProjection } from "../lib/services/cppg-runtime-course-registration.ts";
import { ismsPTheoryBatch1Records } from "../lib/data/isms-p-theory-batch1.mjs";
import {
  parseStructuredLessonContent,
  structuredLessonText,
} from "../lib/services/structured-content-service.ts";

const root = process.cwd();

test("all 12 approved Batch 1 bodies satisfy the structured learner rendering contract", () => {
  assert.equal(ismsPTheoryBatch1Records.length, 12);
  for (const record of ismsPTheoryBatch1Records) {
    assert.equal(record.content.bodyFormat, "STRUCTURED_JSON");
    const parsed = parseStructuredLessonContent(record.content.body);
    const text = structuredLessonText(record.content.body);
    assert.ok(parsed, record.metadata.officialCode);
    assert.ok(text, record.metadata.officialCode);
    assert.equal(parsed.criterionId, record.metadata.officialCode);
    assert.ok(parsed.sections.length > 0);
    assert.ok(!parsed.sections.some((section) => ["title", "provenance"].includes(section.key)));
    assert.doesNotMatch(text, /^\s*[\[{]/);
    assert.doesNotMatch(text, /"(?:criterionId|sourceSectionOrder|sections|status|value)"\s*:/);
  }
});

test("representative Batch 1 bodies preserve approved semantic prose", () => {
  for (const code of ["1.1.1", "2.2.6", "2.9.2"]) {
    const record = ismsPTheoryBatch1Records.find((candidate) => candidate.metadata.officialCode === code);
    assert.ok(record, code);
    const source = JSON.parse(record.content.body) as {
      sections: { official_core: { value: unknown[] } };
    };
    const expected = source.sections.official_core.value.find((value) => typeof value === "string");
    const rendered = structuredLessonText(record.content.body);
    assert.equal(typeof expected, "string");
    assert.ok(rendered?.includes(expected as string), code);
  }
});

test("malformed structured content fails closed instead of leaking raw JSON", () => {
  assert.equal(parseStructuredLessonContent('{"sections":'), null);
  assert.equal(parseStructuredLessonContent('{"criterionId":"1.1.1","sections":{}}'), null);
});

test("detail action components perform durable writes only from explicit COMPLETE clicks", () => {
  for (const relative of ["components/course-lesson-actions.tsx", "components/lesson-actions.tsx"]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /action:\s*["'](?:START|UPDATE)["']/);
    assert.match(source, /action:\s*["']COMPLETE["']/);
    assert.match(source, /onClick=\{\(\) => void complete\(\)\}/);
    const effects = [...source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/g)];
    assert.ok(effects.length > 0, relative);
    for (const effect of effects) assert.doesNotMatch(effect[1], /fetch\s*\(/);
  }
});

test("shared renderer selects structured parsing only for the explicit discriminator", () => {
  const source = fs.readFileSync(path.join(root, "components/safe-lesson-content.tsx"), "utf8");
  assert.match(source, /format === "STRUCTURED_JSON"/);
  assert.match(source, /parseStructuredLessonContent\(content\)/);
  assert.match(source, /format === "PLAIN_TEXT"/);
  assert.match(source, /data-structured-content-v3/);
});

const projection = await buildCppgCourseTheoryDraftProjection({ actorUserId: "structured-render-test" });
const body = projection.contents[0].payload.body;
assert.ok(typeof body === "string");
const source = JSON.parse(body) as Record<string, unknown>;

test("all 25 real canonical CPPG bodies render without changing bodies or projection identities", async () => {
  assert.equal(projection.contents.length, 25);
  const before = JSON.stringify(projection);
  for (const content of projection.contents) {
    const raw = content.payload.body;
    assert.ok(typeof raw === "string");
    const payload = JSON.parse(raw);
    const parsed = parseStructuredLessonContent(raw);
    assert.ok(parsed, content.id);
    assert.equal(parsed.learningUnitId, payload.learningUnitId);
    assert.equal(parsed.officialSubjectId, payload.officialSubjectId);
    assert.equal(parsed.sections.length, 11);
    assert.equal(parsed.sections.find((section) => section.key === "definition")?.items[0], payload.definition);
    assert.equal(content.payload.body, raw);
  }
  assert.equal(JSON.stringify(projection), before);
  const again = await buildCppgCourseTheoryDraftProjection({ actorUserId: "structured-render-test" });
  assert.equal(again.projectionSemanticHash, projection.projectionSemanticHash);
  assert.deepEqual(again.revisionRegistration.identities, projection.revisionRegistration.identities);
  assert.deepEqual(again.contents, projection.contents);
});

test("CPPG objectives show original learner text and perspectives show only the four textual values", () => {
  const parsed = parseStructuredLessonContent(body);
  assert.ok(parsed);
  assert.deepEqual(parsed.sections.find((section) => section.key === "objectives")?.items,
    (source.objectives as Array<{ text: string }>).map(({ text }) => text));
  assert.deepEqual(parsed.sections.find((section) => section.key === "perspectives")?.items,
    ["controller", "processor", "dataSubject", "complianceManagement"].map((key) =>
      (source.perspectives as Record<string, string>)[key]));
  const text = structuredLessonText(body);
  assert.ok(text);
  assert.doesNotMatch(text, /SECURIUM_CPPG_THEORY_AUTHORITY|UNRESOLVED_CANDIDATES|CPPG-S1|S1-U01-O1|conceptBindingState/);
});

test("CPPG-like malformed identities, missing fields, and unexpected value shapes fail closed", () => {
  const mutations: Array<(payload: Record<string, unknown>) => void> = [
    (p) => { p.authority = "untrusted"; },
    (p) => { delete p.authority; },
    (p) => { delete p.learningUnitId; },
    (p) => { delete p.officialSubjectId; },
    (p) => { p.learningUnitId = "arbitrary-title"; },
    (p) => { p.officialSubjectId = "CPPG-S2"; },
    ...["title", "definition", "purpose", "keyLegalOperationalConcept", "scope", "importantDistinctions", "lifecycle", "commonMisunderstandings", "appliedScenario", "cppgExamReasoningPoint", "objectives", "coreConcepts", "conceptBindingState"].map((key) =>
      (p: Record<string, unknown>) => { delete p[key]; }),
    (p) => { p.definition = { text: "not a string" }; },
    (p) => { p.title = " "; },
    (p) => { p.definition = "x".repeat(20_001); },
    (p) => { p.objectives = []; },
    (p) => { p.objectives = [{ id: "S1-U01-O1", text: { nested: "untrusted" } }]; },
    (p) => { p.objectives = [{ text: "missing ID" }]; },
    (p) => { p.commonMisunderstandings = ["text", { text: "nested" }]; },
    (p) => { p.coreConcepts = [{ id: "untrusted" }]; },
    (p) => { p.perspectives = { controller: "only one" }; },
    (p) => { p.perspectives = { ...(p.perspectives as object), controller: { nested: "unsafe" } }; },
    (p) => { p.perspectives = { ...(p.perspectives as object), arbitrary: { nested: "unsafe" } }; },
    (p) => { p.authority = "untrusted"; p.criterionId = "1.1.1"; p.sections = { one_glance: { status: "done", value: "downgrade" } }; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(parseStructuredLessonContent(JSON.stringify(candidate)), null, JSON.stringify(candidate).slice(0, 150));
  }
  assert.equal(parseStructuredLessonContent(JSON.stringify({ title: "CPPG", definition: "text" })), null);
});

test("CPPG adapter preserves whitespace, literal text, and every input byte", () => {
  const payload = structuredClone(source);
  payload.definition = "  literal ['not', 'a list'] <script>alert(1)</script>  ";
  const raw = JSON.stringify(payload, null, 2);
  const before = JSON.stringify(payload);
  const parsed = parseStructuredLessonContent(raw);
  assert.ok(parsed);
  assert.deepEqual(parsed.sections.find((section) => section.key === "definition")?.items, [payload.definition]);
  assert.equal(JSON.stringify(payload), before);
  assert.equal(raw, JSON.stringify(payload, null, 2));
});

test("SafeLessonContent renders real CPPG learner prose as HTML without internal IDs or the fallback", () => {
  const html = renderToStaticMarkup(createElement(SafeLessonContent, { content: body, format: "STRUCTURED_JSON" }));
  assert.match(html, /학습 목표/);
  assert.match(html, /처리 목적과 권리 영향의 관계/);
  assert.match(html, /개인정보는 특정 개인을 식별하거나/);
  assert.match(html, /목적·근거·책임·통제를 설계하고 검증/);
  assert.doesNotMatch(html, /학습 본문을 표시할 수 없습니다|conceptBindingState|SECURIUM_CPPG_THEORY_AUTHORITY|S1-U01-O1/);
  const malicious = JSON.stringify({ ...source, definition: '<script>alert("unsafe")</script>' });
  const escaped = renderToStaticMarkup(createElement(SafeLessonContent, { content: malicious, format: "STRUCTURED_JSON" }));
  assert.match(escaped, /&lt;script&gt;/);
  assert.doesNotMatch(escaped, /<script>/);
});

test("existing ISMS-P section order, quoted lists, and malformed behavior stay unchanged", () => {
  const isms = JSON.stringify({ criterionId: "1.1.1", sourceSectionOrder: ["wrap_up", "learning_objectives", "private"], sections: {
    wrap_up: { status: "done", value: "['first', 'second']" },
    learning_objectives: { status: "done", value: [{ item: "goal", meaning: "meaning", audit_check: "check" }] },
    private: { status: "done", value: "hidden" },
  } });
  assert.deepEqual(parseStructuredLessonContent(isms), { criterionId: "1.1.1", sections: [
    { key: "wrap_up", label: "핵심 정리", items: ["first", "second"] },
    { key: "learning_objectives", label: "학습 목표", items: ["goal", "meaning", "check"] },
  ] });
  for (const invalid of ['{"sections":', '{"criterionId":"1.1.1","sections":{}}', 'null', '[]']) {
    assert.equal(parseStructuredLessonContent(invalid), null);
  }
});
