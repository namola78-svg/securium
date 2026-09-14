import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_GRAPH_LIMITS,
  PUBLIC_GRAPH_SCHEMA_VERSION,
  validatePublicGraphResponse,
} from "../lib/services/public-graph-response-validation.ts";
import {
  EXPECTED_EMPTY_GRAPH_RESPONSE,
  EXPECTED_PUBLIC_GRAPH_RESPONSE,
  SYNTHETIC_SOURCE_FIXTURE,
  createEdgeLimitBoundaryResponse,
  createNodeLimitBoundaryResponse,
} from "../verification/public-graph-response-validation/fixtures.ts";

type MutableRecord = Record<string, unknown>;

type MutableGraph = {
  [key: string]: unknown;
  data: {
    [key: string]: unknown;
    nodes: Array<MutableRecord>;
    edges: Array<MutableRecord>;
    queryType: string;
    depth: number;
    page?: unknown;
  };
};

type MutableEnvelope = { [key: string]: unknown; data: unknown };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mutableGraph<T>(value: T): MutableGraph {
  return clone(value) as unknown as MutableGraph;
}

function expectCodes(value: unknown, ...codes: string[]) {
  const result = validatePublicGraphResponse(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errorCodes, codes);
  return result;
}

function expectOracleMismatch(value: unknown) {
  assert.throws(() => assert.deepEqual(value, EXPECTED_PUBLIC_GRAPH_RESPONSE));
}

test("valid Role to Skill to Concept projection follows the documented shape", () => {
  assert.deepEqual(SYNTHETIC_SOURCE_FIXTURE.nodes.filter((node) => node.visibility === "PUBLIC").map((node) => node.id), [
    "role-1",
    "skill-1",
    "concept-1",
  ]);
  assert.deepEqual(SYNTHETIC_SOURCE_FIXTURE.edges.filter((edge) => edge.visibility === "PUBLIC").map((edge) => edge.id), [
    "rs-public",
    "sc-public",
  ]);
  assert.equal(validatePublicGraphResponse(EXPECTED_PUBLIC_GRAPH_RESPONSE).ok, true);
});

test("the independent projection oracle detects omitted public nodes and edges", () => {
  const incomplete = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  incomplete.data.nodes = incomplete.data.nodes.slice(0, 2);
  incomplete.data.edges = incomplete.data.edges.slice(0, 1);

  assert.equal(validatePublicGraphResponse(incomplete).ok, true);
  expectOracleMismatch(incomplete);
});

test("EMPTY is an explicit no-data response and does not carry hidden counts", () => {
  assert.equal(validatePublicGraphResponse(EXPECTED_EMPTY_GRAPH_RESPONSE).ok, true);
  const withHiddenCount = clone(EXPECTED_EMPTY_GRAPH_RESPONSE) as unknown as MutableEnvelope;
  withHiddenCount.data = { hiddenNodeCount: 1 };
  expectCodes(withHiddenCount, "INVALID_DATA");
});

test("query-specific page shape is required and bounded", () => {
  const missingPage = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  delete missingPage.data.page;
  expectCodes(missingPage, "INVALID_DATA");

  const pagedWithNullPage = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  pagedWithNullPage.data.queryType = "ROLE_SKILLS";
  pagedWithNullPage.data.depth = 1;
  pagedWithNullPage.data.nodes = pagedWithNullPage.data.nodes.slice(0, 2);
  pagedWithNullPage.data.edges = pagedWithNullPage.data.edges.slice(0, 1);
  pagedWithNullPage.data.page = null;
  expectCodes(pagedWithNullPage, "INVALID_PAGE");

  const emptyCursor = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  emptyCursor.data.queryType = "ROLE_SKILLS";
  emptyCursor.data.depth = 1;
  emptyCursor.data.nodes = emptyCursor.data.nodes.slice(0, 2);
  emptyCursor.data.edges = emptyCursor.data.edges.slice(0, 1);
  emptyCursor.data.page = { limit: 200, hasMore: true, nextCursor: "" };
  expectCodes(emptyCursor, "INVALID_PAGE");
});

test("all supported query types preserve their canonical traversal view", () => {
  const cases = [
    { queryType: "ROLE_SKILLS", depth: 1, root: { type: "ROLE", publicId: "role:role-1" }, nodeIndexes: [0, 1], edgeIndexes: [0], paged: true },
    { queryType: "ROLE_GRAPH", depth: 2, root: { type: "ROLE", publicId: "role:role-1" }, nodeIndexes: [0, 1, 2], edgeIndexes: [0, 1], paged: false },
    { queryType: "SKILL_ROLES", depth: 1, root: { type: "SKILL", publicId: "skill:skill-1" }, nodeIndexes: [0, 1], edgeIndexes: [0], paged: true },
    { queryType: "SKILL_CONCEPTS", depth: 1, root: { type: "SKILL", publicId: "skill:skill-1" }, nodeIndexes: [1, 2], edgeIndexes: [1], paged: true },
    { queryType: "SKILL_GRAPH", depth: 1, root: { type: "SKILL", publicId: "skill:skill-1" }, nodeIndexes: [0, 1, 2], edgeIndexes: [0, 1], paged: false },
    { queryType: "CONCEPT_SKILLS", depth: 1, root: { type: "CONCEPT", publicId: "concept:concept-1" }, nodeIndexes: [1, 2], edgeIndexes: [1], paged: true },
    { queryType: "CONCEPT_GRAPH", depth: 2, root: { type: "CONCEPT", publicId: "concept:concept-1" }, nodeIndexes: [0, 1, 2], edgeIndexes: [0, 1], paged: false },
  ] as const;

  for (const item of cases) {
    const value = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
    value.data.queryType = item.queryType;
    value.data.depth = item.depth;
    value.data.root = item.root;
    value.data.nodes = item.nodeIndexes.map((index) => clone(EXPECTED_PUBLIC_GRAPH_RESPONSE.data.nodes[index])) as Array<MutableRecord>;
    value.data.edges = item.edgeIndexes.map((index) => clone(EXPECTED_PUBLIC_GRAPH_RESPONSE.data.edges[index])) as Array<MutableRecord>;
    value.data.page = item.paged ? { limit: 200, hasMore: false, nextCursor: null } : null;
    assert.equal(validatePublicGraphResponse(value).ok, true, item.queryType);
  }
});

test("private node and label exposure is detected by the independent projection oracle", () => {
  const leaked = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  leaked.data.nodes.push({
    type: "SKILL",
    publicId: "skill:skill-private",
    key: "skill:private-sentinel",
    label: "Private Skill Sentinel",
    aliases: [],
  });
  leaked.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-1" },
    target: { type: "SKILL", publicId: "skill:skill-private" },
  });

  assert.equal(validatePublicGraphResponse(leaked).ok, true);
  expectOracleMismatch(leaked);
  assert.equal(SYNTHETIC_SOURCE_FIXTURE.nodes.find((node) => node.id === "skill-private")?.visibility, "PRIVATE");
});

test("private edge exposure is detected by the independent projection oracle", () => {
  const leaked = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  leaked.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-1" },
    target: { type: "SKILL", publicId: "skill:skill-private" },
  });

  expectCodes(leaked, "DANGLING_EDGE");
  expectOracleMismatch(leaked);
  assert.equal(SYNTHETIC_SOURCE_FIXTURE.edges.find((edge) => edge.id === "rs-private")?.visibility, "PRIVATE");
});

test("a private intermediate node cannot be replaced by a direct bypass edge", () => {
  const bypass = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  bypass.data.edges.push({
    type: "SKILL_REQUIRES_CONCEPT",
    source: { type: "ROLE", publicId: "role:role-1" },
    target: { type: "CONCEPT", publicId: "concept:concept-1" },
  });

  expectCodes(bypass, "INVALID_RELATION_DIRECTION");
  expectOracleMismatch(bypass);
});

test("dangling references, duplicate nodes, and duplicate logical edges fail closed", () => {
  const dangling = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  dangling.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-1" },
    target: { type: "SKILL", publicId: "skill:missing" },
  });
  expectCodes(dangling, "DANGLING_EDGE");

  const duplicateNode = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  duplicateNode.data.nodes.push(clone(duplicateNode.data.nodes[0]));
  expectCodes(duplicateNode, "DUPLICATE_NODE");

  const duplicateEdge = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  duplicateEdge.data.edges.push(clone(duplicateEdge.data.edges[0]));
  expectCodes(duplicateEdge, "DUPLICATE_EDGE");
});

test("wrong relation direction and node type combinations fail closed", () => {
  const wrongDirection = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  wrongDirection.data.edges[0] = {
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "SKILL", publicId: "skill:skill-1" },
    target: { type: "ROLE", publicId: "role:role-1" },
  };
  expectCodes(wrongDirection, "INVALID_RELATION_DIRECTION");

  const wrongNodeType = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  wrongNodeType.data.nodes[1].type = "CONCEPT";
  expectCodes(wrongNodeType, "INVALID_NODE", "INVALID_NODE_ID", "DANGLING_EDGE");
});

test("all returned nodes and edges must be reachable from the query root within its depth", () => {
  const disconnected = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  disconnected.data.nodes.push({
    type: "ROLE",
    publicId: "role:role-2",
    key: "role:security:unrelated",
    label: "Unrelated Role",
    aliases: [],
  });
  disconnected.data.nodes.push({
    type: "SKILL",
    publicId: "skill:skill-2",
    key: "skill:security:unrelated",
    label: "Unrelated Skill",
    aliases: [],
  });
  disconnected.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-2" },
    target: { type: "SKILL", publicId: "skill:skill-2" },
  });
  expectCodes(disconnected, "INVALID_GRAPH_TOPOLOGY");

  const tooDeep = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  tooDeep.data.queryType = "SKILL_GRAPH";
  tooDeep.data.depth = 1;
  tooDeep.data.root = { type: "SKILL", publicId: "skill:skill-1" };
  tooDeep.data.nodes.push({
    type: "ROLE",
    publicId: "role:role-2",
    key: "role:security:too-deep",
    label: "Too Deep Role",
    aliases: [],
  });
  tooDeep.data.nodes.push({
    type: "SKILL",
    publicId: "skill:skill-2",
    key: "skill:security:too-deep",
    label: "Too Deep Skill",
    aliases: [],
  });
  tooDeep.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-2" },
    target: { type: "SKILL", publicId: "skill:skill-1" },
  });
  tooDeep.data.edges.push({
    type: "ROLE_REQUIRES_SKILL",
    source: { type: "ROLE", publicId: "role:role-2" },
    target: { type: "SKILL", publicId: "skill:skill-2" },
  });
  expectCodes(tooDeep, "INVALID_GRAPH_TOPOLOGY");
});

test("private and operational sentinel fields are rejected without reflecting their names or values", () => {
  const sentinels = [
    ["userId", "learner-123"],
    ["evidenceProjections", [{ userId: "learner-123" }]],
    ["answer", "correct"],
    ["reviewerId", "reviewer-123"],
    ["opsNote", "private operation"],
    ["source", { url: "https://private.invalid" }],
    ["revision", "internal-revision"],
  ] as const;

  for (const [field, value] of sentinels) {
    const leaked = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
    leaked.data.nodes[0][field] = value;
    const result = expectCodes(leaked, "UNKNOWN_FIELD");
    assert.equal(JSON.stringify(result).includes(field), false);
    assert.equal(JSON.stringify(result).includes(String(value)), false);
  }
});

test("exact total node and edge limits pass, while the next item fails", () => {
  const nodeBoundary = createNodeLimitBoundaryResponse();
  assert.equal(nodeBoundary.data.nodes.length, PUBLIC_GRAPH_LIMITS.totalNodeHardMax);
  assert.equal(validatePublicGraphResponse(nodeBoundary).ok, true);

  const nodeOverflow = mutableGraph(nodeBoundary);
  nodeOverflow.data.nodes.push({
    type: "CONCEPT",
    publicId: "concept:overflow",
    key: "ontology:overflow",
    label: "Overflow",
    aliases: [],
  });
  expectCodes(nodeOverflow, "NODE_LIMIT_EXCEEDED");

  const edgeBoundary = createEdgeLimitBoundaryResponse();
  assert.equal(edgeBoundary.data.edges.length, PUBLIC_GRAPH_LIMITS.totalEdgeHardMax);
  assert.equal(validatePublicGraphResponse(edgeBoundary).ok, true);

  const edgeOverflow = mutableGraph(edgeBoundary);
  edgeOverflow.data.edges.push({
    type: "SKILL_REQUIRES_CONCEPT",
    source: { type: "SKILL", publicId: "skill:skill-3" },
    target: { type: "CONCEPT", publicId: "concept:concept-1" },
  });
  expectCodes(edgeOverflow, "EDGE_LIMIT_EXCEEDED");
});

test("malformed input returns only stable error codes and never a partial graph", () => {
  const malformed = {
    schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
    status: "OK",
    data: {
      schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
      queryType: "ROLE_GRAPH",
      depth: 2,
      root: { type: "ROLE", publicId: "role:role-1" },
      nodes: [{ type: "ROLE", publicId: "role:role-1", key: "role:1", label: "Role", aliases: [] }],
      edges: [{ type: "ROLE_REQUIRES_SKILL", source: null, target: [] }],
      page: null,
    },
    page: null,
  };
  const result = validatePublicGraphResponse(malformed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errorCodes, ["INVALID_EDGE"]);
  assert.equal("data" in result, false);
  assert.equal(JSON.stringify(result).includes("role-1"), false);
});

test("the validator does not mutate input and gives deterministic results", () => {
  const input = clone(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  const before = clone(input);
  const first = validatePublicGraphResponse(input);
  const second = validatePublicGraphResponse(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test("unsupported response-byte and query-cost claims stay outside response validation", () => {
  const direct = mutableGraph(EXPECTED_PUBLIC_GRAPH_RESPONSE);
  direct.data.queryType = "ROLE_SKILLS";
  direct.data.depth = 1;
  direct.data.nodes = direct.data.nodes.slice(0, 2);
  direct.data.edges = direct.data.edges.slice(0, 1);
  direct.data.page = { limit: 200, hasMore: false, nextCursor: null };
  assert.equal(validatePublicGraphResponse(direct).ok, true);
  assert.equal(PUBLIC_GRAPH_LIMITS.perHopHardMax, 500);
});
