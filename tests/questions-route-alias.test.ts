import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("legacy questions route redirects to the practice hub", () => {
  const source = readFileSync("app/questions/route.ts", "utf8");

  assert.match(source, /NextResponse\.redirect/);
  assert.match(source, /new URL\("\/practice", request\.url\)/);
});
