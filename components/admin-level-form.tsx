"use client";

import { useState } from "react";

type Course = { id: string; name: string };
type Level = {
  id: string;
  courseId: string;
  code: string;
  number: number;
  title: string;
  description: string;
  passingScore: number;
  requiredLevelId: string | null;
  displayOrder: number;
  active: boolean;
  published: boolean;
};

export function AdminLevelForm({
  courses,
  levels,
  initial,
}: {
  courses: Course[];
  levels: Array<{ id: string; title: string; courseId: string }>;
  initial?: Level;
}) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) {
    const response = await fetch("/api/admin/levels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        courseId: formData.get("courseId"),
        code: formData.get("code"),
        number: formData.get("number"),
        title: formData.get("title"),
        description: formData.get("description"),
        passingScore: formData.get("passingScore"),
        requiredLevelId: formData.get("requiredLevelId"),
        displayOrder: formData.get("displayOrder"),
        active: formData.get("active") === "on",
        published: formData.get("published") === "on",
      }),
    });
    setMessage(response.ok ? "단계를 저장했습니다." : "단계를 저장하지 못했습니다.");
    if (response.ok) window.location.reload();
  }
  return (
    <form className="admin-form" action={save}>
      <label>과정<select name="courseId" defaultValue={initial?.courseId} required>
        <option value="">선택</option>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
      </select></label>
      <label>코드<input name="code" defaultValue={initial?.code} pattern="[A-Z0-9_]+" required /></label>
      <label>번호<input name="number" type="number" min={1} defaultValue={initial?.number ?? 1} required /></label>
      <label>제목<input name="title" defaultValue={initial?.title} required /></label>
      <label className="wide">설명<textarea name="description" defaultValue={initial?.description} /></label>
      <label>통과점수<input name="passingScore" type="number" min={0} max={100} defaultValue={initial?.passingScore ?? 60} /></label>
      <label>선행 단계<select name="requiredLevelId" defaultValue={initial?.requiredLevelId ?? ""}>
        <option value="">없음 · 첫 단계</option>
        {levels.filter((level) => !initial || level.id !== initial.id).map((level) => <option key={level.id} value={level.id}>{level.title}</option>)}
      </select></label>
      <label>정렬순서<input name="displayOrder" type="number" min={0} defaultValue={initial?.displayOrder ?? 0} /></label>
      <label className="check-label"><input name="active" type="checkbox" defaultChecked={initial?.active ?? true} />활성</label>
      <label className="check-label"><input name="published" type="checkbox" defaultChecked={initial?.published ?? false} />공개</label>
      <button className="button button-dark" type="submit">단계 저장</button>
      {message ? <p className="form-message wide">{message}</p> : null}
    </form>
  );
}

export function AdminLevelContentForm({ levelId }: { levelId: string }) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) {
    const response = await fetch("/api/admin/level-contents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        levelId,
        contentType: formData.get("contentType"),
        contentId: formData.get("contentId"),
        displayOrder: formData.get("displayOrder"),
        required: formData.get("required") === "on",
      }),
    });
    setMessage(response.ok ? "콘텐츠를 연결했습니다." : "연결하지 못했습니다.");
  }
  return (
    <form className="admin-form compact-form" action={save}>
      <label>유형<select name="contentType"><option value="QUESTION">문제</option><option value="SUBJECT">과목</option><option value="TOPIC">주제</option><option value="CONTENT">콘텐츠</option></select></label>
      <label>콘텐츠 ID<input name="contentId" required /></label>
      <label>순서<input name="displayOrder" type="number" min={0} defaultValue={0} /></label>
      <label className="check-label"><input name="required" type="checkbox" defaultChecked />필수</label>
      <button className="button button-ghost" type="submit">연결</button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}

