import type { RetrievalContext } from "./types.ts";
import {
  expandOntologyRetrievalQueries,
  type OntologyGraph,
} from "../services/ontology-service.ts";

export type RetrievalSearchOptions = {
  query: string;
  limit?: number;
};

export type ConceptAwareRetrievalCandidate = {
  label: string;
  aliases?: readonly string[];
  courseIds?: readonly string[];
};

export type RetrievalQueryExpansionDiagnostics = {
  originalQuery: string;
  expandedQueries: string[];
  addedQueries: string[];
  matchedConceptLabels: string[];
  courseId?: string;
  candidateCount: number;
  scopedCandidateCount: number;
};

export interface RetrievalProvider {
  search(options: RetrievalSearchOptions): Promise<RetrievalContext[]>;
  searchByCourse(
    courseId: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalContext[]>;
  searchByTopic(
    courseId: string,
    topicId: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalContext[]>;
  getContextByIds(ids: string[]): Promise<RetrievalContext[]>;
}

export type VectorRetrievalSearchOptions = {
  embedding: readonly number[];
  limit?: number;
  minimumSimilarity?: number;
};

/**
 * Optional extension point only. No pgvector query or embedding generation is
 * enabled in this sprint.
 */
export interface VectorRetrievalProvider extends RetrievalProvider {
  searchSimilar(
    options: VectorRetrievalSearchOptions,
  ): Promise<RetrievalContext[]>;
  searchSimilarByCourse(
    courseId: string,
    options: VectorRetrievalSearchOptions,
  ): Promise<RetrievalContext[]>;
}

export function validateEmbeddingVector(
  embedding: readonly number[],
  expectedDimensions?: number,
) {
  if (
    embedding.length === 0 ||
    embedding.length > 4096 ||
    embedding.some((value) => !Number.isFinite(value)) ||
    (expectedDimensions !== undefined &&
      embedding.length !== expectedDimensions)
  ) {
    throw new TypeError("The embedding vector is invalid.");
  }
  return embedding;
}

export function clampRetrievalLimit(limit = 8) {
  return Math.max(1, Math.min(limit, 12));
}

export function expandRetrievalQueriesWithConceptAliases(
  options: RetrievalSearchOptions & { courseId?: string },
  candidates: readonly ConceptAwareRetrievalCandidate[],
  aliasLimit = 4,
) {
  return describeRetrievalQueryExpansion(
    options,
    candidates,
    aliasLimit,
  ).expandedQueries;
}

export function expandRetrievalQueriesWithOntologyGraph(
  options: RetrievalSearchOptions & { courseId?: string },
  graph: OntologyGraph,
  limit = 12,
) {
  if (graph.concepts.length === 0) {
    return [options.query.trim()];
  }
  return expandOntologyRetrievalQueries({
    query: options.query,
    graph,
    courseId: options.courseId,
    limit,
  }).expandedQueries;
}

export function describeRetrievalQueryExpansionWithOntologyGraph(
  options: RetrievalSearchOptions & { courseId?: string },
  graph: OntologyGraph,
  limit = 12,
): RetrievalQueryExpansionDiagnostics {
  const expansion = expandOntologyRetrievalQueries({
    query: options.query,
    graph,
    courseId: options.courseId,
    limit,
  });
  const originalQuery = options.query.trim();
  const normalizedOriginal = normalizeRetrievalQuery(originalQuery);
  const expandedQueries = expansion.expandedQueries.length
    ? expansion.expandedQueries
    : [originalQuery];

  return {
    originalQuery,
    expandedQueries,
    addedQueries: expandedQueries.filter(
      (expandedQuery) =>
        normalizeRetrievalQuery(expandedQuery) !== normalizedOriginal,
    ),
    matchedConceptLabels: expansion.matchedConceptLabels,
    courseId: options.courseId,
    candidateCount: graph.concepts.length,
    scopedCandidateCount: graph.concepts.length,
  };
}

export function describeRetrievalQueryExpansion(
  options: RetrievalSearchOptions & { courseId?: string },
  candidates: readonly ConceptAwareRetrievalCandidate[],
  aliasLimit = 4,
): RetrievalQueryExpansionDiagnostics {
  const originalQuery = options.query.trim();
  const query = normalizeRetrievalQuery(options.query);
  const scopedCandidates = candidates.filter(
    (candidate) =>
      !options.courseId ||
      !candidate.courseIds?.length ||
      candidate.courseIds.includes(options.courseId),
  );
  if (!query) {
    return {
      originalQuery,
      expandedQueries: [""],
      addedQueries: [],
      matchedConceptLabels: [],
      courseId: options.courseId,
      candidateCount: candidates.length,
      scopedCandidateCount: scopedCandidates.length,
    };
  }

  const expanded = [originalQuery];
  const matchedConceptLabels: string[] = [];
  for (const candidate of scopedCandidates) {

    const labels = [candidate.label, ...(candidate.aliases ?? [])]
      .map((value) => value.trim())
      .filter(Boolean);
    const matched = labels.some((label) => {
      const normalized = normalizeRetrievalQuery(label);
      return normalized.includes(query) || query.includes(normalized);
    });
    if (!matched) continue;

    matchedConceptLabels.push(candidate.label);
    for (const label of labels) {
      if (normalizeRetrievalQuery(label) === query) continue;
      expanded.push(label);
      if (expanded.length > aliasLimit) break;
    }
    if (expanded.length > aliasLimit) break;
  }

  const expandedQueries = [...new Set(expanded)].slice(
    0,
    Math.max(1, aliasLimit + 1),
  );
  return {
    originalQuery,
    expandedQueries,
    addedQueries: expandedQueries.filter(
      (expandedQuery) =>
        normalizeRetrievalQuery(expandedQuery) !== query,
    ),
    matchedConceptLabels: [...new Set(matchedConceptLabels)],
    courseId: options.courseId,
    candidateCount: candidates.length,
    scopedCandidateCount: scopedCandidates.length,
  };
}

function normalizeRetrievalQuery(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
