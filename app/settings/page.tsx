import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { LearningSettingsForm } from "@/components/learning-settings-form";
import { getLearningSettings } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "학습 설정",
  description: "하루 문제 목표와 학습 시간을 설정합니다.",
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
          <h1>학습 목표 설정</h1>
          <p>하루 문제 수와 학습 시간을 정하면 대시보드의 오늘 학습 계획에 반영됩니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">하루 목표</p>
            <h2>지속 가능한 학습량을 정해보세요</h2>
            <p>설정한 목표는 추천 학습과 대시보드 요약에 사용됩니다. 실제 완료 여부는 학습 기록을 기준으로 계산합니다.</p>
            <div className="learner-settings-panel settings-panel">
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
              <p>오늘의 학습 계획과 복습 항목은 대시보드에서 확인할 수 있습니다.</p>
            </div>
            <div className="button-row">
              <ActionButton href="/dashboard" variant="dark">대시보드 보기</ActionButton>
              <ActionButton href="/practice" variant="ghost">문제풀이 시작</ActionButton>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
