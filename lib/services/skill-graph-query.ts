import { AppError } from "../errors.ts";

export type SkillGraphLimits = {
  readonly perHopDefault: number;
  readonly perHopHardMax: number;
  readonly totalNodeHardMax: number;
  readonly totalEdgeHardMax: number;
  readonly exactAliasCandidateHardMax: number;
};

export const SKILL_GRAPH_LIMITS: SkillGraphLimits = Object.freeze({
  perHopDefault: 200,
  perHopHardMax: 500,
  totalNodeHardMax: 1000,
  totalEdgeHardMax: 2000,
  exactAliasCandidateHardMax: 20,
} as const);

export type SkillGraphNodeType = "ROLE" | "SKILL" | "CONCEPT";
export type SkillGraphEdgeType = "ROLE_REQUIRES_SKILL" | "SKILL_REQUIRES_CONCEPT";
export type SkillGraphDepth = 1 | 2;

export const SKILL_GRAPH_EDGE_TYPES = Object.freeze([
  "ROLE_REQUIRES_SKILL",
  "SKILL_REQUIRES_CONCEPT",
] as const);
export const SKILL_GRAPH_ORDER_VERSION = "skill-graph.order.v1";
export const SKILL_GRAPH_CURSOR_VERSION = "skill-graph.cursor.v1";
const SKILL_GRAPH_MAX_CURSOR_LENGTH = 4096;

export function isSkillGraphEdgeType(value: unknown): value is SkillGraphEdgeType {
  return typeof value === "string" && (SKILL_GRAPH_EDGE_TYPES as readonly string[]).includes(value);
}

/** Provider-independent UTF-16 code-unit ordering; identity normalization is intentionally separate. */
export function compareSkillGraphStrings(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function compareSkillGraphCursorPositions(left: SkillGraphCursorPosition, right: SkillGraphCursorPosition) {
  return compareSkillGraphStrings(left.canonicalKey, right.canonicalKey)
    || compareSkillGraphStrings(left.stableId, right.stableId);
}

export type RoleGraphReference = {
  id?: string;
  roleKey?: string;
  alias?: string;
};

export type SkillGraphReference = {
  id?: string;
  skillKey?: string;
  alias?: string;
};

export type ConceptGraphReference = {
  id?: string;
  key?: string;
  stableKey?: string;
  alias?: string;
};

export type SkillGraphQueryType =
  | "ROLE_SKILLS"
  | "SKILL_ROLES"
  | "SKILL_CONCEPTS"
  | "CONCEPT_SKILLS"
  | "ROLE_GRAPH"
  | "SKILL_GRAPH"
  | "CONCEPT_GRAPH";

export type SkillGraphQueryInput = {
  queryType: SkillGraphQueryType;
  root:
    | { type: "ROLE"; reference: RoleGraphReference }
    | { type: "SKILL"; reference: SkillGraphReference }
    | { type: "CONCEPT"; reference: ConceptGraphReference };
  depth?: number;
  limit?: number;
  cursor?: string;
};

export type SkillGraphProvenance = {
  sourceType: string;
};

export type SkillGraphNode =
  | {
      type: "ROLE";
      id: string;
      roleKey: string;
      label: string;
      aliases: string[];
      provenance?: SkillGraphProvenance;
    }
  | {
      type: "SKILL";
      id: string;
      skillKey: string;
      label: string;
      aliases: string[];
      provenance?: SkillGraphProvenance;
    }
  | {
      type: "CONCEPT";
      id: string;
      conceptKey: string;
      label: string;
      aliases: string[];
      provenance?: SkillGraphProvenance;
    };

export type SkillGraphNodeReference = {
  type: SkillGraphNodeType;
  id: string;
};

export type SkillGraphEdge = {
  id: string;
  type: SkillGraphEdgeType;
  source: SkillGraphNodeReference;
  target: SkillGraphNodeReference;
  relationVersion: number;
  provenance?: SkillGraphProvenance;
};

export type SkillGraphPage = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type SkillGraphQueryResult = {
  schemaVersion: "skill-graph.v1";
  queryType: SkillGraphQueryType;
  depth: SkillGraphDepth;
  root: SkillGraphNodeReference;
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  page?: SkillGraphPage;
};

export type SkillGraphCursorPosition = {
  canonicalKey: string;
  stableId: string;
};

export type SkillGraphRepositoryNode = {
  type: SkillGraphNodeType;
  id: string;
  canonicalKey: string;
  label: string;
  aliases: string[];
  sourceType?: string;
};

export type SkillGraphRepositoryEdge = {
  id: string;
  type: SkillGraphEdgeType;
  source: SkillGraphNodeReference;
  target: SkillGraphNodeReference;
  relationVersion: number;
  sourceType?: string;
};

export type SkillGraphHop = {
  edge: SkillGraphRepositoryEdge;
  target?: SkillGraphRepositoryNode;
};

export type SkillGraphHopPage = {
  hops: SkillGraphHop[];
  hasMore: boolean;
  last?: SkillGraphCursorPosition;
  overflow: boolean;
  hardOverflow?: boolean;
};

export type SkillGraphResolution =
  | { kind: "RESOLVED"; node: SkillGraphRepositoryNode }
  | { kind: "NOT_FOUND" }
  | { kind: "IDENTITY_CONFLICT"; candidateIds?: string[] }
  | { kind: "AMBIGUOUS_ALIAS"; candidateIds?: string[] }
  | { kind: "INTERNAL_ERROR" };

export type SkillGraphHopReadInput = {
  sourceIds: readonly string[];
  limit: number;
  after?: SkillGraphCursorPosition;
};

export type SkillGraphRepository = {
  resolveRole(reference: RoleGraphReference): Promise<SkillGraphResolution>;
  resolveSkill(reference: SkillGraphReference): Promise<SkillGraphResolution>;
  resolveConcept(reference: ConceptGraphReference): Promise<SkillGraphResolution>;
  readRoleToSkills(input: SkillGraphHopReadInput): Promise<SkillGraphHopPage>;
  readSkillToRoles(input: SkillGraphHopReadInput): Promise<SkillGraphHopPage>;
  readSkillToConcepts(input: SkillGraphHopReadInput): Promise<SkillGraphHopPage>;
  readConceptToSkills(input: SkillGraphHopReadInput): Promise<SkillGraphHopPage>;
};

export type SkillGraphQueryOptions = {
  limit?: number;
  cursor?: string;
};

export type SkillGraphQueryService = {
  querySkillGraph(input: SkillGraphQueryInput): Promise<SkillGraphQueryResult>;
  getRoleSkills(reference: RoleGraphReference, options?: SkillGraphQueryOptions): Promise<SkillGraphQueryResult>;
  getSkillRoles(reference: SkillGraphReference, options?: SkillGraphQueryOptions): Promise<SkillGraphQueryResult>;
  getSkillConcepts(reference: SkillGraphReference, options?: SkillGraphQueryOptions): Promise<SkillGraphQueryResult>;
  getConceptSkills(reference: ConceptGraphReference, options?: SkillGraphQueryOptions): Promise<SkillGraphQueryResult>;
  getRoleGraph(reference: RoleGraphReference): Promise<SkillGraphQueryResult>;
  getSkillGraph(reference: SkillGraphReference, options?: Omit<SkillGraphQueryOptions, "cursor">): Promise<SkillGraphQueryResult>;
  getConceptGraph(reference: ConceptGraphReference): Promise<SkillGraphQueryResult>;
};

export type SkillGraphErrorCode =
  | "NOT_FOUND"
  | "IDENTITY_CONFLICT"
  | "AMBIGUOUS_ALIAS"
  | "INVALID_QUERY"
  | "DEPTH_LIMIT_EXCEEDED"
  | "FAN_OUT_LIMIT_EXCEEDED"
  | "AUTHORIZATION_DENIED"
  | "ORPHAN_RELATION"
  | "INTERNAL_ERROR";

export class SkillGraphError extends AppError {
  readonly code: SkillGraphErrorCode;

  constructor(code: SkillGraphErrorCode, message: string = code, status = defaultStatus(code)) {
    super(message, status, code);
    this.name = "SkillGraphError";
    this.code = code;
  }
}

export function createSkillGraphQueryService(
  repository: SkillGraphRepository,
  limits: SkillGraphLimits = SKILL_GRAPH_LIMITS,
): SkillGraphQueryService {
  async function querySkillGraph(input: SkillGraphQueryInput): Promise<SkillGraphQueryResult> {
    try {
      return await querySkillGraphUnchecked(input);
    } catch (error) {
      if (error instanceof SkillGraphError) throw error;
      throw new SkillGraphError("INTERNAL_ERROR", "Skill Graph query failed.", 500);
    }
  }

  async function querySkillGraphUnchecked(input: SkillGraphQueryInput): Promise<SkillGraphQueryResult> {
    const normalized = validateInput(input, limits);
    const root = await resolveRoot(repository, normalized.root, limits.exactAliasCandidateHardMax);
    const fingerprint = queryFingerprint(normalized.queryType, root.node, normalized.depth, normalized.limit);
    const after = normalized.cursor ? await decodeCursor(normalized.cursor, fingerprint) : undefined;

    if (normalized.depth === 1 && normalized.queryType !== "SKILL_GRAPH") {
      const page = await readDepthOne(repository, normalized.queryType, root.node.id, normalized.limit, after);
      if (page.hardOverflow) throw graphError("FAN_OUT_LIMIT_EXCEEDED", "Skill Graph fan-out exceeds the hard maximum.");
      if (page.hasMore && !page.last) throw graphError("INTERNAL_ERROR", "Skill Graph pagination state is incomplete.", 500);
      const nextCursor = page.hasMore && page.last ? await encodeCursor({ fingerprint, ...page.last }) : null;
      return await composeResult({
        queryType: normalized.queryType,
        depth: 1,
        root: root.node,
        hops: page.hops.map((hop) => ({ ...hop, edgeDepth: 1 })),
        page: {
          limit: normalized.limit,
          hasMore: page.hasMore,
          nextCursor,
        },
      }, limits);
    }

    if (normalized.queryType === "SKILL_GRAPH") {
      const [roles, concepts] = await Promise.all([
        repository.readSkillToRoles({ sourceIds: [root.node.id], limit: normalized.limit }),
        repository.readSkillToConcepts({ sourceIds: [root.node.id], limit: normalized.limit }),
      ]);
      assertComplete(roles, limits);
      assertComplete(concepts, limits);
      return await composeResult({
        queryType: normalized.queryType,
        depth: 1,
        root: root.node,
        hops: [
          ...roles.hops.map((hop) => ({ ...hop, edgeDepth: 1 })),
          ...concepts.hops.map((hop) => ({ ...hop, edgeDepth: 1 })),
        ],
      }, limits);
    }

    const first = await readFirstDepthTwoHop(repository, normalized.queryType, root.node.id, normalized.limit);
    assertComplete(first, limits);
    const second = await readSecondDepthTwoHop(repository, normalized.queryType, first.hops, normalized.limit);
    assertComplete(second, limits);

    return await composeResult({
      queryType: normalized.queryType,
      depth: 2,
      root: root.node,
      hops: [
        ...first.hops.map((hop) => ({ ...hop, edgeDepth: 1 })),
        ...second.hops.map((hop) => ({ ...hop, edgeDepth: 2 })),
      ],
    }, limits);
  }

  return Object.freeze({
    querySkillGraph,
    getRoleSkills: (reference, options = {}) => querySkillGraph({ queryType: "ROLE_SKILLS", root: { type: "ROLE", reference }, depth: 1, ...options }),
    getSkillRoles: (reference, options = {}) => querySkillGraph({ queryType: "SKILL_ROLES", root: { type: "SKILL", reference }, depth: 1, ...options }),
    getSkillConcepts: (reference, options = {}) => querySkillGraph({ queryType: "SKILL_CONCEPTS", root: { type: "SKILL", reference }, depth: 1, ...options }),
    getConceptSkills: (reference, options = {}) => querySkillGraph({ queryType: "CONCEPT_SKILLS", root: { type: "CONCEPT", reference }, depth: 1, ...options }),
    getRoleGraph: (reference) => querySkillGraph({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference }, depth: 2 }),
    getSkillGraph: (reference, options = {}) => querySkillGraph({ queryType: "SKILL_GRAPH", root: { type: "SKILL", reference }, depth: 1, ...options }),
    getConceptGraph: (reference) => querySkillGraph({ queryType: "CONCEPT_GRAPH", root: { type: "CONCEPT", reference }, depth: 2 }),
  });
}

export async function querySkillGraph(input: SkillGraphQueryInput) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).querySkillGraph(input);
}

export async function getRoleSkills(reference: RoleGraphReference, options?: SkillGraphQueryOptions) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getRoleSkills(reference, options);
}

export async function getSkillRoles(reference: SkillGraphReference, options?: SkillGraphQueryOptions) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getSkillRoles(reference, options);
}

export async function getSkillConcepts(reference: SkillGraphReference, options?: SkillGraphQueryOptions) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getSkillConcepts(reference, options);
}

export async function getConceptSkills(reference: ConceptGraphReference, options?: SkillGraphQueryOptions) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getConceptSkills(reference, options);
}

export async function getRoleGraph(reference: RoleGraphReference) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getRoleGraph(reference);
}

export async function getSkillGraph(reference: SkillGraphReference, options?: Omit<SkillGraphQueryOptions, "cursor">) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getSkillGraph(reference, options);
}

export async function getConceptGraph(reference: ConceptGraphReference) {
  const { createDatabaseSkillGraphRepository } = await import("../../db/skill-graph-query-repository.ts");
  return createSkillGraphQueryService(createDatabaseSkillGraphRepository()).getConceptGraph(reference);
}

function validateInput(input: SkillGraphQueryInput, limits: SkillGraphLimits) {
  if (!input || typeof input !== "object") throw graphError("INVALID_QUERY", "Skill Graph query is required.");
  const queryTypes: readonly SkillGraphQueryType[] = ["ROLE_SKILLS", "SKILL_ROLES", "SKILL_CONCEPTS", "CONCEPT_SKILLS", "ROLE_GRAPH", "SKILL_GRAPH", "CONCEPT_GRAPH"];
  if (!queryTypes.includes(input.queryType)) throw graphError("INVALID_QUERY", "Skill Graph query type is invalid.");
  const expectedRoot = rootTypeForQuery(input.queryType);
  if (!input.root || input.root.type !== expectedRoot) throw graphError("INVALID_QUERY", "Skill Graph root type does not match query type.");
  assertReference(input.root);
  const expectedDepth = input.queryType === "ROLE_GRAPH" || input.queryType === "CONCEPT_GRAPH" ? 2 : 1;
  const depth = input.depth ?? expectedDepth;
  if (!Number.isInteger(depth) || depth < 1) throw graphError("INVALID_QUERY", "Skill Graph depth must be a positive integer.");
  if (depth > 2) throw graphError("DEPTH_LIMIT_EXCEEDED", "Skill Graph depth cannot exceed 2.");
  if (depth !== expectedDepth) throw graphError("INVALID_QUERY", "Skill Graph query type has a fixed depth.");
  if (input.cursor !== undefined && (typeof input.cursor !== "string" || !input.cursor.trim())) throw graphError("INVALID_QUERY", "Skill Graph cursor must be a non-empty string.");
  if (typeof input.cursor === "string" && input.cursor.length > SKILL_GRAPH_MAX_CURSOR_LENGTH) throw graphError("INVALID_QUERY", "Skill Graph cursor is too large.");
  if (input.cursor && (depth !== 1 || input.queryType === "SKILL_GRAPH")) throw graphError("INVALID_QUERY", "Cursors are supported only for direct depth-1 queries.");
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1)) throw graphError("INVALID_QUERY", "Skill Graph limit must be a positive integer.");
  if (input.limit !== undefined && input.limit > limits.perHopHardMax) throw graphError("FAN_OUT_LIMIT_EXCEEDED", "Skill Graph limit exceeds the hard maximum.");
  return {
    queryType: input.queryType,
    root: input.root,
    depth: depth as SkillGraphDepth,
    limit: input.limit ?? limits.perHopDefault,
    cursor: input.cursor,
  };
}

function assertReference(root: SkillGraphQueryInput["root"]) {
  const allowed = root.type === "ROLE" ? ["id", "roleKey", "alias"] : root.type === "SKILL" ? ["id", "skillKey", "alias"] : ["id", "key", "stableKey", "alias"];
  if (!root.reference || typeof root.reference !== "object" || Array.isArray(root.reference)) throw graphError("INVALID_QUERY", "Canonical graph identity must be an object.");
  const reference = root.reference as Record<string, unknown>;
  for (const key of Object.keys(reference)) {
    if (!allowed.includes(key)) throw graphError("INVALID_QUERY", `Unsupported ${root.type} identity field.`);
    if (typeof reference[key] !== "string" || !reference[key].trim()) throw graphError("INVALID_QUERY", `${key} must be a non-empty string.`);
  }
  if (!Object.keys(reference).length) throw graphError("INVALID_QUERY", "At least one canonical identity is required.");
}

async function resolveRoot(repository: SkillGraphRepository, root: SkillGraphQueryInput["root"], exactAliasCandidateHardMax: number) {
  const resolution = root.type === "ROLE"
    ? await repository.resolveRole(root.reference)
    : root.type === "SKILL"
      ? await repository.resolveSkill(root.reference)
      : await repository.resolveConcept(root.reference);
  if (resolution.kind !== "RESOLVED" && "candidateIds" in resolution && resolution.candidateIds && resolution.candidateIds.length > exactAliasCandidateHardMax) {
    throw graphError(resolution.kind, "Canonical identity candidate set exceeds the hard maximum.");
  }
  if (resolution.kind !== "RESOLVED") throw graphError(resolution.kind, resolution.kind === "NOT_FOUND" ? "Canonical graph root was not found." : undefined);
  return resolution;
}

async function readDepthOne(repository: SkillGraphRepository, queryType: SkillGraphQueryType, rootId: string, limit: number, after?: SkillGraphCursorPosition) {
  const input = { sourceIds: [rootId], limit, after };
  switch (queryType) {
    case "ROLE_SKILLS": return repository.readRoleToSkills(input);
    case "SKILL_ROLES": return repository.readSkillToRoles(input);
    case "SKILL_CONCEPTS": return repository.readSkillToConcepts(input);
    case "CONCEPT_SKILLS": return repository.readConceptToSkills(input);
    default: throw graphError("INVALID_QUERY", "Query is not a direct depth-1 traversal.");
  }
}

async function readFirstDepthTwoHop(repository: SkillGraphRepository, queryType: SkillGraphQueryType, rootId: string, limit: number) {
  if (queryType === "ROLE_GRAPH") return repository.readRoleToSkills({ sourceIds: [rootId], limit });
  if (queryType === "CONCEPT_GRAPH") return repository.readConceptToSkills({ sourceIds: [rootId], limit });
  throw graphError("INVALID_QUERY", "Query is not a depth-2 traversal.");
}

async function readSecondDepthTwoHop(repository: SkillGraphRepository, queryType: SkillGraphQueryType, first: SkillGraphHop[], limit: number) {
  const sourceIds = [...new Set(first.map((hop) => hop.target?.id).filter((id): id is string => Boolean(id)))];
  if (queryType === "ROLE_GRAPH") return repository.readSkillToConcepts({ sourceIds, limit });
  if (queryType === "CONCEPT_GRAPH") return repository.readSkillToRoles({ sourceIds, limit });
  throw graphError("INVALID_QUERY", "Query is not a depth-2 traversal.");
}

function assertComplete(page: SkillGraphHopPage, limits: SkillGraphLimits) {
  if (page.hardOverflow || page.overflow || page.hops.length > limits.perHopHardMax) throw graphError("FAN_OUT_LIMIT_EXCEEDED", "Skill Graph fan-out exceeds the hard maximum.");
}

async function composeResult(input: {
  queryType: SkillGraphQueryType;
  depth: SkillGraphDepth;
  root: SkillGraphRepositoryNode;
  hops: Array<SkillGraphHop & { edgeDepth: number }>;
  page?: SkillGraphPage;
}, limits: SkillGraphLimits): Promise<SkillGraphQueryResult> {
  const nodes = new Map<string, { node: SkillGraphRepositoryNode; depth: number }>();
  const edges = new Map<string, { edge: SkillGraphEdge; depth: number }>();
  const logicalEdges = new Map<string, string>();
  const edgeIdentities = new Map<string, string>();
  const rootKey = nodeKey(input.root.type, input.root.id);
  nodes.set(rootKey, { node: input.root, depth: 0 });
  const visitedNodes = new Set<string>([rootKey]);
  const visitedEdges = new Set<string>();

  for (const hop of input.hops) {
    if (!hop.target) throw graphError("ORPHAN_RELATION", "A graph relation points to a missing canonical node.");
    assertEdgeContract(hop, input.queryType, hop.edgeDepth);
    const targetKey = nodeKey(hop.target.type, hop.target.id);
    if (targetKey === rootKey) continue;
    const canonicalOtherEndpoint = isReverseHop(input.queryType, hop.edge.type) ? hop.edge.target : hop.edge.source;
    if (!nodes.has(nodeKey(canonicalOtherEndpoint.type, canonicalOtherEndpoint.id))) {
      throw graphError("ORPHAN_RELATION", "A graph relation points outside the composed canonical topology.");
    }
    const edgeKey = `${hop.edge.type}:${hop.edge.id}`;
    const logicalKey = `${hop.edge.type}:${hop.edge.source.id}:${hop.edge.target.id}`;
    const existingEdgeLogical = edgeIdentities.get(edgeKey);
    if (existingEdgeLogical && existingEdgeLogical !== logicalKey) throw graphError("INTERNAL_ERROR", "A canonical graph relation identity was returned for conflicting endpoints.", 500);
    const existingLogical = logicalEdges.get(logicalKey);
    if (existingLogical && existingLogical !== hop.edge.id) throw graphError("INTERNAL_ERROR", "Conflicting duplicate canonical graph relations were returned.", 500);
    if (visitedEdges.has(edgeKey)) continue;
    visitedEdges.add(edgeKey);
    edgeIdentities.set(edgeKey, logicalKey);
    logicalEdges.set(logicalKey, hop.edge.id);
    edges.set(edgeKey, { edge: toPublicEdge(hop.edge), depth: hop.edgeDepth });
    const prior = nodes.get(targetKey);
    if (!prior || hop.edgeDepth < prior.depth) nodes.set(targetKey, { node: hop.target, depth: hop.edgeDepth });
    visitedNodes.add(targetKey);
  }

  if (nodes.size > limits.totalNodeHardMax || edges.size > limits.totalEdgeHardMax) throw graphError("FAN_OUT_LIMIT_EXCEEDED", "Skill Graph total fan-out exceeds the hard maximum.");
  const sortedNodes = [...nodes.values()]
    .sort((left, right) => left.depth - right.depth || nodeRank(left.node.type) - nodeRank(right.node.type) || compareSkillGraphStrings(left.node.canonicalKey, right.node.canonicalKey) || compareSkillGraphStrings(left.node.id, right.node.id))
    .map(({ node }) => toPublicNode(node));
  const sortedEdges = [...edges.values()]
    .sort((left, right) => left.depth - right.depth || edgeRank(left.edge.type) - edgeRank(right.edge.type) || compareSkillGraphStrings(left.edge.source.id, right.edge.source.id) || compareSkillGraphStrings(left.edge.target.id, right.edge.target.id) || compareSkillGraphStrings(left.edge.id, right.edge.id))
    .map(({ edge }) => edge);
  if (!visitedNodes.has(rootKey)) throw graphError("INTERNAL_ERROR", "Skill Graph root was not retained.", 500);
  return {
    schemaVersion: "skill-graph.v1",
    queryType: input.queryType,
    depth: input.depth,
    root: { type: input.root.type, id: input.root.id },
    nodes: sortedNodes,
    edges: sortedEdges,
    ...(input.page ? { page: input.page } : {}),
  };
}

function assertEdgeContract(hop: SkillGraphHop, queryType: SkillGraphQueryType, edgeDepth: number) {
  if (!isSkillGraphEdgeType(hop.edge.type)) {
    throw graphError("INTERNAL_ERROR", "Skill Graph relation type is not in the canonical closed set.", 500);
  }
  const expectedType = queryType === "SKILL_GRAPH"
    ? null
    : queryType === "ROLE_GRAPH"
      ? edgeDepth === 1 ? "ROLE_REQUIRES_SKILL" : "SKILL_REQUIRES_CONCEPT"
      : queryType === "CONCEPT_GRAPH"
        ? edgeDepth === 1 ? "SKILL_REQUIRES_CONCEPT" : "ROLE_REQUIRES_SKILL"
        : queryType === "ROLE_SKILLS" || queryType === "SKILL_ROLES"
          ? "ROLE_REQUIRES_SKILL"
          : "SKILL_REQUIRES_CONCEPT";
  if (expectedType && hop.edge.type !== expectedType) {
    throw graphError("INTERNAL_ERROR", "Skill Graph relation type does not match the query contract.", 500);
  }
  const expected = hop.edge.type === "ROLE_REQUIRES_SKILL"
    ? { source: "ROLE" as const, target: "SKILL" as const }
    : { source: "SKILL" as const, target: "CONCEPT" as const };
  const reverse = isReverseHop(queryType, hop.edge.type);
  const traversedEndpoint = reverse ? hop.edge.source : hop.edge.target;
  if (
    typeof hop.edge.id !== "string" || !hop.edge.id.trim() ||
    !Number.isInteger(hop.edge.relationVersion) || hop.edge.relationVersion < 1 ||
    hop.edge.source.type !== expected.source ||
    hop.edge.target.type !== expected.target ||
    hop.target?.type !== traversedEndpoint.type ||
    hop.target.id !== traversedEndpoint.id
  ) {
    throw graphError("INTERNAL_ERROR", "Skill Graph relation endpoints do not match the canonical edge contract.", 500);
  }
}

function isReverseHop(queryType: SkillGraphQueryType, edgeType: SkillGraphEdgeType) {
  return queryType === "SKILL_ROLES" || queryType === "CONCEPT_SKILLS" || queryType === "CONCEPT_GRAPH" || (queryType === "SKILL_GRAPH" && edgeType === "ROLE_REQUIRES_SKILL");
}

function toPublicNode(node: SkillGraphRepositoryNode): SkillGraphNode {
  const provenance = node.sourceType ? { sourceType: node.sourceType } : undefined;
  const aliases = [...new Set(node.aliases)].sort(compareSkillGraphStrings);
  if (node.type === "ROLE") return { type: "ROLE", id: node.id, roleKey: node.canonicalKey, label: node.label, aliases, ...(provenance ? { provenance } : {}) };
  if (node.type === "SKILL") return { type: "SKILL", id: node.id, skillKey: node.canonicalKey, label: node.label, aliases, ...(provenance ? { provenance } : {}) };
  return { type: "CONCEPT", id: node.id, conceptKey: node.canonicalKey, label: node.label, aliases, ...(provenance ? { provenance } : {}) };
}

function toPublicEdge(edge: SkillGraphRepositoryEdge): SkillGraphEdge {
  return {
    id: edge.id,
    type: edge.type,
    source: edge.source,
    target: edge.target,
    relationVersion: edge.relationVersion,
    ...(edge.sourceType ? { provenance: { sourceType: edge.sourceType } } : {}),
  };
}

function rootTypeForQuery(queryType: SkillGraphQueryType): SkillGraphNodeType {
  if (queryType === "ROLE_SKILLS" || queryType === "ROLE_GRAPH") return "ROLE";
  if (queryType === "SKILL_ROLES" || queryType === "SKILL_CONCEPTS" || queryType === "SKILL_GRAPH") return "SKILL";
  return "CONCEPT";
}

function nodeKey(type: SkillGraphNodeType, id: string) {
  return `${type}:${id}`;
}

function nodeRank(type: SkillGraphNodeType) {
  return type === "ROLE" ? 0 : type === "SKILL" ? 1 : 2;
}

function edgeRank(type: SkillGraphEdgeType) {
  return type === "ROLE_REQUIRES_SKILL" ? 0 : 1;
}

function queryFingerprint(queryType: SkillGraphQueryType, root: SkillGraphRepositoryNode, depth: SkillGraphDepth, limit: number) {
  return JSON.stringify({
    version: 1,
    cursorVersion: SKILL_GRAPH_CURSOR_VERSION,
    orderVersion: SKILL_GRAPH_ORDER_VERSION,
    queryType,
    rootType: root.type,
    rootId: root.id,
    depth,
    limit,
  });
}

async function encodeCursor(input: { fingerprint: string; canonicalKey: string; stableId: string }) {
  const body = JSON.stringify({
    cursorVersion: SKILL_GRAPH_CURSOR_VERSION,
    fingerprint: input.fingerprint,
    canonicalKey: input.canonicalKey,
    stableId: input.stableId,
  });
  const integrity = await cursorDigest(body);
  const binary = String.fromCharCode(...new TextEncoder().encode(JSON.stringify({
    cursorVersion: SKILL_GRAPH_CURSOR_VERSION,
    fingerprint: input.fingerprint,
    canonicalKey: input.canonicalKey,
    stableId: input.stableId,
    integrity,
  })));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function decodeCursor(value: string, fingerprint: string): Promise<SkillGraphCursorPosition> {
  try {
    if (value.length > SKILL_GRAPH_MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid cursor encoding");
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
    if (bytes.length > SKILL_GRAPH_MAX_CURSOR_LENGTH) throw new Error("cursor payload too large");
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as Partial<{
      cursorVersion: string;
      fingerprint: string;
      canonicalKey: string;
      stableId: string;
      integrity: string;
    }>;
    const keys = Object.keys(decoded).sort().join("\u0000");
    if (keys !== ["canonicalKey", "cursorVersion", "fingerprint", "integrity", "stableId"].sort().join("\u0000")) throw new Error("cursor fields");
    if (
      decoded.cursorVersion !== SKILL_GRAPH_CURSOR_VERSION ||
      decoded.fingerprint !== fingerprint ||
      !isCursorField(decoded.canonicalKey) ||
      !isCursorField(decoded.stableId) ||
      !isCursorField(decoded.integrity) ||
      decoded.integrity !== await cursorDigest(JSON.stringify({
        cursorVersion: decoded.cursorVersion,
        fingerprint: decoded.fingerprint,
        canonicalKey: decoded.canonicalKey,
        stableId: decoded.stableId,
      }))
    ) throw new Error("cursor mismatch");
    return { canonicalKey: decoded.canonicalKey, stableId: decoded.stableId };
  } catch {
    throw graphError("INVALID_QUERY", "Skill Graph cursor is invalid for this query.");
  }
}

function isCursorField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

async function cursorDigest(value: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function graphError(code: SkillGraphErrorCode, message?: string, status?: number): never {
  throw new SkillGraphError(code, message ?? code, status ?? defaultStatus(code));
}

function defaultStatus(code: SkillGraphErrorCode) {
  return code === "AUTHORIZATION_DENIED" ? 403 : code === "INTERNAL_ERROR" ? 500 : code === "NOT_FOUND" ? 404 : 400;
}
