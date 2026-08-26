import styles from "@/components/v2/dashboard-v2.module.css";

export default function DashboardLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="대시보드 불러오는 중">
      <div className={styles.container}>
        <div className={styles.loadingHeader} />
        <div className={styles.loadingGrid} aria-hidden="true">
          <div className={styles.loadingPrimary} />
          <div className={styles.loadingCard} />
          <div className={styles.loadingWide} />
          <div className={styles.loadingWide} />
        </div>
        <span className="sr-only" role="status">대시보드를 불러오고 있습니다.</span>
      </div>
    </main>
  );
}
