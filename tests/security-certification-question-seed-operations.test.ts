import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const operationsDoc = readFileSync(
  "docs/curriculum/security-certification-question-seed-operations.md",
  "utf8",
);

const subjects = [
  "network",
  "system",
  "application-security",
  "information-security-general",
  "management-law",
];

test("security certification question seed operation scripts stay documented", () => {
  for (const subject of subjects) {
    for (const action of [
      "stats",
      "seed:d1-local",
      "seed:postgres",
      "verify:d1-local",
      "verify:postgres",
    ]) {
      const scriptName = `curriculum:security-certification:${subject}-questions:${action}`;
      assert.equal(
        typeof packageJson.scripts[scriptName],
        "string",
        `${scriptName} must be defined in package.json`,
      );
      assert.match(
        operationsDoc,
        new RegExp(escapeRegExp(`npm run ${scriptName}`)),
        `${scriptName} must be documented`,
      );
    }
  }
});

test("postgres question seed commands require explicit production approval", () => {
  const guardedScripts = [
    packageJson.scripts["curriculum:security-certification:network-questions:seed:postgres"],
    packageJson.scripts["curriculum:security-certification:system-questions:seed:postgres"],
    packageJson.scripts[
      "curriculum:security-certification:application-security-questions:seed:postgres"
    ],
    packageJson.scripts[
      "curriculum:security-certification:information-security-general-questions:seed:postgres"
    ],
    packageJson.scripts[
      "curriculum:security-certification:management-law-questions:seed:postgres"
    ],
  ];

  assert.match(operationsDoc, /--confirm-production-seed/);
  assert.match(operationsDoc, /SECURIUM_CONFIRM_NETWORK_SECURITY_QUESTION_SEED/);
  assert.match(operationsDoc, /SECURIUM_CONFIRM_SYSTEM_SECURITY_QUESTION_SEED/);
  assert.match(operationsDoc, /SECURIUM_CONFIRM_APPLICATION_SECURITY_QUESTION_SEED/);
  assert.match(
    operationsDoc,
    /SECURIUM_CONFIRM_INFORMATION_SECURITY_GENERAL_QUESTION_SEED/,
  );
  assert.match(operationsDoc, /SECURIUM_CONFIRM_MANAGEMENT_LAW_QUESTION_SEED/);
  assert.match(operationsDoc, /SECURIUM_QUESTION_SEED_ACTOR_USER_ID/);
  assert.match(operationsDoc, /created_by/);
  assert.match(operationsDoc, /reviewed_by/);

  for (const command of guardedScripts) {
    assert.equal(typeof command, "string");
    assert.doesNotMatch(
      command,
      /--confirm-production-seed/,
      "npm script should not include the production confirmation flag by default",
    );
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
