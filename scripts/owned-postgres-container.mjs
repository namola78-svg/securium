import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const DOCKER_TIMEOUT_MS = 30_000;
const RECEIPT_KIND = "securium.owned-postgres-container";
const RECEIPT_VERSION = 1;
export const POSTGRES_OWNER_LABEL = "com.securium.evidence-once.owner";

const inspectFormat = "{{json .Id}}|{{json .Name}}|{{json .State.Running}}|{{json (index .Config.Labels \"com.securium.evidence-once.owner\")}}";

export async function createOwnedPostgresContainer({
  name,
  ownerToken,
  password,
  receiptPath,
  image = "postgres:17.6",
}) {
  const record = {
    kind: RECEIPT_KIND,
    version: RECEIPT_VERSION,
    containerName: requireValue(name, "OWNED_POSTGRES_CONTAINER_NAME_REQUIRED"),
    ownerToken: requireValue(ownerToken, "OWNED_POSTGRES_CONTAINER_OWNER_REQUIRED"),
    containerId: null,
    receiptPath: receiptPath?.trim() || null,
  };
  if (!password) throw new Error("OWNED_POSTGRES_CONTAINER_PASSWORD_REQUIRED");
  await writeReceipt(record);

  const existing = await inspectContainer(record.containerName);
  if (existing) throw new Error("OWNED_POSTGRES_CONTAINER_NAME_IN_USE");

  try {
    const { stdout } = await docker([
      "run", "--detach", "--rm", "--name", record.containerName,
      "--label", `${POSTGRES_OWNER_LABEL}=${record.ownerToken}`,
      "--env", `POSTGRES_PASSWORD=${password}`,
      "--publish", "127.0.0.1::5432", image,
    ]);
    const containerId = stdout.trim().split(/\r?\n/).at(-1)?.trim();
    if (!/^[0-9a-f]{12,64}$/i.test(containerId || "")) {
      throw new Error("OWNED_POSTGRES_CONTAINER_ID_INVALID");
    }
    record.containerId = containerId;
    await writeReceipt(record);
    const actual = await inspectContainer(record.containerId);
    assertOwnedRecord(record, actual);
    if (!actual.running) throw new Error("OWNED_POSTGRES_CONTAINER_NOT_RUNNING");
    return record;
  } catch (error) {
    if (record.containerId) {
      await cleanupOwnedPostgresContainer(record).catch(() => {});
    }
    throw sanitizeOwnedError(error, "OWNED_POSTGRES_CONTAINER_CREATE_FAILED");
  }
}

export async function getPublishedPostgresPort(record) {
  requireCreatedRecord(record);
  let stdout;
  try {
    ({ stdout } = await docker(["port", record.containerId, "5432/tcp"]));
  } catch {
    throw new Error("OWNED_POSTGRES_PORT_LOOKUP_FAILED");
  }
  const port = stdout.trim().match(/127\.0\.0\.1:(\d+)$/m)?.[1];
  if (!port) throw new Error("OWNED_POSTGRES_LOOPBACK_PORT_NOT_PUBLISHED");
  return port;
}

export async function inspectOwnedPostgresContainer(record) {
  requireCreatedRecord(record);
  return inspectContainer(record.containerId);
}

export async function cleanupOwnedPostgresContainer(record) {
  if (!record?.containerId) return "NO_CREATED_CONTAINER";
  const actual = await inspectContainer(record.containerId);
  if (!actual) return "ALREADY_REMOVED";
  assertOwnedRecord(record, actual);
  try {
    await docker(["rm", "--force", record.containerId]);
  } catch {
    throw new Error("OWNED_POSTGRES_CONTAINER_REMOVE_FAILED");
  }
  if (await inspectContainer(record.containerId)) {
    throw new Error("OWNED_POSTGRES_CONTAINER_NOT_REMOVED");
  }
  return "REMOVED";
}

export async function readOwnedPostgresReceipt(receiptPath) {
  let raw;
  try {
    raw = await readFile(receiptPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    throw new Error("OWNED_POSTGRES_RECEIPT_INVALID");
  }
  if (
    record?.kind !== RECEIPT_KIND ||
    record?.version !== RECEIPT_VERSION ||
    typeof record.containerName !== "string" ||
    typeof record.ownerToken !== "string" ||
    (record.containerId !== null && !/^[0-9a-f]{12,64}$/i.test(record.containerId || ""))
  ) {
    throw new Error("OWNED_POSTGRES_RECEIPT_INVALID");
  }
  return record;
}

async function inspectContainer(identifier) {
  try {
    const { stdout } = await docker(["inspect", `--format=${inspectFormat}`, identifier]);
    const [id, name, running, ownerToken] = stdout.trim().split("|", 4).map((value) => JSON.parse(value));
    return { id, name, running, ownerToken };
  } catch (error) {
    if (isMissingContainer(error)) return null;
    throw new Error("OWNED_POSTGRES_CONTAINER_INSPECT_FAILED");
  }
}

function assertOwnedRecord(record, actual) {
  if (
    !actual ||
    actual.id?.toLowerCase() !== record.containerId?.toLowerCase() ||
    actual.name !== `/${record.containerName}` ||
    actual.ownerToken !== record.ownerToken
  ) {
    throw new Error("OWNED_POSTGRES_CONTAINER_OWNERSHIP_MISMATCH");
  }
}

function requireCreatedRecord(record) {
  if (!record?.containerId || !record.containerName || !record.ownerToken) {
    throw new Error("OWNED_POSTGRES_CONTAINER_RECORD_REQUIRED");
  }
}

function requireValue(value, code) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

async function writeReceipt(record) {
  if (!record.receiptPath) return;
  await writeFile(record.receiptPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function docker(argumentsToDocker) {
  return execFile("docker", argumentsToDocker, {
    windowsHide: true,
    timeout: DOCKER_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
}

function isMissingContainer(error) {
  if (error?.code !== 1) return false;
  const output = `${error?.stdout || ""} ${error?.stderr || ""}`.toLowerCase();
  return output.includes("no such object") || output.includes("no such container") || output.includes("does not exist");
}

function sanitizeOwnedError(error, fallback) {
  if (typeof error?.message === "string" && error.message.startsWith("OWNED_POSTGRES_")) {
    return error;
  }
  return new Error(fallback);
}
