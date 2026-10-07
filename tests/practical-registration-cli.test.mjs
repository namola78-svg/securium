import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { PRACTICAL_SERVER_AUTHORITY_REQUIRED } from "../lib/policy/practical-registration-authority.ts";

const runFile = promisify(execFile);
const manifest = JSON.parse(await readFile("reports/content-audit/governed-practical-registration-manifest-2026-09-08.json", "utf8"));
const script = "scripts/register-governed-practical-content.mjs";

async function withManifest(payload, callback) {
  const directory = await mkdtemp(join(tmpdir(), "securium-practical-denial-"));
  const path = join(directory, "manifest.json");
  try {
    await writeFile(path, JSON.stringify(payload), "utf8");
    await callback(path);
  } finally {
    await rm(path, { force: true });
    await rmdir(directory);
  }
}

function run(path, args = [], environment = {}) {
  return runFile(process.execPath, [script, "--manifest", path, ...args], {
    windowsHide: true, timeout: 30_000,
    env: { ...process.env, APP_ENV: "test", DB_PROVIDER: "invalid-provider", ...environment },
  });
}

test("manifest apply and replay deny caller claims before any database connection", async () => {
  let connections = 0;
  const listener = createServer((socket) => { connections += 1; socket.destroy(); });
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const url = `postgres://synthetic:synthetic@127.0.0.1:${listener.address().port}/synthetic`;
  const claimed = {
    ...manifest,
    authority: { approved: true, registrationPurpose: "PRACTICAL", lifecycle: "APPROVED_ACTIVE", capability: "caller-token" },
    registrations: manifest.registrations.map((registration) => ({
      ...registration, governance: { ...registration.governance, lifecycle: "CANONICAL_UNPUBLISHED" },
      conceptCandidates: registration.conceptCandidates.map((candidate) => ({ ...candidate, mappingStatus: "APPROVED" })),
      mutationLabel: "CANONICAL_CONTENT_REGISTRATION", replay: { accepted: true },
    })),
  };
  try {
    await withManifest(claimed, async (path) => {
      for (let replay = 0; replay < 2; replay += 1) {
        await assert.rejects(() => run(path, ["--apply", "--nonprod"], { DB_PROVIDER: "supabase", DATABASE_URL: url, DIRECT_URL: url, POSTGRES_SSL_MODE: "disable" }), (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stderr, new RegExp(PRACTICAL_SERVER_AUTHORITY_REQUIRED));
          assert.doesNotMatch(error.stderr, /DATABASE_PROVIDER_CONFIGURATION_INVALID|PostgresError/);
          assert.equal(error.stdout.trim(), "");
          return true;
        });
      }
    });
    assert.equal(connections, 0, "denial must precede provider initialization and all writes");
  } finally {
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
});

test("manifest apply denies even when provider configuration is invalid", async () => {
  await withManifest(manifest, async (path) => {
    await assert.rejects(() => run(path, ["--apply", "--nonprod"]), (error) => {
      assert.match(error.stderr, new RegExp(PRACTICAL_SERVER_AUTHORITY_REQUIRED));
      assert.doesNotMatch(error.stderr, /DATABASE_PROVIDER_CONFIGURATION_INVALID/);
      return true;
    });
  });
});

test("dry-run preserves read-only inspection and reports no granted authority", async () => {
  await withManifest(manifest, async (path) => {
    const { stdout } = await run(path, ["--dry-run"]);
    const result = JSON.parse(stdout);
    assert.equal(result.mode, "DRY_RUN");
    assert.equal(result.registrationCount, 8);
    assert.equal(result.writes, 0);
    assert.equal(result.authority, "NOT_GRANTED");
    assert.equal(result.denialCode, PRACTICAL_SERVER_AUTHORITY_REQUIRED);
  });
});

test("existing CLI production and non-production checks remain in force", async () => {
  await withManifest(manifest, async (path) => {
    await assert.rejects(() => run(path, ["--apply"]), /NONPROD_CONFIRMATION_REQUIRED/);
    await assert.rejects(() => run(path, ["--apply", "--nonprod"], { APP_ENV: "production" }), /PRODUCTION_REGISTRATION_FORBIDDEN/);
  });
});

test("manifest shape validation remains unchanged", async () => {
  await withManifest({ ...manifest, manifestVersion: "UNKNOWN" }, async (path) => {
    await assert.rejects(() => run(path, ["--apply", "--nonprod"]), /UNSUPPORTED_REGISTRATION_MANIFEST/);
  });
  await withManifest({ ...manifest, registrations: [] }, async (path) => {
    await assert.rejects(() => run(path, ["--apply", "--nonprod"]), /REGISTRATION_ENTRIES_REQUIRED/);
  });
});
