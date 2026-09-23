import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const CPPG_SOURCE_ROOT_CONTRACT = "SECURIUM_CPPG_SOURCE_EVIDENCE_V1";
export const CPPG_MANIFEST_SOURCE_ROOT = "../source-evidence-original/cppg";
export const CPPG_SOURCE_EVIDENCE_RELATIVE_ROOT = "source-evidence-original/cppg";

function contractError(message, cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = "CPPG_SOURCE_ROOT_CONTRACT_UNAVAILABLE";
  return error;
}

function readGitCommonDirectory(repoRoot) {
  const dotGit = join(repoRoot, ".git");
  let gitStat;
  try {
    gitStat = statSync(dotGit);
  } catch (error) {
    throw contractError(`repository Git metadata is unavailable: ${dotGit}`, error);
  }

  if (gitStat.isDirectory()) return dotGit;
  if (!gitStat.isFile()) throw contractError(`repository Git metadata is invalid: ${dotGit}`);

  const pointer = readFileSync(dotGit, "utf8").trim();
  const match = /^gitdir:\s*(.+)$/iu.exec(pointer);
  if (!match) throw contractError(`repository Git worktree pointer is invalid: ${dotGit}`);
  const worktreeGitDirectory = resolve(repoRoot, match[1].trim());
  const commonDirectoryFile = join(worktreeGitDirectory, "commondir");
  if (!existsSync(commonDirectoryFile)) return worktreeGitDirectory;
  const commonDirectory = readFileSync(commonDirectoryFile, "utf8").trim();
  if (!commonDirectory) throw contractError(`repository Git common directory is empty: ${commonDirectoryFile}`);
  return resolve(worktreeGitDirectory, commonDirectory);
}

export function resolveCppgWorkspaceRoot(repoRoot) {
  const normalizedRepoRoot = resolve(repoRoot);
  const commonGitDirectory = readGitCommonDirectory(normalizedRepoRoot);
  return dirname(commonGitDirectory);
}

export function resolveCppgSourceRoot(repoRoot) {
  return join(resolveCppgWorkspaceRoot(repoRoot), CPPG_SOURCE_EVIDENCE_RELATIVE_ROOT);
}
