import test from "node:test";
import assert from "node:assert/strict";
import { validateProductAuthority } from "../scripts/validate-securium-isrm-foundation-product-authority.mjs";

test("ISRM canonical product authority preserves the bounded reviewed contract", () => {
  const result = validateProductAuthority();
  assert.equal(result.valid, true, result.errors.join(", "));
  assert.deepEqual(result.metrics, {
    course: 1,
    subjects: 5,
    curriculumUnits: 12,
    theoryAssets: 3,
    questions: 30,
    practicalSpecs: 10,
    officialSources: 3,
    commercialSourceAuthority: 0,
    unknownProvenance: 0,
    reportDependencies: 0,
    runtimeRegistration: 0,
    ontologyProvisioning: 0,
    roleSkillWrites: 0,
    evidenceMaterialization: 0,
  });
});
