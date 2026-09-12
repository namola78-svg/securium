import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { isAbsolute, join, normalize, resolve } from "node:path";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { createPostgresJsExecutor } from "../db/postgres/postgres-js-executor.ts";
import { EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import {
  EvidenceRecomputeLifecycleExecutor,
  QuestionAttemptEvidenceEventExecutor,
} from "../lib/services/evidence-recompute-executor.ts";
import { EvidenceRecomputeService } from "../lib/services/evidence-recompute.ts";
import { createEvidenceRecomputeWorkerIdentity } from "./run-evidence-recompute-worker.mjs";

const execFile = promisify(execFileCallback);
const EXIT_OK = 0;
const EXIT_CONFIGURATION = 2;
const EXIT_FAILURE = 1;
const EXIT_RETRYABLE = 75;
export const D1_FIXTURE_MARKER = ".securium-evidence-once-d1.json";
const D1_FIXTURE_KIND = "securium.question-attempt-evidence-once.d1";

export function createD1FixtureMetadata({ persistPath, databaseName, ownerToken }) {
  return {
    kind: D1_FIXTURE_KIND,
    version: 1,
    provider: "d1",
    persistPath: resolve(persistPath),
    databaseName,
    ownerToken,
  };
}

export async function runQuestionAttemptEvidenceOnce(options) {
  const target = await openDisposableTarget(options);
  try {
    const repository = new EvidenceProjectionRepository(target.provider);
    const resolver = new DatabaseEvidenceSourceResolver(target.provider);
    const recompute = new EvidenceRecomputeService(repository, resolver);
    const lifecycle = new EvidenceRecomputeLifecycleExecutor(repository);
    const executor = new QuestionAttemptEvidenceEventExecutor(lifecycle, recompute);
    return await executor.processNext(createEvidenceRecomputeWorkerIdentity());
  } finally {
    await target.close();
  }
}

export function presentResult(result) {
  const status = result.outcome === "COMPLETED"
    ? result.projectionOutcome === "EXACT_REPLAY" ? "REPLAY" : "COMPLETED"
    : result.outcome === "RETRYABLE" ? "RETRYABLE_FAILURE"
      : result.outcome;
  return {
    status,
    requestId: result.requestId,
    projectionOutcome: result.projectionOutcome ?? null,
    projectionCount: result.projectionCount,
    errorClass: result.errorClass ?? null,
  };
}

export function resultExitCode(result) {
  if (result.outcome === "NO_REQUEST" || result.outcome === "COMPLETED") return EXIT_OK;
  if (result.outcome === "RETRYABLE" || result.outcome === "CLAIM_LOST") return EXIT_RETRYABLE;
  return EXIT_FAILURE;
}

export function parseArguments(argv, environment = process.env) {
  const options = {
    provider: null,
    localDisposable: false,
    d1PersistPath: null,
    d1DatabaseName: null,
    d1FixtureOwnerToken: null,
    postgresUrl: environment.SECURIUM_EVIDENCE_ONCE_POSTGRES_URL?.trim() || null,
    postgresContainerId: environment.SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER?.trim() || null,
    postgresOwnerToken: environment.SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER?.trim() || null,
  };

  for (const argument of argv) {
    if (argument === "--local-disposable") {
      options.localDisposable = true;
      continue;
    }
    if (argument === "--help") return { help: true };
    if (argument.startsWith("--provider=")) {
      options.provider = argument.slice("--provider=".length).trim().toLowerCase();
      continue;
    }
    if (argument.startsWith("--d1-persist-to=")) {
      options.d1PersistPath = argument.slice("--d1-persist-to=".length).trim();
      continue;
    }
    if (argument.startsWith("--d1-database=")) {
      options.d1DatabaseName = argument.slice("--d1-database=".length).trim();
      continue;
    }
    if (argument.startsWith("--d1-fixture-owner=")) {
      options.d1FixtureOwnerToken = argument.slice("--d1-fixture-owner=".length).trim();
      continue;
    }
    throw configurationError("UNKNOWN_ARGUMENT");
  }

  if (!options.localDisposable) throw configurationError("LOCAL_DISPOSABLE_TARGET_REQUIRED");
  if (!["d1", "postgres"].includes(options.provider)) {
    throw configurationError("EXPLICIT_PROVIDER_REQUIRED");
  }
  if (environment.APP_ENV?.trim().toLowerCase() === "production") {
    throw configurationError("PRODUCTION_TARGET_FORBIDDEN");
  }

  if (options.provider === "d1") {
    if (!options.d1PersistPath || !isAbsolute(options.d1PersistPath)) {
      throw configurationError("D1_PERSIST_PATH_REQUIRED");
    }
    if (!existsSync(options.d1PersistPath)) {
      throw configurationError("D1_PERSIST_PATH_NOT_FOUND");
    }
    if (!options.d1DatabaseName || !/^[A-Za-z0-9._-]+$/.test(options.d1DatabaseName)) {
      throw configurationError("D1_DATABASE_NAME_REQUIRED");
    }
    if (!options.d1FixtureOwnerToken || !/^[A-Za-z0-9._:-]+$/.test(options.d1FixtureOwnerToken)) {
      throw configurationError("D1_FIXTURE_OWNER_REQUIRED");
    }
    return options;
  }

  if (!options.postgresUrl || !options.postgresContainerId || !options.postgresOwnerToken) {
    throw configurationError("DISPOSABLE_POSTGRES_TARGET_REQUIRED");
  }
  validateLocalPostgresUrl(options.postgresUrl);
  return options;
}

export const usage = `Usage:
  node node_modules/tsx/dist/cli.mjs scripts/run-question-attempt-evidence-once.mjs --local-disposable --provider=d1 --d1-persist-to=<absolute-local-persist-dir> --d1-database=<local-d1-database-identity> --d1-fixture-owner=<fixture-owner-token>
  SECURIUM_EVIDENCE_ONCE_POSTGRES_URL=<loopback-url> SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER=<owned-container> SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER=<owner-label> node node_modules/tsx/dist/cli.mjs scripts/run-question-attempt-evidence-once.mjs --local-disposable --provider=postgres`;

async function openDisposableTarget(options) {
  if (options.provider === "d1") return openD1Target(options);
  return openPostgresTarget(options);
}

async function openD1Target(options) {
  const persistPath = await assertOwnedD1Fixture(options);
  const { Miniflare } = await import("miniflare");
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: options.d1DatabaseName },
    d1Persist: persistPath,
  });
  try {
    const database = await miniflare.getD1Database("DB");
    const provider = new D1DatabaseProvider(database);
    if (!await provider.healthCheck()) throw configurationError("D1_HEALTH_CHECK_FAILED");
    return { provider, close: () => miniflare.dispose() };
  } catch (error) {
    await miniflare.dispose().catch(() => {});
    throw error;
  }
}

async function assertOwnedD1Fixture(options) {
  const persistPath = resolve(options.d1PersistPath);
  await assertRealDirectory(persistPath, "D1_PERSIST_PATH_NOT_FOUND", "D1_PERSIST_PATH_LINK_FORBIDDEN");

  const markerPath = join(persistPath, D1_FIXTURE_MARKER);
  let marker;
  try {
    const markerStats = await lstat(markerPath);
    if (markerStats.isSymbolicLink()) throw configurationError("D1_FIXTURE_MARKER_LINK_FORBIDDEN");
    marker = JSON.parse(await readFile(markerPath, "utf8"));
  } catch (error) {
    if (error?.code === "D1_FIXTURE_MARKER_LINK_FORBIDDEN") throw error;
    throw configurationError("D1_FIXTURE_MARKER_REQUIRED");
  }
  if (
    marker?.kind !== D1_FIXTURE_KIND ||
    marker?.version !== 1 ||
    marker?.provider !== "d1" ||
    marker?.databaseName !== options.d1DatabaseName ||
    marker?.ownerToken !== options.d1FixtureOwnerToken ||
    !samePath(marker?.persistPath, persistPath)
  ) {
    throw configurationError("D1_FIXTURE_OWNERSHIP_INVALID");
  }

  const wranglerD1Path = join(persistPath, "v3", "d1");
  if (existsSync(wranglerD1Path)) {
    await assertRealDirectory(wranglerD1Path, "D1_PERSISTENCE_NOT_FOUND", "D1_PERSISTENCE_LINK_FORBIDDEN");
    return wranglerD1Path;
  }
  return persistPath;
}

async function assertRealDirectory(path, missingCode, linkCode) {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw configurationError(missingCode);
  }
  if (!stats.isDirectory()) throw configurationError(missingCode);
  let resolvedPath;
  try {
    resolvedPath = await realpath(path);
  } catch {
    throw configurationError(linkCode);
  }
  if (!samePath(resolvedPath, resolve(path))) throw configurationError(linkCode);
}

function samePath(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const normalizeForComparison = (value) => {
    const normalized = normalize(resolve(value));
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return normalizeForComparison(left) === normalizeForComparison(right);
}

async function openPostgresTarget(options) {
  const url = new URL(options.postgresUrl);
  await assertOwnedDisposablePostgres(options.postgresContainerId, options.postgresOwnerToken, url);
  const executor = await createPostgresJsExecutor({
    APP_ENV: "test",
    DATABASE_URL: options.postgresUrl,
    POSTGRES_SSL_MODE: "disable",
    POSTGRES_QUERY_TIMEOUT_MS: "10000",
  });
  const provider = new PostgresDatabaseProvider(executor);
  try {
    if (!await provider.healthCheck()) throw configurationError("POSTGRES_HEALTH_CHECK_FAILED");
    return { provider, close: async () => { if (executor.close) await executor.close(); } };
  } catch (error) {
    await executor.close?.().catch(() => {});
    throw error;
  }
}

async function assertOwnedDisposablePostgres(containerId, ownerToken, url) {
  const host = url.hostname.toLowerCase();
  if (host !== "127.0.0.1") {
    throw configurationError("POSTGRES_LOOPBACK_REQUIRED");
  }
  const expectedPort = String(url.port || "5432");
  const format = '{{json .State.Running}}|{{index .Config.Labels "com.securium.evidence-once.owner"}}|{{json (index .NetworkSettings.Ports "5432/tcp")}}';
  let stdout;
  try {
    ({ stdout } = await execFile("docker", ["inspect", `--format=${format}`, containerId], { windowsHide: true }));
  } catch {
    throw configurationError("DISPOSABLE_POSTGRES_CONTAINER_UNAVAILABLE");
  }
  const [running, actualOwner, bindingsJson] = stdout.trim().split("|", 3);
  if (running !== "true" || actualOwner !== ownerToken) {
    throw configurationError("DISPOSABLE_POSTGRES_OWNERSHIP_INVALID");
  }
  let bindings;
  try {
    bindings = JSON.parse(bindingsJson || "null");
  } catch {
    throw configurationError("DISPOSABLE_POSTGRES_PORT_INVALID");
  }
  if (!Array.isArray(bindings) || !bindings.some((binding) =>
    binding?.HostIp === "127.0.0.1" && String(binding.HostPort) === expectedPort
  )) {
    throw configurationError("DISPOSABLE_POSTGRES_LOOPBACK_PORT_INVALID");
  }
}

function validateLocalPostgresUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw configurationError("POSTGRES_URL_INVALID");
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.pathname.slice(1)) {
    throw configurationError("POSTGRES_URL_INVALID");
  }
}

function configurationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function errorCode(error) {
  if (typeof error === "object" && error !== null && typeof error.code === "string") return error.code;
  return "EVIDENCE_ONCE_RUNNER_FAILED";
}

if (process.argv.some((argument) => argument.replaceAll("\\", "/").endsWith("/scripts/run-question-attempt-evidence-once.mjs"))) {
  if (process.argv.includes("--help")) {
    console.log(usage);
  } else {
    try {
      const options = parseArguments(process.argv.slice(2));
      const result = await runQuestionAttemptEvidenceOnce(options);
      console.log(JSON.stringify(presentResult(result)));
      process.exitCode = resultExitCode(result);
    } catch (error) {
      console.error(`EVIDENCE_ONCE_ERROR ${errorCode(error)}`);
      console.error(usage);
      process.exitCode = error?.code && ["LOCAL_DISPOSABLE_TARGET_REQUIRED", "EXPLICIT_PROVIDER_REQUIRED", "PRODUCTION_TARGET_FORBIDDEN", "D1_PERSIST_PATH_REQUIRED", "D1_PERSIST_PATH_NOT_FOUND", "D1_DATABASE_NAME_REQUIRED", "D1_FIXTURE_OWNER_REQUIRED", "D1_PERSIST_PATH_LINK_FORBIDDEN", "D1_FIXTURE_MARKER_REQUIRED", "D1_FIXTURE_MARKER_LINK_FORBIDDEN", "D1_FIXTURE_OWNERSHIP_INVALID", "D1_PERSISTENCE_NOT_FOUND", "D1_PERSISTENCE_LINK_FORBIDDEN", "D1_HEALTH_CHECK_FAILED", "DISPOSABLE_POSTGRES_TARGET_REQUIRED", "POSTGRES_URL_INVALID", "POSTGRES_LOOPBACK_REQUIRED", "POSTGRES_PORT_INVALID", "POSTGRES_LOOPBACK_PORT_INVALID", "DISPOSABLE_POSTGRES_PORT_INVALID", "DISPOSABLE_POSTGRES_LOOPBACK_PORT_INVALID", "DISPOSABLE_POSTGRES_CONTAINER_UNAVAILABLE", "DISPOSABLE_POSTGRES_OWNERSHIP_INVALID", "POSTGRES_HEALTH_CHECK_FAILED"].includes(error.code)
        ? EXIT_CONFIGURATION
        : EXIT_FAILURE;
    }
  }
}
