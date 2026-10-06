import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolveCppgSourceRoot, resolveCppgWorkspaceRoot } from "../scripts/cppg-source-root.mjs";

test("normal clone discovery resolves source evidence from its own repository root", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "cppg-normal-clone-"));
  const repo = join(workspace, "securium");
  try {
    await mkdir(join(repo, ".git"), { recursive: true });
    assert.equal(resolveCppgWorkspaceRoot(repo), resolve(repo));
    assert.equal(resolveCppgSourceRoot(repo), join(repo, "source-evidence-original", "cppg"));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("worktree pointer and commondir resolve source evidence from the common checkout", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "cppg-worktree-"));
  const primary = join(workspace, "primary");
  const worktree = join(workspace, "linked-worktree");
  const worktreeGit = join(primary, ".git", "worktrees", "linked-worktree");
  try {
    await mkdir(worktree, { recursive: true });
    await mkdir(worktreeGit, { recursive: true });
    await writeFile(join(worktree, ".git"), `gitdir: ${worktreeGit.replaceAll("\\", "/")}\n`);
    await writeFile(join(worktreeGit, "commondir"), "../..\n");
    assert.equal(resolveCppgWorkspaceRoot(worktree), resolve(primary));
    assert.equal(resolveCppgSourceRoot(worktree), join(primary, "source-evidence-original", "cppg"));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("invalid worktree pointer fails closed", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "cppg-invalid-worktree-"));
  const repo = join(workspace, "repo");
  try {
    await mkdir(repo, { recursive: true });
    await writeFile(join(repo, ".git"), "not a gitdir pointer\n");
    assert.throws(() => resolveCppgSourceRoot(repo), { code: "CPPG_SOURCE_ROOT_CONTRACT_UNAVAILABLE" });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
