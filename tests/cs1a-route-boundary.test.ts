import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const governedRepositories = [
  "db/content-revision-repositories.ts",
  "db/content-revision-governance-repositories.ts",
  "db/lesson-repositories.ts",
  "db/shared-content-repositories.ts",
  "db/question-repositories.ts",
  "db/question-governance-repository.ts",
  "db/curriculum-repositories.ts",
  "db/repositories.ts",
  "db/phase3-repositories.ts",
  "db/specialized-repositories.ts",
  "db/practical-specialization-repositories.ts",
];

test("CS1A-12 server repository mutation boundary is present on every writable repository surface", async () => {
  for (const file of governedRepositories) {
    const source = await readFile(file, "utf8");
    assert.match(source, /assertCs1aMutationAllowed/);
  }
});

test("CS1A-12 no MCP implementation path is part of the bounded change", async () => {
  const source = await readFile("lib/data/isms-p-theory-batch1-materializer.mjs", "utf8");
  assert.match(source, /CS1A_POLICY_REQUIRED/);
  assert.doesNotMatch(source, /course\.developer-secure-coding-8h/);
});

