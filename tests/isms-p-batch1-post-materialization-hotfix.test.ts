import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
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
