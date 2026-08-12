"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/v2/review-v2.module.css";

type WrongNote = {
  id: string;
  title: string;
  content: string;
  difficulty: string;
  wrongCount: number;
  mastered: boolean;
  userMemo: string;
  updatedAt: string;
  questionId: string;
  courseId: string;
  courseSlug: string;
};

export function WrongNoteCard({ note }: { note: WrongNote }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  async function save(formData: FormData) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/wrong-notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: note.id, userMemo: formData.get("userMemo"), mastered: formData.get("mastered") === "on" }) });
      setMessage(response.ok ? "오답노트를 저장했습니다." : "오답노트를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function bookmark() {
    setBookmarking(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType: "QUESTION", targetId: note.questionId, courseId: note.courseId }) });
      setMessage(response.ok ? "문제를 북마크에 저장했습니다." : "북마크를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setBookmarking(false);
    }
  }

  return (
    <article className={styles.noteCard}>
      <div className={styles.noteMain}>
        <div className={styles.itemMeta}>
          <span>{formatDifficulty(note.difficulty)}</span>
          <span>최근 확인 {note.updatedAt.slice(0, 10)}</span>
          {note.wrongCount > 1 ? <span className={styles.warningBadge}>반복 오답 {note.wrongCount}회</span> : <span>오답 1회</span>}
          {note.mastered ? <span className={styles.successBadge}>학습 완료</span> : null}
        </div>
        <h3>{note.title}</h3>
        <p className={styles.noteContent}>{note.content}</p>
      </div>
      <div className={styles.notePrimaryAction}>
        <Link className={styles.primaryAction} href={`/practice/${note.courseSlug}?wrongOnly=1&questionId=${note.questionId}&count=1`}>다시 풀기<span aria-hidden="true">→</span></Link>
      </div>
      <details className={styles.noteDetails}>
        <summary>메모와 학습 상태 관리</summary>
        <form action={save} className={styles.noteForm}>
          <label><span>나의 메모</span><small>틀린 이유와 다시 확인할 기준을 적어두세요.</small><textarea name="userMemo" defaultValue={note.userMemo} maxLength={2000} placeholder="예: 적용 순서를 반대로 기억했다." /></label>
          <label className={styles.checkbox}><input name="mastered" type="checkbox" defaultChecked={note.mastered} /><span>학습 완료로 표시</span></label>
          <button type="submit" disabled={saving}>{saving ? "저장 중..." : "메모 저장"}</button>
        </form>
        <button className={styles.bookmarkAction} type="button" onClick={bookmark} disabled={bookmarking}>{bookmarking ? "저장 중..." : "북마크 저장"}</button>
      </details>
      {message ? <p className={styles.formMessage} role="status" aria-live="polite">{message}</p> : null}
    </article>
  );
}

function formatDifficulty(value: string) {
  return ({ EASY: "쉬움", MEDIUM: "보통", HARD: "어려움" } as Record<string, string>)[value] ?? "난이도 미정";
}
