import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyChangedPaths,
  decideFromEnvironment,
  parseNameStatusZ,
} from "../scripts/vercel-ignore-build.mjs";

const BUILD = "BUILD";
const SKIP = "SKIP";
const SCRIPT = fileURLToPath(new URL("../scripts/vercel-ignore-build.mjs", import.meta.url));

function env(overrides = {}) {
  return {
    VERCEL_ENV: "preview",
    VERCEL_GIT_PREVIOUS_SHA: "a".repeat(40),
    VERCEL_GIT_COMMIT_SHA: "b".repeat(40),
    ...overrides,
  };
}

function gitFor({ diff = "M\0docs/change.md\0", diffStatus = 0, head = "b".repeat(40), catStatus = 0 } = {}) {
  return (args) => {
    if (args[0] === "cat-file") return { status: catStatus, stdout: "", stderr: "" };
    if (args[0] === "rev-parse") return { status: head ? 0 : 1, stdout: head, stderr: "" };
    if (args[0] === "merge-base") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "diff") return { status: diffStatus, stdout: diff, stderr: "" };
    return { status: 1, stdout: "", stderr: "" };
  };
}

test("safe docs, reports, and approved governance evidence are SKIP candidates", () => {
  assert.equal(classifyChangedPaths(["docs/change.md"]).decision, SKIP);
  assert.equal(classifyChangedPaths(["reports/evidence.json"]).decision, SKIP);
  assert.equal(classifyChangedPaths(["governance/reference/decision.md"]).decision, SKIP);
  assert.equal(classifyChangedPaths(["docs/change.md", "reports/evidence.json"]).decision, SKIP);
});

test("runtime, dependency, configuration, data, auth, and test paths BUILD", () => {
  const paths = [
    "app/page.tsx", "components/button.tsx", "lib/runtime.ts", "app/api/health/route.ts",
    "public/logo.svg", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json",
    "db/schema.ts", "db/migrations/001.sql", "db/postgres/migrations/001.sql", "lib/policy/rules.ts",
    "lib/services/auth.ts", "middleware.ts", "tests/example.test.ts", "source-evidence-original/source.pdf",
  ];
  for (const path of paths) assert.equal(classifyChangedPaths([path]).decision, BUILD, path);
});

test("mixed, unknown, traversal-like, and malformed paths BUILD", () => {
  assert.equal(classifyChangedPaths(["docs/change.md", "app/page.tsx"]).decision, BUILD);
  assert.equal(classifyChangedPaths(["reports/evidence.json", "unknown.bin"]).decision, BUILD);
  assert.equal(classifyChangedPaths(["../app/page.tsx"]).decision, BUILD);
  assert.equal(classifyChangedPaths(["C:/app/page.tsx"]).decision, BUILD);
  assert.equal(classifyChangedPaths([]).decision, BUILD);
});

test("rename and deletion parsing includes every affected path", () => {
  const paths = parseNameStatusZ("R100\0docs/old.md\0docs/new.md\0D\0app/removed.tsx\0");
  assert.deepEqual(paths, ["docs/old.md", "docs/new.md", "app/removed.tsx"]);
  assert.equal(classifyChangedPaths(paths).decision, BUILD);
});

test("missing, invalid, or untrusted comparison inputs BUILD", () => {
  assert.equal(decideFromEnvironment({ env: env({ VERCEL_GIT_PREVIOUS_SHA: undefined }), git: gitFor() }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env({ VERCEL_GIT_COMMIT_SHA: "not-a-sha" }), git: gitFor() }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ catStatus: 1 }) }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ head: "" }) }).decision, BUILD);
});

test("git diff failure and parser error BUILD", () => {
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ diffStatus: 1 }) }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ diff: "M\0docs/file.md" }) }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ diff: "Q999\0docs/file.md\0" }) }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: (args) => args[0] === "merge-base" ? { status: 1, stdout: "", stderr: "" } : gitFor()(args) }).decision, BUILD);
});

test("production always BUILD and preview uses the classifier", () => {
  assert.equal(decideFromEnvironment({ env: env({ VERCEL_ENV: "production" }), git: gitFor({ diff: "M\0docs/file.md\0" }) }).decision, BUILD);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ diff: "M\0docs/file.md\0" }) }).decision, SKIP);
  assert.equal(decideFromEnvironment({ env: env(), git: gitFor({ diff: "M\0tests/example.test.ts\0" }) }).decision, BUILD);
});

test("Vercel exit semantics are enforced by the CLI", () => {
  const build = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: { ...process.env, VERCEL_ENV: "preview" } });
  assert.equal(build.status, 1);
  assert.match(build.stdout, /VERCEL_BUILD_DECISION=BUILD/);

  const root = mkdtempSync(join(tmpdir(), "securium-vercel-ignore-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Classifier Test"], { cwd: root });
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "change.md"), "base\n");
    execFileSync("git", ["add", "docs/change.md"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "base"], { cwd: root });
    const previous = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    writeFileSync(join(root, "docs", "change.md"), "changed\n");
    execFileSync("git", ["commit", "-qam", "docs"], { cwd: root });
    const current = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const skipped = spawnSync(process.execPath, [SCRIPT], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: previous, VERCEL_GIT_COMMIT_SHA: current },
    });
    assert.equal(skipped.status, 0);
    assert.match(skipped.stdout, /VERCEL_BUILD_DECISION=SKIP/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
