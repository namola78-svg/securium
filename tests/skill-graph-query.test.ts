import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSkillGraphCursorPositions,
  compareSkillGraphStrings,
  createSkillGraphQueryService,
  SkillGraphError,
  type SkillGraphHop,
  type SkillGraphHopReadInput,
  type SkillGraphRepository,
  type SkillGraphRepositoryNode,
  type SkillGraphResolution,
} from "../lib/services/skill-graph-query.ts";

const role = node("ROLE", "role-1", "role:security:application-security", "Application Security Engineer", ["appsec"]);
const otherRole = node("ROLE", "role-2", "role:security:soc", "SOC Analyst", ["soc"]);
const skill = node("SKILL", "skill-1", "skill:security:secure-code-review", "Secure Code Review", ["secure code review"]);
const otherSkill = node("SKILL", "skill-2", "skill:security:vulnerability-assessment", "Vulnerability Assessment", ["vulnerability assessment"]);
const emptySkill = node("SKILL", "skill-3", "skill:security:empty", "Empty Skill", ["empty skill"]);
const concept = node("CONCEPT", "concept-1", "ontology:security:input-validation", "Input Validation", ["input validation"]);
const otherConcept = node("CONCEPT", "concept-2", "ontology:security:threat-modeling", "Threat Modeling", ["threat modeling"]);
const punctuationSkillDash = node("SKILL", "skill-dash", "skill:a-1", "Dash Skill", []);
const punctuationSkillUnderscore = node("SKILL", "skill-underscore", "skill:a_1", "Underscore Skill", []);

test("Role queries return canonical normalized graph DTOs", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  const result = await service.getRoleSkills({ alias: "AppSec" });
  assert.equal(result.queryType, "ROLE_SKILLS");
  assert.equal(result.depth, 1);
  assert.deepEqual(result.root, { type: "ROLE", id: "role-1" });
  assert.deepEqual(result.nodes.map((item) => item.id), ["role-1", "skill-1", "skill-2"]);
  assert.deepEqual(result.edges.map((item) => item.type), ["ROLE_REQUIRES_SKILL", "ROLE_REQUIRES_SKILL"]);
  assert.equal(result.edges[0]?.id, "rs-1");
  assert.equal("provenanceJson" in result.nodes[0]!, false);
});

test("Role depth-2, Skill-centered, and Concept-centered queries use the canonical paths", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  const roleGraph = await service.getRoleGraph({ id: "role-1" });
  assert.deepEqual(roleGraph.nodes.map((item) => item.id), ["role-1", "skill-1", "skill-2", "concept-1", "concept-2"]);
  assert.deepEqual(roleGraph.edges.map((item) => item.type), [
    "ROLE_REQUIRES_SKILL",
    "ROLE_REQUIRES_SKILL",
    "SKILL_REQUIRES_CONCEPT",
    "SKILL_REQUIRES_CONCEPT",
  ]);

  const skillGraph = await service.getSkillGraph({ skillKey: skill.canonicalKey });
  assert.deepEqual(skillGraph.nodes.map((item) => item.id), ["skill-1", "role-1", "role-2", "concept-1"]);
  assert.deepEqual(skillGraph.edges.map(({ type, source, target }) => ({ type, source, target })), [
    { type: "ROLE_REQUIRES_SKILL", source: { type: "ROLE", id: "role-1" }, target: { type: "SKILL", id: "skill-1" } },
    { type: "ROLE_REQUIRES_SKILL", source: { type: "ROLE", id: "role-2" }, target: { type: "SKILL", id: "skill-1" } },
    { type: "SKILL_REQUIRES_CONCEPT", source: { type: "SKILL", id: "skill-1" }, target: { type: "CONCEPT", id: "concept-1" } },
  ]);

  const conceptGraph = await service.getConceptGraph({ key: concept.canonicalKey });
  assert.deepEqual(conceptGraph.nodes.map((item) => item.id), ["concept-1", "skill-1", "skill-2", "role-1", "role-2"]);
  assert.equal(conceptGraph.edges.some((item) => item.type === "ROLE_REQUIRES_SKILL" && item.source.id === "concept-1"), false);
});

test("all direct query contracts support both directions and valid empty roots", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  assert.deepEqual((await service.getSkillRoles({ id: skill.id })).nodes.map((item) => item.id), ["skill-1", "role-1", "role-2"]);
  assert.deepEqual((await service.getSkillConcepts({ alias: "secure code review" })).nodes.map((item) => item.id), ["skill-1", "concept-1"]);
  assert.deepEqual((await service.getConceptSkills({ alias: "input validation" })).nodes.map((item) => item.id), ["concept-1", "skill-1", "skill-2"]);
  const empty = await service.getSkillConcepts({ id: emptySkill.id });
  assert.deepEqual(empty.nodes.map((item) => item.id), [emptySkill.id]);
  assert.deepEqual(empty.edges, []);
});

test("Skill identity conflicts and ambiguous aliases fail closed", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  await assert.rejects(
    service.getSkillConcepts({ id: skill.id, skillKey: otherSkill.canonicalKey }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "IDENTITY_CONFLICT",
  );
  await assert.rejects(
    service.getSkillConcepts({ alias: "shared skill" }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "AMBIGUOUS_ALIAS",
  );
  await assert.rejects(
    service.getSkillConcepts({ id: skill.id, alias: "missing alias" }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "IDENTITY_CONFLICT",
  );
});

test("Role and Concept resolution preserve their existing repository semantics", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  await assert.rejects(
    service.getRoleSkills({ id: role.id, roleKey: otherRole.canonicalKey }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "IDENTITY_CONFLICT",
  );
  await assert.rejects(
    service.getRoleSkills({ alias: "shared role" }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "AMBIGUOUS_ALIAS",
  );
  await assert.rejects(
    service.getConceptSkills({ id: "missing" }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "NOT_FOUND",
  );
});

test("depth, fan-out, and cursor bounds are enforced", async () => {
  const service = createSkillGraphQueryService(fixtureRepository(), {
    perHopDefault: 1,
    perHopHardMax: 2,
    totalNodeHardMax: 10,
    totalEdgeHardMax: 10,
    exactAliasCandidateHardMax: 20,
  });
  await assert.rejects(
    service.querySkillGraph({ queryType: "ROLE_SKILLS", root: { type: "ROLE", reference: { id: role.id } }, depth: 3 }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "DEPTH_LIMIT_EXCEEDED",
  );
  await assert.rejects(
    createSkillGraphQueryService(fixtureRepository({ duplicateRoleSkill: true }), {
      perHopDefault: 1,
      perHopHardMax: 2,
      totalNodeHardMax: 10,
      totalEdgeHardMax: 10,
      exactAliasCandidateHardMax: 20,
    }).getRoleGraph({ id: role.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "FAN_OUT_LIMIT_EXCEEDED",
  );

  const paged = createSkillGraphQueryService(fixtureRepository()).getRoleSkills({ id: role.id }, { limit: 1 });
  const first = await paged;
  assert.equal(first.page?.hasMore, true);
  const cursor = first.page?.nextCursor;
  if (!cursor) throw new Error("Expected a cursor for the first page.");
  const second = await createSkillGraphQueryService(fixtureRepository()).getRoleSkills({ id: role.id }, { limit: 1, cursor });
  assert.deepEqual(second.nodes.map((item) => item.id), ["role-1", "skill-2"]);
});

test("depth-2 requested limits are respected and depth-2 overflow is rejected", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  const defaultResult = await service.querySkillGraph({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: role.id } }, depth: 2 });
  assert.equal(defaultResult.nodes.length, 5);
  await assert.rejects(
    service.querySkillGraph({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: role.id } }, depth: 2, limit: 1 }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "FAN_OUT_LIMIT_EXCEEDED",
  );
  const hardResult = await service.querySkillGraph({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: role.id } }, depth: 2, limit: 500 });
  assert.equal(hardResult.nodes.length, 5);
  await assert.rejects(
    service.querySkillGraph({ queryType: "ROLE_GRAPH", root: { type: "ROLE", reference: { id: role.id } }, depth: 2, limit: 501 }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "FAN_OUT_LIMIT_EXCEEDED",
  );
});

test("closed edge types and endpoint families fail closed", async () => {
  await assert.rejects(
    createSkillGraphQueryService(fixtureRepository({ unknownEdge: true })).getSkillGraph({ id: skill.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "INTERNAL_ERROR",
  );
  await assert.rejects(
    createSkillGraphServiceWithOptions({ malformedEdge: true }).getRoleSkills({ id: role.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "INTERNAL_ERROR",
  );
});

test("cursor integrity rejects pagination-state tampering and malformed payloads", async () => {
  const service = createSkillGraphQueryService(fixtureRepository());
  const first = await service.getRoleSkills({ id: role.id }, { limit: 1 });
  const cursor = first.page?.nextCursor;
  if (!cursor) throw new Error("Expected a cursor for tampering tests.");
  const mutations = [
    (payload: Record<string, unknown>) => { payload.canonicalKey = "skill:tampered"; },
    (payload: Record<string, unknown>) => { payload.stableId = "skill-tampered"; },
    (payload: Record<string, unknown>) => { payload.fingerprint = String(payload.fingerprint).replace('"rootId":"role-1"', '"rootId":"role-2"'); },
    (payload: Record<string, unknown>) => { payload.fingerprint = String(payload.fingerprint).replace('"queryType":"ROLE_SKILLS"', '"queryType":"SKILL_ROLES"'); },
    (payload: Record<string, unknown>) => { payload.fingerprint = String(payload.fingerprint).replace('"depth":1', '"depth":2'); },
    (payload: Record<string, unknown>) => { payload.fingerprint = String(payload.fingerprint).replace('"limit":1', '"limit":2'); },
    (payload: Record<string, unknown>) => { payload.fingerprint = String(payload.fingerprint).replace('skill-graph.order.v1', 'skill-graph.order.v2'); },
  ];
  for (const mutate of mutations) {
    await assert.rejects(
      service.getRoleSkills({ id: role.id }, { limit: 1, cursor: mutateCursor(cursor, mutate) }),
      (error: unknown) => error instanceof SkillGraphError && error.code === "INVALID_QUERY",
    );
  }
  for (const malformed of ["", "not-base64", mutateCursor(cursor, (payload) => { payload.cursorVersion = "wrong"; }), mutateCursor(cursor, (payload) => { payload.extra = true; })]) {
    await assert.rejects(
      service.getRoleSkills({ id: role.id }, { limit: 1, cursor: malformed }),
      (error: unknown) => error instanceof SkillGraphError && error.code === "INVALID_QUERY",
    );
  }
});

test("pagination uses deterministic provider-independent key ordering", async () => {
  const repository = fixtureRepository({ punctuation: true });
  const service = createSkillGraphQueryService(repository);
  const first = await service.getRoleSkills({ id: role.id }, { limit: 1 });
  const cursor = first.page?.nextCursor;
  if (!cursor) throw new Error("Expected a punctuation cursor.");
  assert.deepEqual(first.nodes.map((item) => item.id), [role.id, punctuationSkillDash.id]);
  const second = await createSkillGraphQueryService(fixtureRepository({ punctuation: true })).getRoleSkills({ id: role.id }, { limit: 1, cursor });
  assert.deepEqual(second.nodes.map((item) => item.id), [role.id, punctuationSkillUnderscore.id]);
});

test("alias candidate overflow remains fail closed", async () => {
  await assert.rejects(
    createSkillGraphServiceWithOptions({ aliasOverflow: true }).getSkillConcepts({ alias: "overflow alias" }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "AMBIGUOUS_ALIAS",
  );
});

test("duplicate edges are suppressed and orphan relations fail closed", async () => {
  const duplicateRepository = fixtureRepository({ duplicateRoleSkill: true });
  const service = createSkillGraphQueryService(duplicateRepository);
  const result = await service.getRoleSkills({ id: role.id });
  assert.equal(result.edges.length, 2);
  assert.deepEqual(result.edges.map((item) => item.id), ["rs-1", "rs-2"]);

  const orphanService = createSkillGraphQueryService(fixtureRepository({ orphan: true }));
  await assert.rejects(
    orphanService.getRoleSkills({ id: role.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "ORPHAN_RELATION",
  );
});

test("conflicting relation identities and malformed edge endpoints fail closed", async () => {
  await assert.rejects(
    createSkillGraphQueryService(fixtureRepository({ conflictingDuplicate: true })).getRoleSkills({ id: role.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "INTERNAL_ERROR",
  );
  await assert.rejects(
    createSkillGraphQueryService(fixtureRepository({ malformedEdge: true })).getRoleSkills({ id: role.id }),
    (error: unknown) => error instanceof SkillGraphError && error.code === "INTERNAL_ERROR",
  );
});

test("depth-2 traversal remains batched rather than N+1", async () => {
  const repository = fixtureRepository();
  const service = createSkillGraphQueryService(repository);
  await service.getRoleGraph({ id: role.id });
  assert.deepEqual(repository.calls, {
    resolveRole: 1,
    resolveSkill: 0,
    resolveConcept: 0,
    roleToSkills: 1,
    skillToConcepts: 1,
    skillToRoles: 0,
    conceptToSkills: 0,
  });
});

function createSkillGraphServiceWithOptions(options: Parameters<typeof fixtureRepository>[0]) {
  return createSkillGraphQueryService(fixtureRepository(options));
}

function fixtureRepository(options: { duplicateRoleSkill?: boolean; conflictingDuplicate?: boolean; malformedEdge?: boolean; orphan?: boolean; unknownEdge?: boolean; punctuation?: boolean; aliasOverflow?: boolean } = {}) {
  const calls = {
    resolveRole: 0,
    resolveSkill: 0,
    resolveConcept: 0,
    roleToSkills: 0,
    skillToConcepts: 0,
    skillToRoles: 0,
    conceptToSkills: 0,
  };
  const repository: SkillGraphRepository & { calls: typeof calls } = {
    calls,
    async resolveRole(reference) {
      calls.resolveRole += 1;
      const alias = reference.alias?.normalize("NFKC").trim().toLowerCase();
      if (reference.alias === "shared role") return { kind: "AMBIGUOUS_ALIAS", candidateIds: [role.id, otherRole.id] };
      if (reference.id === role.id && reference.roleKey === otherRole.canonicalKey) return { kind: "IDENTITY_CONFLICT", candidateIds: [role.id, otherRole.id] };
      if (reference.id === role.id || reference.roleKey === role.canonicalKey || alias === "appsec") return resolved(role);
      return { kind: "NOT_FOUND" };
    },
    async resolveSkill(reference) {
      calls.resolveSkill += 1;
      if (options.aliasOverflow && reference.alias === "overflow alias") return { kind: "AMBIGUOUS_ALIAS", candidateIds: Array.from({ length: 21 }, (_, index) => `skill-${index + 1}`) };
      if (reference.alias === "shared skill") return { kind: "AMBIGUOUS_ALIAS", candidateIds: [skill.id, otherSkill.id] };
      if (reference.id === skill.id && (reference.skillKey === otherSkill.canonicalKey || reference.alias === "missing alias")) return { kind: "IDENTITY_CONFLICT", candidateIds: [skill.id, otherSkill.id] };
      if (reference.id === skill.id || reference.skillKey === skill.canonicalKey || reference.alias === "secure code review") return resolved(skill);
      if (reference.id === otherSkill.id) return resolved(otherSkill);
      if (reference.id === emptySkill.id) return resolved(emptySkill);
      return { kind: "NOT_FOUND" };
    },
    async resolveConcept(reference) {
      calls.resolveConcept += 1;
      if (reference.id === concept.id || reference.key === concept.canonicalKey || reference.alias === "input validation") return resolved(concept);
      return { kind: "NOT_FOUND" };
    },
    async readRoleToSkills(input) {
      calls.roleToSkills += 1;
      if (input.sourceIds[0] !== role.id) return page([], input);
      if (options.punctuation) return page([
        hop("rs-punctuation-underscore", "ROLE_REQUIRES_SKILL", role, punctuationSkillUnderscore),
        hop("rs-punctuation-dash", "ROLE_REQUIRES_SKILL", role, punctuationSkillDash),
      ], input);
      const hops = [
        hop("rs-2", "ROLE_REQUIRES_SKILL", role, otherSkill),
        hop("rs-1", "ROLE_REQUIRES_SKILL", role, skill),
        ...(options.duplicateRoleSkill ? [hop("rs-1", "ROLE_REQUIRES_SKILL", role, skill)] : []),
        ...(options.conflictingDuplicate ? [hop("rs-1", "ROLE_REQUIRES_SKILL", role, otherSkill)] : []),
      ];
      if (options.malformedEdge) hops.push({ edge: { id: "rs-malformed", type: "ROLE_REQUIRES_SKILL", source: ref(role), target: ref(otherConcept), relationVersion: 1 }, target: otherConcept });
      if (options.orphan) hops.push({ edge: { id: "rs-orphan", type: "ROLE_REQUIRES_SKILL", source: ref(role), target: ref(otherSkill), relationVersion: 1 }, target: undefined });
      return page(hops, input);
    },
    async readSkillToConcepts(input) {
      calls.skillToConcepts += 1;
      const hops = input.sourceIds.flatMap((id) => id === skill.id ? [options.unknownEdge
        ? { ...hop("sc-unknown", "UNKNOWN_EDGE" as "SKILL_REQUIRES_CONCEPT", skill, concept), edge: { ...hop("sc-unknown", "SKILL_REQUIRES_CONCEPT", skill, concept).edge, type: "UNKNOWN_EDGE" as "SKILL_REQUIRES_CONCEPT" } }
        : hop("sc-1", "SKILL_REQUIRES_CONCEPT", skill, concept)] : id === otherSkill.id ? [hop("sc-2", "SKILL_REQUIRES_CONCEPT", otherSkill, otherConcept)] : []);
      return page(hops, input);
    },
    async readSkillToRoles(input) {
      calls.skillToRoles += 1;
      const hops = input.sourceIds.flatMap((id) => id === skill.id ? [reverseHop("rs-1", "ROLE_REQUIRES_SKILL", role, skill), reverseHop("rs-3", "ROLE_REQUIRES_SKILL", otherRole, skill)] : []);
      return page(hops, input);
    },
    async readConceptToSkills(input) {
      calls.conceptToSkills += 1;
      const hops = input.sourceIds.flatMap((id) => id === concept.id ? [reverseHop("sc-1", "SKILL_REQUIRES_CONCEPT", skill, concept), reverseHop("sc-2", "SKILL_REQUIRES_CONCEPT", otherSkill, concept)] : []);
      return page(hops, input);
    },
  };
  return repository;
}

function resolved(item: SkillGraphRepositoryNode): SkillGraphResolution {
  return { kind: "RESOLVED", node: item };
}

function node(type: SkillGraphRepositoryNode["type"], id: string, canonicalKey: string, label: string, aliases: string[]): SkillGraphRepositoryNode {
  return { type, id, canonicalKey, label, aliases, sourceType: "TEST" };
}

function ref(item: SkillGraphRepositoryNode) {
  return { type: item.type, id: item.id } as const;
}

function hop(id: string, type: "ROLE_REQUIRES_SKILL" | "SKILL_REQUIRES_CONCEPT", source: SkillGraphRepositoryNode, target: SkillGraphRepositoryNode): SkillGraphHop {
  return {
    edge: { id, type, source: ref(source), target: ref(target), relationVersion: 1, sourceType: "TEST" },
    target,
  };
}

function reverseHop(id: string, type: "ROLE_REQUIRES_SKILL" | "SKILL_REQUIRES_CONCEPT", canonicalSource: SkillGraphRepositoryNode, canonicalTarget: SkillGraphRepositoryNode): SkillGraphHop {
  return {
    edge: { id, type, source: ref(canonicalSource), target: ref(canonicalTarget), relationVersion: 1, sourceType: "TEST" },
    target: canonicalSource,
  };
}

function page(hops: SkillGraphHop[], input: SkillGraphHopReadInput) {
  const ordered = [...hops].sort((left, right) => {
    const leftTarget = left.target;
    const rightTarget = right.target;
    if (!leftTarget || !rightTarget) return leftTarget ? -1 : rightTarget ? 1 : compareSkillGraphStrings(left.edge.id, right.edge.id);
    return compareSkillGraphStrings(leftTarget.canonicalKey, rightTarget.canonicalKey) || compareSkillGraphStrings(leftTarget.id, rightTarget.id) || compareSkillGraphStrings(left.edge.id, right.edge.id);
  });
  const after = input.after;
  const filtered = after
    ? ordered.filter((item) => {
        const target = item.target;
        return Boolean(target && compareSkillGraphCursorPositions({ canonicalKey: target.canonicalKey, stableId: target.id }, after) > 0);
      })
    : ordered;
  const overflow = filtered.length > input.limit;
  const selected = filtered.slice(0, input.limit);
  const last = selected.at(-1)?.target;
  return {
    hops: selected,
    hasMore: overflow,
    overflow,
    last: last ? { canonicalKey: last.canonicalKey, stableId: last.id } : undefined,
  };
}

function mutateCursor(cursor: string, mutate: (payload: Record<string, unknown>) => void) {
  const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
  mutate(payload);
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}
