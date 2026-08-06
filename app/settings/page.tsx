import type { Metadata } from "next";
import Link from "next/link";
import { LearningSettingsForm } from "@/components/learning-settings-form";
import { getLearningSettings } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "학습 설정",
  description: "하루 목표 문제 수와 학습 시간을 설정합니다.",
};
export const dynamic = "force-dynamic";

export default async function LearningSettingsPage() {
  const user = await requireCurrentAppUser("/settings");
  const settings = await getLearningSettings(user.id);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">학습 설정</p>
          <h1>학습 설정</h1>
          <p>
            오늘의 학습 계획과 추천 학습에 사용할 하루 목표 문제 수와 학습
            시간을 관리합니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">하루 목표</p>
            <h2>하루 학습 목표</h2>
            <p>
              설정한 목표는 내 학습 대시보드와 오늘의 학습 계획에서 사용됩니다.
              실제 완료 여부는 풀이와 학습 기록을 기준으로 계산됩니다.
            </p>
            <div className="admin-panel settings-panel">
              <LearningSettingsForm
                dailyQuestionGoal={settings?.dailyQuestionGoal ?? 10}
                dailyStudyMinutes={settings?.dailyStudyMinutes ?? 30}
              />
            </div>
          </article>

          <article className="course-detail-section course-detail-bottom-cta">
            <div>
              <p className="eyebrow">다음 단계</p>
              <h2>설정 후 바로 학습을 이어가세요</h2>
              <p>
                목표를 저장한 뒤 오늘의 학습이나 문제풀이 화면에서 현재 상태를
                확인할 수 있습니다.
              </p>
            </div>
            <div className="button-row">
              <Link className="button button-dark" href="/dashboard">
                대시보드 보기
              </Link>
              <Link className="button button-ghost" href="/practice">
                문제풀이
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
