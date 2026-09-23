import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  CPPG_MANIFEST_SOURCE_ROOT,
  CPPG_SOURCE_ROOT_CONTRACT,
  resolveCppgSourceRoot,
  resolveCppgWorkspaceRoot,
} from "../scripts/cppg-source-root.mjs";
import { loadBundle, revalidateSourceManifest } from "../scripts/validate-securium-cppg-foundation-wave-a.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSourceRoot = resolveCppgSourceRoot(repoRoot);
const bundle = await loadBundle(repoRoot);

function codeOf(error) {
  return error && typeof error === "object" ? error.code : undefined;
}

test("resolves the established CPPG source root from the repository worktree contract", async () => {
  assert.equal(resolveCppgWorkspaceRoot(repoRoot), dirname(dirname(expectedSourceRoot)));
  assert.equal(bundle.sourceManifest.sourceRoot, CPPG_MANIFEST_SOURCE_ROOT);
  assert.equal((await revalidateSourceManifest(bundle.sourceManifest, repoRoot)).sourceRootContract, CPPG_SOURCE_ROOT_CONTRACT);
});

test("revalidation is independent of arbitrary process.cwd and caller sourceRoot", async () => {
  const service = await import("../lib/services/cppg-runtime-course-registration.ts");
  const previousCwd = process.cwd();
  const temporaryCwd = await mkdtemp(join(tmpdir(), "cppg-source-root-cwd-"));
  try {
    process.chdir(temporaryCwd);
    await assert.rejects(
      () => service.buildCppgCourseTheoryDraftProjection({ actorUserId: "source-root-test", sourceRoot: "caller-controlled" }),
      (error) => codeOf(error) === "CPPG_APPROVAL_BINDING_UNAVAILABLE",
    );
  } finally {
    process.chdir(previousCwd);
    await rm(temporaryCwd, { recursive: true, force: true });
  }
});

test("a nonexistent server-owned root fails closed", async () => {
  const fakeRepository = await mkdtemp(join(tmpdir(), "cppg-source-root-missing-"));
  try {
    await mkdir(join(fakeRepository, ".git"));
    await assert.rejects(
      () => revalidateSourceManifest(bundle.sourceManifest, fakeRepository),
      /configured CPPG source root is unavailable/,
    );
  } finally {
    await rm(fakeRepository, { recursive: true, force: true });
  }
});

test("a manifest hash mismatch fails closed", async () => {
  const first = bundle.sourceManifest.files[0];
  assert.ok(first);
  const mutatedManifest = { ...bundle.sourceManifest, files: [{ ...first, sha256: "0".repeat(64) }, ...bundle.sourceManifest.files.slice(1)] };
  await assert.rejects(
    () => revalidateSourceManifest(mutatedManifest, repoRoot),
    /source hash mismatches|source package hash mismatch/,
  );
});

test("valid recovered package reaches approval boundary without starting persistence", async () => {
  const service = await import("../lib/services/cppg-runtime-course-registration.ts");
  let began = 0;
  const adapter = {
    inspect: async () => ({ courseCount: 0, recordCount: 0, recordIds: [], semanticHashes: {}, duplicateAuthorityCount: 0 }),
    begin: async () => { began += 1; throw new Error("transaction must not begin"); },
  };
  await assert.rejects(
    () => service.persistCppgCourseTheoryDraft({ actorUserId: "source-root-test", sourceRoot: "caller-controlled" }, adapter),
    (error) => codeOf(error) === "CPPG_APPROVAL_BINDING_UNAVAILABLE",
  );
  assert.equal(began, 0);
});
