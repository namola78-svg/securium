import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateFoundation } from "./validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const sourceManifestPath = resolve(root, "../../source-evidence-original/digital-forensics/manifest.json");

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "securium-df-foundation-"));
  await cp(root, directory, { recursive: true });
  return directory;
}

async function readFixture(directory, name) {
  return JSON.parse(await readFile(join(directory, name), "utf8"));
}

async function writeFixture(directory, name, value) {
  await writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function expectInvalid(t, file, mutate, expectedText) {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const value = await readFixture(directory, file);
  mutate(value);
  await writeFixture(directory, file, value);
  const result = await validateFoundation(directory, { sourceManifestPath });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes(expectedText)), result.errors.join("; "));
}

test("canonical Foundation fixture passes the bounded validator", async () => {
  const result = await validateFoundation(root, { sourceManifestPath });
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.deepEqual(result.metrics, {
    course: 1,
    modules: 8,
    minutes: 480,
    objectives: 32,
    theoryAssets: 24,
    questions: 40,
    explanations: 40,
    practicals: 8,
    executableLabs: 0,
    sourceManifestSha256: "717204c2ba58f53b81eecb1bbc52c2e799d3250194f39e88b61fc177627b1ece",
    sourceExpressionReuse: 0,
    h04ToH08LocalSourceDependence: 0,
  });
});

test("duplicate Foundation authority fails closed", async (t) => {
  await expectInvalid(t, "manifest.json", (value) => { value.productFoundationAuthorityCount = 2; }, "authority count");
});

test("course identity mutation fails closed", async (t) => {
  await expectInvalid(t, "course.json", (value) => { value.courseId = "course-other"; }, "course identity mismatch");
});

test("duration mutation fails closed", async (t) => {
  await expectInvalid(t, "course.json", (value) => { value.durationMinutes = 479; }, "course duration");
});

test("module-count mutation fails closed", async (t) => {
  await expectInvalid(t, "modules.json", (value) => { value.modules.pop(); }, "module count");
});

test("objective orphan fails closed", async (t) => {
  await expectInvalid(t, "objectives.json", (value) => { value.objectives[0].questionIds = []; }, "no question binding");
});

test("duplicate stable objective ID fails closed", async (t) => {
  await expectInvalid(t, "objectives.json", (value) => { value.objectives[1].id = value.objectives[0].id; }, "duplicate objective IDs");
});

test("theory-count mutation fails closed", async (t) => {
  await expectInvalid(t, "theory.json", (value) => { value.theory.pop(); }, "theory count");
});

test("question-count mutation fails closed", async (t) => {
  await expectInvalid(t, "assessment.json", (value) => { value.questions.pop(); }, "question count");
});

test("question-distribution mutation fails closed", async (t) => {
  await expectInvalid(t, "assessment.json", (value) => { value.questions[0].type = "unapprovedType"; }, "question type distribution");
});

test("difficulty-distribution mutation fails closed", async (t) => {
  await expectInvalid(t, "assessment.json", (value) => { value.questions[39].difficulty = "easy"; }, "question difficulty distribution");
});

test("missing explanation fails closed", async (t) => {
  await expectInvalid(t, "assessment.json", (value) => { delete value.questions[0].explanation; }, "shallow explanation");
});

test("practical-count mutation fails closed", async (t) => {
  await expectInvalid(t, "practicals.json", (value) => { value.practicals.pop(); }, "practical count");
});

test("executable lab mutation fails closed", async (t) => {
  await expectInvalid(t, "practicals.json", (value) => { value.executable = true; }, "executable practical/lab");
});

test("restricted-source expression reuse fails closed", async (t) => {
  await expectInvalid(t, "assessment.json", (value) => { value.localQuestionWordingReuse = 1; }, "local question wording reuse");
});

test("H04 local-support overclaim fails closed", async (t) => {
  await expectInvalid(t, "provenance.json", (value) => { value.sourceSupportByModule[3].local = "LOCAL_SOURCE_SUPPORTED"; }, "falsely claims local source support");
});

test("PII safety mutation fails closed", async (t) => {
  await expectInvalid(t, "practicals.json", (value) => { value.practicalSafety.realPii = 1; }, "realPii");
});

test("runtime publication mutation fails closed", async (t) => {
  await expectInvalid(t, "course.json", (value) => { value.status = "PUBLISHED"; }, "publication status");
});
