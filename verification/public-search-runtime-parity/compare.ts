import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type LoadedReport =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "invalid"; reason: "invalid-json" | "not-object" }>
  | Readonly<{ status: "present"; report: JsonObject }>;

const EXPECTED_VECTOR_COUNT = 40;
const EXPECTED_NODE = {
  node22: "v22.13.0",
  node24: "v24.19.0",
} as const;

function readReport(path: string): LoadedReport {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) return { status: "missing" };
  try {
    const value: unknown = JSON.parse(readFileSync(resolvedPath, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { status: "invalid", reason: "not-object" };
    }
    return { status: "present", report: value as JsonObject };
  } catch {
    return { status: "invalid", reason: "invalid-json" };
  }
}

function valueAt(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as JsonObject)[key];
  }
  return current;
}

function resultsOf(report: JsonObject | undefined): JsonObject[] {
  const results = report?.results;
  return Array.isArray(results)
    ? results.filter(
        (result): result is JsonObject =>
          result !== null && typeof result === "object" && !Array.isArray(result),
      )
    : [];
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function vectorIds(report: JsonObject | undefined) {
  return resultsOf(report).map((result) => ({
    id: result.id,
    operation: result.operation,
  }));
}

function runtimeProfile(report: JsonObject | undefined) {
  const runtime = report?.runtime;
  if (runtime === null || typeof runtime !== "object" || Array.isArray(runtime)) {
    return null;
  }
  return {
    node: (runtime as JsonObject).node ?? null,
    icu: (runtime as JsonObject).icu ?? null,
    unicode: (runtime as JsonObject).unicode ?? null,
    v8: (runtime as JsonObject).v8 ?? null,
    platform: (runtime as JsonObject).platform ?? null,
    arch: (runtime as JsonObject).arch ?? null,
    supportedLocales: (runtime as JsonObject).supportedLocales ?? null,
  };
}

function goldenValidation(loaded: LoadedReport, expectedNode: string) {
  if (loaded.status !== "present") {
    return {
      status: "MISSING_RESULT" as const,
      reason: loaded.status === "missing" ? "result-artifact-missing" : loaded.reason,
    };
  }

  const report = loaded.report;
  const results = resultsOf(report);
  const summary = report.summary;
  const runtime = runtimeProfile(report);
  const ids = vectorIds(report);
  const uniqueIds = new Set(ids.map((entry) => String(entry.id))).size === ids.length;
  const valid =
    report.formatVersion === "public-search-runtime-parity.result.v1" &&
    report.vectorSetVersion === "public-search-runtime-parity.v1" &&
    valueAt(report, "contract", "oracleMatch") === true &&
    runtime?.node === expectedNode &&
    Array.isArray(report.results) &&
    results.length === EXPECTED_VECTOR_COUNT &&
    uniqueIds &&
    Array.isArray(summary) === false &&
    summary !== null &&
    typeof summary === "object" &&
    !Array.isArray(summary) &&
    (summary as JsonObject).total === EXPECTED_VECTOR_COUNT &&
    (summary as JsonObject).executed === EXPECTED_VECTOR_COUNT &&
    (summary as JsonObject).pass === EXPECTED_VECTOR_COUNT &&
    (summary as JsonObject).fail === 0 &&
    (summary as JsonObject).skip === 0 &&
    results.every((result) => result.oracleMatch === true && "actual" in result);

  return {
    status: valid ? ("PASS" as const) : ("FAIL" as const),
    reason: valid ? "40-of-40-oracle-matches" : "report-contract-or-vector-validation-failed",
    total: results.length,
    pass: typeof summary === "object" && summary !== null ? (summary as JsonObject).pass : null,
    fail: typeof summary === "object" && summary !== null ? (summary as JsonObject).fail : null,
    skip: typeof summary === "object" && summary !== null ? (summary as JsonObject).skip : null,
  };
}

function differenceRows(left: JsonObject | undefined, right: JsonObject | undefined) {
  if (left === undefined || right === undefined) return [];
  const leftResults = resultsOf(left);
  const rightResults = resultsOf(right);
  const leftById = new Map(leftResults.map((result) => [String(result.id), result]));
  const rightById = new Map(rightResults.map((result) => [String(result.id), result]));
  const ids = [...new Set([...leftById.keys(), ...rightById.keys()])];
  return ids
    .map((id) => {
      const leftResult = leftById.get(id);
      const rightResult = rightById.get(id);
      const same =
        leftResult !== undefined &&
        rightResult !== undefined &&
        leftResult.operation === rightResult.operation &&
        sameJson(leftResult.actual, rightResult.actual);
      return same
        ? null
        : {
            id,
            node22: leftResult
              ? {
                  operation: leftResult.operation,
                  expected: leftResult.expected ?? null,
                  actual: leftResult.actual ?? null,
                }
              : null,
            node24: rightResult
              ? {
                  operation: rightResult.operation,
                  expected: rightResult.expected ?? null,
                  actual: rightResult.actual ?? null,
                }
              : null,
          };
    })
    .filter((difference): difference is Exclude<typeof difference, null> => difference !== null);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const required = (name: string) => {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : undefined;
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a path`);
    return value;
  };
  return {
    node22: required("--node22"),
    node24: required("--node24"),
    output: required("--output"),
    matrixJobResult: required("--matrix-job-result"),
  };
}

const args = parseArgs();
const node22 = readReport(args.node22);
const node24 = readReport(args.node24);
const node22Report = node22.status === "present" ? node22.report : undefined;
const node24Report = node24.status === "present" ? node24.report : undefined;
const node22Golden = goldenValidation(node22, EXPECTED_NODE.node22);
const node24Golden = goldenValidation(node24, EXPECTED_NODE.node24);
const bindingKeys = {
  vectorSetVersion: sameJson(node22Report?.vectorSetVersion, node24Report?.vectorSetVersion),
  source: sameJson(
    valueAt(node22Report, "source"),
    valueAt(node24Report, "source"),
  ),
  contract: sameJson(
    valueAt(node22Report, "contract"),
    valueAt(node24Report, "contract"),
  ),
};
const bindingPass =
  node22.status === "present" &&
  node24.status === "present" &&
  bindingKeys.vectorSetVersion &&
  bindingKeys.source &&
  bindingKeys.contract;
const node22Ids = vectorIds(node22Report);
const node24Ids = vectorIds(node24Report);
const vectorIdsMatch =
  node22Ids.length === EXPECTED_VECTOR_COUNT &&
  node24Ids.length === EXPECTED_VECTOR_COUNT &&
  sameJson(node22Ids, node24Ids);
const outputDifferences = differenceRows(node22Report, node24Report);
const actualOutputsMatch = vectorIdsMatch && outputDifferences.length === 0;
const node22Runtime = runtimeProfile(node22Report);
const node24Runtime = runtimeProfile(node24Report);
const runtimeDifferences = {
  node: node22Runtime?.node !== node24Runtime?.node,
  icu: node22Runtime?.icu !== node24Runtime?.icu,
  unicode: node22Runtime?.unicode !== node24Runtime?.unicode,
  v8: node22Runtime?.v8 !== node24Runtime?.v8,
  platform: node22Runtime?.platform !== node24Runtime?.platform,
  arch: node22Runtime?.arch !== node24Runtime?.arch,
};
const prerequisitesPass =
  args.matrixJobResult === "success" &&
  node22Golden.status === "PASS" &&
  node24Golden.status === "PASS" &&
  bindingPass &&
  vectorIdsMatch;
const crossRuntimeParity = prerequisitesPass
  ? actualOutputsMatch
    ? "PASS"
    : "FAIL"
  : "NOT_ESTABLISHED";

const comparison = {
  formatVersion: "public-search-runtime-parity.comparison.v1",
  matrixJobResult: args.matrixJobResult,
  node22: {
    result: node22.status,
    runtime: node22Runtime,
    goldenVectorValidation: node22Golden,
  },
  node24: {
    result: node24.status,
    runtime: node24Runtime,
    goldenVectorValidation: node24Golden,
  },
  sourceVectorAndDependencyBinding: {
    status: bindingPass ? "PASS" : "FAIL",
    keys: bindingKeys,
    node22: valueAt(node22Report, "source") ?? null,
    node24: valueAt(node24Report, "source") ?? null,
  },
  vectorIdAndCountComparison: {
    status: vectorIdsMatch ? "PASS" : "FAIL",
    expectedCount: EXPECTED_VECTOR_COUNT,
    node22Count: node22Ids.length,
    node24Count: node24Ids.length,
    idsMatch: vectorIdsMatch,
  },
  actualOutputComparison: {
    status: actualOutputsMatch ? "PASS" : "FAIL",
    differences: outputDifferences,
  },
  runtimeComparison: {
    profiles: {
      node22: node22Runtime,
      node24: node24Runtime,
    },
    differences: runtimeDifferences,
    icuUnicodeVersionDifference:
      runtimeDifferences.icu || runtimeDifferences.unicode ? "PRESENT" : "NONE",
  },
  crossRuntimeParity,
};

const serialized = JSON.stringify(comparison, null, 2) + "\n";
writeFileSync(resolve(args.output), serialized, "utf8");

console.log("# Public search runtime parity comparison");
console.log("");
console.log(`- matrix job result: ${args.matrixJobResult}`);
console.log(
  `- Node 22.13.0 golden-vector validation: ${node22Golden.status} (${node22Golden.total ?? "missing"}/${EXPECTED_VECTOR_COUNT})`,
);
console.log(
  `- Node 24.19.0 golden-vector validation: ${node24Golden.status} (${node24Golden.total ?? "missing"}/${EXPECTED_VECTOR_COUNT})`,
);
console.log(`- source/vector/lockfile binding: ${bindingPass ? "PASS" : "FAIL"}`);
const source = valueAt(node22Report, "source");
console.log(
  `- source commit: ${valueAt(source, "commit") ?? "missing"}; comparison blob/SHA-256: ${valueAt(source, "comparisonBlob") ?? "missing"}/${valueAt(source, "comparisonSha256") ?? "missing"}`,
);
console.log(
  `- vector blob/SHA-256: ${valueAt(source, "vectorBlob") ?? "missing"}/${valueAt(source, "vectorSha256") ?? "missing"}; lockfile blob/SHA-256: ${valueAt(source, "lockfileBlob") ?? "missing"}/${valueAt(source, "lockfileSha256") ?? "missing"}`,
);
console.log(`- vector ID/count comparison: ${vectorIdsMatch ? "PASS" : "FAIL"}`);
console.log(
  `- actual output/error classification comparison: ${actualOutputsMatch ? "PASS" : "FAIL"}`,
);
console.log(
  `- Node 22 runtime: ${node22Runtime?.node ?? "missing"}, ICU ${node22Runtime?.icu ?? "missing"}, Unicode ${node22Runtime?.unicode ?? "missing"}, V8 ${node22Runtime?.v8 ?? "missing"}, ${node22Runtime?.platform ?? "missing"}/${node22Runtime?.arch ?? "missing"}, ko-KR=${valueAt(node22Runtime, "supportedLocales", "koKR") ?? "missing"}`,
);
console.log(
  `- Node 24 runtime: ${node24Runtime?.node ?? "missing"}, ICU ${node24Runtime?.icu ?? "missing"}, Unicode ${node24Runtime?.unicode ?? "missing"}, V8 ${node24Runtime?.v8 ?? "missing"}, ${node24Runtime?.platform ?? "missing"}/${node24Runtime?.arch ?? "missing"}, ko-KR=${valueAt(node24Runtime, "supportedLocales", "koKR") ?? "missing"}`,
);
console.log(`- CROSS_RUNTIME_PARITY: ${crossRuntimeParity}`);
if (outputDifferences.length > 0) {
  console.log(`- vector differences: ${outputDifferences.length}`);
  for (const difference of outputDifferences) {
    console.log(`  - ${difference.id}: expected/actual differ between runtimes`);
  }
}

if (crossRuntimeParity !== "PASS") process.exitCode = 1;
