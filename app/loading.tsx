export default function Loading() {
  return (
    <main className="page-main">
      <div className="shell section">
        <div className="empty-state" role="status" aria-live="polite">
          <strong>학습 정보를 불러오는 중입니다.</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>
      </div>
    </main>
  );
}
