export { EXPECTED_SUBJECTS, validateFoundation, loadBundle } from "../lib/cppg/foundation-validator.mjs";
export { revalidateSourceManifest } from "./cppg-source-validation.mjs";
import { loadBundle, validateFoundation } from "../lib/cppg/foundation-validator.mjs";
import { revalidateSourceManifest } from "./cppg-source-validation.mjs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const bundle = await loadBundle(repoRoot);
  const result = validateFoundation(bundle);
  const source = await revalidateSourceManifest(bundle.sourceManifest, repoRoot);
  const finalResult = { manifestId: "SECURIUM_CPPG_FOUNDATION_VALIDATION_V1", ...result, source, generatedAt: "2026-09-08", mutationTests: "see securium-cppg-foundation-wave-a-mutation-tests.json" };
  await writeFile(join(repoRoot, "reports", "content-audit", "securium-cppg-foundation-wave-a-validation.json"), `${JSON.stringify(finalResult, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(finalResult, null, 2));
}
