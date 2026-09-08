/**
 * Bounded, DRAFT-only canonical Concept seed for the current security-learning
 * domains. This is a data-foundation package, not course mapping or ontology
 * edge materialization.
 *
 * Authority: ontology_concepts / ontology_aliases.
 * Source files, CP-A, legacy tables, and course metadata are reference inputs
 * only. Definitions below are independently authored and intentionally short.
 *
 * This module is historical Dataset A evidence only. It has no canonical
 * writer authority; SQL rendering is limited to a disposable local fixture
 * and fails closed for shared nonprod, production, and Dataset B state.
 */

import {
  assertSecuriumCanonicalConceptDatasetHistoricalTarget,
  SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION,
  SECURIUM_CANONICAL_CONCEPT_DATASET_MANIFEST_CLASSIFICATION,
  SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY,
  SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY,
  SECURIUM_CANONICAL_CONCEPT_DATASET_CANONICAL_OWNER,
} from "./securium-canonical-concept-dataset-archival-guard.mjs";

export const SECURIUM_CANONICAL_CONCEPT_SEED_ID =
  "SECURIUM_CANONICAL_CONCEPT_DATASET_V1_2026_09_08";
export const SECURIUM_CANONICAL_CONCEPT_SEED_STATUS = "DRAFT";
export const SECURIUM_CANONICAL_CONCEPT_SEED_SOURCE_ID =
  SECURIUM_CANONICAL_CONCEPT_SEED_ID;

export const SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING = Object.freeze({
  bindingVersion: "TARGET_BRANCH_BOUND_V1",
  repository: "securium-canonical-ontology-dataset",
  branch: "architecture/canonical-ontology-dataset",
  targetHead: "980ef6adb94d87a923d7a973edaf4419f03fff9d",
  manifestPath: "reports/content-audit/securium-canonical-ontology-concept-dataset-manifest-2026-09-08.json",
  manifestSha256: "16B6BA243E587FD1BE021FD950DEAB56B82D670078BE26B2C16C1BEF18BF91D8",
  liveCanonicalDatasetSha256: "fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009",
  seedModulePath: "lib/data/securium-canonical-concept-dataset-seed.mjs",
  seedTestPath: "tests/securium-canonical-concept-dataset-seed.test.mjs",
});

const provenance = Object.freeze({
  authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING",
  sourceRole: "REFERENCE_ONLY",
  rightsStatus: "RIGHTS_REVIEW_REQUIRED",
  restrictedReuse: 0,
  definitionMethod: "BOUNDED_INDEPENDENT_REAUTHORING",
  authority: "ontology_concepts / ontology_aliases",
  domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
  architectureEvidence: [
    "securium-current-ontology-inventory",
    "securium-sw-security-weakness-concept-mapping-closure-2026-09-08",
    "securium-secure-coding-authoring-v2-reference",
    "securium-web-pentest-8h-authoring-wave-a-b-reference",
  ],
});

const concept = ({ slug, label, description, aliases = [], domains, rationale }) =>
  Object.freeze({
    id: `concept:securium:${slug}`,
    conceptKey: `ontology:securium:${slug}`,
    namespace: "securium",
    label,
    category: "security-learning",
    description,
    aliases: Object.freeze(aliases),
    weight: 70,
    status: SECURIUM_CANONICAL_CONCEPT_SEED_STATUS,
    sourceType: "CONTENT",
    sourceId: SECURIUM_CANONICAL_CONCEPT_SEED_SOURCE_ID,
    provenance,
    domains: Object.freeze(domains),
    rationale,
  });

export const SECURIUM_CANONICAL_CONCEPT_SEED = Object.freeze([
  concept({
    slug: "trust-boundary",
    label: "Trust Boundary",
    description: "A boundary where control, interpretation, authority, or trust changes between components or data owners.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Appears in secure-coding data-flow review and Source/Validation/Sink reasoning.",
  }),
  concept({
    slug: "input-validation",
    label: "Input Validation",
    description: "Server-side enforcement that an input has an allowed type, shape, value domain, and failure behavior for its use.",
    aliases: [],
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Shared control concept for allowlists, typed inputs, and bounded request data.",
  }),
  concept({
    slug: "injection",
    label: "Injection",
    description: "Untrusted data changes the meaning of a language, query, command, template, or other interpreter input.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Bounded broader concept for the distinct injection subtypes used by current courses.",
  }),
  concept({
    slug: "code-injection",
    label: "Code Injection",
    description: "Untrusted data crosses an executable-code or expression boundary and changes program semantics.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact SW Wave A/Wave C concept; kept distinct from OS command and SQL injection.",
  }),
  concept({
    slug: "os-command-injection",
    label: "OS Command Injection",
    description: "Untrusted data changes an operating-system process, command, option, argument, or execution context.",
    aliases: ["Command Injection"],
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact SW Wave A/Wave C concept; the alias is a conventional exact synonym in this bounded domain.",
  }),
  concept({
    slug: "sql-injection",
    label: "SQL Injection",
    description: "Untrusted data changes the structure or meaning of a SQL statement rather than remaining a bound value.",
    aliases: ["SQLi"],
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact current SW topic and secure-coding/web-pentest exercise concept.",
  }),
  concept({
    slug: "path-traversal",
    label: "Path Traversal",
    description: "Untrusted path material escapes an intended filesystem location or selects an unintended filesystem object.",
    aliases: ["Directory Traversal"],
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact current SW topic and filesystem-boundary learning objective.",
  }),
  concept({
    slug: "file-upload-security",
    label: "File Upload Security",
    description: "Controls that constrain uploaded content, identity, storage, execution, access, and lifecycle.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Shared upload boundary concept; does not collapse upload and path traversal semantics.",
  }),
  concept({
    slug: "cross-site-scripting",
    label: "Cross-Site Scripting",
    description: "Attacker-controlled content is interpreted as script in a browser execution context.",
    aliases: ["XSS"],
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact current SW topic and output-context exercise concept.",
  }),
  concept({
    slug: "http-response-splitting",
    label: "HTTP Response Splitting",
    description: "Untrusted response metadata changes HTTP message structure by creating unintended headers or response boundaries.",
    domains: ["SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact current SW topic; kept separate from generic output encoding.",
  }),
  concept({
    slug: "error-information-exposure",
    label: "Error Information Exposure",
    description: "Error handling reveals implementation, secret, path, request, or diagnostic information beyond the intended audience.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Exact current SW topic and safe-error-path learning objective.",
  }),
  concept({
    slug: "server-side-request-forgery",
    label: "Server-Side Request Forgery",
    description: "Attacker-influenced server requests reach unintended network locations or trust zones.",
    aliases: ["SSRF"],
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Current web-pentest server-side request analysis and secure-coding extension domain.",
  }),
  concept({
    slug: "authentication",
    label: "Authentication",
    description: "The process of establishing which principal is making a request or using a service.",
    aliases: ["AuthN"],
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Distinct identity-establishment concept; not used as an authorization substitute.",
  }),
  concept({
    slug: "authorization",
    label: "Authorization",
    description: "A server-side decision that a principal may perform a specific action on a specific resource in context.",
    aliases: ["AuthZ"],
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Distinct policy-enforcement concept for object and action checks.",
  }),
  concept({
    slug: "idor-bola",
    label: "IDOR / BOLA",
    description: "Object-level authorization failure allowing a principal to access or change another object's resource through a reference.",
    aliases: ["Insecure Direct Object Reference", "Broken Object Level Authorization"],
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Preserves the distinction between authentication, general authorization, and object-level authorization weakness.",
  }),
  concept({
    slug: "session-management",
    label: "Session Management",
    description: "Lifecycle controls for session identifiers, state, rotation, expiry, revocation, and transport.",
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Current web-pentest and secure-coding session lifecycle coverage.",
  }),
  concept({
    slug: "cross-site-request-forgery",
    label: "Cross-Site Request Forgery",
    description: "A browser is induced to send an authenticated state-changing request without the user's intended action.",
    aliases: ["CSRF"],
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Kept distinct from XSS and session management despite adjacent web controls.",
  }),
  concept({
    slug: "api-security",
    label: "API Security",
    description: "Security controls for API identity, authorization, schema, input, rate, response, and trust boundaries.",
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Broad API context used by current web-pentest and secure-coding API boundary material.",
  }),
  concept({
    slug: "output-encoding",
    label: "Output Encoding",
    description: "Context-specific transformation or serialization that keeps data from being interpreted as control syntax at an output sink.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Control concept supporting XSS and response-structure reasoning without replacing the weakness identity.",
  }),
  concept({
    slug: "sensitive-data-exposure",
    label: "Sensitive Data Exposure",
    description: "Sensitive information becomes available through an unintended response, log, trace, storage copy, or error path.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS"],
    rationale: "Shared data-handling and disclosure concept for minimization, redaction, and bounded errors.",
  }),
  concept({
    slug: "security-logging",
    label: "Security Logging",
    description: "Protected, structured recording of security-relevant events with sufficient context and controlled disclosure.",
    domains: ["SECURE_CODING", "WEB_PENTEST"],
    rationale: "Control concept for protected telemetry, distinct from information exposure and error handling.",
  }),
  concept({
    slug: "cryptography",
    label: "Cryptography",
    description: "The disciplined use of cryptographic primitives, keys, randomness, protocols, and lifecycle controls for a stated purpose.",
    domains: ["SECURE_CODING"],
    rationale: "Top-level purpose-and-lifecycle concept from the secure-coding crypto exercise.",
  }),
  concept({
    slug: "encryption",
    label: "Encryption",
    description: "A cryptographic transformation intended to provide confidentiality against parties without the required key.",
    domains: ["SECURE_CODING"],
    rationale: "Kept distinct from the broader cryptography concept.",
  }),
  concept({
    slug: "password-hashing",
    label: "Password Hashing",
    description: "Purpose-built, slow, salted password-verifier derivation that limits offline guessing impact.",
    domains: ["SECURE_CODING"],
    rationale: "Kept distinct from encryption and general cryptographic hashing.",
  }),
  concept({
    slug: "dependency-security",
    label: "Dependency Security",
    description: "Identification, ownership, reachability, remediation, and compensating control for software dependencies and their supply chain.",
    domains: ["SECURE_CODING"],
    rationale: "Current secure-coding dependency triage exercise.",
  }),
  concept({
    slug: "secure-code-review",
    label: "Secure Code Review",
    description: "Evidence-based review of code paths, trust boundaries, security controls, and residual risk.",
    domains: ["SECURE_CODING", "SW_SECURITY_WEAKNESS"],
    rationale: "Assessment and practical reasoning capability represented as a domain Concept, not a Skill or course identity.",
  }),
  concept({
    slug: "attack-surface-analysis",
    label: "Attack Surface Analysis",
    description: "Systematic identification and scoping of reachable assets, interfaces, inputs, trust boundaries, and exposed behavior.",
    domains: ["WEB_PENTEST"],
    rationale: "Current web-pentest reconnaissance and attack-surface mapping topics.",
  }),
  concept({
    slug: "vulnerability-validation",
    label: "Vulnerability Validation",
    description: "Reproducible confirmation that observed behavior violates a defined security property under stated scope and evidence.",
    domains: ["SW_SECURITY_WEAKNESS", "WEB_PENTEST"],
    rationale: "Supports false-positive discrimination and retest reasoning without becoming a generic RETEST identity.",
  }),
  concept({
    slug: "data-minimization",
    label: "Data Minimization",
    description: "Limiting collection, propagation, retention, and exposure of data to what the function and audience require.",
    domains: ["SECURE_CODING"],
    rationale: "Current secure-coding data-handling exercise; not a learner-data Concept.",
  }),
]);

export const SECURIUM_CANONICAL_CONCEPT_SEED_METADATA = Object.freeze({
  seedId: SECURIUM_CANONICAL_CONCEPT_SEED_ID,
  status: SECURIUM_CANONICAL_CONCEPT_SEED_STATUS,
  authority: "ontology_concepts / ontology_aliases",
  conceptCount: SECURIUM_CANONICAL_CONCEPT_SEED.length,
  edgeCount: 0,
  mappingCount: 0,
  courseMappingCount: 0,
  skillCount: 0,
  evidenceCount: 0,
  learnerStateMutation: 0,
  productionMutation: 0,
  ontologyMutationScope: "DRAFT_CONCEPT_AND_EXACT_ALIAS_IDENTITY_ONLY",
  provenance,
  provenanceBinding: SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING,
  classification: SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION,
  manifestClassification: SECURIUM_CANONICAL_CONCEPT_DATASET_MANIFEST_CLASSIFICATION,
  writerAuthority: SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY,
  sharedNonprodWriteAuthority: SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY,
  canonicalOwner: SECURIUM_CANONICAL_CONCEPT_DATASET_CANONICAL_OWNER,
});

const normalize = (value) => value
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/\s+/g, " ")
  .replace(/\s*\/\s*/g, "/")
  .replace(/[(){}\[\],.]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const stableJsonStringify = (value) => JSON.stringify(value, (_key, candidate) => {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return Object.fromEntries(Object.entries(candidate).sort(([left], [right]) => left.localeCompare(right)));
  }
  return candidate;
});

/** Render deterministic PostgreSQL seed SQL. It is intentionally DRAFT-only. */
export function renderSecuriumCanonicalConceptSeedSql(options = {}) {
  assertSecuriumCanonicalConceptDatasetHistoricalTarget(options);
  const rows = SECURIUM_CANONICAL_CONCEPT_SEED.map((item) =>
    `(${sql(item.id)},${sql(item.conceptKey)},${sql(item.namespace)},${sql(item.label)},${sql(normalize(item.label))},${sql(item.category)},${sql(item.description)},${sql(item.sourceType)},${sql(item.sourceId)},${item.weight},${sql(item.status)},${sql(stableJsonStringify({ ...item.provenance, domains: item.domains, rationale: item.rationale, seedId: SECURIUM_CANONICAL_CONCEPT_SEED_ID, repositoryBinding: SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING }))})`,
  ).join(",\n  ");
  const aliases = SECURIUM_CANONICAL_CONCEPT_SEED.flatMap((item) => item.aliases.map((alias) => ({ item, alias })));
  const aliasRows = aliases.map(({ item, alias }) =>
    `(${sql(`ontology-alias:${item.conceptKey}:${normalize(alias)}`)},${sql(item.id)},${sql(alias)},${sql(normalize(alias))},${sql(alias === "XSS" || alias === "CSRF" || alias === "SSRF" || alias === "SQLi" || alias === "AuthN" || alias === "AuthZ" ? "en" : "und")},${sql(SECURIUM_CANONICAL_CONCEPT_SEED_SOURCE_ID)})`,
  ).join(",\n  ");
  return `BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ontology_concepts existing
    JOIN (VALUES
      ${rows}
    ) AS incoming(id, concept_key, namespace, label, normalized_label, category, description, source_type, source_id, weight, status, metadata_json)
      ON incoming.id = existing.id OR incoming.concept_key = existing.concept_key
    WHERE existing.namespace <> incoming.namespace
       OR existing.label <> incoming.label
       OR existing.normalized_label <> incoming.normalized_label
       OR existing.category <> incoming.category
       OR existing.description <> incoming.description
       OR existing.source_type <> incoming.source_type
       OR existing.source_id <> incoming.source_id
       OR existing.weight <> incoming.weight
       OR existing.status <> incoming.status
       OR existing.metadata_json <> incoming.metadata_json
  ) THEN
    RAISE EXCEPTION 'SECURIUM_CANONICAL_CONCEPT_SEED_CONFLICT';
  END IF;
END $$;
WITH incoming(id, concept_key, namespace, label, normalized_label, category, description, source_type, source_id, weight, status, metadata_json) AS (
  VALUES
  ${rows}
)
INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category, description, source_type, source_id, weight, status, metadata_json)
SELECT id, concept_key, namespace, label, normalized_label, category, description, source_type, source_id, weight, status, metadata_json
FROM incoming
ON CONFLICT (concept_key) DO NOTHING;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ontology_aliases existing
    JOIN (VALUES
      ${aliasRows || "(NULL,NULL,NULL,NULL,NULL,NULL)"}
    ) AS incoming(id, concept_id, alias, normalized_alias, language, source)
      ON existing.normalized_alias = incoming.normalized_alias
    WHERE existing.concept_id <> incoming.concept_id
  ) THEN
    RAISE EXCEPTION 'SECURIUM_CANONICAL_ALIAS_CONFLICT';
  END IF;
END $$;
${aliasRows ? `INSERT INTO ontology_aliases (id, concept_id, alias, normalized_alias, language, source)
VALUES
  ${aliasRows}
ON CONFLICT (concept_id, normalized_alias) DO NOTHING;` : ""}
COMMIT;`;
}

export function validateSecuriumCanonicalConceptSeed() {
  const keys = new Set();
  const ids = new Set();
  const aliases = new Map();
  for (const item of SECURIUM_CANONICAL_CONCEPT_SEED) {
    if (ids.has(item.id) || keys.has(item.conceptKey)) throw new Error("DUPLICATE_CANONICAL_IDENTITY");
    ids.add(item.id);
    keys.add(item.conceptKey);
    if (item.status !== "DRAFT") throw new Error("NON_DRAFT_SEED_RECORD");
    if (!item.conceptKey.startsWith("ontology:securium:")) throw new Error("INVALID_CONCEPT_KEY_NAMESPACE");
    if (!normalize(item.label)) throw new Error("EMPTY_CONCEPT_LABEL");
    for (const alias of item.aliases) {
      const lookup = normalize(alias);
      const prior = aliases.get(lookup);
      if (prior && prior !== item.conceptKey) throw new Error("AMBIGUOUS_ALIAS");
      aliases.set(lookup, item.conceptKey);
    }
  }
  return { conceptCount: ids.size, aliasCount: [...aliases].length, edgeCount: 0, mappingCount: 0 };
}
