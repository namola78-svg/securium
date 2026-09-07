import { createOntologyConceptRelationshipEdges } from "../services/ontology-service.ts";

// Authoring-level Concept refinement. This module is not a DB seed and performs no persistence.
const namespace = "securium";
const key = (slug) => `ontology:${namespace}:${slug}`;

export const SECURIUM_SW_INJECTION_CONCEPTS = Object.freeze({
  injection: Object.freeze({
    key: key("injection"),
    label: "인젝션",
    englishLabel: "Injection",
    aliases: [],
    state: "NEW_AUTHORING_CANDIDATE",
  }),
  codeInjection: Object.freeze({
    key: key("code-injection"),
    label: "코드 인젝션",
    englishLabel: "Code Injection",
    aliases: [],
    state: "NEW_AUTHORING_CANDIDATE",
  }),
  osCommandInjection: Object.freeze({
    key: key("os-command-injection"),
    label: "OS 명령어 인젝션",
    englishLabel: "OS Command Injection",
    aliases: ["Command Injection", "명령어 삽입"],
    state: "NEW_AUTHORING_CANDIDATE",
  }),
});

export const SECURIUM_SW_COARSE_INJECTION_CONCEPT = Object.freeze({
  key: "ontology:security-certification:명령어-및-코드-인젝션",
  treatment: "LEGACY_COARSE_RELATED",
  mutate: false,
});

const relationEvidence = ["securium-sw-security-weakness-concept-relation-refinement-2026-09-05"];

export const SECURIUM_SW_INJECTION_RELATION_EDGES = Object.freeze(
  createOntologyConceptRelationshipEdges({
    parentConceptKey: SECURIUM_SW_INJECTION_CONCEPTS.injection.key,
    childConceptKey: SECURIUM_SW_INJECTION_CONCEPTS.codeInjection.key,
    evidence: relationEvidence,
  })
    .concat(
      createOntologyConceptRelationshipEdges({
        parentConceptKey: SECURIUM_SW_INJECTION_CONCEPTS.injection.key,
        childConceptKey: SECURIUM_SW_INJECTION_CONCEPTS.osCommandInjection.key,
        evidence: relationEvidence,
      }),
    )
    .map((relation) => Object.freeze({ ...relation, status: "DRAFT" })),
);

export const SECURIUM_SW_LESSON_CONCEPT_TARGETS = Object.freeze({
  "SW-W-01": SECURIUM_SW_INJECTION_CONCEPTS.codeInjection.key,
  "SW-W-06": SECURIUM_SW_INJECTION_CONCEPTS.osCommandInjection.key,
});

export const SECURIUM_SW_EVIDENCE_ROLLUP_POLICY = Object.freeze({
  rule: "NARROW_PLUS_BOUNDED_BROADER_ROLLUP",
  narrowToBroad: "PERMITTED_BOUNDED",
  broadToNarrow: "FORBIDDEN",
  siblingToSibling: "FORBIDDEN",
  confidence: "COMPUTE_NARROW_INDEPENDENTLY; BROADER_ROLLUP_CONSERVATIVE",
});
