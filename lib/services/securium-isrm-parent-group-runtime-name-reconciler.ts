import { AppError } from "../../lib/errors.ts";
import { CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP } from "./securium-canonical-security-professional-learning-group-provisioner.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseTransaction,
} from "../../db/provider/database-provider.ts";

export const CANONICAL_ISRM_COURSE = Object.freeze({
  id: "course-isrm",
  code: "ISRM",
  slug: "isrm",
  name: "\uC815\uBCF4\uBCF4\uD638\uC704\uD5D8\uAD00\uB9AC\uC0AC(ISRM)",
  shortName: "ISRM",
  courseGroupId: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
  active: true,
  published: false,
  isSample: false,
  deletedAt: null,
} as const);

export type CanonicalIsrmCourse = typeof CANONICAL_ISRM_COURSE;
export type IsrmCourseReconciledField = "name" | "shortName";
export type IsrmCourseProvisioningResult = {
  status: "CREATED" | "NOOP_EXISTING" | "GOVERNED_METADATA_RECONCILIATION";
  course: CanonicalIsrmCourse;
  reconciledFields: readonly IsrmCourseReconciledField[];
};

type ParentGroupRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  isSample: boolean;
  deletedAt: string | null;
};

type CourseRow = {
  id: string;
  courseGroupId: string;
  code: string;
  slug: string;
  name: string;
  shortName: string;
  active: boolean;
  published: boolean;
  isSample: boolean;
  deletedAt: string | null;
};

type ExistingCourseResolution =
  | { status: "NOOP_EXISTING"; reconciledFields: readonly [] }
  | { status: "GOVERNED_METADATA_RECONCILIATION"; reconciledFields: IsrmCourseReconciledField[] };

const PARENT_GROUP_MATCH_QUERY: DatabaseStatement = {
  sql: `SELECT id, code, name, active, is_sample, deleted_at
    FROM course_groups
    WHERE id = ? OR code = ? OR name = ?`,
  parameters: [
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
  ],
};

const COURSE_MATCH_QUERY: DatabaseStatement = {
  sql: `SELECT id, course_group_id, code, slug, name, short_name, active, published, is_sample, deleted_at
    FROM courses
    WHERE id = ? OR code = ? OR slug = ?`,
  parameters: [
    CANONICAL_ISRM_COURSE.id,
    CANONICAL_ISRM_COURSE.code,
    CANONICAL_ISRM_COURSE.slug,
  ],
};

const COURSE_INSERT: DatabaseStatement = {
  sql: `INSERT INTO courses
    (id, course_group_id, code, slug, name, short_name, active, published, is_sample, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  parameters: [
    CANONICAL_ISRM_COURSE.id,
    CANONICAL_ISRM_COURSE.courseGroupId,
    CANONICAL_ISRM_COURSE.code,
    CANONICAL_ISRM_COURSE.slug,
    CANONICAL_ISRM_COURSE.name,
    CANONICAL_ISRM_COURSE.shortName,
    CANONICAL_ISRM_COURSE.active,
    CANONICAL_ISRM_COURSE.published,
    CANONICAL_ISRM_COURSE.isSample,
    CANONICAL_ISRM_COURSE.deletedAt,
  ],
};

const CONDITIONAL_COURSE_INSERT: DatabaseStatement = {
  sql: `INSERT INTO courses
    (id, course_group_id, code, slug, name, short_name, active, published, is_sample, deleted_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM course_groups
      WHERE id = ? AND code = ? AND name = ? AND active = 1 AND is_sample = 0 AND deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM courses
      WHERE id = ? OR code = ? OR slug = ?
    )`,
  parameters: [
    ...COURSE_INSERT.parameters!,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
    CANONICAL_ISRM_COURSE.id,
    CANONICAL_ISRM_COURSE.code,
    CANONICAL_ISRM_COURSE.slug,
  ],
};

const CONDITIONAL_METADATA_UPDATE: DatabaseStatement = {
  sql: `UPDATE courses
    SET name = ?, short_name = ?
    WHERE id = ? AND code = ? AND slug = ? AND course_group_id = ?
      AND active = 1 AND published = 0 AND is_sample = 0 AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM course_groups
        WHERE id = ? AND code = ? AND name = ? AND active = 1 AND is_sample = 0 AND deleted_at IS NULL
      )`,
  parameters: [
    CANONICAL_ISRM_COURSE.name,
    CANONICAL_ISRM_COURSE.shortName,
    CANONICAL_ISRM_COURSE.id,
    CANONICAL_ISRM_COURSE.code,
    CANONICAL_ISRM_COURSE.slug,
    CANONICAL_ISRM_COURSE.courseGroupId,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
  ],
};

export async function provisionOrReconcileCanonicalIsrmCourse(
  database: DatabaseProvider,
  environment: "NONPROD",
): Promise<IsrmCourseProvisioningResult> {
  assertNonProductionEnvironment(environment);

  if (typeof database.transactional === "function") {
    try {
      return await database.transactional(async (transaction) =>
        reconcileInTransaction(transaction),
      );
    } catch (error) {
      if (error instanceof IsrmCourseProvisioningError) throw error;
      return resolveConcurrentOutcome(database, error);
    }
  }

  return reconcileWithConditionalStatements(database);
}

async function reconcileInTransaction(
  database: Pick<DatabaseProvider, "query" | "queryOne" | "execute"> | DatabaseTransaction,
): Promise<IsrmCourseProvisioningResult> {
  assertCanonicalParent(await readParentGroups(database));
  const existing = resolveExistingCourse(await readCourseRows(database));
  if (existing) {
    if (existing.status === "NOOP_EXISTING") {
      return {
        status: existing.status,
        course: CANONICAL_ISRM_COURSE,
        reconciledFields: existing.reconciledFields,
      };
    }
    const updated = await database.execute(metadataUpdateStatement());
    if (updated.affectedRows !== 1) {
      throw provisioningError(
        "ISRM_METADATA_RECONCILIATION_FAILED",
        "The governed ISRM name reconciliation did not update exactly one row.",
      );
    }
    assertCanonicalCourse(await readSingleCanonicalCourse(database));
    return {
      status: "GOVERNED_METADATA_RECONCILIATION",
      course: CANONICAL_ISRM_COURSE,
      reconciledFields: existing.reconciledFields,
    };
  }

  const inserted = await database.execute(COURSE_INSERT);
  if (inserted.affectedRows !== 1) {
    throw provisioningError(
      "ISRM_COURSE_INSERT_ROW_COUNT_MISMATCH",
      "The canonical ISRM course insert did not create exactly one row.",
    );
  }
  assertCanonicalCourse(await readSingleCanonicalCourse(database));
  return {
    status: "CREATED",
    course: CANONICAL_ISRM_COURSE,
    reconciledFields: [],
  };
}

async function reconcileWithConditionalStatements(
  database: DatabaseProvider,
): Promise<IsrmCourseProvisioningResult> {
  assertCanonicalParent(await readParentGroups(database));
  const existing = resolveExistingCourse(await readCourseRows(database));
  if (existing?.status === "NOOP_EXISTING") {
    return {
      status: existing.status,
      course: CANONICAL_ISRM_COURSE,
      reconciledFields: existing.reconciledFields,
    };
  }

  if (existing?.status === "GOVERNED_METADATA_RECONCILIATION") {
    const [updated] = await database.transaction([CONDITIONAL_METADATA_UPDATE]);
    if (updated?.affectedRows === 1) {
      assertCanonicalCourse(await readSingleCanonicalCourse(database));
      return {
        status: existing.status,
        course: CANONICAL_ISRM_COURSE,
        reconciledFields: existing.reconciledFields,
      };
    }
    return resolveConcurrentOutcome(database, provisioningError(
      "ISRM_METADATA_RECONCILIATION_CONFLICT",
      "The governed ISRM metadata update did not match the safe canonical state.",
    ));
  }

  const [inserted] = await database.transaction([CONDITIONAL_COURSE_INSERT]);
  if (inserted?.affectedRows === 1) {
    assertCanonicalCourse(await readSingleCanonicalCourse(database));
    return {
      status: "CREATED",
      course: CANONICAL_ISRM_COURSE,
      reconciledFields: [],
    };
  }

  return resolveConcurrentOutcome(database, provisioningError(
    "ISRM_COURSE_PROVISIONING_CONFLICT",
    "The canonical ISRM course was not created and no safe result was returned.",
  ));
}

async function resolveConcurrentOutcome(
  database: DatabaseProvider,
  cause: unknown,
): Promise<IsrmCourseProvisioningResult> {
  try {
    assertCanonicalParent(await readParentGroups(database));
    const existing = resolveExistingCourse(await readCourseRows(database));
    if (existing?.status === "NOOP_EXISTING") {
      return {
        status: existing.status,
        course: CANONICAL_ISRM_COURSE,
        reconciledFields: existing.reconciledFields,
      };
    }
  } catch (error) {
    if (error instanceof IsrmCourseProvisioningError) throw error;
  }

  throw provisioningError(
    "ISRM_COURSE_PROVISIONING_FAILED",
    "The canonical ISRM course transaction failed without a safe resulting identity.",
    cause,
  );
}

function resolveExistingCourse(rows: CourseRow[]): ExistingCourseResolution | null {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw provisioningError(
      "ISRM_COURSE_MULTIPLE_MATCHES",
      "Multiple rows overlap the canonical ISRM course identity.",
    );
  }

  const row = rows[0];
  const exactIdentity =
    row.id === CANONICAL_ISRM_COURSE.id &&
    row.code === CANONICAL_ISRM_COURSE.code &&
    row.slug === CANONICAL_ISRM_COURSE.slug;

  if (!exactIdentity) {
    if (row.id === CANONICAL_ISRM_COURSE.id) {
      throw provisioningError("ISRM_COURSE_ID_COLLISION", "The canonical ISRM course ID has incompatible identity metadata.");
    }
    if (row.code === CANONICAL_ISRM_COURSE.code) {
      throw provisioningError("ISRM_COURSE_CODE_COLLISION", "The canonical ISRM course code is occupied by another ID.");
    }
    if (row.slug === CANONICAL_ISRM_COURSE.slug) {
      throw provisioningError("ISRM_COURSE_SLUG_COLLISION", "The canonical ISRM course slug is occupied by another ID.");
    }
    throw provisioningError("ISRM_COURSE_PARTIAL_IDENTITY_COLLISION", "A partial canonical ISRM identity collision was detected.");
  }

  if (row.deletedAt !== null) {
    throw provisioningError("ISRM_COURSE_RESTORE_REVIEW_REQUIRED", "The canonical ISRM course is soft-deleted and requires separate restore review.");
  }
  if (row.courseGroupId !== CANONICAL_ISRM_COURSE.courseGroupId) {
    throw provisioningError("ISRM_COURSE_WRONG_PARENT", "The canonical ISRM course is assigned to the wrong parent group.");
  }
  if (!row.active || row.published || row.isSample) {
    throw provisioningError("ISRM_COURSE_VISIBILITY_CONFLICT", "The existing canonical ISRM course has incompatible visibility state.");
  }

  const reconciledFields: IsrmCourseReconciledField[] = [];
  if (row.name !== CANONICAL_ISRM_COURSE.name) reconciledFields.push("name");
  if (row.shortName !== CANONICAL_ISRM_COURSE.shortName) reconciledFields.push("shortName");
  if (reconciledFields.length === 0) {
    return { status: "NOOP_EXISTING", reconciledFields: [] };
  }
  return { status: "GOVERNED_METADATA_RECONCILIATION", reconciledFields };
}

function assertCanonicalParent(rows: ParentGroupRow[]): ParentGroupRow {
  if (rows.length === 0) {
    throw provisioningError("ISRM_PARENT_GROUP_NOT_FOUND", "The canonical ISRM parent group does not exist.");
  }
  if (rows.length > 1) {
    throw provisioningError("ISRM_PARENT_GROUP_MULTIPLE_MATCHES", "Multiple rows overlap the canonical ISRM parent-group identity.");
  }
  const row = rows[0];
  const exactIdentity =
    row.id === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id &&
    row.code === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code &&
    row.name === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name;
  if (!exactIdentity) {
    throw provisioningError("ISRM_PARENT_GROUP_IDENTITY_CONFLICT", "The ISRM parent group identity is not canonical.");
  }
  if (row.deletedAt !== null) {
    throw provisioningError("ISRM_PARENT_GROUP_RESTORE_REVIEW_REQUIRED", "The canonical ISRM parent group is soft-deleted and requires separate review.");
  }
  if (!row.active || row.isSample) {
    throw provisioningError("ISRM_PARENT_GROUP_STATE_CONFLICT", "The canonical ISRM parent group has incompatible state.");
  }
  return row;
}

async function readParentGroups(
  database: Pick<DatabaseProvider, "query"> | DatabaseTransaction,
): Promise<ParentGroupRow[]> {
  const result = await database.query<Record<string, unknown>>(PARENT_GROUP_MATCH_QUERY);
  return result.rows.map(normalizeParentGroupRow);
}

async function readCourseRows(
  database: Pick<DatabaseProvider, "query"> | DatabaseTransaction,
): Promise<CourseRow[]> {
  const result = await database.query<Record<string, unknown>>(COURSE_MATCH_QUERY);
  return result.rows.map(normalizeCourseRow);
}

async function readSingleCanonicalCourse(
  database: Pick<DatabaseProvider, "query"> | DatabaseTransaction,
): Promise<CourseRow> {
  const rows = await readCourseRows(database);
  if (rows.length !== 1) {
    throw provisioningError("ISRM_COURSE_READBACK_FAILED", "The canonical ISRM course readback was not unique.");
  }
  return rows[0];
}

function assertCanonicalCourse(row: CourseRow) {
  const exact =
    row.id === CANONICAL_ISRM_COURSE.id &&
    row.code === CANONICAL_ISRM_COURSE.code &&
    row.slug === CANONICAL_ISRM_COURSE.slug &&
    row.name === CANONICAL_ISRM_COURSE.name &&
    row.shortName === CANONICAL_ISRM_COURSE.shortName &&
    row.courseGroupId === CANONICAL_ISRM_COURSE.courseGroupId &&
    row.active === CANONICAL_ISRM_COURSE.active &&
    row.published === CANONICAL_ISRM_COURSE.published &&
    row.isSample === CANONICAL_ISRM_COURSE.isSample &&
    row.deletedAt === CANONICAL_ISRM_COURSE.deletedAt;
  if (!exact) {
    throw provisioningError("ISRM_COURSE_READBACK_CONFLICT", "The canonical ISRM course readback does not match the fixed contract.");
  }
}

function metadataUpdateStatement(): DatabaseStatement {
  return {
    sql: `UPDATE courses
      SET name = ?, short_name = ?
      WHERE id = ? AND code = ? AND slug = ? AND course_group_id = ?
        AND active = 1 AND published = 0 AND is_sample = 0 AND deleted_at IS NULL`,
    parameters: [
      CANONICAL_ISRM_COURSE.name,
      CANONICAL_ISRM_COURSE.shortName,
      CANONICAL_ISRM_COURSE.id,
      CANONICAL_ISRM_COURSE.code,
      CANONICAL_ISRM_COURSE.slug,
      CANONICAL_ISRM_COURSE.courseGroupId,
    ],
  };
}

function normalizeParentGroupRow(row: Record<string, unknown>): ParentGroupRow {
  return {
    id: requiredString(row.id, "group id"),
    code: requiredString(row.code, "group code"),
    name: requiredString(row.name, "group name"),
    active: requiredBoolean(row.active, "group active"),
    isSample: requiredBoolean(row.is_sample, "group is_sample"),
    deletedAt: optionalTimestamp(row.deleted_at, "group deleted_at"),
  };
}

function normalizeCourseRow(row: Record<string, unknown>): CourseRow {
  return {
    id: requiredString(row.id, "course id"),
    courseGroupId: requiredString(row.course_group_id, "course group id"),
    code: requiredString(row.code, "course code"),
    slug: requiredString(row.slug, "course slug"),
    name: requiredString(row.name, "course name"),
    shortName: requiredString(row.short_name, "course short name"),
    active: requiredBoolean(row.active, "course active"),
    published: requiredBoolean(row.published, "course published"),
    isSample: requiredBoolean(row.is_sample, "course is_sample"),
    deletedAt: optionalTimestamp(row.deleted_at, "course deleted_at"),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw provisioningError("ISRM_UNEXPECTED_ROW_SHAPE", `The ${field} value has an unexpected shape.`);
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 1) return value === 1;
  throw provisioningError("ISRM_UNEXPECTED_ROW_SHAPE", `The ${field} value has an unexpected shape.`);
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw provisioningError("ISRM_UNEXPECTED_ROW_SHAPE", `The ${field} value has an unexpected shape.`);
}

function assertNonProductionEnvironment(environment: "NONPROD") {
  if (environment !== "NONPROD") {
    throw provisioningError("ISRM_NONPROD_REQUIRED", "ISRM course provisioning requires the explicit NONPROD environment.");
  }
}

function provisioningError(code: string, message: string, cause?: unknown) {
  return new IsrmCourseProvisioningError(code, message, cause);
}

export class IsrmCourseProvisioningError extends AppError {
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, 409, code);
    this.name = "IsrmCourseProvisioningError";
    this.cause = cause;
  }
}
