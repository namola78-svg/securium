import { officialSecurityCertificationContents, officialSecurityCertificationCourseLessons } from "../data/security-certification-course-lessons.mjs";
import {
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

export type SecurityCertificationOntologyCoverageSummary = {
  treeId: string;
  courseId: string;
  totalNodeCount: number;
  requiredNodeCount: number;
  linkedCurriculumNodeCount: number;
  courseLessonEdgeCount: number;
  conceptEdgeCount: number;
  gapCount: number;
  topGapIds: string[];
};

const NAMESPACE = "security-certification";
const officialContents =
  officialSecurityCertificationContents as OfficialSecurityCertificationContent[];
const officialCourseLessons =
  officialSecurityCertificationCourseLessons as OfficialSecurityCertificationCourseLesson[];

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
