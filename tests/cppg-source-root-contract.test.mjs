import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat, readFile } from "node:fs/promises";
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
import { loadBundle, validateFoundation } from "../scripts/validate-securium-cppg-foundation-wave-a.mjs";
import { revalidateSourceManifest } from "../scripts/cppg-source-validation.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSourceRoot = resolveCppgSourceRoot(repoRoot);
const bundle = await loadBundle(repoRoot);
const sourcePackageAvailable = await stat(expectedSourceRoot).then((result) => result.isDirectory()).catch(() => false);
const finalGateAReport = JSON.parse(await readFile(join(repoRoot, "reports", "content-audit", "securium-cppg-foundation-wave-a-final.json"), "utf8"));

function codeOf(error) {
  return error && typeof error === "object" ? error.code : undefined;
}

test("reconfirms Gate A content identity and revalidates source bytes when the package is available", async () => {
  assert.equal(resolveCppgWorkspaceRoot(repoRoot), dirname(dirname(expectedSourceRoot)));
  assert.equal(bundle.sourceManifest.sourceRoot, CPPG_MANIFEST_SOURCE_ROOT);
  assert.equal(bundle.sourceManifest.manifestId, "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1");
  assert.equal(bundle.sourceManifest.packageHash, finalGateAReport.sourcePackage.packageHash);
  assert.equal(bundle.sourceManifest.fileCount, finalGateAReport.sourcePackage.files);
  if (sourcePackageAvailable) {
    const result = await revalidateSourceManifest(bundle.sourceManifest, repoRoot);
    assert.equal(result.sourceRootContract, CPPG_SOURCE_ROOT_CONTRACT);
    assert.equal(result.filesRevalidated, 133);
    assert.equal(result.packageHash, bundle.sourceManifest.packageHash);
  } else {
    await assert.rejects(() => revalidateSourceManifest(bundle.sourceManifest, repoRoot), /configured CPPG source root is unavailable/);
  }
});

test("production projection uses the server-owned reviewed manifest, independent of cwd and caller sourceRoot", async () => {
  const service = await import("../lib/services/cppg-runtime-course-registration.ts");
  const previousCwd = process.cwd();
  const temporaryCwd = await mkdtemp(join(tmpdir(), "cppg-source-root-cwd-"));
  try {
    process.chdir(temporaryCwd);
    const projection = await service.buildCppgCourseTheoryDraftProjection({ actorUserId: "source-root-test", sourceRoot: "caller-controlled" });
    assert.equal(projection.courseId, "course-cppg");
    assert.equal(projection.packageKey, "course-cppg:foundation:v1");
  } finally {
    process.chdir(previousCwd);
    await rm(temporaryCwd, { recursive: true, force: true });
  }
});

test("production structural validation rejects file-list edits outside the pinned package hash", () => {
  const tampered = structuredClone(bundle);
  tampered.sourceManifest.files[0].sha256 = "0".repeat(64);
  assert.throws(() => validateFoundation(tampered), /reviewed package hash/u);
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

test("a manifest hash mismatch fails closed", { skip: !sourcePackageAvailable && "source evidence package is not mounted in this CI checkout" }, async () => {
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
