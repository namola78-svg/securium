import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const entry = "app/api/admin/ise-wave-a/governance/route.ts";
const imports = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function localModule(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const base = specifier.startsWith("@/")
    ? path.join(root, specifier.slice(2))
    : path.resolve(path.dirname(from), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, "index.ts")];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function moduleAncestry(start: string): Set<string> {
  const visited = new Set<string>();
  const pending = [path.join(root, start)];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(imports)) {
      if (/^\s*(?:import|export)\s+type\b/.test(match[0])) continue;
      const dependency = localModule(file, match[1] ?? match[2]);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return visited;
}

test("ISE governance route import ancestry excludes Secure Coding review infrastructure", () => {
  const ancestry = [...moduleAncestry(entry)].map((file) => path.relative(root, file).replaceAll("\\", "/"));
  assert.ok(ancestry.includes(entry));
  assert.equal(ancestry.some((file) => /secure-coding-review-adapter|secure-coding-reviewed-input-resolver|secure-coding-final-review-evidence|content-final-review-authority/.test(file)), false, ancestry.join("\n"));
  assert.ok(ancestry.includes("lib/services/ise-wave-a-review-judgment-service.ts"));

  const core = readFileSync(path.join(root, "lib/services/content-review-judgment-core.ts"), "utf8");
  assert.match(core, /resolvedContext:\s*ServerOwnedReviewedInputContext/);
  assert.doesNotMatch(core, /resolveSecureCodingReviewedInputContext|\?\?\s*await/);
  const repository = readFileSync(path.join(root, "db/content-review-judgment-repository.ts"), "utf8");
  assert.doesNotMatch(repository, /resolveSecureCodingReviewedInputContext/);
});
