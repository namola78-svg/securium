import type {
  PublicCourseOutlineResult,
} from "./public-course-outline-adapter.ts";

export type PublicDiscoverySelectionInput = Readonly<{
  courseId: string;
  courseSlug: string;
}>;

export type PublicDiscoverySelectionErrorCode =
  | "INVALID_INPUT"
  | "IDENTITY_MISMATCH";

export type PublicDiscoverySelectionError = Readonly<{
  status: "SELECTION_ERROR";
  code: PublicDiscoverySelectionErrorCode;
}>;

export type PublicDiscoverySelectionResult =
  | PublicCourseOutlineResult
  | PublicDiscoverySelectionError;

export type PublicDiscoveryOutlineAdapter = (
  input: Readonly<{ courseSlug: string }>,
) => Promise<PublicCourseOutlineResult>;

/**
 * Connects a server-owned search selection to the current public outline.
 * The selection ID is a binding check, not an authorization proof or a
 * snapshot/revision guarantee.
 */
export function createPublicDiscoverySelectionService(
  outlineAdapter: PublicDiscoveryOutlineAdapter,
) {
  async function getSelectedCourseOutline(
    input: unknown,
  ): Promise<PublicDiscoverySelectionResult> {
    if (!isValidInput(input)) {
      return { status: "SELECTION_ERROR", code: "INVALID_INPUT" };
    }

    const outline = await outlineAdapter({ courseSlug: input.courseSlug });
    if (outline.status !== "OK") return outline;
    if (outline.course.id !== input.courseId) {
      return { status: "SELECTION_ERROR", code: "IDENTITY_MISMATCH" };
    }
    return outline;
  }

  return Object.freeze({ getSelectedCourseOutline });
}

function isValidInput(input: unknown): input is PublicDiscoverySelectionInput {
  if (!isRecord(input)) return false;
  if (Object.keys(input).some((key) => key !== "courseId" && key !== "courseSlug")) {
    return false;
  }
  return (
    typeof input.courseId === "string" &&
    input.courseId.trim().length > 0 &&
    typeof input.courseSlug === "string" &&
    input.courseSlug.length > 0 &&
    input.courseSlug === input.courseSlug.trim()
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
