"use client";

import { useState } from "react";

export function LearningSettingsForm({
  dailyQuestionGoal,
  dailyStudyMinutes,
}: {
  dailyQuestionGoal: number;
  dailyStudyMinutes: number;
}) {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ dailyQuestionGoal?: string; dailyStudyMinutes?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setErrors({});
    const questionGoal = Number(formData.get("dailyQuestionGoal"));
    const studyMinutes = Number(formData.get("dailyStudyMinutes"));
    const nextErrors: typeof errors = {};
    if (!Number.isInteger(questionGoal) || questionGoal < 1 || questionGoal > 500) nextErrors.dailyQuestionGoal = "하루 1~500 사이의 정수를 입력해주세요.";
    if (!Number.isInteger(studyMinutes) || studyMinutes < 1 || studyMinutes > 1440) nextErrors.dailyStudyMinutes = "하루 1~1,440 사이의 정수를 입력해주세요.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/learning-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dailyQuestionGoal: questionGoal,
          dailyStudyMinutes: studyMinutes,
        }),
      });
      setMessage(
        response.ok ? "학습 목표를 저장했습니다." : "학습 목표를 저장하지 못했습니다. 입력값을 확인해주세요.",
      );
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="goal-form" action={save}>
      <label htmlFor="daily-question-goal">
        하루 문제 목표
        <input id="daily-question-goal" name="dailyQuestionGoal" type="number" min={1} max={500} defaultValue={dailyQuestionGoal} required aria-invalid={Boolean(errors.dailyQuestionGoal)} aria-describedby={errors.dailyQuestionGoal ? "daily-question-goal-error" : "daily-question-goal-hint"} />
        <small id="daily-question-goal-hint">하루 1~500문제</small>
        {errors.dailyQuestionGoal ? <small id="daily-question-goal-error" className="field-error" role="alert">{errors.dailyQuestionGoal}</small> : null}
      </label>
      <label htmlFor="daily-study-minutes">
        하루 학습 시간(분)
        <input id="daily-study-minutes" name="dailyStudyMinutes" type="number" min={1} max={1440} defaultValue={dailyStudyMinutes} required aria-invalid={Boolean(errors.dailyStudyMinutes)} aria-describedby={errors.dailyStudyMinutes ? "daily-study-minutes-error" : "daily-study-minutes-hint"} />
        <small id="daily-study-minutes-hint">하루 1~1,440분</small>
        {errors.dailyStudyMinutes ? <small id="daily-study-minutes-error" className="field-error" role="alert">{errors.dailyStudyMinutes}</small> : null}
      </label>
      <button className="button button-ghost" type="submit" disabled={saving} aria-busy={saving}>
        {saving ? "저장 중..." : "목표 저장"}
      </button>
      {message ? <small role="status" aria-live="polite">{message}</small> : null}
    </form>
  );
}
