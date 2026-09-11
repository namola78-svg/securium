import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ISRM_DRAFT_ROOTS = [
  "content-drafts/securium-isrm-s01-u01-authoring",
  "content-drafts/securium-isrm-s01-u02-authoring",
  "content-drafts/securium-isrm-s01-u03-authoring",
  "content-drafts/securium-isrm-s02-u01-authoring",
  "content-drafts/securium-isrm-s02-u02-authoring",
  "content-drafts/securium-isrm-s03-u01-authoring",
  "content-drafts/securium-isrm-s03-u02-authoring",
  "content-drafts/securium-isrm-s03-u03-authoring",
  "content-drafts/securium-isrm-s03-u04-authoring",
  "content-drafts/securium-isrm-s04-u01-authoring",
  "content-drafts/securium-isrm-s04-u02-authoring",
  "content-drafts/securium-isrm-s05-u01-authoring",
];

const USED_IN_FILES = ["manifest.json", "objectives.json", "theory.json", "questions.json"];

async function readJson(root, fileName) {
  return JSON.parse(await readFile(resolve(root, fileName), "utf8"));
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`);
}

function claimPrefix(learningUnitId) {
  return `${learningUnitId.replace(/^isrm-2025-2027-/, "ISRM-").toUpperCase()}-`;
}

function claimIdsByFile({ manifest, objectives, theory, questions }) {
  return new Map([
    ["manifest.json", manifest.officialScopeAnchor?.claimIds ?? []],
    ["objectives.json", objectives.objectives.flatMap((objective) => objective.claimIds ?? [])],
    ["theory.json", [
      ...(theory.claimIds ?? []),
      ...theory.sections.flatMap((section) => section.claimIds ?? []),
    ]],
    ["questions.json", questions.questions.flatMap((question) => question.claimIds ?? [])],
  ]);
}

export async function validateSourceClaimReferences(root) {
  const [manifest, objectives, theory, questions, claims] = await Promise.all([
    readJson(root, "manifest.json"),
    readJson(root, "objectives.json"),
    readJson(root, "theory.json"),
    readJson(root, "questions.json"),
    readJson(root, "source-claims.json"),
  ]);

  assert.equal(typeof manifest.learningUnitId, "string", `${root}/manifest.json must declare learningUnitId`);
  for (const [fileName, entity] of [
    ["objectives.json", objectives],
    ["theory.json", theory],
    ["questions.json", questions],
  ]) {
    assert.equal(
      entity.learningUnitId,
      manifest.learningUnitId,
      `${root}/${fileName}.learningUnitId must match manifest.json`,
    );
  }

  const sourceClaimIds = claims.claims.map((claim) => claim.id);
  unique(sourceClaimIds, `${root} source claim IDs`);
  const expectedClaimPrefix = claimPrefix(manifest.learningUnitId);
  for (const claimId of sourceClaimIds) {
    assert.ok(claimId.startsWith(expectedClaimPrefix), `${root}/${claimId} does not belong to ${manifest.learningUnitId}`);
  }
  const sourceClaimSet = new Set(sourceClaimIds);
  const actualClaimIdsByFile = claimIdsByFile({ manifest, objectives, theory, questions });
  const referenceErrors = [];

  for (const [fileName, claimIds] of actualClaimIdsByFile) {
    for (const claimId of claimIds) {
      assert.ok(claimId.startsWith(expectedClaimPrefix), `${root}/${fileName} references claim from another learning unit ${claimId}`);
      if (!sourceClaimSet.has(claimId)) {
        referenceErrors.push(`${root}/${fileName} references unknown source claim ${claimId}`);
      }
    }
  }

  for (const claim of claims.claims) {
    assert.ok(Array.isArray(claim.usedIn), `${root}/${claim.id}.usedIn must be an array`);
    unique(claim.usedIn, `${root}/${claim.id}.usedIn`);
    for (const fileName of claim.usedIn) {
      assert.ok(USED_IN_FILES.includes(fileName), `${root}/${claim.id}.usedIn references unsupported file ${fileName}`);
      if (!actualClaimIdsByFile.get(fileName).includes(claim.id)) {
        referenceErrors.push(`${root}/${claim.id}.usedIn lists ${fileName}, but that file does not reference ${claim.id}`);
      }
    }
  }

  if (referenceErrors.length > 0) {
    throw new Error(referenceErrors.join("\n"));
  }

  return {
    root,
    claimCount: sourceClaimIds.length,
    usedInCount: claims.claims.reduce((count, claim) => count + claim.usedIn.length, 0),
  };
}

export async function validateAllSourceClaimReferences(roots = ISRM_DRAFT_ROOTS) {
  assert.deepEqual(
    roots,
    ISRM_DRAFT_ROOTS,
    "source claim validation must cover the configured ISRM draft package roots",
  );
  const packages = [];
  for (const root of roots) {
    packages.push(await validateSourceClaimReferences(root));
  }
  return {
    status: "PASS",
    packageCount: packages.length,
    claimCount: packages.reduce((count, packageResult) => count + packageResult.claimCount, 0),
    usedInCount: packages.reduce((count, packageResult) => count + packageResult.usedInCount, 0),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await validateAllSourceClaimReferences(), null, 2));
}
