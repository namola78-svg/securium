import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPublicCourseSearchProjection,
  createPublicCourseSearchIdOrderKey,
  normalizePublicCourseSearchQuery,
  normalizePublicCourseSearchText,
  PUBLIC_COURSE_SEARCH_COMPARISON_VERSION,
  PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
  PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES,
  PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
} from "../../lib/services/public-course-search-comparison.ts";
import {
  CONTRACT_ORACLE,
  VECTOR_SET_VERSION,
  vectors,
  type Oracle,
  type RuntimeParityVector,
} from "./vectors.ts";

type Actual =
  | Oracle
  | Readonly<{ kind: "unexpected"; type: string; value: string }>;

type DescribedValue =
  | Readonly<{
      type: "string";
      json: string;
      utf16CodeUnits: readonly string[];
      utf8Bytes: number;
    }>
  | Readonly<{ type: "undefined" }>
  | Readonly<{ type: "number" | "boolean" | "null"; value: number | boolean | null }>
  | Readonly<{ type: "object"; entries: Readonly<Record<string, DescribedValue>> }>
  | Readonly<{ type: "other"; value: string }>;

function gitValue(args: readonly string[]) {
  return execFileSync("git", [...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function describeString(value: string): DescribedValue {
  const utf16CodeUnits: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    utf16CodeUnits.push(value.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0"));
  }
  return {
    type: "string",
    json: JSON.stringify(value),
    utf16CodeUnits,
    utf8Bytes: new TextEncoder().encode(value).byteLength,
  };
}

function describe(value: unknown): DescribedValue {
  if (typeof value === "string") return describeString(value);
  if (value === undefined) return { type: "undefined" };
  if (value === null) return { type: "null", value: null };
  if (typeof value === "number" || typeof value === "boolean") {
    return {
      type: typeof value === "number" ? "number" : "boolean",
      value: value as number | boolean,
    };
  }
  if (typeof value === "object") {
    const entries: Record<string, DescribedValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      entries[key] = describe(entry);
    }
    return { type: "object", entries };
  }
  return {
    type: "other",
    value: String(value),
  };
}

function describeOracle(oracle: Oracle) {
  if (oracle.kind === "value") {
    return { kind: oracle.kind, value: describeString(oracle.value) };
  }
  return oracle;
}

function describeActual(actual: Actual) {
  if (actual.kind === "value") {
    return { kind: actual.kind, value: describeString(actual.value) };
  }
  if (actual.kind === "unexpected") {
    return actual;
  }
  return actual;
}

function actualFromCall(call: () => unknown): Actual {
  try {
    const value = call();
    if (typeof value === "string") return { kind: "value", value };
    if (typeof value === "boolean") return { kind: "boolean", value };
    if (typeof value === "number") return { kind: "number", value };
    return {
      kind: "unexpected",
      type: value === null ? "null" : typeof value,
      value: String(value),
    };
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return {
        kind: "error",
        name: error instanceof TypeError ? "TypeError" : "RangeError",
      };
    }
    return {
      kind: "unexpected",
      type: error instanceof Error ? error.constructor.name : typeof error,
      value: error instanceof Error ? error.message : String(error),
    };
  }
}

function expectedMatches(actual: Actual, expected: Oracle) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function callVector(vector: RuntimeParityVector): Actual {
  switch (vector.operation) {
    case "normalize-text":
      return actualFromCall(() => normalizePublicCourseSearchText(vector.input));
    case "normalize-query":
      return actualFromCall(() => normalizePublicCourseSearchQuery(vector.input));
    case "projection":
      return actualFromCall(() => buildPublicCourseSearchProjection(vector.input));
    case "projection-contains":
      return actualFromCall(() => {
        const projection = buildPublicCourseSearchProjection(vector.input);
        const query = normalizePublicCourseSearchQuery(vector.query);
        return projection.includes(query);
      });
    case "id-order-key":
      return actualFromCall(() => createPublicCourseSearchIdOrderKey(vector.input));
    case "versions":
      return actualFromCall(() => PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES);
  }
}

function actualContract() {
  return {
    comparisonVersion: PUBLIC_COURSE_SEARCH_COMPARISON_VERSION,
    normalizerVersion: PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
    idOrderKeyVersion: PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
    maxQueryBytes: PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES,
  };
}

function runtimeMetadata() {
  return {
    node: process.version,
    icu: process.versions.icu,
    unicode: process.versions.unicode,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    supportedLocales: {
      koKR: Intl.Collator.supportedLocalesOf(["ko-KR"]).length === 1,
    },
  };
}

function sourceMetadata() {
  const comparisonPath = "lib/services/public-course-search-comparison.ts";
  const vectorPath = "verification/public-search-runtime-parity/vectors.ts";
  const comparisonBlob = gitValue(["hash-object", comparisonPath]);
  const vectorBlob = gitValue(["hash-object", vectorPath]);
  const vectorSha256 = createHash("sha256")
    .update(readFileSync(resolve(process.cwd(), vectorPath)))
    .digest("hex");
  return {
    commit: gitValue(["rev-parse", "HEAD"]),
    comparisonPath,
    comparisonBlob,
    vectorPath,
    vectorBlob,
    vectorSha256,
  };
}

function comparableReport(report: Record<string, unknown>) {
  return JSON.stringify({
    vectorSetVersion: report.vectorSetVersion,
    source: report.source,
    contract: report.contract,
    results: report.results,
  });
}

const args = process.argv.slice(2);
const compareIndex = args.indexOf("--compare");
const outputIndex = args.indexOf("--output");
const comparePath = compareIndex >= 0 ? args[compareIndex + 1] : undefined;
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

if (compareIndex >= 0 && !comparePath) {
  throw new Error("--compare requires a JSON report path");
}
if (outputIndex >= 0 && !outputPath) {
  throw new Error("--output requires a JSON report path");
}

const observedContract = actualContract();
const contractOracleMatch =
  JSON.stringify(observedContract) === JSON.stringify(CONTRACT_ORACLE);
const source = sourceMetadata();
const results = vectors.map((vector) => {
  const actual = callVector(vector);
  return {
    id: vector.id,
    operation: vector.operation,
    input: describe(vector.input),
    query: describe(vector.query),
    expected: describeOracle(vector.expected),
    actual: describeActual(actual),
    oracleMatch: expectedMatches(actual, vector.expected),
  };
});
const passCount = results.filter((result) => result.oracleMatch).length;
const failCount = results.length - passCount;

const report: Record<string, unknown> = {
  formatVersion: "public-search-runtime-parity.result.v1",
  vectorSetVersion: VECTOR_SET_VERSION,
  source,
  runtime: runtimeMetadata(),
  contract: {
    observed: observedContract,
    oracle: CONTRACT_ORACLE,
    oracleMatch: contractOracleMatch,
  },
  results,
  summary: {
    total: results.length,
    pass: passCount,
    fail: failCount,
  },
  crossRuntimeParity: { status: "NOT_CHECKED" },
};

if (comparePath) {
  const previous = JSON.parse(readFileSync(resolve(comparePath), "utf8")) as Record<
    string,
    unknown
  >;
  const same = comparableReport(previous) === comparableReport(report);
  report.crossRuntimeParity = {
    status: same ? "PASS" : "FAIL",
    comparedReport: comparePath,
  };
}

const serialized = JSON.stringify(report, null, 2) + "\n";
if (outputPath) {
  const resolvedOutputPath = resolve(outputPath);
  if (existsSync(resolvedOutputPath)) {
    throw new Error("refusing to overwrite existing output: " + resolvedOutputPath);
  }
  writeFileSync(resolvedOutputPath, serialized, "utf8");
} else {
  process.stdout.write(serialized);
}

const runtime = runtimeMetadata();
console.error(
  "[runtime-parity] " +
    runtime.node +
    " ICU " +
    runtime.icu +
    " Unicode " +
    runtime.unicode +
    ": " +
    passCount +
    "/" +
    results.length +
    " golden vectors passed",
);

if (!contractOracleMatch || failCount > 0) {
  process.exitCode = 1;
}
