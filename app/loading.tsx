export default function Loading() {
  return (
    <main className="page-main route-loading-page">
      <div className="shell">
        <div className="route-loading" role="status" aria-live="polite">
          <span className="sr-only">학습 정보를 불러오는 중입니다.</span>
          <span className="route-loading-bar" aria-hidden="true" />
        </div>
      </div>
    </main>
  );
}
