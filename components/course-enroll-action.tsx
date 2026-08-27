"use client";

import { authRedirectHref } from "@/lib/auth-routing";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/design-system-primitives";
import { CardSkeleton, InlineError, RetryButton } from "@/components/state-ui";
import { usePresentationIdentity } from "@/components/presentation-identity-provider";

type EnrollmentStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
type ActionStatus =
  | "checking"
  | "anonymous"
  | "ready"
  | "enrolling"
  | "enrolled"
  | "completed"
  | "error";

type CourseEnrollActionProps = {
  courseId: string;
  courseSlug: string;
  initialSignedIn: boolean;
  initialEnrollmentStatus?: EnrollmentStatus | null;
};

const TEXT = {
  duplicate: "\uC774\uBBF8 \uB0B4 \uD559\uC2B5\uC5D0 \uCD94\uAC00\uB41C \uACFC\uC815\uC785\uB2C8\uB2E4.",
  enrolled: "\uACFC\uC815\uC744 \uB0B4 \uD559\uC2B5\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4.",
  enrollError:
    "\uACFC\uC815\uC744 \uCD94\uAC00\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
  loginAndAdd:
    "\uB85C\uADF8\uC778\uD558\uACE0 \uACFC\uC815 \uCD94\uAC00",
  continueLearning: "\uD559\uC2B5 \uACC4\uC18D\uD558\uAE30",
  review: "\uBCF5\uC2B5\uD558\uAE30",
  retry: "\uB2E4\uC2DC \uC2DC\uB3C4",
  enrolling:
    "\uB0B4 \uD559\uC2B5\uC5D0 \uCD94\uAC00\uD558\uB294 \uC911",
  addToLearning:
    "\uB0B4 \uD559\uC2B5\uC5D0 \uCD94\uAC00",
} as const;
const ENROLLMENT_SYNC_EVENT = "securium:course-enrolled";

export function CourseEnrollAction({
  courseId,
  courseSlug,
  initialSignedIn,
  initialEnrollmentStatus = null,
}: CourseEnrollActionProps) {
  const router = useRouter();
  const { status: presentationStatus, identity } = usePresentationIdentity();
  const [status, setStatus] = useState<ActionStatus>(
    initialSignedIn
      ? statusFromEnrollment(initialEnrollmentStatus)
      : "checking",
  );
  const renderStatus =
    !initialSignedIn && status === "checking" && presentationStatus !== "loading"
      ? identity?.authenticated
        ? "ready"
        : "anonymous"
      : status;
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleEnrollmentSync(event: Event) {
      const detail = (event as CustomEvent<{ courseId?: string }>).detail;
      if (detail?.courseId !== courseId) return;
      setStatus("enrolled");
    }

    window.addEventListener(ENROLLMENT_SYNC_EVENT, handleEnrollmentSync);
    return () => window.removeEventListener(ENROLLMENT_SYNC_EVENT, handleEnrollmentSync);
  }, [courseId]);

  async function handleEnroll() {
    if (status === "enrolling") return;
    setStatus("enrolling");
    setMessage(null);

    try {
      const response = await fetch("/api/enrollments", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ courseId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (payload?.code === "DUPLICATE_ENROLLMENT") {
          setStatus("enrolled");
          setMessage(TEXT.duplicate);
          syncEnrollmentState(courseId);
          router.refresh();
          return;
        }
        throw new Error("ENROLL_FAILED");
      }

      setStatus("enrolled");
      setMessage(TEXT.enrolled);
      syncEnrollmentState(courseId);
      router.refresh();
    } catch (error) {
      console.error("SECURIUM_ENROLLMENT_ERROR", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      setStatus("error");
      setMessage(TEXT.enrollError);
    }
  }

  if (renderStatus === "checking") {
    return (
      <div className="enroll-action" aria-live="polite">
        <CardSkeleton compact />
      </div>
    );
  }

  if (renderStatus === "anonymous") {
    return (
      <div className="enroll-action">
        <ActionButton
          href={authRedirectHref("/login", `/courses/${courseSlug}`)}
          variant="dark"
          className="full-width"
        >
          {TEXT.loginAndAdd}
        </ActionButton>
      </div>
    );
  }

  if (renderStatus === "enrolled") {
    return (
      <div className="enroll-action">
        <ActionButton href={`/learn/${courseSlug}`} variant="dark" className="full-width">
          {TEXT.continueLearning}
        </ActionButton>
        {message ? <p className="enroll-message success">{message}</p> : null}
      </div>
    );
  }

  if (renderStatus === "completed") {
    return (
      <div className="enroll-action">
        <ActionButton
          href={`/practice/${courseSlug}?mode=review`}
          variant="dark"
          className="full-width"
        >
          {TEXT.review}
        </ActionButton>
      </div>
    );
  }

  if (renderStatus === "error") {
    return (
      <div className="enroll-action" aria-live="polite">
        <RetryButton label={TEXT.retry} onRetry={handleEnroll} />
        {message ? <InlineError message={message} /> : null}
      </div>
    );
  }

  return (
    <div className="enroll-action">
      <ActionButton
        variant="dark"
        className="full-width"
        type="button"
        onClick={handleEnroll}
        disabled={renderStatus === "enrolling"}
        loading={renderStatus === "enrolling"}
        aria-busy={renderStatus === "enrolling"}
      >
        {renderStatus === "enrolling" ? TEXT.enrolling : TEXT.addToLearning}
      </ActionButton>
    </div>
  );
}

function statusFromEnrollment(status: EnrollmentStatus | null): ActionStatus {
  if (status === "COMPLETED") return "completed";
  if (status === "ACTIVE" || status === "PAUSED") return "enrolled";
  return "ready";
}

function syncEnrollmentState(courseId: string) {
  window.dispatchEvent(
    new CustomEvent(ENROLLMENT_SYNC_EVENT, {
      detail: { courseId },
    }),
  );
}
