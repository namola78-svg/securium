import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadLocalEnvIfPresent } from "../scripts/load-local-env.mjs";

test("optional local env loader ignores missing files", () => {
  assert.doesNotThrow(() =>
    loadLocalEnvIfPresent(join(tmpdir(), "securium-missing-env-file.env")),
  );
});

test("optional local env loader reads simple values without overriding process env", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "securium-env-loader-"));
  const envPath = join(tempDir, ".env.local");
  const existingKey = "SECURIUM_ENV_LOADER_EXISTING";
  const loadedKey = "SECURIUM_ENV_LOADER_LOADED";
  const quotedKey = "SECURIUM_ENV_LOADER_QUOTED";

  const previousExisting = process.env[existingKey];
  const previousLoaded = process.env[loadedKey];
  const previousQuoted = process.env[quotedKey];

  try {
    process.env[existingKey] = "shell-value";
    delete process.env[loadedKey];
    delete process.env[quotedKey];

    writeFileSync(
      envPath,
      [
        "# comment",
        `${existingKey}=file-value`,
        `${loadedKey}=postgres://example.invalid/db`,
        `${quotedKey}=\"quoted value\"`,
        "INVALID-KEY=ignored",
      ].join("\n"),
      "utf8",
    );

    loadLocalEnvIfPresent(envPath);

    assert.equal(process.env[existingKey], "shell-value");
    assert.equal(process.env[loadedKey], "postgres://example.invalid/db");
    assert.equal(process.env[quotedKey], "quoted value");
  } finally {
    restoreEnv(existingKey, previousExisting);
    restoreEnv(loadedKey, previousLoaded);
    restoreEnv(quotedKey, previousQuoted);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
