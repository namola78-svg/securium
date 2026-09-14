import {
  PUBLIC_GRAPH_SCHEMA_VERSION,
  type PublicGraphEdgeType,
  type PublicGraphNodeType,
} from "../../lib/services/public-graph-response-validation.ts";

export type SyntheticVisibility = "PUBLIC" | "PRIVATE";

export type SyntheticSourceNode = {
  readonly id: string;
  readonly type: PublicGraphNodeType;
  readonly label: string;
  readonly visibility: SyntheticVisibility;
};

export type SyntheticSourceEdge = {
  readonly id: string;
  readonly type: PublicGraphEdgeType;
  readonly sourceId: string;
  readonly targetId: string;
  readonly visibility: SyntheticVisibility;
};

export type SyntheticSourceFixture = {
  readonly nodes: readonly SyntheticSourceNode[];
  readonly edges: readonly SyntheticSourceEdge[];
};

export const SYNTHETIC_SOURCE_FIXTURE: SyntheticSourceFixture = {
  nodes: [
    { id: "role-1", type: "ROLE", label: "Application Security Engineer", visibility: "PUBLIC" },
    { id: "skill-1", type: "SKILL", label: "Secure Code Review", visibility: "PUBLIC" },
    { id: "concept-1", type: "CONCEPT", label: "Input Validation", visibility: "PUBLIC" },
    { id: "skill-private", type: "SKILL", label: "Private Skill Sentinel", visibility: "PRIVATE" },
    { id: "concept-private", type: "CONCEPT", label: "Private Concept Sentinel", visibility: "PRIVATE" },
  ],
  edges: [
    {
      id: "rs-public",
      type: "ROLE_REQUIRES_SKILL",
      sourceId: "role-1",
      targetId: "skill-1",
      visibility: "PUBLIC",
    },
    {
      id: "sc-public",
      type: "SKILL_REQUIRES_CONCEPT",
      sourceId: "skill-1",
      targetId: "concept-1",
      visibility: "PUBLIC",
    },
    {
      id: "rs-private",
      type: "ROLE_REQUIRES_SKILL",
      sourceId: "role-1",
      targetId: "skill-private",
      visibility: "PRIVATE",
    },
    {
      id: "sc-private",
      type: "SKILL_REQUIRES_CONCEPT",
      sourceId: "skill-private",
      targetId: "concept-private",
      visibility: "PRIVATE",
    },
    {
      id: "bypass-private",
      type: "SKILL_REQUIRES_CONCEPT",
      sourceId: "role-1",
      targetId: "concept-1",
      visibility: "PRIVATE",
    },
  ],
};

// This is a manually authored expected projection, kept independent of the validator.
export const EXPECTED_PUBLIC_GRAPH_RESPONSE = {
  schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
  status: "OK",
  data: {
    schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
    queryType: "ROLE_GRAPH",
    depth: 2,
    root: { type: "ROLE", publicId: "role:role-1" },
    nodes: [
      {
        type: "ROLE",
        publicId: "role:role-1",
        key: "role:security:application-security",
        label: "Application Security Engineer",
        aliases: ["appsec"],
      },
      {
        type: "SKILL",
        publicId: "skill:skill-1",
        key: "skill:security:secure-code-review",
        label: "Secure Code Review",
        aliases: ["secure code review"],
      },
      {
        type: "CONCEPT",
        publicId: "concept:concept-1",
        key: "ontology:security:input-validation",
        label: "Input Validation",
        aliases: ["input validation"],
      },
    ],
    edges: [
      {
        type: "ROLE_REQUIRES_SKILL",
        source: { type: "ROLE", publicId: "role:role-1" },
        target: { type: "SKILL", publicId: "skill:skill-1" },
      },
      {
        type: "SKILL_REQUIRES_CONCEPT",
        source: { type: "SKILL", publicId: "skill:skill-1" },
        target: { type: "CONCEPT", publicId: "concept:concept-1" },
      },
    ],
  },
  page: null,
} as const;

export const EXPECTED_EMPTY_GRAPH_RESPONSE = {
  schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
  status: "EMPTY",
  data: null,
  page: null,
} as const;

function publicId(type: PublicGraphNodeType, index: number): string {
  return `${type.toLowerCase()}:${type.toLowerCase()}-${index}`;
}

function generatedNode(type: PublicGraphNodeType, index: number) {
  return {
    type,
    publicId: publicId(type, index),
    key: `${type.toLowerCase()}:synthetic-${index}`,
    label: `${type} ${index}`,
    aliases: [],
  } as const;
}

function generatedReference(type: PublicGraphNodeType, index: number) {
  return { type, publicId: publicId(type, index) } as const;
}

export function createNodeLimitBoundaryResponse() {
  const nodes = [
    generatedNode("ROLE", 0),
    ...Array.from({ length: 499 }, (_, index) => generatedNode("SKILL", index)),
    ...Array.from({ length: 500 }, (_, index) => generatedNode("CONCEPT", index)),
  ];
  const edges = [
    ...Array.from({ length: 499 }, (_, index) => ({
      type: "ROLE_REQUIRES_SKILL" as const,
      source: generatedReference("ROLE", 0),
      target: generatedReference("SKILL", index),
    })),
    ...Array.from({ length: 500 }, (_, index) => ({
      type: "SKILL_REQUIRES_CONCEPT" as const,
      source: generatedReference("SKILL", index % 499),
      target: generatedReference("CONCEPT", index),
    })),
  ];

  return {
    schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
    status: "OK" as const,
    data: {
      schemaVersion: PUBLIC_GRAPH_SCHEMA_VERSION,
      queryType: "ROLE_GRAPH" as const,
      depth: 2 as const,
      root: generatedReference("ROLE", 0),
      nodes,
      edges,
    },
    page: null,
  };
}

export function createEdgeLimitBoundaryResponse() {
  const response = createNodeLimitBoundaryResponse();
  const edges = [
    ...Array.from({ length: 499 }, (_, index) => ({
      type: "ROLE_REQUIRES_SKILL" as const,
      source: generatedReference("ROLE", 0),
      target: generatedReference("SKILL", index),
    })),
    ...Array.from({ length: 500 }, (_, conceptIndex) => ({
      type: "SKILL_REQUIRES_CONCEPT" as const,
      source: generatedReference("SKILL", 0),
      target: generatedReference("CONCEPT", conceptIndex),
    })),
    ...Array.from({ length: 500 }, (_, conceptIndex) => ({
      type: "SKILL_REQUIRES_CONCEPT" as const,
      source: generatedReference("SKILL", 1),
      target: generatedReference("CONCEPT", conceptIndex),
    })),
    ...Array.from({ length: 500 }, (_, conceptIndex) => ({
      type: "SKILL_REQUIRES_CONCEPT" as const,
      source: generatedReference("SKILL", 2),
      target: generatedReference("CONCEPT", conceptIndex),
    })),
    {
      type: "SKILL_REQUIRES_CONCEPT" as const,
      source: generatedReference("SKILL", 3),
      target: generatedReference("CONCEPT", 0),
    },
  ];

  return {
    ...response,
    data: {
      ...response.data,
      edges,
    },
  };
}
