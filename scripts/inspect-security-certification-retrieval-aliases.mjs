import { describeRetrievalQueryExpansion } from "../lib/ai/retrieval-provider.ts";
import { getSecurityCertificationRetrievalConceptAliases } from "../lib/curriculum/security-certification-ontology.ts";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const query = argValue("--query=") ?? process.argv[2] ?? "RBAC";
const courseId = argValue("--course-id=") ?? "course-ise";
const limit = parseLimit(argValue("--limit=") ?? "4");
const format = argValue("--format=") ?? "text";

const diagnostics = describeRetrievalQueryExpansion(
  { query, courseId, limit },
  getSecurityCertificationRetrievalConceptAliases(),
  limit,
);

if (format === "json") {
  console.log(JSON.stringify(diagnostics, null, 2));
} else if (format === "text") {
  console.log(`QUERY:${diagnostics.originalQuery}`);
  console.log(`COURSE_ID:${diagnostics.courseId ?? "all"}`);
  console.log(`CANDIDATES:${diagnostics.scopedCandidateCount}/${diagnostics.candidateCount}`);
  console.log(`MATCHED_CONCEPTS:${diagnostics.matchedConceptLabels.join(",") || "-"}`);
  console.log(`EXPANDED_QUERIES:${diagnostics.expandedQueries.join(" | ")}`);
} else {
  fail("SECURITY_CERTIFICATION_RETRIEVAL_ALIAS_FORMAT_INVALID");
}

function argValue(prefix) {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    fail("SECURITY_CERTIFICATION_RETRIEVAL_ALIAS_LIMIT_INVALID");
  }
  return parsed;
}

function printHelp() {
  console.log(`Inspect security certification retrieval alias expansion.

Usage:
  node scripts/inspect-security-certification-retrieval-aliases.mjs --query=RBAC --course-id=course-ise

Options:
  --query=<text>       Search query to expand. Defaults to RBAC.
  --course-id=<id>     Course scope. Defaults to course-ise.
  --limit=<1..12>      Maximum alias expansion count. Defaults to 4.
  --format=text|json   Output format. Defaults to text.

This script is read-only and does not connect to D1, PostgreSQL, Supabase, or external AI services.`);
}

function fail(code) {
  console.error(code);
  process.exit(1);
}
