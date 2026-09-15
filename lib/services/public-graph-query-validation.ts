import {
  SKILL_GRAPH_LIMITS,
  type ConceptGraphReference,
  type RoleGraphReference,
  type SkillGraphDepth,
  type SkillGraphQueryInput,
  type SkillGraphQueryType,
  type SkillGraphReference,
} from "./skill-graph-query.ts";

export const PUBLIC_GRAPH_QUERY_TYPES = Object.freeze([
  "ROLE_SKILLS",
  "ROLE_GRAPH",
  "SKILL_ROLES",
  "SKILL_CONCEPTS",
  "SKILL_GRAPH",
  "CONCEPT_SKILLS",
  "CONCEPT_GRAPH",
] as const);

export const PUBLIC_GRAPH_QUERY_LIMITS = Object.freeze({
  defaultLimit: SKILL_GRAPH_LIMITS.perHopDefault,
  maxDepth: 2,
  maxLimit: SKILL_GRAPH_LIMITS.perHopHardMax,
  maxCursorLength: 4096,
} as const);

const PUBLIC_GRAPH_QUERY_FIELDS = ["queryType", "root", "depth", "limit", "cursor"] as const;
const PUBLIC_GRAPH_ROOT_FIELDS = ["type", "reference"] as const;
const PUBLIC_GRAPH_REFERENCE_FIELDS = {
  ROLE: ["id", "roleKey", "alias"],
  SKILL: ["id", "skillKey", "alias"],
  CONCEPT: ["id", "key", "stableKey", "alias"],
} as const;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/u;

const ERROR_CODE_ORDER = [
  "INVALID_QUERY_OBJECT",
  "UNKNOWN_FIELD",
  "INVALID_QUERY_TYPE",
  "INVALID_ROOT",
  "INVALID_IDENTITY",
  "INVALID_DEPTH",
  "DEPTH_LIMIT_EXCEEDED",
  "INVALID_LIMIT",
  "LIMIT_EXCEEDED",
  "INVALID_CURSOR",
  "CURSOR_NOT_SUPPORTED",
] as const;

export type PublicGraphQueryValidationCode = (typeof ERROR_CODE_ORDER)[number];

export type PublicGraphQueryValidationResult =
  | { readonly ok: true; readonly query: PublicGraphQuery }
  | { readonly ok: false; readonly errorCodes: readonly PublicGraphQueryValidationCode[] };

export type PublicGraphQuery = {
  readonly queryType: SkillGraphQueryType;
  readonly root: SkillGraphQueryInput["root"];
  readonly depth: SkillGraphDepth;
  readonly limit: number;
  readonly cursor?: string;
};

type PublicGraphNodeType = SkillGraphQueryInput["root"]["type"];

type QueryContract = {
  readonly rootType: PublicGraphNodeType;
  readonly depth: SkillGraphDepth;
  readonly paged: boolean;
};

const QUERY_CONTRACTS: Readonly<Record<SkillGraphQueryType, QueryContract>> = Object.freeze({
  ROLE_SKILLS: { rootType: "ROLE", depth: 1, paged: true },
  ROLE_GRAPH: { rootType: "ROLE", depth: 2, paged: false },
  SKILL_ROLES: { rootType: "SKILL", depth: 1, paged: true },
  SKILL_CONCEPTS: { rootType: "SKILL", depth: 1, paged: true },
  SKILL_GRAPH: { rootType: "SKILL", depth: 1, paged: false },
  CONCEPT_SKILLS: { rootType: "CONCEPT", depth: 1, paged: true },
  CONCEPT_GRAPH: { rootType: "CONCEPT", depth: 2, paged: false },
});

type MutableRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: MutableRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasOnlyAllowedFields(value: MutableRecord, allowed: readonly string[], addIssue: () => void) {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.includes(key)) addIssue();
  }
}

function isQueryType(value: unknown): value is SkillGraphQueryType {
  return typeof value === "string" && (PUBLIC_GRAPH_QUERY_TYPES as readonly string[]).includes(value);
}

function isNodeType(value: unknown): value is PublicGraphNodeType {
  return value === "ROLE" || value === "SKILL" || value === "CONCEPT";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function rootForQuery(queryType: SkillGraphQueryType): PublicGraphNodeType {
  return QUERY_CONTRACTS[queryType].rootType;
}

function readReference(
  value: unknown,
  nodeType: PublicGraphNodeType,
  addUnknownField: () => void,
  addInvalidIdentity: () => void,
): MutableRecord | null {
  if (!isPlainObject(value)) {
    addInvalidIdentity();
    return null;
  }

  let valid = true;
  const addUnknown = () => {
    valid = false;
    addUnknownField();
  };
  const addInvalid = () => {
    valid = false;
    addInvalidIdentity();
  };
  const allowedFields = PUBLIC_GRAPH_REFERENCE_FIELDS[nodeType];
  hasOnlyAllowedFields(value, allowedFields, addUnknown);

  const reference: MutableRecord = {};
  for (const field of allowedFields) {
    if (!hasOwn(value, field)) continue;
    if (!isNonEmptyString(value[field])) {
      addInvalid();
      continue;
    }
    reference[field] = value[field];
  }

  if (Object.keys(reference).length === 0) addInvalid();
  return valid ? reference : null;
}

function readRoot(
  value: unknown,
  expectedType: PublicGraphNodeType,
  addUnknownField: () => void,
  addInvalidRoot: () => void,
  addInvalidIdentity: () => void,
  addInvalidIdentityUnknownField: () => void,
): PublicGraphQuery["root"] | null {
  if (!isPlainObject(value)) {
    addInvalidRoot();
    return null;
  }

  let valid = true;
  const addRootIssue = () => {
    valid = false;
    addInvalidRoot();
  };
  hasOnlyAllowedFields(value, PUBLIC_GRAPH_ROOT_FIELDS, () => {
    valid = false;
    addUnknownField();
  });

  const actualType = isNodeType(value.type) ? value.type : expectedType;
  if (!hasOwn(value, "type") || !isNodeType(value.type) || value.type !== expectedType) addRootIssue();
  if (!hasOwn(value, "reference")) addRootIssue();

  const reference = readReference(value.reference, actualType, addInvalidIdentityUnknownField, addInvalidIdentity);
  if (!reference || !valid) return null;

  if (actualType === "ROLE") {
    return {
      type: "ROLE",
      reference: reference as RoleGraphReference,
    };
  }
  if (actualType === "SKILL") {
    return {
      type: "SKILL",
      reference: reference as SkillGraphReference,
    };
  }
  return {
    type: "CONCEPT",
    reference: reference as ConceptGraphReference,
  };
}

function readDepth(value: unknown, contract: QueryContract, addIssue: (code: PublicGraphQueryValidationCode) => void): SkillGraphDepth {
  if (value === undefined) return contract.depth;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
    addIssue("INVALID_DEPTH");
    return contract.depth;
  }
  if (value > PUBLIC_GRAPH_QUERY_LIMITS.maxDepth) {
    addIssue("DEPTH_LIMIT_EXCEEDED");
    return contract.depth;
  }
  if (value !== contract.depth) addIssue("INVALID_DEPTH");
  return value as SkillGraphDepth;
}

function readLimit(value: unknown, addIssue: (code: PublicGraphQueryValidationCode) => void): number {
  if (value === undefined) return PUBLIC_GRAPH_QUERY_LIMITS.defaultLimit;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
    addIssue("INVALID_LIMIT");
    return PUBLIC_GRAPH_QUERY_LIMITS.defaultLimit;
  }
  if (value > PUBLIC_GRAPH_QUERY_LIMITS.maxLimit) {
    addIssue("LIMIT_EXCEEDED");
    return PUBLIC_GRAPH_QUERY_LIMITS.defaultLimit;
  }
  return value;
}

function readCursor(
  value: unknown,
  contract: QueryContract,
  addIssue: (code: PublicGraphQueryValidationCode) => void,
): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string"
    || !value.trim()
    || value.length > PUBLIC_GRAPH_QUERY_LIMITS.maxCursorLength
    || value.length % 4 === 1
    || !CURSOR_PATTERN.test(value)
  ) {
    addIssue("INVALID_CURSOR");
    return undefined;
  }
  if (!contract.paged) addIssue("CURSOR_NOT_SUPPORTED");
  return value;
}

function freezeRoot(root: PublicGraphQuery["root"]): PublicGraphQuery["root"] {
  Object.freeze(root.reference);
  return Object.freeze(root);
}

export function validatePublicGraphQuery(input: unknown): PublicGraphQueryValidationResult {
  const issues = new Set<PublicGraphQueryValidationCode>();
  const addIssue = (code: PublicGraphQueryValidationCode) => issues.add(code);

  if (!isPlainObject(input)) return { ok: false, errorCodes: ["INVALID_QUERY_OBJECT"] };

  hasOnlyAllowedFields(input, PUBLIC_GRAPH_QUERY_FIELDS, () => addIssue("UNKNOWN_FIELD"));

  if (!isQueryType(input.queryType)) {
    addIssue("INVALID_QUERY_TYPE");
    return { ok: false, errorCodes: ERROR_CODE_ORDER.filter((code) => issues.has(code)) };
  }

  const contract = QUERY_CONTRACTS[input.queryType];
  const root = readRoot(
    input.root,
    rootForQuery(input.queryType),
    () => addIssue("UNKNOWN_FIELD"),
    () => addIssue("INVALID_ROOT"),
    () => addIssue("INVALID_IDENTITY"),
    () => addIssue("UNKNOWN_FIELD"),
  );
  const depth = readDepth(input.depth, contract, addIssue);
  const limit = readLimit(input.limit, addIssue);
  const cursor = readCursor(input.cursor, contract, addIssue);

  if (issues.size > 0 || !root) {
    return { ok: false, errorCodes: ERROR_CODE_ORDER.filter((code) => issues.has(code)) };
  }

  const query: PublicGraphQuery = Object.freeze({
    queryType: input.queryType,
    root: freezeRoot(root),
    depth,
    limit,
    ...(cursor === undefined ? {} : { cursor }),
  });
  return { ok: true, query };
}
