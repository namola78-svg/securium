import styles from "./analytics-v2.module.css";

export default function AnalyticsLoading() {
  return (
    <main className={`page-main dashboard-page ${styles.page}`} aria-busy="true" aria-live="polite">
      <div className="shell">
        <header className={`dashboard-intro ${styles.header}`}>
          <div><p className="eyebrow">LEARNING ANALYTICS</p><h1>학습 분석</h1><p>최근 학습 기록과 과정별 진도를 확인하고 있습니다.</p></div>
        </header>
        <section className={styles.emptyState}><h2>학습 기록을 불러오는 중입니다.</h2><p>분석 결과를 준비하고 있습니다.</p></section>
      </div>
    </main>
  );
}
