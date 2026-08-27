import { AppError } from "../errors.ts";
import {
  CS1A_HUMAN_DECISION_ARTIFACT_V1,
  CS1A_HUMAN_DECISION_HASH_V1,
  buildCanonicalHumanDecisionProjection,
  verifyHumanDecisionArtifact,
  type Cs1aHumanDecisionArtifact,
  type Cs1aHumanDecisionInput,
  type Cs1aHumanDecisionProjection,
} from "./cs1a-human-decision.ts";
import type { Cs1aDecision, Cs1aPublicationAuthority } from "./cs1a-contract.ts";
import { canonicalJson } from "./canonical-json.ts";

export type Cs1aExecutionVerificationInput = Readonly<{
  artifact: unknown;
  expectedDecisionSet: Cs1aHumanDecisionInput;
  expectedDecision: Cs1aDecision;
  expectedPublicationAuthority: Cs1aPublicationAuthority;
}>;

export type VerifiedCs1aDecisionSemantics = Readonly<{
  artifactSource: "ARTIFACT_SUPPLIED";
  projectionSource: "RECOMPUTED";
  contractVersion: typeof CS1A_HUMAN_DECISION_HASH_V1;
  projection: Cs1aHumanDecisionProjection;
  humanDecisionHash: string;
  subjectCount: number;
  governanceScopes: readonly string[];
  decision: Cs1aDecision;
  reasonCodes: readonly string[];
  publicationAuthority: Cs1aPublicationAuthority;
}>;

export function verifyCs1aDecisionSemantics(
  input: Cs1aExecutionVerificationInput,
): VerifiedCs1aDecisionSemantics {
  const artifact = assertArtifactShape(input.artifact);
  const expectedProjection = buildCanonicalHumanDecisionProjection(input.expectedDecisionSet);
  const expectedDecision = input.expectedDecision;
  const expectedPublicationAuthority = input.expectedPublicationAuthority;

  if (artifact.contractVersion !== CS1A_HUMAN_DECISION_HASH_V1) {
    fail("CS1A_EXECUTION_UNSUPPORTED_CONTRACT");
  }
  if (artifact.projection.contractVersion !== CS1A_HUMAN_DECISION_HASH_V1) {
    fail("CS1A_EXECUTION_UNSUPPORTED_CONTRACT");
  }

  const recomputedHash = verifyHumanDecisionArtifact(artifact);
  if (canonicalJson(artifact.projection) !== canonicalJson(expectedProjection)) {
    fail("CS1A_EXECUTION_SUBJECT_SET_MISMATCH");
  }
  if (recomputedHash !== artifact.humanDecisionHash) {
    fail("CS1A_EXECUTION_HUMAN_DECISION_HASH_MISMATCH");
  }

  const subjects = artifact.projection.subjects;
  if (subjects.length === 0 || subjects.some((subject) => subject.decision !== expectedDecision)) {
    fail("CS1A_EXECUTION_DECISION_MISMATCH");
  }
  if (subjects.some((subject) => subject.publicationAuthority !== expectedPublicationAuthority)) {
    fail("CS1A_EXECUTION_PUBLICATION_AUTHORITY_MISMATCH");
  }

  return Object.freeze({
    artifactSource: "ARTIFACT_SUPPLIED",
    projectionSource: "RECOMPUTED",
    contractVersion: CS1A_HUMAN_DECISION_HASH_V1,
    projection: artifact.projection,
    humanDecisionHash: recomputedHash,
    subjectCount: subjects.length,
    governanceScopes: Object.freeze([...new Set(subjects.map((subject) => String(subject.governanceScope)))]),
    decision: expectedDecision,
    reasonCodes: Object.freeze([...new Set(subjects.map((subject) => String(subject.reasonCode)))]),
    publicationAuthority: expectedPublicationAuthority,
  });
}

function assertArtifactShape(value: unknown): Cs1aHumanDecisionArtifact {
  if (!value || typeof value !== "object") fail("CS1A_EXECUTION_ARTIFACT_INVALID");
  const artifact = value as Partial<Cs1aHumanDecisionArtifact>;
  if (artifact.artifactVersion !== CS1A_HUMAN_DECISION_ARTIFACT_V1) {
    fail("CS1A_EXECUTION_ARTIFACT_INVALID");
  }
  if (!artifact.projection || typeof artifact.projection !== "object") {
    fail("CS1A_EXECUTION_ARTIFACT_INVALID");
  }
  return artifact as Cs1aHumanDecisionArtifact;
}

function fail(code: string): never {
  throw new AppError("CS-1A governance execution verification failed.", 400, code);
}
