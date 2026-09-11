import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ISRM_DRAFT_ROOTS,
  validateAllSourceClaimReferences,
  validateSourceClaimReferences,
} from "../scripts/validate-securium-isrm-source-claim-references.mjs";

const sourceRoot = "content-drafts/securium-isrm-s01-u01-authoring";

async function fixture(packageRoot = sourceRoot) {
  const root = await mkdtemp(join(tmpdir(), "securium-isrm-source-claims-"));
  await cp(packageRoot, root, { recursive: true });
  return root;
}

async function editJson(root, fileName, edit) {
  const path = join(root, fileName);
  const value = JSON.parse(await readFile(path, "utf8"));
  edit(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("all ISRM packages pass source claim reference validation", async () => {
  const result = await validateAllSourceClaimReferences();
  assert.equal(result.status, "PASS");
  assert.equal(result.packageCount, ISRM_DRAFT_ROOTS.length);
  assert.ok(result.claimCount > 0);
  assert.ok(result.usedInCount > 0);
});

test("allows a valid additional claim reference without a fixed aggregate count", async () => {
  const baselineRoot = await fixture();
  const root = await fixture();
  try {
    const baseline = await validateSourceClaimReferences(baselineRoot);
    await editJson(root, "objectives.json", (objectives) => {
      objectives.objectives[0].claimIds.push("ISRM-S01-U01-C05");
    });
    await editJson(root, "source-claims.json", (claims) => {
      claims.claims.find((claim) => claim.id.endsWith("C05")).usedIn.push("objectives.json");
    });
    const result = await validateSourceClaimReferences(root);
    assert.equal(result.usedInCount, baseline.usedInCount + 1);
    assert.ok(result.claimCount > 0);
  } finally {
    await Promise.all([
      rm(baselineRoot, { recursive: true, force: true }),
      rm(root, { recursive: true, force: true }),
    ]);
  }
});

test("rejects a usedIn target that does not contain the claim ID", async () => {
  const root = await fixture();
  try {
    await editJson(root, "source-claims.json", (claims) => {
      claims.claims.find((claim) => claim.id.endsWith("C02")).usedIn.push("questions.json");
    });
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /C02\.usedIn lists questions\.json, but that file does not reference/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a source claim ID from another unit in an entity reference", async () => {
  const root = await fixture();
  try {
    await editJson(root, "objectives.json", (objectives) => {
      objectives.objectives[0].claimIds.push("ISRM-S02-U01-C01");
    });
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /objectives\.json references claim from another learning unit ISRM-S02-U01-C01/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a manifest claim reference absent from source-claims", async () => {
  const root = await fixture();
  try {
    await editJson(root, "manifest.json", (manifest) => {
      manifest.officialScopeAnchor.claimIds.push("ISRM-S01-U01-C99");
    });
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /manifest\.json references unknown source claim ISRM-S01-U01-C99/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a package with a missing required source-reference file", async () => {
  const root = await fixture();
  try {
    await rm(join(root, "questions.json"));
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /ENOENT|questions\.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an entity connected to the wrong learning unit", async () => {
  const root = await fixture();
  try {
    await editJson(root, "objectives.json", (objectives) => {
      objectives.learningUnitId = "isrm-2025-2027-s02-u01";
    });
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /objectives\.json\.learningUnitId must match manifest\.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects duplicate source claim IDs", async () => {
  const root = await fixture();
  try {
    await editJson(root, "source-claims.json", (claims) => {
      claims.claims.push({ ...claims.claims[0] });
    });
    await assert.rejects(
      () => validateSourceClaimReferences(root),
      /source claim IDs contains duplicates/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not allow empty or incomplete configured package input to pass", async () => {
  await assert.rejects(
    () => validateAllSourceClaimReferences([]),
    /configured ISRM draft package roots/,
  );
  await assert.rejects(
    () => validateAllSourceClaimReferences(ISRM_DRAFT_ROOTS.slice(0, -1)),
    /configured ISRM draft package roots/,
  );
});

test("allows existing related-unit continuity links outside source claim references", async () => {
  const root = await fixture("content-drafts/securium-isrm-s04-u02-authoring");
  try {
    await editJson(root, "manifest.json", (manifest) => {
      manifest.continuity.priorUnitIds.push("isrm-2025-2027-s02-u01");
    });
    const result = await validateSourceClaimReferences(root);
    assert.ok(result.claimCount > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
