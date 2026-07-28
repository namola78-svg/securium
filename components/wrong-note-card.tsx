"use client";

import { useState } from "react";
import Link from "next/link";

export function WrongNoteCard({
  note,
}: {
  note: {
    id: string;
    title: string;
    content: string;
    wrongCount: number;
    mastered: boolean;
    userMemo: string;
    questionId: string;
    courseId: string;
    courseSlug: string;
  };
}) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) {
    const response = await fetch("/api/wrong-notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: note.id,
        userMemo: formData.get("userMemo"),
        mastered: formData.get("mastered") === "on",
      }),
    });
    setMessage(response.ok ? "오답노트를 저장했습니다." : "저장하지 못했습니다.");
  }
  async function bookmark() {
    const response = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "QUESTION",
        targetId: note.questionId,
        courseId: note.courseId,
      }),
    });
    setMessage(response.ok ? "즐겨찾기를 변경했습니다." : "변경하지 못했습니다.");
  }
  return (
    <article className="review-card">
      <div className="course-card-top">
        <span className="badge">오답 {note.wrongCount}회</span>
        <span className={note.mastered ? "status-on" : "status-off"}>
          {note.mastered ? "숙지 완료" : "미숙지"}
        </span>
      </div>
      <h2>{note.title}</h2>
      <p>{note.content}</p>
      <form action={save}>
        <label>
          내 메모
          <textarea name="userMemo" defaultValue={note.userMemo} maxLength={2000} />
        </label>
        <label className="check-label">
          <input name="mastered" type="checkbox" defaultChecked={note.mastered} />
          숙지 완료
        </label>
        <button className="button button-dark" type="submit">
          저장
        </button>
      </form>
      <div className="card-actions">
        <Link
          className="button button-ghost"
          href={`/practice/${note.courseSlug}?wrongOnly=1&count=50`}
        >
          오답만 다시 풀기
        </Link>
        <button className="button button-ghost" type="button" onClick={bookmark}>
          즐겨찾기
        </button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </article>
  );
}
