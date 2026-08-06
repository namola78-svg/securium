import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("learning settings is protected consistently by the proxy", () => {
  const source = readFileSync("proxy.ts", "utf8");

  assert.match(source, /const PROTECTED_PREFIXES = \[/);
  assert.match(source, /"\/settings"/);
  assert.match(source, /matcher: \[/);
});
