import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_FORENSICS_8H_BINDING_KEY,
  DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
  DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY,
  DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256,
  assertDigitalForensics8HSourceAuthority,
  loadDigitalForensics8HRuntimeModel,
} from "../lib/services/digital-forensics-8h-runtime-adapter.ts";

const registrationContext = {
  id: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
  code: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code,
  slug: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug,
  bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
  active: false,
  published: false,
  deletedAt: null,
};

function load(overrides = {}) {
  return loadDigitalForensics8HRuntimeModel({
    runtimeCourse: { ...registrationContext, ...(overrides.runtimeCourse ?? {}) },
    exposure: overrides.exposure ?? "registration",
  });
}

test("loads the canonical Digital Forensics Foundation with exact identity and counts", () => {
  const model = load();
  assert.deepEqual(model.runtimeIdentity, DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY);
  assert.deepEqual(model.foundationBinding, {
    manifestId: "SECURIUM_DIGITAL_FORENSICS_8H_FOUNDATION_PRODUCT_AUTHORITY_V1",
    courseId: "course-digital-forensics-8h",
    code: "DF-8H",
    slug: "digital-forensics-8h",
    version: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
    bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
    status: "DRAFT_UNPUBLISHED",
  });
  assert.deepEqual(model.counts, {
    course: 1,
    modules: 8,
    minutes: 480,
    objectives: 32,
    theoryAssets: 24,
    questions: 40,
    explanations: 40,
    practicalSpecifications: 8,
    executableLabs: 0,
  });
  assert.equal(model.moduleIds.length, 8);
  assert.equal(model.objectiveIds.length, 32);
  assert.equal(model.theoryIds.length, 24);
  assert.equal(model.questionIds.length, 40);
  assert.equal(model.practicalIds.length, 8);
});

test("rejects wrong runtime identity and version context", () => {
  for (const field of ["id", "code", "slug", "bindingKey"]) {
    assert.throws(
      () => load({ runtimeCourse: { [field]: "wrong-value" } }),
      (error) => error.code === "RUNTIME_IDENTITY_MISMATCH",
    );
  }
  assert.throws(
    () => load({ exposure: "server-runtime" }),
    (error) => error.code === "UNPUBLISHED_ACCESS_DENIED",
  );
});

test("rejects wrong source authority metadata without reading source members", () => {
  const valid = {
    manifestSha256: DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256,
    authorityCount: 1,
    competingAuthorities: 0,
    memberCount: 22,
    localExpressionReuse: 0,
    localQuestionWordingReuse: 0,
    restrictedSourceDependence: 0,
    h04ToH08LocalSourceDependence: 0,
  };
  assert.doesNotThrow(() => assertDigitalForensics8HSourceAuthority(valid));
  for (const [field, value] of [
    ["manifestSha256", "0".repeat(64)],
    ["authorityCount", 2],
    ["competingAuthorities", 1],
    ["memberCount", 21],
    ["localExpressionReuse", 1],
    ["h04ToH08LocalSourceDependence", 1],
  ]) {
    assert.throws(
      () => assertDigitalForensics8HSourceAuthority({ ...valid, [field]: value }),
      (error) => error.code === "SOURCE_AUTHORITY_INVALID",
    );
  }
});

test("returns deeply frozen sanitized Foundation data", () => {
  const model = load();
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.foundation), true);
  assert.equal(Object.isFrozen(model.foundation.modules), true);
  assert.equal(Object.isFrozen(model.foundation.modules[0]), true);
  assert.equal(Object.isFrozen(model.foundation.questions), true);
  assert.equal(Object.isFrozen(model.foundation.questions[0]), true);
  assert.equal(Object.isFrozen(model.foundation.questions[0].options), true);
  assert.equal(Object.isFrozen(model.foundation.provenance), true);
  assert.equal(JSON.stringify(model).includes("source-evidence-original"), false);
  assert.equal(JSON.stringify(model).includes("reports/content-audit"), false);
  assert.throws(() => {
    model.foundation.questions[0].options[0] = "mutated";
  }, TypeError);
});

test("repeated reads are deterministic and retain the synthetic practical boundary", () => {
  const first = load();
  const second = load();
  assert.deepEqual(first, second);
  assert.deepEqual(first.practicalBoundary, {
    classification: "SYNTHETIC_SPEC_ONLY",
    executableLabs: 0,
    automatedGrading: 0,
    caseId: "DF-CASE-001-credential-misuse-exfiltration",
    realPii: 0,
    realVictimEvidence: 0,
    malwareExecution: 0,
    credentialTheftExecution: 0,
  });
  assert.equal(first.sourceBoundary.h04ToH08, "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE");
  assert.equal(first.sourceBoundary.h04ToH08LocalDependence, 0);
});
