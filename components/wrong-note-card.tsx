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
  const [saving, setSaving] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  async function save(formData: FormData) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/wrong-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          userMemo: formData.get("userMemo"),
          mastered: formData.get("mastered") === "on",
        }),
      });
      setMessage(
        response.ok
          ? "오답노트를 저장했습니다."
          : "오답노트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function bookmark() {
    setBookmarking(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "QUESTION",
          targetId: note.questionId,
          courseId: note.courseId,
        }),
      });
      setMessage(
        response.ok
          ? "즐겨찾기를 저장했습니다."
          : "즐겨찾기를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBookmarking(false);
    }
  }

  return (
    <article className="review-card wrong-note-card">
      <div className="course-card-top">
        <span className="badge">오답 {note.wrongCount}회</span>
        <span className={note.mastered ? "status-on" : "status-off"}>
          {note.mastered ? "학습 완료" : "미숙지"}
        </span>
      </div>
      <h2>{note.title}</h2>
      <p>{note.content}</p>
      <form action={save}>
        <label>
          나의 메모
          <textarea
            name="userMemo"
            defaultValue={note.userMemo}
            maxLength={2000}
            placeholder="틀린 이유나 다시 볼 포인트를 적어두세요."
          />
        </label>
        <label className="check-label">
          <input name="mastered" type="checkbox" defaultChecked={note.mastered} />
          이 문제를 학습 완료로 표시
        </label>
        <button className="button button-dark" type="submit" disabled={saving}>
          {saving ? "저장 중..." : "메모 저장"}
        </button>
      </form>
      <div className="card-actions">
        <Link
          className="button button-ghost"
          href={`/practice/${note.courseSlug}?wrongOnly=1&count=50`}
        >
          오답만 다시 풀기
        </Link>
        <button
          className="button button-ghost"
          type="button"
          onClick={bookmark}
          disabled={bookmarking}
        >
          {bookmarking ? "저장 중..." : "즐겨찾기"}
        </button>
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
