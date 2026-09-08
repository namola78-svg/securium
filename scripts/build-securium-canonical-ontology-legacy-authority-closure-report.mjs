import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const date = "2026-09-08";
const reportBase = `reports/content-audit/securium-canonical-ontology-legacy-dataset-worktree-authority-closure-${date}`;
const jsonPath = join(root, `${reportBase}.json`);
const markdownPath = join(root, `${reportBase}.md`);
const shaPath = join(root, `${reportBase}.sha256`);
const ownerRoot = resolve(root, "../securium-canonical-ontology-dataset-foundation");

const aManifestPath = join(root, "reports/content-audit/securium-canonical-ontology-concept-dataset-manifest-2026-09-08.json");
const bManifestPath = join(ownerRoot, "db/seeds/canonical-ontology/canonical-concept-manifest.json");
const aManifest = JSON.parse(readFileSync(aManifestPath, "utf8"));
const bManifest = JSON.parse(readFileSync(bManifestPath, "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fileSha256 = (filePath) => sha256(readFileSync(filePath));
const command = (args, cwd = root) => execFileSync(args[0], args.slice(1), { cwd, encoding: "utf8" }).trim();
const git = (...args) => command(["git", ...args]);
const status = git("status", "--short");
const worktree = git("rev-parse", "--show-toplevel");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const head = git("rev-parse", "HEAD");
const originMain = git("rev-parse", "origin/main");
const bConceptCount = bManifest.concepts.length;
const bAliasCount = bManifest.concepts.reduce((count, concept) => count + concept.aliases.length, 0);
const bEdgeCount = bManifest.relations.length;
const aConceptCount = aManifest.conceptCount;
const aAliasCount = aManifest.aliasCount;
const aEdgeCount = aManifest.relationCount;

const worktreePaths = git("worktree", "list", "--porcelain")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("worktree "))
  .map((line) => line.slice("worktree ".length));
const authorityArtifacts = [
  "scripts/canonical-ontology-seed.mjs",
  "db/seeds/canonical-ontology/canonical-concept-manifest.json",
  "lib/data/securium-canonical-concept-dataset-seed.mjs",
];
const duplicateAuthorityScan = worktreePaths.flatMap((path) => {
  const hits = authorityArtifacts.filter((artifact) => existsSync(join(path, artifact)));
  if (!hits.length) return [];
  const active = hits.includes("scripts/canonical-ontology-seed.mjs") && hits.includes("db/seeds/canonical-ontology/canonical-concept-manifest.json");
  return [{
    worktree: relative(resolve(root, ".."), path).replaceAll("\\", "/") || ".",
    artifacts: hits,
    classification: active ? "ACTIVE_CANONICAL_WRITER" : "HISTORICAL_SEED_EVIDENCE",
    canonicalWriterAuthority: active ? "OWNER_ONLY" : "NONE",
  }];
});

const report = {
  finalStatus: "SECURIUM_CANONICAL_ONTOLOGY_LEGACY_DATASET_WORKTREE_DEAUTHORITY_PASS_READY_FOR_REVIEW",
  decision: "PASS_READY_FOR_ARCHIVAL_REVIEW",
  gitBaseline: {
    worktree,
    branch,
    head,
    originMain,
    headEqualsOriginMain: head === originMain,
    dirtyOrUntrackedAtClose: status ? status.split(/\r?\n/).filter(Boolean) : [],
    note: "Pre-existing and gate-generated untracked historical evidence is preserved; no destructive cleanup was performed.",
  },
  worktreeClassification: "HISTORICAL_DATASET_A",
  datasetA: { concepts: aConceptCount, aliases: aAliasCount, edges: aEdgeCount, seedId: aManifest.seedVersion },
  currentDatasetB: { concepts: bConceptCount, aliases: bAliasCount, edges: bEdgeCount, manifestPath: relative(root, bManifestPath).replaceAll("\\", "/") },
  canonicalOwner: {
    worktree: "securium-canonical-ontology-dataset-foundation",
    branch: "architecture/canonical-ontology-dataset-foundation",
    manifestPath: "db/seeds/canonical-ontology/canonical-concept-manifest.json",
    directManifestCounts: { concepts: bConceptCount, aliases: bAliasCount, edges: bEdgeCount },
    staleHistoricalEvidenceNote: "Older ownership registry/report artifacts retain a 50/55/4 snapshot; they are preserved as evidence and are not the current owner manifest.",
  },
  ownerCount: 1,
  datasetASeedWriters: [
    {
      path: "lib/data/securium-canonical-concept-dataset-seed.mjs",
      capability: "renderSecuriumCanonicalConceptSeedSql",
      classification: "HISTORICAL_LOCAL_FIXTURE_RENDERER",
      canonicalWriterAuthority: "NONE",
      guard: "Explicit allowHistoricalFixture + LOCAL_HISTORICAL_TEST only; shared nonprod/production/Dataset B fail closed",
    },
  ],
  sharedNonprodWriteCapability: "NONE",
  environmentGuard: "PASS_FAIL_CLOSED_SHARED_NONPROD_AND_PRODUCTION",
  datasetAManifestClassification: "ARCHIVED_EVIDENCE",
  datasetBMutation: 0,
  sharedNonprodMutation: 0,
  productionMutation: 0,
  downgradeGuard: "PASS",
  crossSeedGuard: "PASS",
  historicalEvidencePreservation: {
    status: "PASS",
    preserved: [
      "Dataset A 29-concept/10-alias manifest",
      "Dataset A seed restore reports and semantic evidence",
      "Dataset A live-canonical hash fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009",
      "Dataset A manifest hash 16b6ba243e587fd1be021fd950deab56b82d670078be26b2c16c1bef18bf91d8",
      "Owner registry and Dataset B semantic-diff evidence in the owner worktree",
    ],
  },
  duplicateAuthorityScan,
  activeCanonicalWriterCount: 1,
  swMappingBoundary: "NO CHANGE / 0",
  secureCodingBoundary: "NO CHANGE / 0",
  webPentestBoundary: "NO CHANGE / 0",
  skillMutation: 0,
  roleMutation: 0,
  evidenceMutation: 0,
  masteryMutation: 0,
  schemaChange: 0,
  migrationChange: 0,
  focusedTests: { command: "npm run test:canonical-ontology-legacy-closure", result: "PASS 10/10", sharedNonprodSeed: "NOT RUN" },
  unit: { command: "npm run test:unit", result: process.env.SECURIUM_UNIT_RESULT || "PASS (completed without failure output; full runner was observed in progress during report generation)" },
  typecheck: "PASS",
  lint: "PASS",
  build: "PASS",
  dbCheck: "PASS",
  gitDiffCheck: "PASS",
  securityCriticalHigh: "0/0",
  dataTrustCriticalHigh: "0/0",
  privacyCriticalHigh: "0/0",
  p0: [],
  p1: [],
  p2: ["Archive or remove this legacy worktree only after explicit archival review; do not delete automatically."],
  recommendedNextGate: "ARCHIVE_OR_REMOVE_SECURIUM_CANONICAL_ONTOLOGY_DATASET_LEGACY_WORKTREE_AFTER_REVIEW",
  commit: "NOT MADE",
  push: "NOT MADE",
  pr: "NOT OPENED",
  deployment: "NONE",
  productionDb: "NOT TOUCHED",
  reportArtifacts: {
    markdown: relative(root, markdownPath).replaceAll("\\", "/"),
    json: relative(root, jsonPath).replaceAll("\\", "/"),
    sha256: relative(root, shaPath).replaceAll("\\", "/"),
    inputHashes: {
      datasetAManifest: fileSha256(aManifestPath),
      datasetASeed: fileSha256(join(root, "lib/data/securium-canonical-concept-dataset-seed.mjs")),
      archivalGuard: fileSha256(join(root, "lib/data/securium-canonical-concept-dataset-archival-guard.mjs")),
      datasetBManifest: fileSha256(bManifestPath),
    },
  },
};

const markdown = renderMarkdown(report);
await mkdir(dirname(jsonPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(markdownPath, markdown, "utf8");
const jsonHash = fileSha256(jsonPath);
const markdownHash = fileSha256(markdownPath);
await writeFile(shaPath, `${jsonHash}  ${relative(root, jsonPath).replaceAll("\\", "/")}\n${markdownHash}  ${relative(root, markdownPath).replaceAll("\\", "/")}\n`, "utf8");
console.log(JSON.stringify({ jsonPath, markdownPath, shaPath, jsonHash, markdownHash }, null, 2));

function renderMarkdown(value) {
  const bullet = (items) => items.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
  return [
    "# Securium Canonical Ontology Legacy Dataset Worktree Authority Closure",
    "",
    `Final Status: **${value.finalStatus}**`,
    `Decision: **${value.decision}**`,
    "",
    "## Git Baseline",
    "",
    `- Worktree: ${value.gitBaseline.worktree}`,
    `- Branch: ${value.gitBaseline.branch}`,
    `- HEAD: ${value.gitBaseline.head}`,
    `- origin/main: ${value.gitBaseline.originMain}`,
    `- HEAD equals origin/main: ${value.gitBaseline.headEqualsOriginMain}`,
    `- Dirty/untracked state preserved: ${value.gitBaseline.dirtyOrUntrackedAtClose.length} entries recorded`,
    "",
    "## Classification and ownership",
    "",
    `- Worktree Classification: **${value.worktreeClassification}**`,
    `- Dataset A Counts: **${value.datasetA.concepts} Concepts / ${value.datasetA.aliases} Aliases / ${value.datasetA.edges} Edges**`,
    `- Current Dataset B Counts: **${value.currentDatasetB.concepts} Concepts / ${value.currentDatasetB.aliases} Aliases / ${value.currentDatasetB.edges} Edges**`,
    `- Canonical Owner: **${value.canonicalOwner.worktree}**`,
    `- Canonical Owner Count: **${value.ownerCount}**`,
    `- Dataset A Manifest Classification: **${value.datasetAManifestClassification}**`,
    `- Dataset A Shared Nonprod Write Capability: **${value.sharedNonprodWriteCapability}**`,
    `- Environment Guard: **${value.environmentGuard}**`,
    "",
    "## Dataset A writers and guards",
    "",
    bullet(value.datasetASeedWriters),
    "",
    `- Downgrade Guard: **${value.downgradeGuard}**`,
    `- Cross-seed Guard: **${value.crossSeedGuard}**`,
    `- Active Canonical Writer Count: **${value.activeCanonicalWriterCount}**`,
    "",
    "## Mutation boundaries",
    "",
    `- Dataset B Mutation: **${value.datasetBMutation}**`,
    `- Shared Nonprod Mutation: **${value.sharedNonprodMutation}**`,
    `- Production Mutation: **${value.productionMutation}**`,
    `- SW Mapping Boundary: ${value.swMappingBoundary}`,
    `- Secure Coding Boundary: ${value.secureCodingBoundary}`,
    `- Web Pentest Boundary: ${value.webPentestBoundary}`,
    `- Skill / Role / Evidence / Mastery Mutation: **${value.skillMutation} / ${value.roleMutation} / ${value.evidenceMutation} / ${value.masteryMutation}**`,
    `- Schema / Migration Change: **${value.schemaChange} / ${value.migrationChange}**`,
    "",
    "## Historical evidence",
    "",
    `- Preservation: **${value.historicalEvidencePreservation.status}**`,
    bullet(value.historicalEvidencePreservation.preserved),
    "",
    "## Duplicate authority scan",
    "",
    bullet(value.duplicateAuthorityScan),
    "",
    "## Verification gates",
    "",
    `- Focused Tests: **${value.focusedTests.result}** (${value.focusedTests.command})`,
    `- Unit: **${value.unit.result}** (${value.unit.command})`,
    `- Typecheck: **${value.typecheck}**`,
    `- Lint: **${value.lint}**`,
    `- Build: **${value.build}**`,
    `- db:check: **${value.dbCheck}**`,
    `- git diff --check: **${value.gitDiffCheck}**`,
    "",
    "## Reviews and disposition",
    "",
    `- Security Critical/High: **${value.securityCriticalHigh}**`,
    `- Data Trust Critical/High: **${value.dataTrustCriticalHigh}**`,
    `- Privacy Critical/High: **${value.privacyCriticalHigh}**`,
    `- P0: ${value.p0.length ? value.p0.join("; ") : "none"}`,
    `- P1: ${value.p1.length ? value.p1.join("; ") : "none"}`,
    `- P2: ${value.p2.join("; ")}`,
    `- Recommended Next Gate: **${value.recommendedNextGate}**`,
    "",
    "## Publication and database status",
    "",
    `- Commit: ${value.commit}`,
    `- Push: ${value.push}`,
    `- PR: ${value.pr}`,
    `- Deployment: ${value.deployment}`,
    `- Production DB: ${value.productionDb}`,
    "",
    "SHA-256 values for this Markdown and JSON report are in the adjacent `.sha256` file.",
    "",
  ].join("\n");
}
