import { AppError } from "../../lib/errors.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseTransaction,
} from "../../db/provider/database-provider.ts";

export const CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP = Object.freeze({
  id: "group-independent",
  code: "INDEPENDENT_PROFESSIONAL",
  name: "독립 전문과정",
  description: "",
  displayOrder: 2,
  active: true,
  isSample: false,
  deletedAt: null,
} as const);

export type CanonicalIndependentProfessionalCourseGroup =
  typeof CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP;

export type CanonicalIndependentProfessionalCourseGroupResult = {
  status: "CREATED" | "NOOP_EXISTING";
  group: CanonicalIndependentProfessionalCourseGroup;
};

// The canonical domain keeps visibility flags as booleans. The compatibility
// PostgreSQL course_groups schema stores those flags as integer 0/1 values.
const CANONICAL_GROUP_PERSISTENCE_FLAGS = Object.freeze({
  active: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.active ? 1 : 0,
  isSample: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.isSample ? 1 : 0,
} as const);

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
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name,
  ],
};

const GROUP_INSERT: DatabaseStatement = {
  sql: `INSERT INTO course_groups
    (id, code, name, description, display_order, active, is_sample, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  parameters: [
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.description,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.displayOrder,
    CANONICAL_GROUP_PERSISTENCE_FLAGS.active,
    CANONICAL_GROUP_PERSISTENCE_FLAGS.isSample,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.deletedAt,
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
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code,
    CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name,
  ],
};

export async function provisionCanonicalIndependentProfessionalCourseGroup(
  database: DatabaseProvider,
  environment: "NONPROD",
): Promise<CanonicalIndependentProfessionalCourseGroupResult> {
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
            "INDEPENDENT_PROFESSIONAL_GROUP_INSERT_ROW_COUNT_MISMATCH",
            "The canonical Independent Professional group insert did not create exactly one row.",
          );
        }
        return {
          status: "CREATED" as const,
          group: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP,
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
          "INDEPENDENT_PROFESSIONAL_GROUP_READBACK_FAILED",
          "The canonical Independent Professional group insert could not be verified.",
        );
      }
      return { status: "CREATED", group: created.group };
    }

    const raced = resolveExisting(await readMatchingGroups(database));
    if (raced) return raced;
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_PROVISIONING_CONFLICT",
      "The canonical Independent Professional group was not created and no resulting row is readable.",
    );
  } catch (error) {
    return resolveConcurrentOutcome(database, error);
  }
}

async function resolveConcurrentOutcome(
  database: DatabaseProvider,
  error: unknown,
): Promise<CanonicalIndependentProfessionalCourseGroupResult> {
  if (error instanceof CanonicalIndependentProfessionalCourseGroupError) {
    throw error;
  }

  try {
    const current = resolveExisting(await readMatchingGroups(database));
    if (current) return current;
  } catch (classificationError) {
    if (classificationError instanceof CanonicalIndependentProfessionalCourseGroupError) {
      throw classificationError;
    }
  }

  throw provisioningError(
    "INDEPENDENT_PROFESSIONAL_GROUP_PROVISIONING_FAILED",
    "The canonical Independent Professional group transaction failed without a safe resulting identity.",
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
): CanonicalIndependentProfessionalCourseGroupResult | null {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_MULTIPLE_MATCHES",
      "Multiple rows overlap the canonical Independent Professional group identity.",
    );
  }

  const row = rows[0];
  const exactIdentity =
    row.id === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id &&
    row.code === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code &&
    row.name === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name;

  if (exactIdentity && row.deletedAt !== null) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_RESTORE_REVIEW_REQUIRED",
      "The canonical Independent Professional group identity is soft-deleted and requires separate restore review.",
    );
  }

  if (exactIdentity) {
    const exactMetadata =
      row.description === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.description &&
      row.displayOrder === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.displayOrder &&
      row.active === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.active &&
      row.isSample === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.isSample;
    if (!exactMetadata) {
      throw provisioningError(
        "INDEPENDENT_PROFESSIONAL_GROUP_METADATA_MISMATCH",
        "The canonical Independent Professional group exists with incompatible metadata or visibility.",
      );
    }
    return {
      status: "NOOP_EXISTING",
      group: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP,
    };
  }

  if (row.id === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_ID_COLLISION",
      "The canonical Independent Professional group ID is occupied by incompatible metadata.",
    );
  }
  if (row.code === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_CODE_COLLISION",
      "The canonical Independent Professional group code is occupied by another ID.",
    );
  }
  if (row.name === CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_NAME_COLLISION",
      "The canonical Independent Professional group name is occupied by another identity.",
    );
  }

  throw provisioningError(
    "INDEPENDENT_PROFESSIONAL_GROUP_PARTIAL_IDENTITY_COLLISION",
    "A partial canonical Independent Professional group identity collision was detected.",
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
      "INDEPENDENT_PROFESSIONAL_GROUP_UNEXPECTED_ROW_SHAPE",
      "The canonical Independent Professional group deleted_at value has an unexpected shape.",
    );
  }

  return { id, code, name, description, displayOrder, active, isSample, deletedAt };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_UNEXPECTED_ROW_SHAPE",
      `The canonical Independent Professional group ${field} value has an unexpected shape.`,
    );
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_UNEXPECTED_ROW_SHAPE",
      `The canonical Independent Professional group ${field} value has an unexpected shape.`,
    );
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 1) return value === 1;
  throw provisioningError(
    "INDEPENDENT_PROFESSIONAL_GROUP_UNEXPECTED_ROW_SHAPE",
    `The canonical Independent Professional group ${field} value has an unexpected shape.`,
  );
}

function assertNonProductionEnvironment(environment: "NONPROD") {
  if (environment !== "NONPROD") {
    throw provisioningError(
      "INDEPENDENT_PROFESSIONAL_GROUP_NONPROD_REQUIRED",
      "Canonical Independent Professional group provisioning requires the explicit NONPROD environment.",
    );
  }
}

function provisioningError(code: string, message: string, cause?: unknown) {
  return new CanonicalIndependentProfessionalCourseGroupError(code, message, cause);
}

export class CanonicalIndependentProfessionalCourseGroupError extends AppError {
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, 409, code);
    this.name = "CanonicalIndependentProfessionalCourseGroupError";
    this.cause = cause;
  }
}
