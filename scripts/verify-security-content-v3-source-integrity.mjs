import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve("reports/content-v3/source-inventory.json");
const outputPath = resolve("reports/content-v3/source-integrity.json");
const inventory = JSON.parse(await readFile(reportPath, "utf8"));
const sourceRoot = resolve(
  process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT || inventory.sourceRoot,
);
const results = [];

for (const file of inventory.files) {
  const path = resolve(sourceRoot, ...file.source_file.split("/"));
  try {
    const bytes = await readFile(path);
    const actual = createHash("sha256").update(bytes).digest("hex");
    results.push({
      source_file: file.source_file,
      expected_sha256: file.sha256,
      actual_sha256: actual,
      status: actual === file.sha256 ? "UNCHANGED" : "HASH_MISMATCH",
    });
  } catch (error) {
    results.push({
      source_file: file.source_file,
      expected_sha256: file.sha256,
      actual_sha256: null,
      status: "READ_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  policy: "READ_ONLY_HASH_REVALIDATION",
  summary: {
    total: results.length,
    unchanged: results.filter((row) => row.status === "UNCHANGED").length,
    mismatched: results.filter((row) => row.status === "HASH_MISMATCH").length,
    readFailed: results.filter((row) => row.status === "READ_FAILED").length,
  },
  files: results,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (report.summary.mismatched || report.summary.readFailed) {
  console.error(JSON.stringify(report.summary));
  process.exit(1);
}
console.log(JSON.stringify({
  status: "SECURITY_CONTENT_V3_SOURCE_INTEGRITY_OK",
  ...report.summary,
}, null, 2));
