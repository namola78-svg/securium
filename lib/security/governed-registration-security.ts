import { requireStableReference } from "../assessment/assessment-objective.ts";
import { canonicalJson } from "../policy/canonical-json.ts";
import { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";

export const GOVERNED_REGISTRATION_PLAN_CANONICALIZATION_V1 = 1 as const;
export const GOVERNED_REGISTRATION_PLAN_HASH_DOMAIN_V1 =
  "SECURIUM_GOVERNED_REGISTRATION_PLAN_V1" as const;
export const GOVERNED_REGISTRATION_CAPABILITY_HASH_DOMAIN_V1 =
  "SECURIUM_GOVERNED_REGISTRATION_CAPABILITY_TOKEN_V1" as const;
export const GOVERNED_REGISTRATION_OPERATION =
  "PRACTICAL_REGISTRATION" as const;

const HASH = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43,512}$/;
const ENUM = /^[A-Z][A-Z0-9_]{0,79}$/;
const VALIDATED_PLAN_BRAND: unique symbol = Symbol("securium.validated-governed-registration-plan");
const VALIDATED_PLAN_OBJECTS = new WeakSet<object>();

export const GOVERNED_REGISTRATION_CAPABILITY_STATES = [
  "ISSUED",
  "CONSUMED",
  "REVOKED",
  "EXPIRED",
  "INVALID",
  "FAILED",
] as const;
export type GovernedRegistrationCapabilityState =
  (typeof GOVERNED_REGISTRATION_CAPABILITY_STATES)[number];

export type GovernedRegistrationPlanConceptBinding = Readonly<{
  canonicalConceptId: string;
  mappingSemanticHash: string;
}>;

export type GovernedRegistrationPlanItem = Readonly<{
  practicalId: string;
  practicalVersionId: string;
  semanticHash: string;
  governanceHash: string;
  governanceDecisionId: string;
  canonicalConceptBindings: readonly GovernedRegistrationPlanConceptBinding[];
}>;

export type GovernedRegistrationGovernanceReference = Readonly<{
  authorityId: string;
  decisionId: string;
  decisionHash: string;
  currentnessKey: string;
}>;

export type GovernedRegistrationExpectedMutation = Readonly<{
  authorityKey: string;
  operation: "INSERT";
  stableIdentity: string;
}>;

export type GovernedRegistrationPlanInput = Readonly<{
  canonicalizationVersion: typeof GOVERNED_REGISTRATION_PLAN_CANONICALIZATION_V1;
  operation: string;
  environment: string;
  courseId: string;
  items: readonly GovernedRegistrationPlanItem[];
  governanceReferences: readonly GovernedRegistrationGovernanceReference[];
  actorId: string;
  auditId: string;
  expectedMutations: readonly GovernedRegistrationExpectedMutation[];
  idempotencyKey: string;
}>;

export type GovernedRegistrationPlan = Readonly<GovernedRegistrationPlanInput & {
  planId: string;
  planHash: string;
  canonicalPayloadJson: string;
  readonly [VALIDATED_PLAN_BRAND]: true;
}>;

export type GovernedRegistrationCapability = Readonly<{
  capabilityId: string;
  planId: string;
  planHash: string;
  capabilityDigest: string;
  issuedToPrincipal: string;
  issuedByActorId: string;
  issuedByAuditId: string;
  issuedAt: string;
  expiresAt: string | null;
  state: GovernedRegistrationCapabilityState;
  consumedAt: string | null;
  revokedAt: string | null;
  resultDigest: string | null;
}>;

export type GovernedRegistrationCapabilityTransition = Readonly<{
  from: GovernedRegistrationCapabilityState;
  to: GovernedRegistrationCapabilityState;
}>;

export type GovernedRegistrationReplayResult = Readonly<{
  outcome: "READ_ONLY_EXACT_REPLAY";
  planId: string;
  planHash: string;
  resultDigest: string;
}>;

export class GovernedRegistrationContractError extends TypeError {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "GovernedRegistrationContractError";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new GovernedRegistrationContractError(code);
}

function assertValidatedPlanAuthority(value: unknown): asserts value is GovernedRegistrationPlan {
  if (!value || typeof value !== "object" || !VALIDATED_PLAN_OBJECTS.has(value)) {
    fail("UNVALIDATED_PLAN_AUTHORITY");
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`UNKNOWN_${field.toUpperCase()}_FIELD`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(`MISSING_${field.toUpperCase()}_${key.toUpperCase()}`);
    }
  }
}

function normalizedText(value: unknown, field: string): string {
  if (typeof value !== "string") fail(`INVALID_${field.toUpperCase()}`);
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n");
  if (normalized.length === 0) fail(`INVALID_${field.toUpperCase()}`);
  return normalized;
}

function stableReference(value: unknown, field: string): string {
  const normalized = normalizedText(value, field);
  try {
    return requireStableReference(normalized, field);
  } catch {
    fail(`INVALID_${field.toUpperCase()}`);
  }
}

function enumValue(value: unknown, field: string): string {
  const normalized = normalizedText(value, field);
  if (!ENUM.test(normalized)) fail(`INVALID_${field.toUpperCase()}`);
  return normalized;
}

function digest(value: unknown, field: string): string {
  if (typeof value !== "string" || !HASH.test(value)) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function nonEmptyArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) fail(`INVALID_${field.toUpperCase()}`);
  return value;
}

function timestamp(value: unknown, field: string): string {
  const normalized = normalizedText(value, field);
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) fail(`INVALID_${field.toUpperCase()}`);
  return new Date(milliseconds).toISOString();
}

function nullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : timestamp(value, field);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeConceptBinding(value: unknown): GovernedRegistrationPlanConceptBinding {
  const input = record(value, "concept_binding");
  exactKeys(input, ["canonicalConceptId", "mappingSemanticHash"], "concept_binding");
  return Object.freeze({
    canonicalConceptId: stableReference(input.canonicalConceptId, "canonical_concept_id"),
    mappingSemanticHash: digest(input.mappingSemanticHash, "mapping_semantic_hash"),
  });
}

function normalizePlanItem(value: unknown): GovernedRegistrationPlanItem {
  const input = record(value, "plan_item");
  exactKeys(input, [
    "practicalId",
    "practicalVersionId",
    "semanticHash",
    "governanceHash",
    "governanceDecisionId",
    "canonicalConceptBindings",
  ], "plan_item");
  const conceptBindings = nonEmptyArray(input.canonicalConceptBindings, "canonical_concept_bindings")
    .map(normalizeConceptBinding)
    .sort((left, right) => compareStrings(left.canonicalConceptId, right.canonicalConceptId));
  if (new Set(conceptBindings.map((binding) => binding.canonicalConceptId)).size !== conceptBindings.length) {
    fail("DUPLICATE_PLAN_ITEM_CONCEPT");
  }
  return Object.freeze({
    practicalId: stableReference(input.practicalId, "practical_id"),
    practicalVersionId: stableReference(input.practicalVersionId, "practical_version_id"),
    semanticHash: digest(input.semanticHash, "semantic_hash"),
    governanceHash: digest(input.governanceHash, "governance_hash"),
    governanceDecisionId: stableReference(input.governanceDecisionId, "governance_decision_id"),
    canonicalConceptBindings: Object.freeze(conceptBindings),
  });
}

function normalizeGovernanceReference(value: unknown): GovernedRegistrationGovernanceReference {
  const input = record(value, "governance_reference");
  exactKeys(input, ["authorityId", "decisionId", "decisionHash", "currentnessKey"], "governance_reference");
  return Object.freeze({
    authorityId: stableReference(input.authorityId, "governance_authority_id"),
    decisionId: stableReference(input.decisionId, "governance_decision_id"),
    decisionHash: digest(input.decisionHash, "decision_hash"),
    currentnessKey: stableReference(input.currentnessKey, "governance_currentness_key"),
  });
}

function normalizeExpectedMutation(value: unknown): GovernedRegistrationExpectedMutation {
  const input = record(value, "expected_mutation");
  exactKeys(input, ["authorityKey", "operation", "stableIdentity"], "expected_mutation");
  if (input.operation !== "INSERT") fail("INVALID_EXPECTED_MUTATION_OPERATION");
  return Object.freeze({
    authorityKey: stableReference(input.authorityKey, "authority_key"),
    operation: "INSERT",
    stableIdentity: stableReference(input.stableIdentity, "stable_identity"),
  });
}

function normalizePlanInput(value: unknown): GovernedRegistrationPlanInput {
  const input = record(value, "registration_plan");
  exactKeys(input, [
    "canonicalizationVersion",
    "operation",
    "environment",
    "courseId",
    "items",
    "governanceReferences",
    "actorId",
    "auditId",
    "expectedMutations",
    "idempotencyKey",
  ], "registration_plan");
  if (input.canonicalizationVersion !== GOVERNED_REGISTRATION_PLAN_CANONICALIZATION_V1) {
    fail("UNSUPPORTED_PLAN_CANONICALIZATION_VERSION");
  }
  const items = nonEmptyArray(input.items, "plan_items")
    .map(normalizePlanItem)
    .sort((left, right) => compareStrings(left.practicalId, right.practicalId) || compareStrings(left.practicalVersionId, right.practicalVersionId));
  if (new Set(items.map((item) => item.practicalId)).size !== items.length) {
    fail("DUPLICATE_PLAN_ITEM_PRACTICAL");
  }
  const governanceReferences = nonEmptyArray(input.governanceReferences, "governance_references")
    .map(normalizeGovernanceReference)
    .sort((left, right) => compareStrings(left.decisionId, right.decisionId));
  if (new Set(governanceReferences.map((reference) => reference.decisionId)).size !== governanceReferences.length) {
    fail("DUPLICATE_GOVERNANCE_REFERENCE");
  }
  const governanceDecisionIds = new Set(governanceReferences.map((reference) => reference.decisionId));
  if (items.some((item) => !governanceDecisionIds.has(item.governanceDecisionId))) {
    fail("PLAN_ITEM_GOVERNANCE_REFERENCE_MISSING");
  }
  const expectedMutations = nonEmptyArray(input.expectedMutations, "expected_mutations")
    .map(normalizeExpectedMutation)
    .sort((left, right) => compareStrings(left.authorityKey, right.authorityKey) || compareStrings(left.stableIdentity, right.stableIdentity));
  const mutationKeys = expectedMutations.map((mutation) => `${mutation.authorityKey}\u0000${mutation.operation}\u0000${mutation.stableIdentity}`);
  if (new Set(mutationKeys).size !== mutationKeys.length) fail("DUPLICATE_EXPECTED_MUTATION");
  return Object.freeze({
    canonicalizationVersion: GOVERNED_REGISTRATION_PLAN_CANONICALIZATION_V1,
    operation: enumValue(input.operation, "operation"),
    environment: enumValue(input.environment, "environment"),
    courseId: stableReference(input.courseId, "course_id"),
    items: Object.freeze(items),
    governanceReferences: Object.freeze(governanceReferences),
    actorId: stableReference(input.actorId, "actor_id"),
    auditId: stableReference(input.auditId, "audit_id"),
    expectedMutations: Object.freeze(expectedMutations),
    idempotencyKey: stableReference(input.idempotencyKey, "idempotency_key"),
  });
}

function planEnvelope(plan: GovernedRegistrationPlanInput): Readonly<Record<string, unknown>> {
  return Object.freeze({
    hashDomain: GOVERNED_REGISTRATION_PLAN_HASH_DOMAIN_V1,
    canonicalizationVersion: GOVERNED_REGISTRATION_PLAN_CANONICALIZATION_V1,
    plan,
  });
}

export function canonicalizeGovernedRegistrationPlan(
  input: GovernedRegistrationPlanInput,
): GovernedRegistrationPlanInput {
  return normalizePlanInput(input);
}

export function serializeGovernedRegistrationPlan(
  input: GovernedRegistrationPlanInput,
): string {
  return stableCanonicalJson(planEnvelope(normalizePlanInput(input)));
}

export async function deriveGovernedRegistrationPlanHash(
  input: GovernedRegistrationPlanInput,
): Promise<string> {
  return sha256Canonical(planEnvelope(normalizePlanInput(input)));
}

export async function createGovernedRegistrationPlan(
  input: GovernedRegistrationPlanInput,
): Promise<GovernedRegistrationPlan> {
  const normalized = normalizePlanInput(input);
  const canonicalPayloadJson = stableCanonicalJson(planEnvelope(normalized));
  const planHash = await sha256Canonical(planEnvelope(normalized));
  const plan = Object.freeze({
    ...normalized,
    planId: `governed-registration-plan:${planHash}`,
    planHash,
    canonicalPayloadJson,
    [VALIDATED_PLAN_BRAND]: true as const,
  });
  VALIDATED_PLAN_OBJECTS.add(plan);
  return plan;
}

export async function assertGovernedRegistrationPlanIntegrity(
  plan: GovernedRegistrationPlan,
): Promise<void> {
  assertValidatedPlanAuthority(plan);
  const {
    planId: _planId,
    planHash: _planHash,
    canonicalPayloadJson: _canonicalPayloadJson,
    ...input
  } = plan;
  const normalized = normalizePlanInput(input);
  const expectedHash = await sha256Canonical(planEnvelope(normalized));
  if (plan.planHash !== expectedHash) fail("PLAN_HASH_MISMATCH");
  if (plan.planId !== `governed-registration-plan:${expectedHash}`) fail("PLAN_ID_HASH_MISMATCH");
  if (plan.canonicalPayloadJson !== stableCanonicalJson(planEnvelope(normalized))) {
    fail("PLAN_CANONICAL_PAYLOAD_MISMATCH");
  }
}

export type CapabilityToken = string & { readonly __capabilityToken: unique symbol };

export function assertCapabilityToken(value: unknown): CapabilityToken {
  if (typeof value !== "string" || !TOKEN.test(value)) fail("INVALID_CAPABILITY_TOKEN");
  return value as CapabilityToken;
}

export async function deriveGovernedRegistrationCapabilityDigest(
  token: CapabilityToken,
): Promise<string> {
  assertCapabilityToken(token);
  return sha256Canonical({
    hashDomain: GOVERNED_REGISTRATION_CAPABILITY_HASH_DOMAIN_V1,
    token,
  });
}

function validateCapabilityState(value: unknown): GovernedRegistrationCapabilityState {
  if (!GOVERNED_REGISTRATION_CAPABILITY_STATES.includes(value as GovernedRegistrationCapabilityState)) {
    fail("INVALID_CAPABILITY_STATE");
  }
  return value as GovernedRegistrationCapabilityState;
}

export function createGovernedRegistrationCapability(input: Readonly<{
  capabilityId: string;
  plan: GovernedRegistrationPlan;
  capabilityDigest: string;
  issuedToPrincipal: string;
  issuedByActorId: string;
  issuedByAuditId: string;
  issuedAt: string;
  expiresAt: string | null;
}>): GovernedRegistrationCapability {
  assertValidatedPlanAuthority(input.plan);
  const issuedAt = timestamp(input.issuedAt, "issued_at");
  const expiresAt = nullableTimestamp(input.expiresAt, "expires_at");
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(issuedAt)) fail("CAPABILITY_EXPIRY_NOT_AFTER_ISSUANCE");
  digest(input.capabilityDigest, "capability_digest");
  const capabilityId = stableReference(input.capabilityId, "capability_id");
  const issuedToPrincipal = stableReference(input.issuedToPrincipal, "issued_to_principal");
  const issuedByActorId = stableReference(input.issuedByActorId, "issued_by_actor_id");
  const issuedByAuditId = stableReference(input.issuedByAuditId, "issued_by_audit_id");
  if (!input.plan.planId || !HASH.test(input.plan.planHash)) fail("CAPABILITY_PLAN_REQUIRED");
  return Object.freeze({
    capabilityId,
    planId: input.plan.planId,
    planHash: input.plan.planHash,
    capabilityDigest: input.capabilityDigest,
    issuedToPrincipal,
    issuedByActorId,
    issuedByAuditId,
    issuedAt,
    expiresAt,
    state: "ISSUED",
    consumedAt: null,
    revokedAt: null,
    resultDigest: null,
  });
}

export function validateGovernedRegistrationCapability(
  capability: GovernedRegistrationCapability,
): GovernedRegistrationCapability {
  const input = record(capability, "capability");
  exactKeys(input, [
    "capabilityId",
    "planId",
    "planHash",
    "capabilityDigest",
    "issuedToPrincipal",
    "issuedByActorId",
    "issuedByAuditId",
    "issuedAt",
    "expiresAt",
    "state",
    "consumedAt",
    "revokedAt",
    "resultDigest",
  ], "capability");
  const capabilityId = stableReference(input.capabilityId, "capability_id");
  const planId = stableReference(input.planId, "plan_id");
  const planHash = digest(input.planHash, "plan_hash");
  const capabilityDigest = digest(input.capabilityDigest, "capability_digest");
  const issuedToPrincipal = stableReference(input.issuedToPrincipal, "issued_to_principal");
  const issuedByActorId = stableReference(input.issuedByActorId, "issued_by_actor_id");
  const issuedByAuditId = stableReference(input.issuedByAuditId, "issued_by_audit_id");
  const issuedAt = timestamp(input.issuedAt, "issued_at");
  const expiresAt = nullableTimestamp(input.expiresAt, "expires_at");
  const consumedAt = nullableTimestamp(input.consumedAt, "consumed_at");
  const revokedAt = nullableTimestamp(input.revokedAt, "revoked_at");
  const state = validateCapabilityState(input.state);
  const resultDigest = input.resultDigest === null ? null : digest(input.resultDigest, "result_digest");
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(issuedAt)) fail("CAPABILITY_EXPIRY_NOT_AFTER_ISSUANCE");
  if (state === "ISSUED" && (consumedAt || revokedAt || resultDigest)) fail("INVALID_ISSUED_CAPABILITY_STATE");
  if (state === "CONSUMED" && (!consumedAt || !resultDigest || revokedAt)) fail("INVALID_CONSUMED_CAPABILITY_STATE");
  if (state === "REVOKED" && (!revokedAt || consumedAt || resultDigest)) fail("INVALID_REVOKED_CAPABILITY_STATE");
  if (state === "EXPIRED" && (consumedAt || revokedAt || resultDigest)) fail("INVALID_EXPIRED_CAPABILITY_STATE");
  if ((state === "INVALID" || state === "FAILED") && (consumedAt || revokedAt || resultDigest)) fail("INVALID_TERMINAL_CAPABILITY_STATE");
  return Object.freeze({ capabilityId, planId, planHash, capabilityDigest, issuedToPrincipal, issuedByActorId, issuedByAuditId, issuedAt, expiresAt, state, consumedAt, revokedAt, resultDigest });
}

export function assertCapabilityPlanBinding(
  capability: GovernedRegistrationCapability,
  plan: GovernedRegistrationPlan,
): void {
  assertValidatedPlanAuthority(plan);
  if (capability.planId !== plan.planId || capability.planHash !== plan.planHash) {
    fail("CAPABILITY_PLAN_BINDING_MISMATCH");
  }
}

export function transitionGovernedRegistrationCapability(
  capability: GovernedRegistrationCapability,
  transition: GovernedRegistrationCapabilityTransition,
  at: string,
  resultDigest: string | null = null,
): GovernedRegistrationCapability {
  const current = validateGovernedRegistrationCapability(capability);
  if (current.state !== transition.from) fail("CAPABILITY_STATE_SOURCE_MISMATCH");
  if (current.state !== "ISSUED") fail("CAPABILITY_TERMINAL_STATE");
  const transitionAt = timestamp(at, "transition_at");
  if (Date.parse(transitionAt) < Date.parse(current.issuedAt)) fail("CAPABILITY_TRANSITION_BEFORE_ISSUANCE");
  if (!["CONSUMED", "REVOKED", "EXPIRED"].includes(transition.to)) fail("INVALID_CAPABILITY_TRANSITION");
  if (transition.to === "EXPIRED" && (!current.expiresAt || Date.parse(transitionAt) < Date.parse(current.expiresAt))) {
    fail("CAPABILITY_NOT_EXPIRED");
  }
  if (transition.to === "CONSUMED") {
    if (!resultDigest) fail("CONSUMED_RESULT_REQUIRED");
    digest(resultDigest, "result_digest");
    return Object.freeze({ ...current, state: "CONSUMED", consumedAt: transitionAt, resultDigest });
  }
  if (resultDigest !== null) fail("UNEXPECTED_CAPABILITY_RESULT");
  if (transition.to === "REVOKED") return Object.freeze({ ...current, state: "REVOKED", revokedAt: transitionAt });
  return Object.freeze({ ...current, state: "EXPIRED" });
}

export function assertReadOnlyExactReplay(
  capability: GovernedRegistrationCapability,
  plan: GovernedRegistrationPlan,
): GovernedRegistrationReplayResult {
  const current = validateGovernedRegistrationCapability(capability);
  assertCapabilityPlanBinding(current, plan);
  if (current.state !== "CONSUMED" || !current.resultDigest) fail("EXACT_REPLAY_NOT_AVAILABLE");
  return Object.freeze({
    outcome: "READ_ONLY_EXACT_REPLAY",
    planId: plan.planId,
    planHash: plan.planHash,
    resultDigest: current.resultDigest,
  });
}

export function serializeGovernedRegistrationCapability(
  capability: GovernedRegistrationCapability,
): string {
  const validated = validateGovernedRegistrationCapability(capability);
  return canonicalJson({
    capabilityId: validated.capabilityId,
    planId: validated.planId,
    planHash: validated.planHash,
    capabilityDigest: validated.capabilityDigest,
    issuedToPrincipal: validated.issuedToPrincipal,
    issuedByActorId: validated.issuedByActorId,
    issuedByAuditId: validated.issuedByAuditId,
    issuedAt: validated.issuedAt,
    expiresAt: validated.expiresAt,
    state: validated.state,
    consumedAt: validated.consumedAt,
    revokedAt: validated.revokedAt,
    resultDigest: validated.resultDigest,
  });
}
