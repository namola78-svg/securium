import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadBundle, validateFoundation } from "./validate-securium-cppg-foundation-wave-a.mjs";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const original = await loadBundle(repoRoot);
const cases = [
  ["missing official subject", (b) => { b.curriculum.subjects.pop(); }],
  ["altered subject order", (b) => { [b.curriculum.subjects[0], b.curriculum.subjects[1]] = [b.curriculum.subjects[1], b.curriculum.subjects[0]]; }],
  ["wrong official weight", (b) => { b.curriculum.subjects[0].officialWeight = 11; }],
  ["weight total != 100", (b) => { b.curriculum.subjects[4].officialWeight = 14; }],
  ["duplicate question", (b) => { b.assessment.questions[1].stem = b.assessment.questions[0].stem; b.assessment.questions[1].options = [...b.assessment.questions[0].options]; }],
  ["missing answer", (b) => { b.assessment.questions[0].correctOptionIndex = null; }],
  ["missing explanation", (b) => { delete b.assessment.questions[0].explanation.correctChoice; }],
  ["unsupported official per-subject question claim", (b) => { b.examProfile.subjectQuestionAllocation = "OFFICIAL_QUESTION_ALLOCATION"; }],
  ["rights boundary violation", (b) => { b.provenanceRights.rightsPolicy.jLabsDirectLearnerFacingReuse = 1; }],
  ["source question contamination", (b) => { b.assessment.questions[0].provenance.referencePackage.copiedQuestion = true; }],
];
const results = [];
for (const [name, mutate] of cases) {
  const candidate = structuredClone(original); mutate(candidate);
  try { validateFoundation(candidate); results.push({ name, expected: "FAIL_CLOSED", status: "FAILED_TEST", error: "mutation was accepted" }); }
  catch (error) { results.push({ name, expected: "FAIL_CLOSED", status: "PASS", error: error instanceof Error ? error.message : String(error) }); }
}
const report = { manifestId: "SECURIUM_CPPG_FOUNDATION_MUTATION_TESTS_V1", generatedAt: "2026-09-08", cases: results, passed: results.filter((result) => result.status === "PASS").length, total: results.length, status: results.every((result) => result.status === "PASS") ? "PASS" : "FAIL" };
await writeFile(join(repoRoot, "reports", "content-audit", "securium-cppg-foundation-wave-a-mutation-tests.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
