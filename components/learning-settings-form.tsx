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
  async function save(formData: FormData) {
    const response = await fetch("/api/learning-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dailyQuestionGoal: formData.get("dailyQuestionGoal"),
        dailyStudyMinutes: formData.get("dailyStudyMinutes"),
      }),
    });
    setMessage(response.ok ? "오늘의 학습 목표를 저장했습니다." : "목표를 저장하지 못했습니다.");
  }
  return (
    <form className="goal-form" action={save}>
      <label>
        하루 목표 문제
        <input
          name="dailyQuestionGoal"
          type="number"
          min={1}
          max={500}
          defaultValue={dailyQuestionGoal}
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
        />
      </label>
      <button className="button button-ghost" type="submit">
        목표 저장
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}

