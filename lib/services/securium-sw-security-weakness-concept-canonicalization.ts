import {
  SECURIUM_SW_COARSE_INJECTION_CONCEPT,
  SECURIUM_SW_INJECTION_CONCEPTS,
  SECURIUM_SW_INJECTION_RELATION_EDGES,
  SECURIUM_SW_EVIDENCE_ROLLUP_POLICY,
} from "../data/securium-sw-security-weakness-concept-relation-refinement.mjs";
import { createOntologyEdge, normalizeOntologyLabel } from "./ontology-service.ts";

export const SW_SECURITY_WEAKNESS_CANONICALIZATION_SCOPE_REVIEW =
  "003e6c264f0740d8e7cbc0734ba8b5b1e81145408009a29fd121de6a0a61810c";
export const SW_SECURITY_WEAKNESS_RELATION_REVIEW =
  "6c7d61c2755b9483ad329df0e5ec09768af157a4b1d541b5e46240b7e5f8dba8";
export const SW_SECURITY_WEAKNESS_CANONICALIZATION_MODE =
  "IMPLEMENTATION_ONLY_NO_DB_EXECUTION";

const EXPECTED_CONCEPT_KEYS = Object.freeze([
  "ontology:securium:injection",
  "ontology:securium:code-injection",
  "ontology:securium:os-command-injection",
]);

const EXPECTED_EDGE_KEYS = Object.freeze(
  SECURIUM_SW_INJECTION_RELATION_EDGES.map((edge) => edge.key),
);

const canonicalDefinitions = Object.freeze({
  injection: "Untrusted data affects interpretation or execution semantics in a context that assigns unintended executable, query, or control meaning.",
  codeInjection: "Untrusted data crosses a code, expression, evaluator, template, or interpreter boundary and changes executable program semantics.",
  osCommandInjection: "Untrusted input changes operating-system command, process, shell, argument, or execution-context semantics.",
});

export type SwCanonicalizationStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type SwCanonicalizationScope = "GLOBAL_CONCEPT";

export type SwCanonicalizationConcept = {
  key: string;
  label: string;
  englishLabel: string;
  normalizedLabel: string;
  namespace: "securium";
  scope: SwCanonicalizationScope;
  category: "security-weakness";
  description: string;
  aliases: readonly string[];
  status: "DRAFT";
  provenance: {
    authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING";
    officialTaxonomyClaim: false;
    scopeReviewId: string;
    relationReviewId: string;
  };
};

export type SwCanonicalizationEdge = {
  key: string;
  courseId?: undefined;
  fromType: "CONCEPT";
  fromId: string;
  toType: "CONCEPT";
  toId: string;
  relation: "PARENT_OF" | "CHILD_OF";
  confidence: 1;
  evidence: readonly string[];
  status: "DRAFT";
};

export type SwCanonicalizationPackage = {
  packageType: "SECURIUM_SW_SECURITY_WEAKNESS_CONCEPT_CANONICALIZATION";
  mode: typeof SW_SECURITY_WEAKNESS_CANONICALIZATION_MODE;
  concepts: readonly SwCanonicalizationConcept[];
  edges: readonly SwCanonicalizationEdge[];
  coarseConcept: {
    key: string;
    treatment: "LEGACY_COARSE_RELATED";
    mutation: 0;
  };
  evidencePolicy: typeof SECURIUM_SW_EVIDENCE_ROLLUP_POLICY;
  invariants: {
    conceptCount: 3;
    edgeCount: 4;
    globalScope: true;
    activeTransitionRequired: true;
    partialActivePackageAllowed: false;
  };
};

export class SwCanonicalizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SwCanonicalizationError";
    this.code = code;
  }
}
function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function candidateConcept(
  candidate: { key: string; label: string; englishLabel: string; aliases: readonly string[] },
  description: string,
): SwCanonicalizationConcept {
  return freeze({
    key: candidate.key,
    label: candidate.label,
    englishLabel: candidate.englishLabel,
    normalizedLabel: normalizeOntologyLabel(candidate.label),
    namespace: "securium",
    scope: "GLOBAL_CONCEPT",
    category: "security-weakness",
    description,
    aliases: freeze([...candidate.aliases]),
    status: "DRAFT",
    provenance: freeze({
      authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING",
      officialTaxonomyClaim: false,
      scopeReviewId: SW_SECURITY_WEAKNESS_CANONICALIZATION_SCOPE_REVIEW,
      relationReviewId: SW_SECURITY_WEAKNESS_RELATION_REVIEW,
    }),
  });
}

export function buildSwSecurityWeaknessConceptCanonicalizationPackage(): SwCanonicalizationPackage {
  const concepts = freeze([
    candidateConcept(SECURIUM_SW_INJECTION_CONCEPTS.injection, canonicalDefinitions.injection),
    candidateConcept(SECURIUM_SW_INJECTION_CONCEPTS.codeInjection, canonicalDefinitions.codeInjection),
    candidateConcept(SECURIUM_SW_INJECTION_CONCEPTS.osCommandInjection, canonicalDefinitions.osCommandInjection),
  ]);
  const edges = freeze(
    SECURIUM_SW_INJECTION_RELATION_EDGES.map((edge) =>
      freeze({
        key: edge.key,
        courseId: undefined,
        fromType: "CONCEPT" as const,
        fromId: edge.fromId,
        toType: "CONCEPT" as const,
        toId: edge.toId,
        relation: edge.relation as "PARENT_OF" | "CHILD_OF",
        confidence: 1 as const,
        evidence: freeze([...edge.evidence]),
        status: "DRAFT" as const,
      }),
    ),
  );
  const result = {
    packageType: "SECURIUM_SW_SECURITY_WEAKNESS_CONCEPT_CANONICALIZATION" as const,
    mode: SW_SECURITY_WEAKNESS_CANONICALIZATION_MODE as typeof SW_SECURITY_WEAKNESS_CANONICALIZATION_MODE,
    concepts,
    edges,
    coarseConcept: freeze({
      key: SECURIUM_SW_COARSE_INJECTION_CONCEPT.key,
      treatment: "LEGACY_COARSE_RELATED" as const,
      mutation: 0 as const,
    }),
    evidencePolicy: SECURIUM_SW_EVIDENCE_ROLLUP_POLICY,
    invariants: freeze({
      conceptCount: 3 as const,
      edgeCount: 4 as const,
      globalScope: true as const,
      activeTransitionRequired: true as const,
      partialActivePackageAllowed: false as const,
    }),
  };
  validateSwSecurityWeaknessConceptCanonicalizationPackage(result);
  return freeze(result);
}

export function validateSwSecurityWeaknessConceptCanonicalizationPackage(
  input: SwCanonicalizationPackage,
): void {
  if (input.concepts.length !== 3) {
    throw new SwCanonicalizationError("SW_CANONICAL_CONCEPT_COUNT_INVALID", "The canonicalization package must contain exactly three Concepts.");
  }
  if (input.edges.length !== 4) {
    throw new SwCanonicalizationError("SW_CANONICAL_EDGE_COUNT_INVALID", "The canonicalization package must contain exactly four reciprocal edges.");
  }

  const conceptKeys = input.concepts.map((concept) => concept.key);
  if (!sameSet(conceptKeys, EXPECTED_CONCEPT_KEYS)) {
    throw new SwCanonicalizationError("SW_CANONICAL_CONCEPT_SET_INVALID", "The package Concept set does not match the approved server-owned package.");
  }
  if (new Set(conceptKeys).size !== conceptKeys.length) {
    throw new SwCanonicalizationError("SW_CANONICAL_CONCEPT_DUPLICATE", "Duplicate Concept identities are not allowed.");
  }
  if (input.concepts.some((concept) => concept.scope !== "GLOBAL_CONCEPT" || concept.status !== "DRAFT")) {
    throw new SwCanonicalizationError("SW_CANONICAL_CONCEPT_STATE_INVALID", "All package Concepts must be global DRAFT candidates.");
  }
  if (!sameSet(input.edges.map((edge) => edge.key), EXPECTED_EDGE_KEYS)) {
    throw new SwCanonicalizationError("SW_CANONICAL_EDGE_SET_INVALID", "The package edge set does not match the approved four-edge hierarchy.");
  }
  if (new Set(input.edges.map((edge) => edge.key)).size !== input.edges.length) {
    throw new SwCanonicalizationError("SW_CANONICAL_EDGE_DUPLICATE", "Duplicate edge identities are not allowed.");
  }

  for (const edge of input.edges) {
    const canonicalEdge = createOntologyEdge({
      fromType: edge.fromType,
      fromId: edge.fromId,
      toType: edge.toType,
      toId: edge.toId,
      relation: edge.relation,
      confidence: edge.confidence,
      evidence: [...edge.evidence],
    });
    if (edge.key !== canonicalEdge.key) {
      throw new SwCanonicalizationError("SW_CANONICAL_EDGE_KEY_INVALID", "Every package edge must use the canonical ontology edge identity.");
    }
  }

  const conceptSet = new Set(conceptKeys);
  for (const edge of input.edges) {
    if (!conceptSet.has(edge.fromId) || !conceptSet.has(edge.toId)) {
      throw new SwCanonicalizationError("SW_CANONICAL_EDGE_ENDPOINT_INVALID", "Every edge endpoint must belong to the exact Concept package.");
    }
    if (edge.fromId === edge.toId) {
      throw new SwCanonicalizationError("SW_CANONICAL_SELF_EDGE", "Self-relations are forbidden.");
    }
  }

  const parentEdges = input.edges.filter((edge) => edge.relation === "PARENT_OF");
  const childEdges = input.edges.filter((edge) => edge.relation === "CHILD_OF");
  for (const parent of parentEdges) {
    if (!childEdges.some((child) => child.fromId === parent.toId && child.toId === parent.fromId)) {
      throw new SwCanonicalizationError("SW_CANONICAL_RECIPROCAL_EDGE_MISSING", "Every parent edge requires an exact reciprocal child edge.");
    }
  }
  if (input.edges.some((edge) =>
    (edge.fromId === SECURIUM_SW_INJECTION_CONCEPTS.codeInjection.key && edge.toId === SECURIUM_SW_INJECTION_CONCEPTS.osCommandInjection.key) ||
    (edge.fromId === SECURIUM_SW_INJECTION_CONCEPTS.osCommandInjection.key && edge.toId === SECURIUM_SW_INJECTION_CONCEPTS.codeInjection.key))) {
    throw new SwCanonicalizationError("SW_CANONICAL_SIBLING_HIERARCHY_FORBIDDEN", "Code Injection and OS Command Injection must remain siblings.");
  }
  if (input.coarseConcept.mutation !== 0 || input.coarseConcept.treatment !== "LEGACY_COARSE_RELATED") {
    throw new SwCanonicalizationError("SW_CANONICAL_COARSE_CONCEPT_MUTATION", "The legacy coarse Concept must remain unchanged.");
  }
  if (input.evidencePolicy.broadToNarrow !== "FORBIDDEN" || input.evidencePolicy.siblingToSibling !== "FORBIDDEN") {
    throw new SwCanonicalizationError("SW_CANONICAL_EVIDENCE_DIRECTION_INVALID", "Broad-to-narrow and sibling evidence propagation must remain forbidden.");
  }
}

function sameSet(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

export type ExistingConceptRecord = {
  key: string;
  label: string;
  normalizedLabel?: string;
  namespace?: string;
  description?: string;
  status?: SwCanonicalizationStatus;
};

export type ExistingEdgeRecord = {
  key: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  status?: SwCanonicalizationStatus;
};

export type ExistingIdentityClassification =
  | "NEW_REQUIRED"
  | "EXACT_EXISTING_MATCH"
  | "CANONICAL_CONCEPT_SEMANTIC_COLLISION"
  | "CANONICAL_EDGE_SEMANTIC_COLLISION";

export function classifyExistingConcept(
  expected: SwCanonicalizationConcept,
  existing: ExistingConceptRecord | null,
): ExistingIdentityClassification {
  if (!existing) return "NEW_REQUIRED";
  const exact = existing.key === expected.key &&
    existing.label === expected.label &&
    (existing.normalizedLabel ?? normalizeOntologyLabel(existing.label)) === expected.normalizedLabel &&
    (existing.namespace ?? "securium") === expected.namespace &&
    (existing.description === undefined || existing.description === expected.description);
  return exact ? "EXACT_EXISTING_MATCH" : "CANONICAL_CONCEPT_SEMANTIC_COLLISION";
}

export function classifyExistingEdge(
  expected: SwCanonicalizationEdge,
  existing: ExistingEdgeRecord | null,
): ExistingIdentityClassification {
  if (!existing) return "NEW_REQUIRED";
  const exact = existing.key === expected.key &&
    existing.fromType === expected.fromType &&
    existing.fromId === expected.fromId &&
    existing.toType === expected.toType &&
    existing.toId === expected.toId &&
    existing.relation === expected.relation;
  return exact ? "EXACT_EXISTING_MATCH" : "CANONICAL_EDGE_SEMANTIC_COLLISION";
}

export type SwCanonicalizationReferenceResult = {
  status: "PASS" | "BLOCK" | "UNKNOWN";
  references: readonly string[];
};

export type SwCanonicalizationPreflightStore = {
  findConcept(key: string): Promise<ExistingConceptRecord | null>;
  findEdge(key: string): Promise<ExistingEdgeRecord | null>;
  findRuntimeReferences(keys: readonly string[]): Promise<SwCanonicalizationReferenceResult>;
};

export async function preflightSwSecurityWeaknessConceptCanonicalization(
  store: SwCanonicalizationPreflightStore,
  packageInput = buildSwSecurityWeaknessConceptCanonicalizationPackage(),
) {
  validateSwSecurityWeaknessConceptCanonicalizationPackage(packageInput);
  const concepts = await Promise.all(packageInput.concepts.map(async (concept) => ({
    key: concept.key,
    classification: classifyExistingConcept(concept, await store.findConcept(concept.key)),
  })));
  const edges = await Promise.all(packageInput.edges.map(async (edge) => ({
    key: edge.key,
    classification: classifyExistingEdge(edge, await store.findEdge(edge.key)),
  })));
  const references = await store.findRuntimeReferences(packageInput.concepts.map((concept) => concept.key));
  if (references.status === "UNKNOWN") {
    throw new SwCanonicalizationError("SW_CANONICAL_REFERENCE_PREFLIGHT_UNKNOWN", "Runtime reference state is unavailable; canonicalization must fail closed.");
  }
  if (references.status === "BLOCK" || references.references.length > 0) {
    throw new SwCanonicalizationError("SW_CANONICAL_RUNTIME_REFERENCE_FOUND", "Existing runtime Evidence or mastery references require a separate compatibility review.");
  }
  const collisions = [...concepts, ...edges].filter((item) => item.classification.includes("COLLISION"));
  if (collisions.length) {
    throw new SwCanonicalizationError("SW_CANONICAL_IDENTITY_COLLISION", "A canonical identity has incompatible existing semantics.");
  }
  return Object.freeze({ package: packageInput, concepts, edges, runtimeReferences: references });
}

export type SwCanonicalizationDraftTransaction = {
  upsertConceptDraft(concept: SwCanonicalizationConcept): Promise<void>;
  upsertEdgeDraft(edge: SwCanonicalizationEdge): Promise<void>;
  readBackPackage(keys: { conceptKeys: readonly string[]; edgeKeys: readonly string[] }): Promise<SwCanonicalizationPackage>;
  recordRegistrationAudit(input: { actorId: string; packageType: string; scopeReviewId: string }): Promise<void>;
};

export type SwCanonicalizationDraftExecutor = {
  transaction<T>(callback: (transaction: SwCanonicalizationDraftTransaction) => Promise<T>): Promise<T>;
};

export type SwCanonicalizationIntent = Readonly<{
  operation?: "PREPARE_DRAFT_REGISTRATION";
}>;

function assertSwCanonicalizationIntent(intent: unknown): void {
  if (intent === undefined) return;
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    throw new SwCanonicalizationError("SW_CANONICAL_INTENT_INVALID", "Canonicalization intent must be a bounded object.");
  }
  const keys = Object.keys(intent);
  if (keys.some((key) => key !== "operation")) {
    throw new SwCanonicalizationError("SW_CANONICAL_INTENT_FIELDS_INVALID", "Canonicalization intent cannot carry semantic package fields.");
  }
  const operation = (intent as { operation?: unknown }).operation;
  if (operation !== undefined && operation !== "PREPARE_DRAFT_REGISTRATION") {
    throw new SwCanonicalizationError("SW_CANONICAL_INTENT_OPERATION_INVALID", "Unsupported canonicalization operation.");
  }
}

function assertServerOwnedPackageReadback(
  actual: SwCanonicalizationPackage,
  expected: SwCanonicalizationPackage,
): void {
  const conceptProjection = (concept: SwCanonicalizationConcept) => ({
    key: concept.key,
    label: concept.label,
    englishLabel: concept.englishLabel,
    normalizedLabel: concept.normalizedLabel,
    namespace: concept.namespace,
    scope: concept.scope,
    category: concept.category,
    description: concept.description,
    aliases: [...concept.aliases],
    status: concept.status,
    provenance: concept.provenance,
  });
  const edgeProjection = (edge: SwCanonicalizationEdge) => ({
    key: edge.key,
    fromType: edge.fromType,
    fromId: edge.fromId,
    toType: edge.toType,
    toId: edge.toId,
    relation: edge.relation,
    confidence: edge.confidence,
    evidence: [...edge.evidence],
    status: edge.status,
  });
  const actualConcepts = actual.concepts.map(conceptProjection).sort((a, b) => a.key.localeCompare(b.key));
  const expectedConcepts = expected.concepts.map(conceptProjection).sort((a, b) => a.key.localeCompare(b.key));
  const actualEdges = actual.edges.map(edgeProjection).sort((a, b) => a.key.localeCompare(b.key));
  const expectedEdges = expected.edges.map(edgeProjection).sort((a, b) => a.key.localeCompare(b.key));
  if (JSON.stringify(actualConcepts) !== JSON.stringify(expectedConcepts) || JSON.stringify(actualEdges) !== JSON.stringify(expectedEdges)) {
    throw new SwCanonicalizationError("SW_CANONICAL_READBACK_SEMANTIC_DRIFT", "Database readback differs from the server-owned reviewed package.");
  }
}

export async function executeSwSecurityWeaknessDraftRegistration(
  executor: SwCanonicalizationDraftExecutor,
  input: { actorId: string; intent?: SwCanonicalizationIntent },
) {
  assertSwCanonicalizationIntent(input.intent);
  const packageInput = buildSwSecurityWeaknessConceptCanonicalizationPackage();
  validateSwSecurityWeaknessConceptCanonicalizationPackage(packageInput);
  if (!input.actorId.trim()) {
    throw new SwCanonicalizationError("SW_CANONICAL_REGISTRATION_ACTOR_REQUIRED", "A server-resolved registration actor is required.");
  }
  return executor.transaction(async (transaction) => {
    for (const concept of packageInput.concepts) await transaction.upsertConceptDraft(concept);
    for (const edge of packageInput.edges) await transaction.upsertEdgeDraft(edge);
    const readBack = await transaction.readBackPackage({
      conceptKeys: packageInput.concepts.map((concept) => concept.key),
      edgeKeys: packageInput.edges.map((edge) => edge.key),
    });
    validateSwSecurityWeaknessConceptCanonicalizationPackage(readBack);
    assertServerOwnedPackageReadback(readBack, packageInput);
    await transaction.recordRegistrationAudit({
      actorId: input.actorId,
      packageType: packageInput.packageType,
      scopeReviewId: SW_SECURITY_WEAKNESS_CANONICALIZATION_SCOPE_REVIEW,
    });
    return Object.freeze({ status: "DRAFT_REGISTERED_IN_TRANSACTION" as const, package: readBack });
  });
}

export function assertSwSecurityWeaknessReviewerSeparation(input: {
  registrationActorId: string;
  reviewerActorId: string;
  reviewerRoles: readonly string[];
}) {
  if (!input.registrationActorId.trim() || !input.reviewerActorId.trim()) {
    throw new SwCanonicalizationError("SW_CANONICAL_REVIEW_ACTOR_REQUIRED", "Registration and review actors are required.");
  }
  if (input.registrationActorId === input.reviewerActorId) {
    throw new SwCanonicalizationError("SW_CANONICAL_SELF_APPROVAL_FORBIDDEN", "The registration actor cannot activate the same package.");
  }
  if (!input.reviewerRoles.some((role) => ["CONTENT_REVIEWER", "COURSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role))) {
    throw new SwCanonicalizationError("SW_CANONICAL_REVIEW_ROLE_REQUIRED", "An authorized ontology reviewer role is required.");
  }
}

export function isSwCanonicalizationRuntimeVisible(status: SwCanonicalizationStatus) {
  return status === "ACTIVE";
}
