import type { Metadata } from "next";
import Link from "next/link";
import { LearningSettingsForm } from "@/components/learning-settings-form";
import { getLearningSettings } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import styles from "@/components/v2/phase11-v2.module.css";

export const metadata: Metadata = {
  title: "학습 설정",
  description: "실제 하루 문제 목표와 학습 시간을 설정합니다.",
};
export const dynamic = "force-dynamic";

export default async function LearningSettingsPage() {
  const user = await requireCurrentAppUser("/settings");
  const settings = await getLearningSettings(user.id);

  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <Link className={styles.backLink} href="/profile">마이페이지로 돌아가기</Link>
        <header className={`dashboard-intro ${styles.pageHeader}`}>
          <div><p className="eyebrow">학습 설정</p><h1>학습 목표 설정</h1><p>현재 저장 가능한 하루 문제 수와 학습 시간만 관리합니다.</p></div>
        </header>

        <section className={styles.settingsLayout} aria-label="학습 설정과 안내">
          <article className={styles.settingsCard} aria-labelledby="daily-goal-title">
            <div className={styles.sectionHeading}><div><p className="eyebrow">하루 목표</p><h2 id="daily-goal-title">지속 가능한 학습량</h2></div><span>저장형 설정</span></div>
            <p>설정한 목표는 대시보드의 오늘 학습 계획에 반영됩니다. 실제 완료 여부는 학습 기록을 기준으로 계산합니다.</p>
            <div className={styles.settingsForm}>
              <LearningSettingsForm dailyQuestionGoal={settings?.dailyQuestionGoal ?? 10} dailyStudyMinutes={settings?.dailyStudyMinutes ?? 30} />
            </div>
          </article>

          <aside className={styles.settingsAside} aria-labelledby="settings-account-title">
            <p className="eyebrow">ACCOUNT</p><h2 id="settings-account-title">계정과 학습 관리</h2>
            <nav aria-label="설정 관련 이동"><Link href="/profile"><span>마이페이지</span><strong>계정 정보 확인</strong></Link><Link href="/dashboard"><span>오늘 학습</span><strong>대시보드에서 목표 확인</strong></Link><Link href="/analytics"><span>학습 결과</span><strong>상세 분석 보기</strong></Link></nav>
            <p>알림, 계정 삭제, 공개 프로필 설정은 현재 제공되는 기능이 아닙니다.</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
