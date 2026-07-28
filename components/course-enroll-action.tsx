"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardSkeleton, InlineError, RetryButton } from "@/components/state-ui";

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

export function CourseEnrollAction({
  courseId,
  courseSlug,
  initialSignedIn,
  initialEnrollmentStatus = null,
}: CourseEnrollActionProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>(
    initialSignedIn
      ? statusFromEnrollment(initialEnrollmentStatus)
      : "checking",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSignedIn) return;

    let active = true;

    async function refreshSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!active) return;
        if (!response.ok) {
          setStatus("anonymous");
          return;
        }
        const payload = (await response.json()) as { authenticated?: boolean };
        setStatus(payload.authenticated ? "ready" : "anonymous");
      } catch {
        if (active) {
          setStatus("anonymous");
        }
      }
    }

    void refreshSession();

    return () => {
      active = false;
    };
  }, [initialSignedIn]);

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
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;

      if (!response.ok) {
        if (payload?.code === "DUPLICATE_ENROLLMENT") {
          setStatus("enrolled");
          setMessage(TEXT.duplicate);
          router.refresh();
          return;
        }
        throw new Error("ENROLL_FAILED");
      }

      setStatus("enrolled");
      setMessage(TEXT.enrolled);
      router.refresh();
    } catch (error) {
      console.error("SECURIUM_ENROLLMENT_ERROR", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      setStatus("error");
      setMessage(TEXT.enrollError);
    }
  }

  if (status === "checking") {
    return (
      <div className="enroll-action" aria-live="polite">
        <CardSkeleton compact />
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="enroll-action">
        <Link
          className="button button-dark full-width"
          href={`/login?return_to=${encodeURIComponent(`/courses/${courseSlug}`)}`}
        >
          {TEXT.loginAndAdd}
        </Link>
      </div>
    );
  }

  if (status === "enrolled") {
    return (
      <div className="enroll-action">
        <Link className="button button-dark full-width" href={`/learn/${courseSlug}`}>
          {TEXT.continueLearning}
        </Link>
        {message ? <p className="enroll-message success">{message}</p> : null}
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="enroll-action">
        <Link
          className="button button-dark full-width"
          href={`/practice/${courseSlug}?mode=review`}
        >
          {TEXT.review}
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="enroll-action" aria-live="polite">
        <RetryButton label={TEXT.retry} onRetry={handleEnroll} />
        {message ? <InlineError message={message} /> : null}
      </div>
    );
  }

  return (
    <div className="enroll-action">
      <button
        className="button button-dark full-width"
        type="button"
        onClick={handleEnroll}
        disabled={status === "enrolling"}
        aria-busy={status === "enrolling"}
      >
        {status === "enrolling" ? TEXT.enrolling : TEXT.addToLearning}
      </button>
    </div>
  );
}

function statusFromEnrollment(status: EnrollmentStatus | null): ActionStatus {
  if (status === "COMPLETED") return "completed";
  if (status === "ACTIVE" || status === "PAUSED") return "enrolled";
  return "ready";
}
