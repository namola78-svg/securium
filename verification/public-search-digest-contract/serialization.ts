import {
  buildPublicCourseSearchProjection,
  createPublicCourseSearchIdOrderKey,
  isSupportedPublicCourseSearchId,
  isWellFormedPublicCourseSearchUnicodeString,
  type PublicCourseSearchProjectionParts,
} from "../../lib/services/public-course-search-comparison.ts";

/**
 * Verification-only candidate. This is deliberately not a product storage
 * helper and is not imported by lib/db/writer/provider code.
 */
export const PUBLIC_SEARCH_DIGEST_SERIALIZATION_VERSION =
  "public-course-search.digest-serialization.v1" as const;

export const PUBLIC_SEARCH_DIGEST_SOURCE_PURPOSE = "source-input" as const;
export const PUBLIC_SEARCH_DIGEST_PROJECTION_PURPOSE =
  "normalized-projection" as const;

export type PublicSearchRuntimeMetadata = Readonly<{
  node: string;
  icu: string;
  unicode: string;
}>;

export type PublicSearchSourceDigestInput = Readonly<{
  courseId: string;
  courseGroupId: string;
  name: string;
  shortName: string;
  groupName: string;
  sourceDescription: string;
  sourceDifficulty: string;
  publicDescriptionRuleVersion: string;
  audienceLabelRuleVersion: string;
  normalizerVersion: string;
  projectionVersion: string;
  runtime?: PublicSearchRuntimeMetadata;
}>;

export type PublicSearchNormalizedProjectionDigestInput = Readonly<{
  courseId: string;
  courseGroupId: string;
  projectionParts: PublicCourseSearchProjectionParts;
  normalizerVersion: string;
  orderKeyVersion: string;
  projectionVersion: string;
  runtime?: PublicSearchRuntimeMetadata;
}>;

export type PublicSearchDigestSerializationOptions = Readonly<{
  serializationVersion?: string;
}>;

type PlainRecord = Record<string, unknown>;

const SOURCE_FIELDS = [
  "course.id",
  "course.groupId",
  "course.name",
  "course.shortName",
  "group.name",
  "course.description",
  "course.difficulty",
  "display.publicDescriptionRuleVersion",
  "display.audienceLabelRuleVersion",
  "search.normalizerVersion",
  "search.projectionVersion",
  "runtime.node",
  "runtime.icu",
  "runtime.unicode",
] as const;

const PROJECTION_FIELDS = [
  "course.id",
  "course.groupId",
  "search.normalizedProjection",
  "search.idOrderKey",
  "search.normalizerVersion",
  "search.orderKeyVersion",
  "search.projectionVersion",
  "runtime.node",
  "runtime.icu",
  "runtime.unicode",
] as const;

const PROJECTION_PART_FIELDS = [
  "name",
  "shortName",
  "groupName",
  "publicDescription",
  "audienceLabel",
] as const;

const RUNTIME_FIELDS = ["node", "icu", "unicode"] as const;

const SOURCE_INPUT_FIELDS = [
  "courseId",
  "courseGroupId",
  "name",
  "shortName",
  "groupName",
  "sourceDescription",
  "sourceDifficulty",
  "publicDescriptionRuleVersion",
  "audienceLabelRuleVersion",
  "normalizerVersion",
  "projectionVersion",
  "runtime",
] as const;

const PROJECTION_INPUT_FIELDS = [
  "courseId",
  "courseGroupId",
  "projectionParts",
  "normalizerVersion",
  "orderKeyVersion",
  "projectionVersion",
  "runtime",
] as const;

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(
  value: unknown,
  allowedKeys: readonly string[],
  field: string,
): asserts value is PlainRecord {
  if (!isPlainRecord(value)) {
    throw new TypeError(`${field} must be a plain object`);
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      throw new TypeError(`${field} contains an unsupported field`);
    }
  }
}

function assertRequiredOwnKeys(
  value: PlainRecord,
  requiredKeys: readonly string[],
  field: string,
) {
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(`${field}.${key} is required`);
    }
  }
}

function assertWellFormedString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a well-formed Unicode string`);
  }
  if (!isWellFormedPublicCourseSearchUnicodeString(value)) {
    throw new RangeError(`${field} must contain Unicode scalar values`);
  }
  return value;
}

function assertNonEmptyString(value: unknown, field: string): string {
  const stringValue = assertWellFormedString(value, field);
  if (stringValue.length === 0) {
    throw new RangeError(`${field} must not be empty`);
  }
  return stringValue;
}

function readRuntime(value: PlainRecord): PublicSearchRuntimeMetadata | undefined {
  if (!Object.prototype.hasOwnProperty.call(value, "runtime")) return undefined;
  if (value.runtime === undefined || value.runtime === null) {
    throw new TypeError("runtime must be omitted or a metadata object");
  }

  assertExactKeys(value.runtime, RUNTIME_FIELDS, "runtime");
  assertRequiredOwnKeys(value.runtime, RUNTIME_FIELDS, "runtime");
  return {
    node: assertNonEmptyString(value.runtime.node, "runtime.node"),
    icu: assertNonEmptyString(value.runtime.icu, "runtime.icu"),
    unicode: assertNonEmptyString(value.runtime.unicode, "runtime.unicode"),
  };
}

function utf8Hex(value: string): { byteLength: number; hex: string } {
  const bytes = new TextEncoder().encode(value);
  return {
    byteLength: bytes.byteLength,
    hex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

function encodeFieldLine(
  index: number,
  field: string,
  value: string | undefined,
): string {
  if (value === undefined) {
    return `${index}\t${field}\tstring\tomitted\t0\t\n`;
  }

  const encoded = utf8Hex(assertWellFormedString(value, field));
  return `${index}\t${field}\tstring\tpresent\t${encoded.byteLength}\t${encoded.hex}\n`;
}

function makeWireText(
  purpose: string,
  fields: readonly string[],
  values: readonly (string | undefined)[],
  serializationVersion: string,
): string {
  if (fields.length !== values.length) {
    throw new Error("verification serializer field/value mismatch");
  }
  const version = assertNonEmptyString(
    serializationVersion,
    "serializationVersion",
  );
  const lines = [
    `format=${version}\n`,
    `purpose=${purpose}\n`,
    `field-count=${fields.length}\n`,
  ];
  for (let index = 0; index < fields.length; index += 1) {
    lines.push(encodeFieldLine(index, fields[index], values[index]));
  }
  return lines.join("");
}

function encodeWireText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function serializationVersion(
  options: PublicSearchDigestSerializationOptions | undefined,
): string {
  if (options === undefined) return PUBLIC_SEARCH_DIGEST_SERIALIZATION_VERSION;
  assertExactKeys(options, ["serializationVersion"], "options");
  if (!Object.prototype.hasOwnProperty.call(options, "serializationVersion")) {
    return PUBLIC_SEARCH_DIGEST_SERIALIZATION_VERSION;
  }
  return assertNonEmptyString(
    options.serializationVersion,
    "options.serializationVersion",
  );
}

function readSourceInput(input: unknown): {
  value: PublicSearchSourceDigestInput;
  runtime: PublicSearchRuntimeMetadata | undefined;
} {
  assertExactKeys(input, SOURCE_INPUT_FIELDS, "source input");
  assertRequiredOwnKeys(
    input,
    SOURCE_INPUT_FIELDS.filter((field) => field !== "runtime"),
    "source input",
  );
  const courseId = assertNonEmptyString(input.courseId, "courseId");
  const courseGroupId = assertNonEmptyString(
    input.courseGroupId,
    "courseGroupId",
  );
  if (!isSupportedPublicCourseSearchId(courseId)) {
    throw new RangeError("courseId is not a supported public-search ID");
  }
  if (!isSupportedPublicCourseSearchId(courseGroupId)) {
    throw new RangeError("courseGroupId is not a supported public-search ID");
  }

  const runtime = readRuntime(input);
  const value = {
    courseId,
    courseGroupId,
    name: assertWellFormedString(input.name, "name"),
    shortName: assertWellFormedString(input.shortName, "shortName"),
    groupName: assertWellFormedString(input.groupName, "groupName"),
    sourceDescription: assertWellFormedString(
      input.sourceDescription,
      "sourceDescription",
    ),
    sourceDifficulty: assertWellFormedString(
      input.sourceDifficulty,
      "sourceDifficulty",
    ),
    publicDescriptionRuleVersion: assertNonEmptyString(
      input.publicDescriptionRuleVersion,
      "publicDescriptionRuleVersion",
    ),
    audienceLabelRuleVersion: assertNonEmptyString(
      input.audienceLabelRuleVersion,
      "audienceLabelRuleVersion",
    ),
    normalizerVersion: assertNonEmptyString(
      input.normalizerVersion,
      "normalizerVersion",
    ),
    projectionVersion: assertNonEmptyString(
      input.projectionVersion,
      "projectionVersion",
    ),
    ...(runtime === undefined
      ? {}
      : { runtime }),
  } as PublicSearchSourceDigestInput;
  return { value, runtime };
}

function readProjectionInput(input: unknown): {
  value: PublicSearchNormalizedProjectionDigestInput;
  runtime: PublicSearchRuntimeMetadata | undefined;
} {
  assertExactKeys(input, PROJECTION_INPUT_FIELDS, "projection input");
  assertRequiredOwnKeys(
    input,
    PROJECTION_INPUT_FIELDS.filter((field) => field !== "runtime"),
    "projection input",
  );
  const courseId = assertNonEmptyString(input.courseId, "courseId");
  const courseGroupId = assertNonEmptyString(
    input.courseGroupId,
    "courseGroupId",
  );
  if (!isSupportedPublicCourseSearchId(courseId)) {
    throw new RangeError("courseId is not a supported public-search ID");
  }
  if (!isSupportedPublicCourseSearchId(courseGroupId)) {
    throw new RangeError("courseGroupId is not a supported public-search ID");
  }

  assertExactKeys(
    input.projectionParts,
    PROJECTION_PART_FIELDS,
    "projectionParts",
  );
  assertRequiredOwnKeys(
    input.projectionParts,
    PROJECTION_PART_FIELDS,
    "projectionParts",
  );
  const projectionParts = {
    name: assertWellFormedString(input.projectionParts.name, "name"),
    shortName: assertWellFormedString(
      input.projectionParts.shortName,
      "shortName",
    ),
    groupName: assertWellFormedString(
      input.projectionParts.groupName,
      "groupName",
    ),
    publicDescription: assertWellFormedString(
      input.projectionParts.publicDescription,
      "publicDescription",
    ),
    audienceLabel: assertWellFormedString(
      input.projectionParts.audienceLabel,
      "audienceLabel",
    ),
  } satisfies PublicCourseSearchProjectionParts;
  const runtime = readRuntime(input);
  const value = {
    courseId,
    courseGroupId,
    projectionParts,
    normalizerVersion: assertNonEmptyString(
      input.normalizerVersion,
      "normalizerVersion",
    ),
    orderKeyVersion: assertNonEmptyString(
      input.orderKeyVersion,
      "orderKeyVersion",
    ),
    projectionVersion: assertNonEmptyString(
      input.projectionVersion,
      "projectionVersion",
    ),
    ...(runtime === undefined
      ? {}
      : { runtime }),
  } as PublicSearchNormalizedProjectionDigestInput;
  return { value, runtime };
}

/** Serializes canonical-source inputs for source-change detection. */
export function serializePublicSearchSourceDigestInput(
  input: unknown,
  options?: PublicSearchDigestSerializationOptions,
): Uint8Array {
  const { value, runtime } = readSourceInput(input);
  return encodeWireText(
    makeWireText(
      PUBLIC_SEARCH_DIGEST_SOURCE_PURPOSE,
      SOURCE_FIELDS,
      [
        value.courseId,
        value.courseGroupId,
        value.name,
        value.shortName,
        value.groupName,
        value.sourceDescription,
        value.sourceDifficulty,
        value.publicDescriptionRuleVersion,
        value.audienceLabelRuleVersion,
        value.normalizerVersion,
        value.projectionVersion,
        runtime?.node,
        runtime?.icu,
        runtime?.unicode,
      ],
      serializationVersion(options),
    ),
  );
}

/**
 * Serializes the normalized projection result and its order/version binding.
 * The existing comparison helper is the sole normalizer implementation.
 */
export function serializePublicSearchNormalizedProjectionDigestInput(
  input: unknown,
  options?: PublicSearchDigestSerializationOptions,
): Uint8Array {
  const { value, runtime } = readProjectionInput(input);
  const normalizedProjection = buildPublicCourseSearchProjection(
    value.projectionParts,
  );
  const idOrderKey = createPublicCourseSearchIdOrderKey(value.courseId);
  return encodeWireText(
    makeWireText(
      PUBLIC_SEARCH_DIGEST_PROJECTION_PURPOSE,
      PROJECTION_FIELDS,
      [
        value.courseId,
        value.courseGroupId,
        normalizedProjection,
        idOrderKey,
        value.normalizerVersion,
        value.orderKeyVersion,
        value.projectionVersion,
        runtime?.node,
        runtime?.icu,
        runtime?.unicode,
      ],
      serializationVersion(options),
    ),
  );
}
