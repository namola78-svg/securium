import type {
  PublicCourseOutlineResult,
  PublicCourseOutlineSubject,
  PublicCourseOutlineTopic,
} from "./public-course-outline-adapter.ts";
import type {
  PublicCourseSearchResult,
  PublicCourseSummary,
} from "./public-course-search-adapter.ts";
import type { PublicDiscoverySelectionResult } from "./public-discovery-selection.ts";
import {
  formatPublicDiscoveryUserGuidance,
  type PublicDiscoveryUserGuidance,
} from "./public-discovery-user-guidance.ts";
import {
  formatPublicSourceDisclosure,
  type PublicSourceDisclosure,
} from "./public-source-disclosure.ts";

export type PublicDiscoveryPresentationInput =
  | Readonly<{
      source: "SEARCH_RESULT";
      result: PublicCourseSearchResult;
    }>
  | Readonly<{
      source: "SEARCH_ERROR";
      error: unknown;
    }>
  | Readonly<{
      source: "SELECTION_RESULT";
      result: PublicDiscoverySelectionResult;
      sourceProjection?: unknown;
    }>;

export type PublicDiscoveryPresentationKind =
  | "SEARCH_RESULT"
  | "SEARCH_ERROR"
  | "SELECTION_RESULT"
  | "UNKNOWN";

type PublicCourseOutlineSuccess = Extract<
  PublicCourseOutlineResult,
  { status: "OK" }
>;

export type PublicDiscoveryPresentation = Readonly<{
  /** Identifies which independent result envelope is being displayed. */
  kind: PublicDiscoveryPresentationKind;
  /** A bounded public search DTO, or null for selection/unknown/error output. */
  search: PublicCourseSearchResult | null;
  /** A successful bounded outline DTO, or null for all selection failures. */
  outline: PublicCourseOutlineSuccess | null;
  guidance: PublicDiscoveryUserGuidance;
  /** Disclosure is only composed for a successful selection result. */
  disclosure: PublicSourceDisclosure | null;
}>;

/**
 * Composes already-produced public discovery results for display.
 *
 * This function does not execute discovery services, read repositories, issue
 * request IDs, track state, decide publication/authorization, or validate the
 * source binding behind a caller-provided disclosure projection.
 */
export function composePublicDiscoveryPresentation(
  input: unknown,
): PublicDiscoveryPresentation {
  try {
    if (!isRecord(input)) return unknownPresentation();

    if (input.source === "SEARCH_RESULT") {
      if (!hasExactKeys(input, ["source", "result"])) {
        return unknownPresentation();
      }
      return composeSearchResult(input.result);
    }

    if (input.source === "SEARCH_ERROR") {
      if (!hasExactKeys(input, ["source", "error"])) {
        return unknownPresentation();
      }
      const guidance = formatGuidance({
        source: "SEARCH_ERROR",
        error: input.error,
      });
      return presentation("SEARCH_ERROR", null, null, guidance, null);
    }

    if (input.source === "SELECTION_RESULT") {
      if (!hasSelectionKeys(input)) return unknownPresentation();
      return composeSelectionResult(input);
    }

    return unknownPresentation();
  } catch {
    // The formatter's bounded unknown-result contract is the safe fallback for
    // hostile accessors or other malformed envelopes.
    return unknownPresentation();
  }
}

function composeSearchResult(
  result: unknown,
): PublicDiscoveryPresentation {
  const guidance = formatGuidance({ source: "SEARCH_RESULT", result });
  if (guidance.category !== "SEARCH_RESULTS" && guidance.category !== "SEARCH_EMPTY") {
    return unknownPresentation(guidance);
  }

  return presentation(
    "SEARCH_RESULT",
    projectSearchResult(result as PublicCourseSearchResult),
    null,
    guidance,
    null,
  );
}

function composeSelectionResult(
  input: Record<string, unknown>,
): PublicDiscoveryPresentation {
  const guidance = formatGuidance({
    source: "SELECTION_RESULT",
    result: input.result,
  });

  if (guidance.category === "UNKNOWN_RESULT") {
    return unknownPresentation(guidance);
  }

  if (guidance.category !== "OUTLINE_READY" && guidance.category !== "OUTLINE_EMPTY") {
    // A failed selection is intentionally a guidance-only display. In
    // particular, caller projection data is not passed to disclosure here.
    return presentation("SELECTION_RESULT", null, null, guidance, null);
  }

  const outline = projectOutlineResult(
    input.result as PublicCourseOutlineSuccess,
  );
  const disclosure = formatPublicSourceDisclosure(input.sourceProjection);
  return presentation("SELECTION_RESULT", null, outline, guidance, disclosure);
}

function projectSearchResult(
  result: PublicCourseSearchResult,
): PublicCourseSearchResult {
  const results = Object.freeze(result.results.map(projectSearchSummary));
  const page = Object.freeze({
    limit: result.page.limit,
    hasNext: result.page.hasNext,
    nextCursor: result.page.nextCursor,
  });

  return Object.freeze({
    contractVersion: result.contractVersion,
    status: result.status,
    results,
    page,
  });
}

function projectSearchSummary(summary: PublicCourseSummary): PublicCourseSummary {
  return Object.freeze({
    id: summary.id,
    groupName: summary.groupName,
    code: summary.code,
    slug: summary.slug,
    name: summary.name,
    shortName: summary.shortName,
    description: summary.description,
    thumbnailUrl: summary.thumbnailUrl,
    totalLevels: summary.totalLevels,
    difficulty: summary.difficulty,
    ...(summary.updatedAt !== undefined ? { updatedAt: summary.updatedAt } : {}),
    ...(summary.subjectCount !== undefined
      ? { subjectCount: summary.subjectCount }
      : {}),
    ...(summary.topicCount !== undefined ? { topicCount: summary.topicCount } : {}),
  });
}

function projectOutlineResult(
  result: PublicCourseOutlineSuccess,
): PublicCourseOutlineSuccess {
  return Object.freeze({
    status: "OK",
    course: Object.freeze({
      id: result.course.id,
      slug: result.course.slug,
      code: result.course.code,
      name: result.course.name,
      shortName: result.course.shortName,
      groupName: result.course.groupName,
      description: result.course.description,
      difficulty: result.course.difficulty,
    }),
    subjects: Object.freeze(result.subjects.map(projectOutlineSubject)),
  });
}

function projectOutlineSubject(
  subject: PublicCourseOutlineSubject,
): PublicCourseOutlineSubject {
  return Object.freeze({
    id: subject.id,
    courseId: subject.courseId,
    code: subject.code,
    name: subject.name,
    description: subject.description,
    displayOrder: subject.displayOrder,
    isSample: subject.isSample,
    topics: Object.freeze(subject.topics.map(projectOutlineTopic)),
  });
}

function projectOutlineTopic(
  topic: PublicCourseOutlineTopic,
): PublicCourseOutlineTopic {
  return Object.freeze({
    id: topic.id,
    subjectId: topic.subjectId,
    code: topic.code,
    name: topic.name,
    description: topic.description,
    displayOrder: topic.displayOrder,
    isSample: topic.isSample,
  });
}

function formatGuidance(input: unknown): PublicDiscoveryUserGuidance {
  try {
    return formatPublicDiscoveryUserGuidance(input);
  } catch {
    return formatPublicDiscoveryUserGuidance(null);
  }
}

function unknownPresentation(
  guidance = formatGuidance(null),
): PublicDiscoveryPresentation {
  return presentation("UNKNOWN", null, null, guidance, null);
}

function presentation(
  kind: PublicDiscoveryPresentationKind,
  search: PublicCourseSearchResult | null,
  outline: PublicCourseOutlineSuccess | null,
  guidance: PublicDiscoveryUserGuidance,
  disclosure: PublicSourceDisclosure | null,
): PublicDiscoveryPresentation {
  return Object.freeze({ kind, search, outline, guidance, disclosure });
}

function hasSelectionKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length >= 2 &&
    keys.every((key) =>
      key === "source" || key === "result" || key === "sourceProjection",
    ) &&
    Object.prototype.hasOwnProperty.call(value, "result")
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
