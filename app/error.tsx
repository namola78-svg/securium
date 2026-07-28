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
    console.error("SECURIUM_PAGE_ERROR", {
      digest: error.digest,
      name: error.name,
    });
  }, [error.digest, error.name]);

  return (
    <main className="page-main">
      <div className="shell section">
        <ErrorState
          title="정보를 불러오지 못했습니다"
          description="잠시 후 다시 시도해주세요"
          onRetry={reset}
        />
      </div>
    </main>
  );
}
