"use client";

import styles from "./analytics-v2.module.css";

export default function AnalyticsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <section className={styles.emptyState} role="alert">
          <p className="eyebrow">불러오기 오류</p>
          <h1>학습 분석을 불러오지 못했습니다.</h1>
          <p>잠시 후 다시 시도해주세요.</p>
          <button className="button button-primary" type="button" onClick={reset}>다시 시도</button>
        </section>
      </div>
    </main>
  );
}
