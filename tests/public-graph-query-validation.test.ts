import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_GRAPH_QUERY_LIMITS,
  validatePublicGraphQuery,
} from "../lib/services/public-graph-query-validation.ts";

type MutableQuery = Record<string, unknown>;

const syntheticCursorSyntax = "ZXhhbXBsZQ";

function validQuery(overrides: MutableQuery = {}): MutableQuery {
  return {
    queryType: "ROLE_SKILLS",
    root: { type: "ROLE", reference: { id: "role-1" } },
    ...overrides,
  };
}

function assertInvalid(input: unknown, errorCodes: readonly string[]) {
  const result = validatePublicGraphQuery(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errorCodes, errorCodes);
  assert.equal("query" in result, false);
}

test("each supported query has a minimal valid input and documented defaults", () => {
  const cases = [
    {
      queryType: "ROLE_SKILLS",
      root: { type: "ROLE", reference: { id: "role-1" } },
      depth: 1,
    },
    {
      queryType: "ROLE_GRAPH",
      root: { type: "ROLE", reference: { roleKey: "role:security:application-security" } },
      depth: 2,
    },
    {
      queryType: "SKILL_ROLES",
      root: { type: "SKILL", reference: { id: "skill-1" } },
      depth: 1,
    },
    {
      queryType: "SKILL_CONCEPTS",
      root: { type: "SKILL", reference: { skillKey: "skill:security:secure-code-review" } },
      depth: 1,
    },
    {
      queryType: "SKILL_GRAPH",
      root: { type: "SKILL", reference: { alias: "secure code review" } },
      depth: 1,
    },
    {
      queryType: "CONCEPT_SKILLS",
      root: { type: "CONCEPT", reference: { id: "concept-1" } },
      depth: 1,
    },
    {
      queryType: "CONCEPT_GRAPH",
      root: { type: "CONCEPT", reference: { stableKey: "ontology:security:input-validation" } },
      depth: 2,
    },
  ] as const;

  for (const item of cases) {
    const result = validatePublicGraphQuery({ queryType: item.queryType, root: item.root });
    assert.deepEqual(result, {
      ok: true,
      query: {
        queryType: item.queryType,
        root: item.root,
        depth: item.depth,
        limit: PUBLIC_GRAPH_QUERY_LIMITS.defaultLimit,
      },
    }, item.queryType);
  }
});

test("optional identity fields, limit, and a cursor are accepted without normalization", () => {
  const input = {
    queryType: "SKILL_CONCEPTS",
    root: {
      type: "SKILL",
      reference: {
        id: " skill-1 ",
        skillKey: "skill:security:secure-code-review",
        alias: "Secure Code Review",
      },
    },
    depth: 1,
    limit: 50,
    cursor: syntheticCursorSyntax,
  };

  assert.deepEqual(validatePublicGraphQuery(input), {
    ok: true,
    query: input,
  });
});

test("query type, root family, and identity allowlists are checked independently", () => {
  assertInvalid(validQuery({ queryType: "UNKNOWN_QUERY" }), ["INVALID_QUERY_TYPE"]);
  assertInvalid(validQuery({ root: { type: "SKILL", reference: { id: "skill-1" } } }), ["INVALID_ROOT"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: { id: "role-1", skillKey: "skill-1" } } }), ["UNKNOWN_FIELD"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: { id: "role-1", publicId: "role:role-1" } } }), ["UNKNOWN_FIELD"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: { id: "   " } } }), ["INVALID_IDENTITY"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: {} } }), ["INVALID_IDENTITY"]);
});

test("non-object inputs and missing required fields fail without a partial query", () => {
  for (const input of [null, [], "query", 1, true]) assertInvalid(input, ["INVALID_QUERY_OBJECT"]);
  assertInvalid({ root: validQuery().root }, ["INVALID_QUERY_TYPE"]);
  assertInvalid({ queryType: "ROLE_SKILLS" }, ["INVALID_ROOT"]);
});

test("unknown fields are rejected at every input level", () => {
  assertInvalid(validQuery({ userId: "private-user-sentinel" }), ["UNKNOWN_FIELD"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: { id: "role-1" }, includePrivate: true } }), ["UNKNOWN_FIELD"]);
  assertInvalid(validQuery({ root: { type: "ROLE", reference: { id: "role-1", extra: "private-identity-sentinel" } } }), ["UNKNOWN_FIELD"]);
});

test("query-specific depth and cursor combinations are fail-closed", () => {
  assertInvalid(validQuery({ depth: 2 }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: "role-1" } }, depth: 1 }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ queryType: "SKILL_GRAPH", root: { type: "SKILL", reference: { id: "skill-1" } }, cursor: syntheticCursorSyntax }), ["CURSOR_NOT_SUPPORTED"]);
  assertInvalid(validQuery({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: "role-1" } }, cursor: syntheticCursorSyntax }), ["CURSOR_NOT_SUPPORTED"]);
  assertInvalid(validQuery({ cursor: "   " }), ["INVALID_CURSOR"]);
  assertInvalid(validQuery({ cursor: null }), ["INVALID_CURSOR"]);
});

test("depth and limit boundaries reject fractional, non-finite, and over-limit values", () => {
  assert.equal(validatePublicGraphQuery(validQuery({ depth: 1 })).ok, true);
  assert.equal(validatePublicGraphQuery({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: "role-1" } }, depth: 2 }).ok, true);
  assertInvalid(validQuery({ depth: 0 }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ depth: 1.5 }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ depth: Number.NaN }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ depth: Number.POSITIVE_INFINITY }), ["INVALID_DEPTH"]);
  assertInvalid(validQuery({ depth: 3 }), ["DEPTH_LIMIT_EXCEEDED"]);
  assertInvalid(validQuery({ limit: 0 }), ["INVALID_LIMIT"]);
  assertInvalid(validQuery({ limit: 1.5 }), ["INVALID_LIMIT"]);
  assertInvalid(validQuery({ limit: Number.NaN }), ["INVALID_LIMIT"]);
  assertInvalid(validQuery({ limit: Number.POSITIVE_INFINITY }), ["INVALID_LIMIT"]);
  assert.equal(validatePublicGraphQuery(validQuery({ limit: 1 })).ok, true);
  assert.equal(validatePublicGraphQuery(validQuery({ limit: PUBLIC_GRAPH_QUERY_LIMITS.maxLimit })).ok, true);
  assertInvalid(validQuery({ limit: PUBLIC_GRAPH_QUERY_LIMITS.maxLimit + 1 }), ["LIMIT_EXCEEDED"]);
});

test("cursor encoded length is bounded for paged queries, while integrity stays with the service", () => {
  const atLimit = "a".repeat(PUBLIC_GRAPH_QUERY_LIMITS.maxCursorLength);
  assert.equal(validatePublicGraphQuery(validQuery({ cursor: atLimit })).ok, true);
  assertInvalid(validQuery({ cursor: `${atLimit}a` }), ["INVALID_CURSOR"]);

  const syntacticallyValidButUnsigned = validatePublicGraphQuery(validQuery({ cursor: syntheticCursorSyntax }));
  assert.equal(syntacticallyValidButUnsigned.ok, true);
});

test("the validator does not mutate input and repeated calls are deterministic", () => {
  const input = validQuery({
    queryType: "CONCEPT_SKILLS",
    root: { type: "CONCEPT", reference: { id: "concept-1", key: "ontology:security:input-validation" } },
    depth: 1,
    limit: 25,
    cursor: syntheticCursorSyntax,
  });
  const before = structuredClone(input);
  const first = validatePublicGraphQuery(input);
  const second = validatePublicGraphQuery(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  if (first.ok) {
    const inputRoot = input.root as MutableQuery;
    assert.notStrictEqual(first.query, input);
    assert.notStrictEqual(first.query.root, input.root);
    assert.notStrictEqual(first.query.root.reference, inputRoot.reference);
  }
});

test("errors contain only stable codes and never reflect raw or private identity values", () => {
  const privateSentinel = "private-role-secret-9f6b";
  const result = validatePublicGraphQuery(validQuery({
    root: { type: "ROLE", reference: { id: privateSentinel, privateIdentity: privateSentinel } },
  }));
  assertInvalid(validQuery({
    root: { type: "ROLE", reference: { id: privateSentinel, privateIdentity: privateSentinel } },
  }), ["UNKNOWN_FIELD"]);
  assert.equal(JSON.stringify(result).includes(privateSentinel), false);
  assert.equal(JSON.stringify(result).includes("query"), false);
});
