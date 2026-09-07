import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import {
  buildIseWaveARegistrationState,
  type WaveARegistrationState,
  type WaveALesson,
  type WaveASourceBinding,
  type WaveAQualificationResolver,
  type WaveASourceResolver,
} from "./ise-wave-a-canonical-revision-provenance.ts";

const EXPECTED_QUALIFICATION_ID = "course-ise";

type CourseRow = Record<string, unknown> & {
  id?: unknown;
  active?: unknown;
  deleted_at?: unknown;
};

type SourceIdentityRow = Record<string, unknown> & {
  id?: unknown;
  canonical_key?: unknown;
  source_type?: unknown;
  normalized_identity?: unknown;
  lifecycle_state?: unknown;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ISE_WAVE_A_CANONICAL_${field.toUpperCase()}_INVALID`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
  throw new Error(`ISE_WAVE_A_CANONICAL_${field.toUpperCase()}_INVALID`);
}

function authorityReference(lesson: WaveALesson): string {
  const reference = lesson.sourceMetadata.authorityReference;
  return requiredString(reference, "SOURCE_REFERENCE");
}

function sourceBindingFromRow(row: SourceIdentityRow, locator: string): WaveASourceBinding {
  const lifecycleState = requiredString(row.lifecycle_state, "SOURCE_LIFECYCLE");
  if (lifecycleState !== "ACTIVE") {
    throw new Error("ISE_WAVE_A_CANONICAL_SOURCE_IDENTITY_INACTIVE");
  }
  return Object.freeze({
    sourceIdentityId: requiredString(row.id, "SOURCE_IDENTITY_ID"),
    canonicalKey: requiredString(row.canonical_key, "SOURCE_CANONICAL_KEY"),
    sourceType: requiredString(row.source_type, "SOURCE_TYPE"),
    normalizedIdentity: requiredString(row.normalized_identity, "SOURCE_NORMALIZED_IDENTITY"),
    lifecycleState: "ACTIVE",
    role: "SCOPE_REFERENCE",
    locator,
    expressionReuse: "NOT_USED",
  });
}

/**
 * Server-owned, read-only access to canonical course and source identity state.
 * Authoring metadata is used only as a lookup key; it never becomes authority.
 */
export class IseWaveACanonicalRepositoryAdapter {
  private readonly database: Pick<DatabaseProvider, "query" | "queryOne" | "execute">;

  readonly qualificationResolver: WaveAQualificationResolver = async (qualificationId) => {
    if (qualificationId !== EXPECTED_QUALIFICATION_ID) return null;
    const result = await this.database.query<CourseRow>({
      sql: `SELECT id, active, deleted_at
        FROM courses
        WHERE id = ? AND deleted_at IS NULL
        LIMIT 2`,
      parameters: [qualificationId],
    });
    if (result.rows.length !== 1) return null;
    const row = result.rows[0];
    const id = requiredString(row.id, "QUALIFICATION_ID");
    if (id !== EXPECTED_QUALIFICATION_ID) return null;
    return { id, active: requiredBoolean(row.active, "QUALIFICATION_ACTIVE") };
  };

  readonly sourceResolver: WaveASourceResolver = async (lesson) => {
    const locator = authorityReference(lesson);
    const result = await this.database.query<SourceIdentityRow>({
      sql: `SELECT id, canonical_key, source_type, normalized_identity, lifecycle_state
        FROM source_identities
        WHERE normalized_identity = ? AND lifecycle_state = 'ACTIVE'
        LIMIT 2`,
      parameters: [locator],
    });
    if (result.rows.length !== 1) {
      throw new Error("ISE_WAVE_A_REQUIRED_CANONICAL_SOURCE_UNRESOLVED");
    }
    const row = result.rows[0];
    const normalizedIdentity = requiredString(row.normalized_identity, "SOURCE_NORMALIZED_IDENTITY");
    if (normalizedIdentity !== locator) {
      throw new Error("ISE_WAVE_A_CANONICAL_SOURCE_SUBSTITUTION");
    }
    return Object.freeze([sourceBindingFromRow(row, locator)]);
  };

  constructor(database: Pick<DatabaseProvider, "query" | "queryOne" | "execute">) {
    this.database = database;
  }

  async buildCurrentState(): Promise<WaveARegistrationState> {
    return buildIseWaveARegistrationState({
      qualificationResolver: this.qualificationResolver,
      sourceResolver: this.sourceResolver,
    });
  }
}

/** Internal server orchestration boundary; it performs canonical reads before pure construction. */
export async function buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(
  database: Pick<DatabaseProvider, "query" | "queryOne" | "execute">,
): Promise<WaveARegistrationState> {
  return new IseWaveACanonicalRepositoryAdapter(database).buildCurrentState();
}

/** Runtime server entrypoint. It is read-only and intentionally has no registration route. */
export async function buildIseWaveACanonicalRevisionProvenanceFromRuntimeRepositories(): Promise<WaveARegistrationState> {
  const { getDatabaseProvider } = await import("../../db/index.ts");
  return buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(await getDatabaseProvider());
}
