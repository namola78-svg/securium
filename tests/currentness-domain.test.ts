import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CONTENT_REVIEW_DOMAINS } from "../lib/policy/content-review-judgment.ts";

test("Generic Review exposes CURRENTNESS as one distinct domain", () => {
  assert.deepEqual([...CONTENT_REVIEW_DOMAINS], [
    "TECHNICAL",
    "SAFETY_SECURITY_CONTENT",
    "COPYRIGHT_RIGHTS",
    "SUPPORT_QUALIFICATION",
    "CURRENTNESS",
  ]);
  assert.equal(CONTENT_REVIEW_DOMAINS.filter((domain) => domain === "CURRENTNESS").length, 1);
  const unknownDomain: string = "NOT_A_REAL_DOMAIN";
  assert.equal(CONTENT_REVIEW_DOMAINS.some((domain) => domain === unknownDomain), false);
});

test("CURRENTNESS migration is additive and has no implicit approval", () => {
  const postgres = readFileSync("db/postgres/migrations/0029_generic_review_currentness_domain.sql", "utf8");
  const d1 = readFileSync("drizzle/0040_generic_review_currentness_domain.sql", "utf8");
  for (const migration of [postgres, d1]) {
    assert.match(migration, /CURRENTNESS/);
    assert.doesNotMatch(migration, /DEFAULT\s+['"]?CURRENTNESS\s+PASS/i);
    assert.doesNotMatch(migration, /UPDATE\s+[^;]+review_domain\s*=/i);
    const insertStatements = migration.split(/\r?\n/).filter((line) => /^\s*INSERT\s+INTO/i.test(line)).join("\n");
    assert.doesNotMatch(insertStatements, /['"]CURRENTNESS['"]/i);
  }
  assert.match(postgres, /content_review_judgments_domain_check/);
  assert.match(d1, /content_review_judgments_domain_check/);
});
