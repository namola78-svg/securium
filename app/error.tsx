"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/state-ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("SECURIUM_PAGE_ERROR", { digest: error.digest, name: error.name });
  }, [error.digest, error.name]);

  return (
    <main className="page-main">
      <div className="shell section">
        <ErrorState
          title="페이지를 불러오지 못했습니다"
          description="잠시 후 다시 시도해주세요. 문제가 계속되면 홈이나 과정 목록으로 이동할 수 있습니다."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
