import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CPPG_MANIFEST_SOURCE_ROOT, resolveCppgSourceRoot } from "../lib/cppg/source-root.mjs";
import { revalidateSourceManifest } from "../lib/cppg/foundation-validator.mjs";

const hash = (data) => createHash("sha256").update(data).digest("hex");

async function withSourcePackage(run) {
  const workspace = await mkdtemp(join(tmpdir(), "cppg-manifest-fixture-"));
  const repository = join(workspace, "repo");
  await mkdir(join(repository, ".git"), { recursive: true });
  const sourceRoot = resolveCppgSourceRoot(repository);
  await mkdir(sourceRoot, { recursive: true });
  const files = [];
  for (let index = 0; index < 133; index += 1) {
    const relativePath = `file-${String(index).padStart(3, "0")}.bin`;
    const data = Buffer.from(`source fixture ${index}`);
    await writeFile(join(sourceRoot, relativePath), data);
    files.push({ relativePath, bytes: data.byteLength, sha256: hash(data) });
  }
  const packageHash = hash(files.slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en"))
    .map((entry) => `${entry.relativePath}\0${entry.bytes}\0${entry.sha256}`).join("\n"));
  const manifest = { sourceRoot: CPPG_MANIFEST_SOURCE_ROOT, packageHash, files };
  try { await run({ repository, sourceRoot, manifest }); }
  finally { await rm(workspace, { recursive: true, force: true }); }
}

test("source revalidation rejects a missing canonical file", async () => {
  await withSourcePackage(async ({ repository, sourceRoot, manifest }) => {
    const missing = manifest.files[0].relativePath;
    await rm(join(sourceRoot, missing));
    await assert.rejects(() => revalidateSourceManifest(manifest, repository), /source files are missing/u);
  });
});

test("source revalidation rejects changed bytes and hashes", async () => {
  await withSourcePackage(async ({ repository, sourceRoot, manifest }) => {
    const changed = manifest.files[0].relativePath;
    await writeFile(join(sourceRoot, changed), "changed source bytes");
    await assert.rejects(() => revalidateSourceManifest(manifest, repository), /source byte mismatches|source hash mismatches|source package hash mismatch/u);
  });
});

test("source revalidation rejects unexpected package files", async () => {
  await withSourcePackage(async ({ repository, sourceRoot, manifest }) => {
    await writeFile(join(sourceRoot, "unmanifested.bin"), "unexpected");
    await assert.rejects(() => revalidateSourceManifest(manifest, repository), /unexpected source files/u);
  });
});
