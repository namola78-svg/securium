import type { RetrievalContext } from "./types.ts";

export type RetrievalSearchOptions = {
  query: string;
  limit?: number;
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
