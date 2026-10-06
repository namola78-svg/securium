import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { CPPG_MANIFEST_SOURCE_ROOT, CPPG_SOURCE_ROOT_CONTRACT } from "../lib/cppg/source-root.mjs";
import { resolveCppgSourceRoot } from "./cppg-source-root.mjs";

function assert(condition, message) { if (!condition) throw new Error(message); }

async function walkFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll("\\", "/"));
    else throw new Error(`unsupported source entry type: ${path}`);
  }
  return files;
}

function sourceEntryPath(sourceRoot, relativePath) {
  if (isAbsolute(relativePath)) throw new Error(`absolute source manifest path is forbidden: ${relativePath}`);
  const path = resolve(sourceRoot, relativePath);
  const escaped = relative(sourceRoot, path);
  if (escaped === "" || escaped.split(/[\\/]/u)[0] === ".." || isAbsolute(escaped)) {
    throw new Error(`source manifest path escapes the configured root: ${relativePath}`);
  }
  return path;
}

function packageHash(entries) {
  return createHash("sha256").update(entries
    .slice()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"))
    .map((entry) => `${entry.relativePath}\0${entry.observedBytes}\0${entry.observedSha256}`)
    .join("\n")).digest("hex");
}

export async function revalidateSourceManifest(sourceManifest, repoRoot) {
  assert(typeof repoRoot === "string" && repoRoot.length > 0, "server-owned repository root is required");
  assert(sourceManifest.sourceRoot === CPPG_MANIFEST_SOURCE_ROOT, `source manifest root contract changed: ${sourceManifest.sourceRoot}`);
  const sourceRoot = resolveCppgSourceRoot(repoRoot);
  let rootStat;
  try {
    rootStat = await stat(sourceRoot);
  } catch (error) {
    throw new Error(`configured CPPG source root is unavailable: ${sourceRoot}`, { cause: error });
  }
  assert(rootStat.isDirectory(), `configured CPPG source root is not a directory: ${sourceRoot}`);

  const expectedPaths = new Set(sourceManifest.files.map((entry) => entry.relativePath));
  const actualPaths = new Set(await walkFiles(sourceRoot));
  const missing = [...expectedPaths].filter((path) => !actualPaths.has(path));
  const extra = [...actualPaths].filter((path) => !expectedPaths.has(path));
  const observed = await Promise.all(sourceManifest.files.filter((entry) => !missing.includes(entry.relativePath)).map(async (entry) => {
    const path = sourceEntryPath(sourceRoot, entry.relativePath);
    const data = await readFile(path);
    return { ...entry, observedBytes: data.byteLength, observedSha256: createHash("sha256").update(data).digest("hex") };
  }));
  const byteMismatches = observed.filter((entry) => entry.bytes !== entry.observedBytes);
  const hashMismatches = observed.filter((entry) => entry.sha256 !== entry.observedSha256);
  const duplicateHashGroups = [...Map.groupBy(observed, (entry) => entry.observedSha256).values()].filter((group) => group.length > 1).length;
  const observedPackageHash = packageHash(observed);
  assert(missing.length === 0, `${missing.length} source files are missing`);
  assert(extra.length === 0, `${extra.length} unexpected source files found`);
  assert(byteMismatches.length === 0, `${byteMismatches.length} source byte mismatches`);
  assert(hashMismatches.length === 0, `${hashMismatches.length} source hash mismatches`);
  assert(duplicateHashGroups === 0, `${duplicateHashGroups} duplicate source hash groups`);
  assert(observed.length === 133, `source file count changed: ${observed.length}`);
  assert(observedPackageHash === sourceManifest.packageHash, `source package hash mismatch: ${observedPackageHash}`);
  return { filesRevalidated: observed.length, byteMismatches: byteMismatches.length, hashMismatches: hashMismatches.length, missing: missing.length, extra: extra.length, duplicateHashGroups, packageHash: observedPackageHash, sourceRootContract: CPPG_SOURCE_ROOT_CONTRACT };
}
