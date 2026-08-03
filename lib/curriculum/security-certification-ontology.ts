import { officialSecurityCertificationContents, officialSecurityCertificationCourseLessons } from "../data/security-certification-course-lessons.mjs";
import { applicationSecurityQuestionSamples } from "../data/security-certification-application-security-questions.mjs";
import { securityCertificationInformationSecurityGeneralQuestionSamples } from "../data/security-certification-information-security-general-questions.mjs";
import { managementLawQuestionSamples } from "../data/security-certification-management-law-questions.mjs";
import { networkSecurityQuestionSamples } from "../data/security-certification-network-security-questions.mjs";
import { practicalSecurityQuestionSamples } from "../data/security-certification-practical-questions.mjs";
import { systemSecurityQuestionSamples } from "../data/security-certification-system-security-questions.mjs";
import type { ConceptAwareRetrievalCandidate } from "../ai/retrieval-provider.ts";
import {
  createOntologyEdge,
  createCurriculumContentOntologyEdges,
  createOntologyConceptKey,
  dedupeOntologyConcepts,
  rankOntologyCoverageGaps,
  type OntologyConcept,
  type OntologyCoverageGap,
  type OntologyEdge,
} from "../services/ontology-service.ts";
import {
  flattenOfficialCurriculumTree,
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  type FlattenedOfficialCurriculumNode,
  type OfficialCurriculumTreeDefinition,
} from "./security-certification-standards.ts";

type OfficialSecurityCertificationContent = {
  id: string;
  title: string;
  canonicalKey: string;
  coreConcepts?: string[];
};

type OfficialSecurityCertificationCourseLesson = {
  id: string;
  courseId: string;
  curriculumNodeId: string;
  contentId: string;
  isRequired?: boolean;
};

type SecurityCertificationQuestionSeed = {
  id: string;
  courseLinks: Array<{
    courseId: string;
  }>;
  contentLinks?: Array<{
    contentType: string;
    contentId: string;
  }>;
};

export type SecurityCertificationOntologyCoverageSummary = {
  treeId: string;
  courseId: string;
  totalNodeCount: number;
  requiredNodeCount: number;
  linkedCurriculumNodeCount: number;
  courseLessonEdgeCount: number;
  conceptEdgeCount: number;
  questionContentEdgeCount: number;
  questionConceptEdgeCount: number;
  gapCount: number;
  topGapIds: string[];
};

const NAMESPACE = "security-certification";
const officialContents =
  officialSecurityCertificationContents as OfficialSecurityCertificationContent[];
const officialCourseLessons =
  officialSecurityCertificationCourseLessons as OfficialSecurityCertificationCourseLesson[];
const officialQuestionSamples = [
  ...networkSecurityQuestionSamples,
  ...systemSecurityQuestionSamples,
  ...applicationSecurityQuestionSamples,
  ...securityCertificationInformationSecurityGeneralQuestionSamples,
  ...managementLawQuestionSamples,
  ...practicalSecurityQuestionSamples,
] as SecurityCertificationQuestionSeed[];

export function officialCurriculumNodeId(stableKey: string) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
}

export function buildSecurityCertificationOntologyConcepts(): OntologyConcept[] {
  const nodeConcepts = SECURITY_CERTIFICATION_CURRICULUM_TREES.flatMap((tree) =>
    flattenOfficialCurriculumTree(tree).map((node) => ({
      label: node.title,
      namespace: NAMESPACE,
      category: node.officialLevel.toLowerCase(),
      sourceType: "CURRICULUM_NODE" as const,
      sourceId: officialCurriculumNodeId(node.stableKey),
      weight: node.importance ?? (node.isRequired ? 10 : 1),
    })),
  );

  const contentConcepts = officialContents.flatMap((content) =>
    (content.coreConcepts ?? []).map((label) => ({
      label,
      namespace: NAMESPACE,
      category: "content-core-concept",
      sourceType: "CONTENT" as const,
      sourceId: content.id,
      weight: 20,
    })),
  );

  return dedupeOntologyConcepts([...nodeConcepts, ...contentConcepts]);
}

export function buildSecurityCertificationOntologyEdges(): OntologyEdge[] {
  return uniqueOntologyEdges([
    ...buildSecurityCertificationCurriculumContentOntologyEdges(),
    ...buildSecurityCertificationQuestionOntologyEdges(),
  ]);
}

function buildSecurityCertificationCurriculumContentOntologyEdges(): OntologyEdge[] {
  const contentById = new Map(officialContents.map((content) => [content.id, content]));
  const flattenedNodeIds = new Set(
    SECURITY_CERTIFICATION_CURRICULUM_TREES.flatMap((tree) =>
      flattenOfficialCurriculumTree(tree).map((node) =>
        officialCurriculumNodeId(node.stableKey),
      ),
    ),
  );

  return officialCourseLessons.flatMap((courseLesson) => {
    const content = contentById.get(courseLesson.contentId);
    if (!content || !flattenedNodeIds.has(courseLesson.curriculumNodeId)) {
      return [];
    }

    const conceptIds = (content.coreConcepts ?? []).map((concept) =>
      createOntologyConceptKey(concept, NAMESPACE),
    );

    return createCurriculumContentOntologyEdges({
      courseId: courseLesson.courseId,
      curriculumNodeId: courseLesson.curriculumNodeId,
      courseLessonId: courseLesson.id,
      contentId: courseLesson.contentId,
      conceptIds,
      evidence: [content.canonicalKey],
    });
  });
}

export function buildSecurityCertificationQuestionOntologyEdges(): OntologyEdge[] {
  const contentById = new Map(officialContents.map((content) => [content.id, content]));
  const edges: OntologyEdge[] = [];

  for (const question of officialQuestionSamples) {
    const linkedContentIds = uniqueStrings(
      (question.contentLinks ?? [])
        .filter((link) => link.contentType === "CONTENT")
        .map((link) => link.contentId)
        .filter((contentId) => contentById.has(contentId)),
    );

    for (const courseLink of question.courseLinks) {
      for (const contentId of linkedContentIds) {
        const content = contentById.get(contentId);
        if (!content) continue;

        edges.push(
          createOntologyEdge({
            courseId: courseLink.courseId,
            fromType: "QUESTION",
            fromId: question.id,
            toType: "CONTENT",
            toId: contentId,
            relation: "DERIVED_FROM",
            confidence: 0.8,
            evidence: [content.canonicalKey],
          }),
        );

        for (const concept of content.coreConcepts ?? []) {
          edges.push(
            createOntologyEdge({
              courseId: courseLink.courseId,
              fromType: "QUESTION",
              fromId: question.id,
              toType: "CONCEPT",
              toId: createOntologyConceptKey(concept, NAMESPACE),
              relation: "TESTS",
              confidence: 0.75,
              evidence: [content.canonicalKey],
            }),
          );
        }
      }
    }
  }

  return uniqueOntologyEdges(edges);
}

export function getSecurityCertificationOntologyCoverageSummaries(): SecurityCertificationOntologyCoverageSummary[] {
  const edges = buildSecurityCertificationOntologyEdges();

  return SECURITY_CERTIFICATION_CURRICULUM_TREES.map((tree) => {
    const nodes = flattenOfficialCurriculumTree(tree);
    const coverageNodes = nodes.map((node) =>
      toCoverageNode(tree, node),
    );
    const gaps = rankOntologyCoverageGaps({
      curriculumNodes: coverageNodes,
      edges,
    });
    const linkedNodeIds = new Set(
      edges
        .filter(
          (edge) =>
            edge.courseId === tree.courseId &&
            edge.fromType === "CURRICULUM_NODE" &&
            edge.relation === "COVERS",
        )
        .map((edge) => edge.fromId),
    );
    const conceptEdgeCount = edges.filter(
      (edge) =>
        edge.courseId === tree.courseId &&
        edge.fromType === "CONTENT" &&
        edge.toType === "CONCEPT",
    ).length;
    const questionContentEdgeCount = edges.filter(
      (edge) =>
        edge.courseId === tree.courseId &&
        edge.fromType === "QUESTION" &&
        edge.toType === "CONTENT",
    ).length;
    const questionConceptEdgeCount = edges.filter(
      (edge) =>
        edge.courseId === tree.courseId &&
        edge.fromType === "QUESTION" &&
        edge.toType === "CONCEPT",
    ).length;

    return {
      treeId: tree.treeId,
      courseId: tree.courseId,
      totalNodeCount: nodes.length,
      requiredNodeCount: nodes.filter((node) => node.isRequired).length,
      linkedCurriculumNodeCount: linkedNodeIds.size,
      courseLessonEdgeCount: edges.filter(
        (edge) =>
          edge.courseId === tree.courseId &&
          edge.fromType === "CURRICULUM_NODE" &&
          edge.toType === "COURSE_LESSON",
      ).length,
      conceptEdgeCount,
      questionContentEdgeCount,
      questionConceptEdgeCount,
      gapCount: gaps.length,
      topGapIds: gaps.slice(0, 10).map((gap) => gap.id),
    };
  });
}

export function getSecurityCertificationOntologyGaps(
  treeId: string,
): OntologyCoverageGap[] {
  const tree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
    (candidate) => candidate.treeId === treeId,
  );
  if (!tree) return [];

  return rankOntologyCoverageGaps({
    curriculumNodes: flattenOfficialCurriculumTree(tree).map((node) =>
      toCoverageNode(tree, node),
    ),
    edges: buildSecurityCertificationOntologyEdges(),
  });
}

export function getSecurityCertificationRetrievalConceptAliases(): ConceptAwareRetrievalCandidate[] {
  const courseIdsByConceptKey = new Map<string, Set<string>>();
  for (const edge of buildSecurityCertificationOntologyEdges()) {
    if (edge.toType !== "CONCEPT") continue;
    const courseIds = courseIdsByConceptKey.get(edge.toId) ?? new Set<string>();
    if (edge.courseId) courseIds.add(edge.courseId);
    courseIdsByConceptKey.set(edge.toId, courseIds);
  }

  return buildSecurityCertificationOntologyConcepts().map((concept) => ({
    label: concept.label,
    aliases: concept.aliases,
    courseIds: [...(courseIdsByConceptKey.get(concept.key) ?? new Set<string>())],
  }));
}

function uniqueOntologyEdges(edges: OntologyEdge[]) {
  return [...new Map(edges.map((edge) => [edge.key, edge])).values()];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function toCoverageNode(
  tree: OfficialCurriculumTreeDefinition,
  node: FlattenedOfficialCurriculumNode,
) {
  return {
    id: officialCurriculumNodeId(node.stableKey),
    courseId: tree.courseId,
    title: node.title,
    nodeType: node.nodeType,
    depth: node.depth,
    required: node.isRequired,
  };
}
