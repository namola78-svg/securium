import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
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
  assert.deepEqual(result, {
    status: "PASS",
    packageCount: 12,
    claimCount: 60,
    usedInCount: 150,
  });
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
      /objectives\.json references unknown source claim ISRM-S02-U01-C01/,
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

test("allows existing related-unit continuity links outside source claim references", async () => {
  const root = await fixture("content-drafts/securium-isrm-s04-u02-authoring");
  try {
    await editJson(root, "manifest.json", (manifest) => {
      manifest.continuity.priorUnitIds.push("isrm-2025-2027-s02-u01");
    });
    const result = await validateSourceClaimReferences(root);
    assert.equal(result.claimCount, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
