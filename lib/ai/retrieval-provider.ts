import type { RetrievalContext } from "./types.ts";

export type RetrievalSearchOptions = {
  query: string;
  limit?: number;
};

export type ConceptAwareRetrievalCandidate = {
  label: string;
  aliases?: readonly string[];
  courseIds?: readonly string[];
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
  const query = normalizeRetrievalQuery(options.query);
  if (!query) return [""];

  const expanded = [options.query.trim()];
  for (const candidate of candidates) {
    if (
      options.courseId &&
      candidate.courseIds?.length &&
      !candidate.courseIds.includes(options.courseId)
    ) {
      continue;
    }

    const labels = [candidate.label, ...(candidate.aliases ?? [])]
      .map((value) => value.trim())
      .filter(Boolean);
    const matched = labels.some((label) => {
      const normalized = normalizeRetrievalQuery(label);
      return normalized.includes(query) || query.includes(normalized);
    });
    if (!matched) continue;

    for (const label of labels) {
      if (normalizeRetrievalQuery(label) === query) continue;
      expanded.push(label);
      if (expanded.length > aliasLimit) break;
    }
    if (expanded.length > aliasLimit) break;
  }

  return [...new Set(expanded)].slice(0, Math.max(1, aliasLimit + 1));
}

function normalizeRetrievalQuery(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
