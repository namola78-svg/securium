"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
          setMessage("이미 내 학습에 추가된 과정입니다.");
          router.refresh();
          return;
        }
        throw new Error("ENROLL_FAILED");
      }

      setStatus("enrolled");
      setMessage("과정이 내 학습에 추가되었습니다.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("과정을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  if (status === "checking") {
    return (
      <div className="enroll-action" aria-live="polite">
        <div className="enroll-skeleton" aria-busy="true">
          <span />
          <span />
        </div>
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
          로그인하고 과정 추가
        </Link>
      </div>
    );
  }

  if (status === "enrolled") {
    return (
      <div className="enroll-action">
        <Link className="button button-dark full-width" href={`/learn/${courseSlug}`}>
          학습 계속하기
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
          복습하기
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="enroll-action" aria-live="polite">
        <button
          className="button button-dark full-width"
          type="button"
          onClick={handleEnroll}
        >
          다시 시도
        </button>
        {message ? <p className="enroll-message error">{message}</p> : null}
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
        {status === "enrolling" ? "내 학습에 추가하는 중" : "내 학습에 추가"}
      </button>
    </div>
  );
}

function statusFromEnrollment(status: EnrollmentStatus | null): ActionStatus {
  if (status === "COMPLETED") return "completed";
  if (status === "ACTIVE" || status === "PAUSED") return "enrolled";
  return "ready";
}
