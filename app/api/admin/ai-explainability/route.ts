import {
  listAdminAIExplainabilityTraces,
  submitAdminAIExplainabilityFeedback,
} from "@/db/ai-explainability-repositories";
import { recordAuditEventSafely } from "@/db/audit-repositories";
import { requireAuditViewer } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";
import {
  aiExplainabilityFeedbackSchema,
  parseInput,
} from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireAuditViewer();
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 50);
    return successResponse(
      request,
      await listAdminAIExplainabilityTraces(limit, {
        source: parseSource(params.get("source")),
        courseId: stringParam(params.get("courseId")),
        provider: stringParam(params.get("provider")),
        status: stringParam(params.get("status")),
        requestId: stringParam(params.get("requestId")),
        feedbackRating: parseFeedbackRating(params.get("feedbackRating")),
        feedbackIssueType: parseFeedbackIssueType(
          params.get("feedbackIssueType"),
        ),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuditViewer();
    await assertAdminActionRateLimit(user.id, "ai-explainability-feedback");
    const input = parseInput(
      aiExplainabilityFeedbackSchema,
      await readRequestInput(request),
    );
    const result = await submitAdminAIExplainabilityFeedback({
      reviewerId: user.id,
      ...input,
    });
    await recordAuditEventSafely(
      {
        actorUserId: user.id,
        actorRoles: user.roles,
        action: "AI_EXPLAINABILITY_FEEDBACK_CREATE",
        resourceType: "AI_EXPLAINABILITY_TRACE",
        resourceId: input.traceId,
        requestId: result.id,
        metadata: {
          traceSource: input.traceSource,
          rating: input.rating,
          issueType: input.issueType,
        },
      },
      request,
    );
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

function stringParam(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}

function parseSource(value: string | null) {
  return value === "QUESTION_EXPLANATION" || value === "SPECIALIZED_REVIEW"
    ? value
    : undefined;
}

function parseFeedbackRating(value: string | null) {
  return value === "HELPFUL" ||
    value === "NOT_HELPFUL" ||
    value === "NEEDS_REVIEW"
    ? value
    : undefined;
}

function parseFeedbackIssueType(value: string | null) {
  return value === "NONE" ||
    value === "LOW_QUALITY_CONTEXT" ||
    value === "MISSING_CITATION" ||
    value === "WRONG_CONCEPT" ||
    value === "PROMPT_ISSUE" ||
    value === "SENSITIVE_CONTENT_RISK" ||
    value === "OTHER"
    ? value
    : undefined;
}
