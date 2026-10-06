import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadBundle, validateFoundation } from "../lib/cppg/foundation-validator.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = await loadBundle(repoRoot);
const mutations = [
  ["course identity", (bundle) => { bundle.curriculum.courseId = "course-other"; }],
  ["curriculum manifest identity", (bundle) => { bundle.curriculum.manifestId = "OTHER"; }],
  ["curriculum authority status", (bundle) => { bundle.curriculum.authorityStatus = "INCOMPLETE"; }],
  ["theory authority identity", (bundle) => { bundle.theory.authorityId = "OTHER"; }],
  ["theory authority course", (bundle) => { bundle.theory.courseId = "course-other"; }],
  ["theory authority revision", (bundle) => { bundle.theory.provenance.officialScopeBasis = "OTHER"; }],
  ["objective authority identity", (bundle) => { bundle.objectives.authorityId = "OTHER"; }],
  ["objective authority course", (bundle) => { bundle.objectives.courseId = "course-other"; }],
  ["objective authority revision", (bundle) => { bundle.objectives.provenance.officialScopeBasis = "OTHER"; }],
  ["assessment authority identity", (bundle) => { bundle.assessment.authorityId = "OTHER"; }],
  ["assessment authority course", (bundle) => { bundle.assessment.courseId = "course-other"; }],
  ["assessment semantic hash", (bundle) => { bundle.assessment.semanticHash = "0".repeat(64); }],
  ["assessment authority revision", (bundle) => { bundle.assessment.provenance.officialScopeBasis = "OTHER"; }],
  ["rights manifest identity", (bundle) => { bundle.provenanceRights.manifestId = "OTHER"; }],
  ["source manifest identity", (bundle) => { bundle.sourceManifest.manifestId = "OTHER"; }],
  ["source root contract", (bundle) => { bundle.sourceManifest.sourceRoot = "../other"; }],
  ["source snapshot date", (bundle) => { bundle.sourceManifest.snapshotDate = "2000-01-01"; }],
  ["source package hash", (bundle) => { bundle.sourceManifest.packageHash = "0".repeat(64); }],
  ["projection authority source", (bundle) => { bundle.projection.generatedFrom = "OTHER"; }],
  ["projection mode", (bundle) => { bundle.projection.projectionMode = "EDITABLE"; }],
  ["projection semantic hash", (bundle) => { bundle.projection.semanticHash = "0".repeat(64); }],
  ["official subject identity", (bundle) => { bundle.curriculum.subjects[0].id = "OTHER"; }],
  ["official subject order", (bundle) => { [bundle.curriculum.subjects[0], bundle.curriculum.subjects[1]] = [bundle.curriculum.subjects[1], bundle.curriculum.subjects[0]]; }],
  ["official weight", (bundle) => { bundle.curriculum.subjects[0].officialWeight += 1; }],
];

test("canonical CPPG authority identity and semantic mutations fail closed", async (t) => {
  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const candidate = structuredClone(canonical);
      mutate(candidate);
      assert.throws(() => validateFoundation(candidate));
    });
  }
});
