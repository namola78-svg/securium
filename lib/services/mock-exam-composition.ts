import { AppError } from "../errors.ts";
import {
  computeMockCompositionSemanticHash,
  stableJson,
  type MockCompositionItem,
} from "./learning-event-contracts.ts";

export const MOCK_COMPOSITION_SNAPSHOT_VERSION = 1 as const;

export type MockCompositionSnapshotItem = MockCompositionItem & Readonly<{
  questionVersionId: string;
}>;

export type MockExamCompositionSnapshot = Readonly<{
  snapshotVersion: typeof MOCK_COMPOSITION_SNAPSHOT_VERSION;
  items: readonly MockCompositionSnapshotItem[];
  passingScore: number;
  questionCount: number;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
}>;

export type MockExamCompositionInput = Omit<
  MockExamCompositionSnapshot,
  "snapshotVersion"
>;

export function createMockExamCompositionSnapshot(
  input: MockExamCompositionInput,
) {
  validateSnapshot(input);
  return stableJson({
    snapshotVersion: MOCK_COMPOSITION_SNAPSHOT_VERSION,
    ...input,
  });
}

export async function resolveMockExamCompositionSnapshot(
  snapshotJson: string | null | undefined,
  expectedSemanticHash?: string | null,
): Promise<MockExamCompositionSnapshot> {
  if (!snapshotJson) unavailable();
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    unavailable();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    unavailable();
  }
  const value = parsed as Record<string, unknown>;
  if (value.snapshotVersion !== MOCK_COMPOSITION_SNAPSHOT_VERSION) {
    unavailable();
  }
  const input = {
    items: value.items,
    passingScore: value.passingScore,
    questionCount: value.questionCount,
    randomizeQuestions: value.randomizeQuestions,
    randomizeChoices: value.randomizeChoices,
  };
  validateSnapshot(input);
  const snapshot = Object.freeze({
    snapshotVersion: MOCK_COMPOSITION_SNAPSHOT_VERSION,
    items: Object.freeze(
      (input.items as MockCompositionSnapshotItem[]).map((item) => Object.freeze(item)),
    ),
    passingScore: input.passingScore as number,
    questionCount: input.questionCount as number,
    randomizeQuestions: input.randomizeQuestions as boolean,
    randomizeChoices: input.randomizeChoices as boolean,
  });
  if (expectedSemanticHash !== undefined) {
    if (!isHash(expectedSemanticHash)) mismatch();
    const actualSemanticHash = await computeMockCompositionSemanticHash({
      items: snapshot.items.map((item) => {
        const { questionVersionId: ignoredQuestionVersionId, ...hashItem } = item;
        void ignoredQuestionVersionId;
        return hashItem;
      }),
      passingScore: snapshot.passingScore,
      questionCount: snapshot.questionCount,
      randomizeQuestions: snapshot.randomizeQuestions,
      randomizeChoices: snapshot.randomizeChoices,
    });
    if (actualSemanticHash !== expectedSemanticHash) mismatch();
  }
  return snapshot;
}

function validateSnapshot(value: {
  items: unknown;
  passingScore: unknown;
  questionCount: unknown;
  randomizeQuestions: unknown;
  randomizeChoices: unknown;
}) {
  const questionCount = value.questionCount;
  const passingScore = value.passingScore;
  if (
    !Array.isArray(value.items) ||
    typeof questionCount !== "number" ||
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    value.items.length !== questionCount ||
    typeof passingScore !== "number" ||
    !Number.isInteger(passingScore) ||
    passingScore < 0 ||
    passingScore > 100 ||
    typeof value.randomizeQuestions !== "boolean" ||
    typeof value.randomizeChoices !== "boolean"
  ) {
    unavailable();
  }
  const items = value.items as unknown[];
  const questionIds = new Set<string>();
  const displayOrders = new Set<number>();
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      unavailable();
    }
    const item = rawItem as Record<string, unknown>;
    if (
      typeof item.displayOrder !== "number" ||
      !Number.isInteger(item.displayOrder) ||
      typeof item.questionIdentity !== "string" ||
      !item.questionIdentity.trim() ||
      typeof item.questionVersionSemanticHash !== "string" ||
      !isHash(item.questionVersionSemanticHash) ||
      typeof item.possibleScore !== "number" ||
      !Number.isInteger(item.possibleScore) ||
      item.possibleScore < 0 ||
      typeof item.conceptMappingSetHash !== "string" ||
      !isHash(item.conceptMappingSetHash) ||
      typeof item.questionVersionId !== "string" ||
      !item.questionVersionId.trim()
    ) {
      unavailable();
    }
    if (
      questionIds.has(item.questionIdentity) ||
      displayOrders.has(item.displayOrder)
    ) {
      unavailable();
    }
    questionIds.add(item.questionIdentity);
    displayOrders.add(item.displayOrder);
  }
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function unavailable(): never {
  throw new AppError(
    "The immutable mock exam composition cannot be restored.",
    409,
    "MOCK_COMPOSITION_UNAVAILABLE",
  );
}

function mismatch(): never {
  throw new AppError(
    "The stored mock exam composition hash does not match its snapshot.",
    409,
    "MOCK_COMPOSITION_MISMATCH",
  );
}
