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
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    if (saving) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/learning-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dailyQuestionGoal: formData.get("dailyQuestionGoal"),
          dailyStudyMinutes: formData.get("dailyStudyMinutes"),
        }),
      });
      setMessage(
        response.ok
          ? "학습 목표를 저장했습니다."
          : "학습 목표를 저장하지 못했습니다. 입력값을 확인해 주세요.",
      );
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="goal-form" action={save}>
      <label>
        하루 목표 문제 수
        <input
          name="dailyQuestionGoal"
          type="number"
          min={1}
          max={500}
          defaultValue={dailyQuestionGoal}
          required
        />
      </label>
      <label>
        목표 학습시간(분)
        <input
          name="dailyStudyMinutes"
          type="number"
          min={1}
          max={1440}
          defaultValue={dailyStudyMinutes}
          required
        />
      </label>
      <button className="button button-ghost" type="submit" disabled={saving}>
        {saving ? "저장 중" : "목표 저장"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </form>
  );
}
