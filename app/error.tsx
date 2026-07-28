"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-main">
      <div className="shell section">
        <div className="empty-state" role="alert">
          <strong>요청한 화면을 표시하지 못했습니다.</strong>
          <p>민감한 내부 정보는 표시하지 않습니다. 잠시 후 다시 시도해 주세요.</p>
          <button className="button button-dark" type="button" onClick={reset}>
            다시 시도
          </button>
        </div>
      </div>
    </main>
  );
}
