import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimePath = new URL("../lib/services/cppg-runtime-course-registration.ts", import.meta.url);
const validatorPath = new URL("../lib/cppg/foundation-validator.mjs", import.meta.url);
const imports = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

async function sourceImportAncestry(startUrl) {
  const { stat } = await import("node:fs/promises");
  const visited = new Set();
  const pending = [startUrl];
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file.href)) continue;
    visited.add(file.href);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(imports)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
      const base = specifier.startsWith("@/")
        ? new URL(`../${specifier.slice(2)}`, import.meta.url)
        : new URL(specifier, file);
      const candidates = /\.[a-z]+$/iu.test(base.pathname)
        ? [base]
        : [".ts", ".tsx", ".js", ".mjs"].map((suffix) => new URL(`${base.href}${suffix}`));
      for (const candidate of candidates) {
        try {
          if ((await stat(candidate)).isFile()) {
            pending.push(candidate);
            break;
          }
        } catch {}
      }
    }
  }
  return [...visited];
}

test("CPPG production registration depends on the canonical lib validator, not scripts tooling", async () => {
  const runtime = await readFile(runtimePath, "utf8");
  assert.ok(runtime.includes("../cppg/foundation-validator.mjs"));
  assert.doesNotMatch(runtime, /(?:\.\.\/)+scripts\//u);
  const validator = await readFile(validatorPath, "utf8");
  assert.doesNotMatch(validator, /(?:\.\.\/)+scripts\//u);
  assert.doesNotMatch(validator, /process\.argv|writeFile\s*\(/u);
});

test("CPPG CLI and runtime expose the same canonical validation functions", async () => {
  const cli = await import("../scripts/validate-securium-cppg-foundation-wave-a.mjs");
  const runtime = await import("../lib/cppg/foundation-validator.mjs");
  assert.equal(cli.validateFoundation, runtime.validateFoundation);
  assert.equal(cli.loadBundle, runtime.loadBundle);
  assert.equal(cli.revalidateSourceManifest, runtime.revalidateSourceManifest);
});

test("ISE production import ancestry contains no repository scripts", async () => {
  const ancestry = await sourceImportAncestry(new URL("../app/api/admin/ise-wave-a/governance/route.ts", import.meta.url));
  const scripts = ancestry.filter((file) => new URL(file).pathname.includes("/scripts/"));
  assert.deepEqual(scripts, []);
  assert.ok(ancestry.some((file) => new URL(file).pathname.endsWith("/lib/cppg/foundation-validator.mjs")));
});
