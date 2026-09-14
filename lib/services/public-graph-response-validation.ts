export const PUBLIC_GRAPH_SCHEMA_VERSION = "public-learning-graph.v1" as const;

export const PUBLIC_GRAPH_NODE_TYPES = ["ROLE", "SKILL", "CONCEPT"] as const;
export type PublicGraphNodeType = (typeof PUBLIC_GRAPH_NODE_TYPES)[number];

export const PUBLIC_GRAPH_EDGE_TYPES = [
  "ROLE_REQUIRES_SKILL",
  "SKILL_REQUIRES_CONCEPT",
] as const;
export type PublicGraphEdgeType = (typeof PUBLIC_GRAPH_EDGE_TYPES)[number];

export const PUBLIC_GRAPH_QUERY_TYPES = [
  "ROLE_SKILLS",
  "ROLE_GRAPH",
  "SKILL_ROLES",
  "SKILL_CONCEPTS",
  "SKILL_GRAPH",
  "CONCEPT_SKILLS",
  "CONCEPT_GRAPH",
] as const;
export type PublicGraphQueryType = (typeof PUBLIC_GRAPH_QUERY_TYPES)[number];

export const PUBLIC_GRAPH_STATUSES = [
  "OK",
  "EMPTY",
  "NOT_FOUND",
  "UNAVAILABLE",
  "INVALID_INPUT",
  "LIMIT_EXCEEDED",
] as const;
export type PublicGraphStatus = (typeof PUBLIC_GRAPH_STATUSES)[number];

export const PUBLIC_GRAPH_LIMITS = Object.freeze({
  maxDepth: 2,
  maxPublicIdBytes: 255,
  maxCursorBytes: 4096,
  totalNodeHardMax: 1000,
  totalEdgeHardMax: 2000,
  perHopHardMax: 500,
} as const);

const PUBLIC_ID_PATTERN = /^(role|skill|concept):([A-Za-z0-9._:-]+)$/;

const ERROR_CODE_ORDER = [
  "INVALID_RESPONSE_OBJECT",
  "UNKNOWN_FIELD",
  "INVALID_SCHEMA_VERSION",
  "INVALID_STATUS",
  "INVALID_DATA",
  "INVALID_PAGE",
  "INVALID_QUERY_TYPE",
  "INVALID_DEPTH",
  "INVALID_ROOT",
  "INVALID_NODE",
  "INVALID_NODE_ID",
  "DUPLICATE_NODE",
  "INVALID_EDGE",
  "INVALID_EDGE_IDENTITY",
  "DUPLICATE_EDGE",
  "DANGLING_EDGE",
  "INVALID_RELATION_DIRECTION",
  "INVALID_GRAPH_TOPOLOGY",
  "NODE_LIMIT_EXCEEDED",
  "EDGE_LIMIT_EXCEEDED",
] as const;

export type PublicGraphValidationCode = (typeof ERROR_CODE_ORDER)[number];

export type PublicGraphValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errorCodes: readonly PublicGraphValidationCode[] };

type PublicGraphReference = {
  readonly type: PublicGraphNodeType;
  readonly publicId: string;
};

type QueryContract = {
  readonly rootType: PublicGraphNodeType;
  readonly depth: 1 | 2;
  readonly paged: boolean;
};

const QUERY_CONTRACTS: Readonly<Record<PublicGraphQueryType, QueryContract>> = {
  ROLE_SKILLS: { rootType: "ROLE", depth: 1, paged: true },
  ROLE_GRAPH: { rootType: "ROLE", depth: 2, paged: false },
  SKILL_ROLES: { rootType: "SKILL", depth: 1, paged: true },
  SKILL_CONCEPTS: { rootType: "SKILL", depth: 1, paged: true },
  SKILL_GRAPH: { rootType: "SKILL", depth: 1, paged: false },
  CONCEPT_SKILLS: { rootType: "CONCEPT", depth: 1, paged: true },
  CONCEPT_GRAPH: { rootType: "CONCEPT", depth: 2, paged: false },
};

function isEdgeAllowedForQuery(queryType: PublicGraphQueryType, edgeType: PublicGraphEdgeType): boolean {
  if (queryType === "ROLE_GRAPH" || queryType === "SKILL_GRAPH" || queryType === "CONCEPT_GRAPH") return true;
  if (queryType === "ROLE_SKILLS" || queryType === "SKILL_ROLES") return edgeType === "ROLE_REQUIRES_SKILL";
  return edgeType === "SKILL_REQUIRES_CONCEPT";
}

const NODE_FIELDS = ["type", "publicId", "key", "label", "aliases"] as const;
const REFERENCE_FIELDS = ["type", "publicId"] as const;
const EDGE_FIELDS = ["type", "source", "target"] as const;
const PAGE_FIELDS = ["limit", "hasMore", "nextCursor"] as const;
const RESPONSE_FIELDS = ["schemaVersion", "status", "data", "page"] as const;
const GRAPH_FIELDS = ["schemaVersion", "queryType", "depth", "root", "nodes", "edges", "page"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasOnlyAllowedFields(value: Record<string, unknown>, allowed: readonly string[], addIssue: () => void) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addIssue();
  }
}

function hasAllFields(value: Record<string, unknown>, fields: readonly string[], addIssue: () => void) {
  for (const field of fields) {
    if (!hasOwn(value, field)) addIssue();
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNodeType(value: unknown): value is PublicGraphNodeType {
  return typeof value === "string" && (PUBLIC_GRAPH_NODE_TYPES as readonly string[]).includes(value);
}

function isEdgeType(value: unknown): value is PublicGraphEdgeType {
  return typeof value === "string" && (PUBLIC_GRAPH_EDGE_TYPES as readonly string[]).includes(value);
}

function isQueryType(value: unknown): value is PublicGraphQueryType {
  return typeof value === "string" && (PUBLIC_GRAPH_QUERY_TYPES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is PublicGraphStatus {
  return typeof value === "string" && (PUBLIC_GRAPH_STATUSES as readonly string[]).includes(value);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasValidPublicId(value: unknown, expectedType: PublicGraphNodeType, addIssue: () => void): value is string {
  if (typeof value !== "string" || utf8ByteLength(value) > PUBLIC_GRAPH_LIMITS.maxPublicIdBytes) {
    addIssue();
    return false;
  }

  const match = PUBLIC_ID_PATTERN.exec(value);
  if (!match || match[1] !== expectedType.toLowerCase()) {
    addIssue();
    return false;
  }

  return true;
}

function readReference(value: unknown, addInvalidId: () => void, addUnknownField: () => void): PublicGraphReference | null {
  if (!isRecord(value)) {
    addInvalidId();
    return null;
  }

  hasOnlyAllowedFields(value, REFERENCE_FIELDS, addUnknownField);
  hasAllFields(value, REFERENCE_FIELDS, addInvalidId);

  if (!isNodeType(value.type)) {
    addInvalidId();
    return null;
  }
  if (!hasValidPublicId(value.publicId, value.type, addInvalidId)) return null;

  return { type: value.type, publicId: value.publicId };
}

function readNodeIdentity(value: unknown, addIssue: (code: PublicGraphValidationCode) => void) {
  if (!isRecord(value)) {
    addIssue("INVALID_NODE");
    return null;
  }

  let valid = true;
  const addNodeIssue = () => {
    valid = false;
    addIssue("INVALID_NODE");
  };
  const addNodeUnknownField = () => {
    valid = false;
    addIssue("UNKNOWN_FIELD");
  };

  hasOnlyAllowedFields(value, NODE_FIELDS, addNodeUnknownField);
  hasAllFields(value, NODE_FIELDS, addNodeIssue);

  const nodeType = isNodeType(value.type) ? value.type : null;
  if (nodeType === null) addNodeIssue();
  if (nodeType === null) return null;
  if (!hasValidPublicId(value.publicId, nodeType, () => {
    valid = false;
    addIssue("INVALID_NODE_ID");
  })) {
    addNodeIssue();
    return null;
  }
  if (!isNonEmptyString(value.key) || !isNonEmptyString(value.label)) addNodeIssue();

  if (!Array.isArray(value.aliases) || value.aliases.some((alias) => !isNonEmptyString(alias))) {
    addNodeIssue();
  }

  return { type: nodeType, publicId: value.publicId, valid } as const;
}

function referenceKey(reference: PublicGraphReference): string {
  return `${reference.type}\u0000${reference.publicId}`;
}

function edgeKey(type: PublicGraphEdgeType, source: PublicGraphReference, target: PublicGraphReference): string {
  return `${type}\u0000${referenceKey(source)}\u0000${referenceKey(target)}`;
}

function validatePage(value: unknown, contract: QueryContract, addIssue: (code: PublicGraphValidationCode) => void) {
  if (value === undefined) return;
  if (value === null) {
    if (contract.paged) addIssue("INVALID_PAGE");
    return;
  }
  if (!isRecord(value)) {
    addIssue("INVALID_PAGE");
    return;
  }

  hasOnlyAllowedFields(value, PAGE_FIELDS, () => addIssue("UNKNOWN_FIELD"));
  hasAllFields(value, PAGE_FIELDS, () => addIssue("INVALID_PAGE"));

  const validLimit = Number.isInteger(value.limit) && typeof value.limit === "number" && value.limit > 0
    && value.limit <= PUBLIC_GRAPH_LIMITS.perHopHardMax;
  if (!validLimit || typeof value.hasMore !== "boolean") addIssue("INVALID_PAGE");
  if (typeof value.nextCursor !== "string" && value.nextCursor !== null) addIssue("INVALID_PAGE");
  if (typeof value.nextCursor === "string" && (!isNonEmptyString(value.nextCursor) || utf8ByteLength(value.nextCursor) > PUBLIC_GRAPH_LIMITS.maxCursorBytes)) {
    addIssue("INVALID_PAGE");
  }
  if (value.hasMore === true && typeof value.nextCursor !== "string") addIssue("INVALID_PAGE");
  if (value.hasMore === false && value.nextCursor !== null) addIssue("INVALID_PAGE");

  if (!contract.paged && value !== null) addIssue("INVALID_PAGE");
  if (contract.paged && value === null) addIssue("INVALID_PAGE");
}

function validateGraphPayload(value: unknown, addIssue: (code: PublicGraphValidationCode) => void) {
  if (!isRecord(value)) {
    addIssue("INVALID_DATA");
    return;
  }

  hasOnlyAllowedFields(value, GRAPH_FIELDS, () => addIssue("UNKNOWN_FIELD"));
  hasAllFields(value, GRAPH_FIELDS, () => addIssue("INVALID_DATA"));

  if (value.schemaVersion !== PUBLIC_GRAPH_SCHEMA_VERSION) addIssue("INVALID_SCHEMA_VERSION");
  if (!isQueryType(value.queryType)) {
    addIssue("INVALID_QUERY_TYPE");
    return;
  }

  const contract = QUERY_CONTRACTS[value.queryType];
  if (value.depth !== contract.depth) addIssue("INVALID_DEPTH");

  const root = readReference(value.root, () => addIssue("INVALID_ROOT"), () => addIssue("UNKNOWN_FIELD"));
  if (!root || root.type !== contract.rootType) addIssue("INVALID_ROOT");

  let validNodeList = true;
  const nodeKeys = new Set<string>();
  if (!Array.isArray(value.nodes)) {
    addIssue("INVALID_NODE");
    validNodeList = false;
  } else {
    if (value.nodes.length > PUBLIC_GRAPH_LIMITS.totalNodeHardMax) addIssue("NODE_LIMIT_EXCEEDED");
    for (const node of value.nodes) {
      const identity = readNodeIdentity(node, addIssue);
      if (!identity) {
        validNodeList = false;
        continue;
      }
      const key = referenceKey(identity);
      if (!identity.valid) validNodeList = false;
      if (nodeKeys.has(key)) {
        validNodeList = false;
        addIssue("DUPLICATE_NODE");
      }
      nodeKeys.add(key);
    }

    if (root && !nodeKeys.has(referenceKey(root))) addIssue("INVALID_ROOT");

    if (!Array.isArray(value.edges)) {
      addIssue("INVALID_EDGE");
      return;
    }

    if (value.edges.length > PUBLIC_GRAPH_LIMITS.totalEdgeHardMax) addIssue("EDGE_LIMIT_EXCEEDED");
    let validEdgeList = true;
    const validatedEdges: Array<{ type: PublicGraphEdgeType; source: PublicGraphReference; target: PublicGraphReference }> = [];
    const edgeKeys = new Set<string>();
    for (const edge of value.edges) {
      if (!isRecord(edge)) {
        validEdgeList = false;
        addIssue("INVALID_EDGE");
        continue;
      }

      let validEdge = true;
      const addEdgeIssue = () => {
        validEdge = false;
        addIssue("INVALID_EDGE");
      };
      const addEdgeUnknownField = () => {
        validEdge = false;
        addIssue("UNKNOWN_FIELD");
      };

      hasOnlyAllowedFields(edge, EDGE_FIELDS, addEdgeUnknownField);
      hasAllFields(edge, EDGE_FIELDS, addEdgeIssue);
      if (!isEdgeType(edge.type)) {
        addEdgeIssue();
        validEdgeList = false;
        continue;
      }
      if (!isEdgeAllowedForQuery(value.queryType, edge.type)) {
        validEdge = false;
        addIssue("INVALID_RELATION_DIRECTION");
      }

      const source = readReference(edge.source, addEdgeIssue, addEdgeUnknownField);
      const target = readReference(edge.target, addEdgeIssue, addEdgeUnknownField);
      if (!source || !target) {
        validEdgeList = false;
        continue;
      }

      const validDirection = edge.type === "ROLE_REQUIRES_SKILL"
        ? source.type === "ROLE" && target.type === "SKILL"
        : source.type === "SKILL" && target.type === "CONCEPT";
      if (!validDirection) {
        validEdge = false;
        addIssue("INVALID_RELATION_DIRECTION");
      }

      const key = edgeKey(edge.type, source, target);
      if (edgeKeys.has(key)) {
        validEdge = false;
        addIssue("DUPLICATE_EDGE");
      }
      edgeKeys.add(key);

      if (!nodeKeys.has(referenceKey(source)) || !nodeKeys.has(referenceKey(target))) {
        validEdge = false;
        addIssue("DANGLING_EDGE");
      }

      if (!validEdge) validEdgeList = false;
      if (validEdge) validatedEdges.push({ type: edge.type, source, target });
    }

    if (
      validNodeList && validEdgeList &&
      value.nodes.length <= PUBLIC_GRAPH_LIMITS.totalNodeHardMax &&
      value.edges.length <= PUBLIC_GRAPH_LIMITS.totalEdgeHardMax &&
      root && nodeKeys.has(referenceKey(root))
    ) {
      validateGraphTopology(value.queryType, contract.depth, root, nodeKeys, validatedEdges, addIssue);
    }
  }

  validatePage(value.page, contract, addIssue);
}

function validateGraphTopology(
  queryType: PublicGraphQueryType,
  depth: 1 | 2,
  root: PublicGraphReference,
  nodeKeys: ReadonlySet<string>,
  edges: ReadonlyArray<{ type: PublicGraphEdgeType; source: PublicGraphReference; target: PublicGraphReference }>,
  addIssue: (code: PublicGraphValidationCode) => void,
) {
  const adjacency = new Map<string, Array<{ edge: (typeof edges)[number]; next: PublicGraphReference }>>();
  for (const edge of edges) {
    const traversal = traversalFor(queryType, edge);
    if (!traversal) continue;
    const entries = adjacency.get(referenceKey(traversal.from)) ?? [];
    entries.push({ edge, next: traversal.to });
    adjacency.set(referenceKey(traversal.from), entries);
  }

  const reachableNodes = new Set<string>([referenceKey(root)]);
  const reachableEdges = new Set<string>();
  let frontier = [root];
  for (let hop = 0; hop < depth && frontier.length > 0; hop += 1) {
    const nextFrontier: PublicGraphReference[] = [];
    for (const current of frontier) {
      for (const entry of adjacency.get(referenceKey(current)) ?? []) {
        const edgeIdentity = edgeKey(entry.edge.type, entry.edge.source, entry.edge.target);
        reachableEdges.add(edgeIdentity);
        const nextKey = referenceKey(entry.next);
        if (!reachableNodes.has(nextKey)) {
          reachableNodes.add(nextKey);
          nextFrontier.push(entry.next);
        }
      }
    }
    frontier = nextFrontier;
  }

  if (reachableNodes.size !== nodeKeys.size || reachableEdges.size !== edges.length) {
    addIssue("INVALID_GRAPH_TOPOLOGY");
  }
}

function traversalFor(
  queryType: PublicGraphQueryType,
  edge: { type: PublicGraphEdgeType; source: PublicGraphReference; target: PublicGraphReference },
) {
  if (queryType === "ROLE_SKILLS" || queryType === "ROLE_GRAPH") {
    return edge.type === "ROLE_REQUIRES_SKILL"
      ? { from: edge.source, to: edge.target }
      : queryType === "ROLE_GRAPH" ? { from: edge.source, to: edge.target } : null;
  }
  if (queryType === "SKILL_ROLES") {
    return edge.type === "ROLE_REQUIRES_SKILL"
      ? { from: edge.target, to: edge.source }
      : null;
  }
  if (queryType === "SKILL_CONCEPTS") {
    return edge.type === "SKILL_REQUIRES_CONCEPT"
      ? { from: edge.source, to: edge.target }
      : null;
  }
  if (queryType === "CONCEPT_SKILLS") {
    return edge.type === "SKILL_REQUIRES_CONCEPT"
      ? { from: edge.target, to: edge.source }
      : null;
  }
  if (queryType === "SKILL_GRAPH") {
    return edge.type === "ROLE_REQUIRES_SKILL"
      ? { from: edge.target, to: edge.source }
      : { from: edge.source, to: edge.target };
  }
  return { from: edge.target, to: edge.source };
}

export function validatePublicGraphResponse(input: unknown): PublicGraphValidationResult {
  const issues = new Set<PublicGraphValidationCode>();
  const addIssue = (code: PublicGraphValidationCode) => issues.add(code);

  if (!isRecord(input)) return { ok: false, errorCodes: ["INVALID_RESPONSE_OBJECT"] };
  hasOnlyAllowedFields(input, RESPONSE_FIELDS, () => addIssue("UNKNOWN_FIELD"));
  hasAllFields(input, RESPONSE_FIELDS, () => addIssue("INVALID_RESPONSE_OBJECT"));

  if (input.schemaVersion !== PUBLIC_GRAPH_SCHEMA_VERSION) addIssue("INVALID_SCHEMA_VERSION");
  if (!isStatus(input.status)) addIssue("INVALID_STATUS");
  if (input.page !== null) addIssue("INVALID_PAGE");

  if (input.status === "OK") {
    validateGraphPayload(input.data, addIssue);
  } else if (input.data !== null) {
    addIssue("INVALID_DATA");
  }

  const errorCodes = ERROR_CODE_ORDER.filter((code) => issues.has(code));
  return errorCodes.length === 0 ? { ok: true } : { ok: false, errorCodes };
}
