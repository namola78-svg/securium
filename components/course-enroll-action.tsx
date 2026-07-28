"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthStatus = "checking" | "authenticated" | "anonymous";

type CourseEnrollActionProps = {
  courseId: string;
  courseSlug: string;
  initialSignedIn: boolean;
};

export function CourseEnrollAction({
  courseId,
  courseSlug,
  initialSignedIn,
}: CourseEnrollActionProps) {
  const [status, setStatus] = useState<AuthStatus>(
    initialSignedIn ? "authenticated" : "checking",
  );

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
        setStatus(payload.authenticated ? "authenticated" : "anonymous");
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

  if (status === "authenticated") {
    return (
      <form action="/api/enrollments" method="post">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="returnTo" value={`/learn/${courseSlug}`} />
        <button className="button button-dark full-width" type="submit">
          수강 시작
        </button>
      </form>
    );
  }

  if (status === "checking") {
    return (
      <button className="button button-dark full-width" type="button" disabled>
        로그인 상태 확인 중
      </button>
    );
  }

  return (
    <Link
      className="button button-dark full-width"
      href={`/login?return_to=${encodeURIComponent(`/courses/${courseSlug}`)}`}
    >
      로그인하고 수강하기
    </Link>
  );
}
