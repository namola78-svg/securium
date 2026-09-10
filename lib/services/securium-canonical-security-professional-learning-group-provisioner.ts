import { AppError } from "../../lib/errors.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseTransaction,
} from "../../db/provider/database-provider.ts";

export const CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP = Object.freeze({
  id: "group-security-professional-learning",
  code: "SECURITY_PROFESSIONAL_LEARNING",
  name: "보안 전문 학습",
  description: "",
  displayOrder: 0,
  active: true,
  isSample: false,
  deletedAt: null,
} as const);

export type CanonicalSecurityProfessionalLearningGroup =
  typeof CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP;

export type CanonicalSecurityProfessionalLearningGroupResult = {
  status: "CREATED" | "NOOP_EXISTING";
  group: CanonicalSecurityProfessionalLearningGroup;
};

type GroupRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  active: boolean;
  isSample: boolean;
  deletedAt: string | null;
};

const GROUP_MATCH_QUERY: DatabaseStatement = {
  sql: `SELECT id, code, name, description, display_order, active, is_sample, deleted_at
    FROM course_groups
    WHERE id = ? OR code = ? OR name = ?`,
  parameters: [
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
  ],
};

const GROUP_INSERT: DatabaseStatement = {
  sql: `INSERT INTO course_groups
    (id, code, name, description, display_order, active, is_sample, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  parameters: [
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.description,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.displayOrder,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.active,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.isSample,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.deletedAt,
  ],
};

const CONDITIONAL_GROUP_INSERT: DatabaseStatement = {
  sql: `INSERT INTO course_groups
    (id, code, name, description, display_order, active, is_sample, deleted_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM course_groups
      WHERE id = ? OR code = ? OR name = ?
    )`,
  parameters: [
    ...GROUP_INSERT.parameters!,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
  ],
};

export async function provisionCanonicalSecurityProfessionalLearningGroup(
  database: DatabaseProvider,
  environment: "NONPROD",
): Promise<CanonicalSecurityProfessionalLearningGroupResult> {
  assertNonProductionEnvironment(environment);

  if (database.kind === "supabase" && database.transactional) {
    try {
      return await database.transactional(async (transaction) => {
        const existing = await readMatchingGroups(transaction);
        const existingResult = resolveExisting(existing);
        if (existingResult) return existingResult;

        const inserted = await transaction.execute(GROUP_INSERT);
        if (inserted.affectedRows !== 1) {
          throw provisioningError(
            "SECURITY_GROUP_INSERT_ROW_COUNT_MISMATCH",
            "The canonical course-group insert did not create exactly one row.",
          );
        }
        return {
          status: "CREATED" as const,
          group: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP,
        };
      });
    } catch (error) {
      return resolveConcurrentOutcome(database, error);
    }
  }

  const existing = await readMatchingGroups(database);
  const existingResult = resolveExisting(existing);
  if (existingResult) return existingResult;

  try {
    const [inserted] = await database.transaction([CONDITIONAL_GROUP_INSERT]);
    if (inserted?.affectedRows === 1) {
      const created = resolveExisting(await readMatchingGroups(database));
      if (!created || created.status !== "NOOP_EXISTING") {
        throw provisioningError(
          "SECURITY_GROUP_READBACK_FAILED",
          "The canonical course-group insert could not be verified.",
        );
      }
      return { status: "CREATED", group: created.group };
    }

    const raced = resolveExisting(await readMatchingGroups(database));
    if (raced) return raced;
    throw provisioningError(
      "SECURITY_GROUP_PROVISIONING_CONFLICT",
      "The canonical course-group was not created and no resulting row is readable.",
    );
  } catch (error) {
    return resolveConcurrentOutcome(database, error);
  }
}

async function resolveConcurrentOutcome(
  database: DatabaseProvider,
  error: unknown,
): Promise<CanonicalSecurityProfessionalLearningGroupResult> {
  if (error instanceof CanonicalSecurityProfessionalLearningGroupError) {
    throw error;
  }

  try {
    const current = resolveExisting(await readMatchingGroups(database));
    if (current) return current;
  } catch (classificationError) {
    if (classificationError instanceof CanonicalSecurityProfessionalLearningGroupError) {
      throw classificationError;
    }
  }

  throw provisioningError(
    "SECURITY_GROUP_PROVISIONING_FAILED",
    "The canonical course-group transaction failed without a safe resulting identity.",
    error,
  );
}

async function readMatchingGroups(
  database: Pick<DatabaseProvider, "query"> | DatabaseTransaction,
): Promise<GroupRow[]> {
  const result = await database.query<Record<string, unknown>>(GROUP_MATCH_QUERY);
  return result.rows.map(normalizeGroupRow);
}

function resolveExisting(
  rows: GroupRow[],
): CanonicalSecurityProfessionalLearningGroupResult | null {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw provisioningError(
      "SECURITY_GROUP_MULTIPLE_MATCHES",
      "Multiple rows overlap the canonical course-group identity.",
    );
  }

  const row = rows[0];
  const exactIdentity =
    row.id === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id &&
    row.code === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code &&
    row.name === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name;

  if (exactIdentity && row.deletedAt !== null) {
    throw provisioningError(
      "SECURITY_GROUP_RESTORE_REVIEW_REQUIRED",
      "The canonical course-group identity is soft-deleted and requires separate restore review.",
    );
  }

  if (exactIdentity) {
    const exactMetadata =
      row.description === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.description &&
      row.displayOrder === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.displayOrder &&
      row.active === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.active &&
      row.isSample === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.isSample;
    if (!exactMetadata) {
      throw provisioningError(
        "SECURITY_GROUP_EXISTING_STATE_CONFLICT",
        "The canonical course-group exists with incompatible metadata or visibility.",
      );
    }
    return {
      status: "NOOP_EXISTING",
      group: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP,
    };
  }

  if (row.id === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id) {
    throw provisioningError(
      "SECURITY_GROUP_ID_COLLISION",
      "The canonical course-group ID is occupied by incompatible metadata.",
    );
  }
  if (row.code === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code) {
    throw provisioningError(
      "SECURITY_GROUP_CODE_COLLISION",
      "The canonical course-group code is occupied by another ID.",
    );
  }
  if (row.name === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name) {
    throw provisioningError(
      "SECURITY_GROUP_NAME_COLLISION",
      "The canonical course-group name is occupied by another identity.",
    );
  }

  throw provisioningError(
    "SECURITY_GROUP_PARTIAL_IDENTITY_COLLISION",
    "A partial canonical course-group identity collision was detected.",
  );
}

function normalizeGroupRow(row: Record<string, unknown>): GroupRow {
  const id = requiredString(row.id, "id");
  const code = requiredString(row.code, "code");
  const name = requiredString(row.name, "name");
  const description = requiredString(row.description, "description");
  const displayOrder = requiredInteger(row.display_order, "display_order");
  const active = requiredBoolean(row.active, "active");
  const isSample = requiredBoolean(row.is_sample, "is_sample");
  const deletedAt = row.deleted_at;
  if (deletedAt !== null && typeof deletedAt !== "string") {
    throw provisioningError(
      "SECURITY_GROUP_UNEXPECTED_ROW_SHAPE",
      "The course-group deleted_at value has an unexpected shape.",
    );
  }

  return { id, code, name, description, displayOrder, active, isSample, deletedAt };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw provisioningError(
      "SECURITY_GROUP_UNEXPECTED_ROW_SHAPE",
      `The course-group ${field} value has an unexpected shape.`,
    );
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw provisioningError(
      "SECURITY_GROUP_UNEXPECTED_ROW_SHAPE",
      `The course-group ${field} value has an unexpected shape.`,
    );
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 1) return value === 1;
  throw provisioningError(
    "SECURITY_GROUP_UNEXPECTED_ROW_SHAPE",
    `The course-group ${field} value has an unexpected shape.`,
  );
}

function assertNonProductionEnvironment(environment: "NONPROD") {
  if (environment !== "NONPROD") {
    throw provisioningError(
      "SECURITY_GROUP_NONPROD_REQUIRED",
      "Canonical course-group provisioning requires the explicit NONPROD environment.",
    );
  }
}

function provisioningError(code: string, message: string, cause?: unknown) {
  return new CanonicalSecurityProfessionalLearningGroupError(code, message, cause);
}

export class CanonicalSecurityProfessionalLearningGroupError extends AppError {
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, 409, code);
    this.name = "CanonicalSecurityProfessionalLearningGroupError";
    this.cause = cause;
  }
}
