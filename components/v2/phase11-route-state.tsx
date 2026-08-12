"use client";

import styles from "./phase11-v2.module.css";

export function Phase11RouteError({ reset, title }: { reset: () => void; title: string }) {
  return <main className={`page-main dashboard-page ${styles.page}`}><div className="shell"><section className={styles.routeState} role="alert"><p className="eyebrow">불러오기 오류</p><h1>{title}</h1><p>잠시 후 다시 시도해주세요.</p><button className="button button-primary" type="button" onClick={reset}>다시 시도</button></section></div></main>;
}

export function Phase11RouteLoading({ title }: { title: string }) {
  return <main className={`page-main dashboard-page ${styles.page}`} aria-busy="true" aria-live="polite"><div className="shell"><section className={styles.routeState}><p className="eyebrow">불러오는 중</p><h1>{title}</h1><p>현재 사용자 정보와 학습 기록을 확인하고 있습니다.</p></section></div></main>;
}
