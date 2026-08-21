import { AppError } from "../errors.ts";

export type QuestionStatus =
  | "DRAFT"
  | "REVIEW_REQUESTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

export type WorkflowAction =
  | "REQUEST_REVIEW"
  | "START_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "PUBLISH"
  | "ARCHIVE";

const transitions: Record<
  WorkflowAction,
  { from: QuestionStatus[]; to: QuestionStatus; roles: string[] }
> = {
  REQUEST_REVIEW: {
    from: ["DRAFT", "REJECTED"],
    to: "REVIEW_REQUESTED",
    roles: ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"],
  },
  START_REVIEW: {
    from: ["REVIEW_REQUESTED"],
    to: "IN_REVIEW",
    roles: ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"],
  },
  APPROVE: {
    from: ["REVIEW_REQUESTED", "IN_REVIEW"],
    to: "APPROVED",
    roles: ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"],
  },
  REJECT: {
    from: ["REVIEW_REQUESTED", "IN_REVIEW"],
    to: "REJECTED",
    roles: ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"],
  },
  PUBLISH: {
    from: ["APPROVED"],
    to: "PUBLISHED",
    roles: ["COURSE_MANAGER", "ADMIN", "SUPER_ADMIN"],
  },
  ARCHIVE: {
    from: ["DRAFT", "REJECTED", "APPROVED", "PUBLISHED"],
    to: "ARCHIVED",
    roles: ["COURSE_MANAGER", "ADMIN", "SUPER_ADMIN"],
  },
};

export function assertQuestionEditor(roles: string[]) {
  if (
    !roles.some((role) =>
      ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"].includes(role),
    )
  ) {
    throw new AppError(
      "문제를 작성할 권한이 없습니다.",
      403,
      "QUESTION_EDIT_FORBIDDEN",
    );
  }
}

export function resolveQuestionTransition(input: {
  action: WorkflowAction;
  status: QuestionStatus;
  roles: string[];
  actorId: string;
  createdBy: string;
}) {
  const rule = transitions[input.action];
  if (!rule.roles.some((role) => input.roles.includes(role))) {
    throw new AppError(
      "이 검수 작업을 수행할 권한이 없습니다.",
      403,
      "QUESTION_REVIEW_FORBIDDEN",
    );
  }
  if (!rule.from.includes(input.status)) {
    throw new AppError(
      "현재 상태에서는 요청한 검수 작업을 수행할 수 없습니다.",
      409,
      "INVALID_QUESTION_TRANSITION",
    );
  }
  if (
    ["START_REVIEW", "APPROVE", "REJECT"].includes(input.action) &&
    input.actorId === input.createdBy &&
    !input.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role))
  ) {
    throw new AppError(
      "작성자는 자신의 문제를 검수할 수 없습니다.",
      403,
      "SELF_REVIEW_FORBIDDEN",
    );
  }
  return rule.to;
}

export function createQuestionVersionSnapshot(value: unknown) {
  return JSON.stringify(value);
}

export function assertGovernedQuestionApproval(input: {
  semanticHash?: string | null;
  governanceJson?: string | null;
  humanReviewHash?: string | null;
  humanReviewedBy?: string | null;
  humanReviewedAt?: string | null;
}) {
  if (!input.semanticHash || !input.governanceJson) {
    throw new AppError(
      "Question governance metadata is required before approval.",
      409,
      "QUESTION_GOVERNANCE_REQUIRED",
    );
  }
  if (
    !input.humanReviewHash ||
    !input.humanReviewedBy ||
    !input.humanReviewedAt
  ) {
    throw new AppError(
      "Human review must be bound to the exact question version.",
      409,
      "HUMAN_REVIEW_REQUIRED",
    );
  }
  try {
    const governance = JSON.parse(input.governanceJson) as Record<string, unknown>;
    if (governance.rightsStatus !== "PASS") {
      throw new AppError(
        "Rights review is required before question approval.",
        409,
        "RIGHTS_REVIEW_REQUIRED",
      );
    }
    if (
      !["PASS_LOW_SIMILARITY", "REVIEW_MEDIUM_SIMILARITY"].includes(
        String(governance.similarityStatus),
      )
    ) {
      throw new AppError(
        "Question similarity review is not clear.",
        409,
        "QUESTION_SIMILARITY_NOT_CLEAR",
      );
    }
    if (governance.reviewedSemanticHash !== input.semanticHash) {
      throw new AppError(
        "Human review is not bound to this exact semantic version.",
        409,
        "HUMAN_REVIEW_HASH_MISMATCH",
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Question governance metadata is invalid.",
      409,
      "QUESTION_GOVERNANCE_INVALID",
    );
  }
}

