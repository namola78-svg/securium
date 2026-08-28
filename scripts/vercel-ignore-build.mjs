import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SAFE_TEXT_EXTENSIONS = new Set([".csv", ".json", ".md", ".pdf", ".png", ".txt"]);
const SAFE_PREFIXES = [
  "docs/",
  "governance/reference/",
  "governance/evidence/",
  "reports/",
];

function build(reason) {
  return { decision: "BUILD", reason };
}

function skip(reason = "proven_non_runtime_only") {
  return { decision: "SKIP", reason };
}

function normalizePath(path) {
  if (typeof path !== "string") throw new Error("invalid_path");
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((segment) => segment === ".." || segment === "." || segment === "")
  ) {
    throw new Error("unsafe_path");
  }
  return normalized;
}

function isSafeNonRuntimePath(path) {
  const normalized = normalizePath(path);
  const prefix = SAFE_PREFIXES.find((candidate) => normalized.startsWith(candidate));
  if (!prefix) return false;
  const extension = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
  return SAFE_TEXT_EXTENSIONS.has(extension);
}

export function parseNameStatusZ(output) {
  if (typeof output !== "string") throw new Error("invalid_git_output");
  if (output.length === 0) return [];
  const tokens = output.split("\0");
  if (tokens.at(-1) !== "") throw new Error("unterminated_git_output");
  tokens.pop();
  const paths = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!/^(?:[ACDMRTUXB]|[ACDMRTUXB][0-9]{1,3})$/.test(status)) {
      throw new Error("invalid_git_status");
    }
    const pathCount = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    if (index + pathCount > tokens.length) throw new Error("incomplete_git_status");
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
      paths.push(normalizePath(tokens[index++]));
    }
  }
  return paths;
}

export function classifyChangedPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return build("empty_diff");
  try {
    const normalized = paths.map(normalizePath);
    if (normalized.every(isSafeNonRuntimePath)) return skip();
    return build("runtime_or_unknown_change");
  } catch {
    return build("path_classification_error");
  }
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function validSha(sha) {
  return typeof sha === "string" && /^[0-9a-f]{40}$/i.test(sha);
}

function verifyCommit(sha, git) {
  if (!validSha(sha)) return false;
  return git(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

export function decideFromEnvironment({ env = process.env, git = runGit } = {}) {
  try {
    if (env.VERCEL_ENV === "production" || env.VERCEL_TARGET_ENV === "production") {
      return build("production_default");
    }

    const previousSha = env.VERCEL_GIT_PREVIOUS_SHA?.trim();
    const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim();
    if (!previousSha || !commitSha) return build("missing_comparison_sha");
    if (!verifyCommit(previousSha, git) || !verifyCommit(commitSha, git)) {
      return build("invalid_comparison_sha");
    }

    const head = git(["rev-parse", "HEAD"]);
    if (head.status !== 0 || head.stdout.trim() !== commitSha) {
      return build("unexpected_repository_state");
    }

    const ancestry = git(["merge-base", "--is-ancestor", previousSha, commitSha]);
    if (ancestry.status !== 0) return build("no_trustworthy_merge_base");

    const diff = git(["diff", "--name-status", "--find-renames", "-z", previousSha, commitSha, "--"]);
    if (diff.status !== 0) return build("git_diff_failure");
    const paths = parseNameStatusZ(diff.stdout);
    return classifyChangedPaths(paths);
  } catch {
    return build("parser_or_classifier_error");
  }
}

export function main() {
  const result = decideFromEnvironment();
  console.log(`VERCEL_BUILD_DECISION=${result.decision}`);
  console.log(`reason=${result.reason}`);
  // Vercel: 0 means ignore/skip the build; 1 means continue the build.
  process.exitCode = result.decision === "SKIP" ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
