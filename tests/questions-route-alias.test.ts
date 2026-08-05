import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("legacy questions route redirects to the practice hub", () => {
  const source = readFileSync("app/questions/page.tsx", "utf8");

  assert.match(source, /redirect\("\/practice"\)/);
  assert.match(source, /force-dynamic/);
});
