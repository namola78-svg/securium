"use client";

import { useState } from "react";

export function AdminMockExamForm({
  courses,
}: {
  courses: Array<{ id: string; name: string }>;
}) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) {
    const response = await fetch("/api/admin/mock-exams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: formData.get("courseId"),
        title: formData.get("title"),
        description: formData.get("description"),
        examType: formData.get("examType"),
        questionCount: formData.get("questionCount"),
        timeLimitMinutes: formData.get("timeLimitMinutes"),
        passingScore: formData.get("passingScore"),
        startAt: formData.get("startAt"),
        endAt: formData.get("endAt"),
        resultOpenAt: formData.get("resultOpenAt"),
        maxAttempts: formData.get("maxAttempts"),
        randomizeQuestions: formData.get("randomizeQuestions") === "on",
        randomizeChoices: formData.get("randomizeChoices") === "on",
        status: formData.get("status"),
        published: formData.get("published") === "on",
      }),
    });
    setMessage(response.ok ? "모의고사를 저장했습니다." : "저장하지 못했습니다.");
    if (response.ok) window.location.reload();
  }
  return (
    <form className="admin-form" action={save}>
      <label>과정<select name="courseId" required><option value="">선택</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
      <label>시험 유형<select name="examType"><option value="QUICK">빠른 모의고사</option><option value="SUBJECT">과목별</option><option value="REALISTIC">실전</option><option value="WRONG_ANSWER">오답</option><option value="WEAK_AREA">취약 영역</option><option value="MANAGED">관리자 지정</option></select></label>
      <label className="wide">제목<input name="title" required /></label>
      <label className="wide">설명<textarea name="description" /></label>
      <label>문제 수<input name="questionCount" type="number" min={1} defaultValue={10} /></label>
      <label>제한시간(분)<input name="timeLimitMinutes" type="number" min={1} defaultValue={15} /></label>
      <label>통과점수<input name="passingScore" type="number" min={0} max={100} defaultValue={60} /></label>
      <label>최대 응시<input name="maxAttempts" type="number" min={1} defaultValue={3} /></label>
      <label>시작일시<input name="startAt" type="datetime-local" /></label>
      <label>종료일시<input name="endAt" type="datetime-local" /></label>
      <label>결과 공개일시<input name="resultOpenAt" type="datetime-local" /></label>
      <label>상태<select name="status"><option value="DRAFT">초안</option><option value="READY">준비</option><option value="OPEN">응시 가능</option><option value="CLOSED">종료</option><option value="ARCHIVED">보관</option></select></label>
      <label className="check-label"><input name="randomizeQuestions" type="checkbox" defaultChecked />문제 무작위</label>
      <label className="check-label"><input name="randomizeChoices" type="checkbox" />선택지 무작위</label>
      <label className="check-label"><input name="published" type="checkbox" />공개</label>
      <button className="button button-dark" type="submit">시험 저장</button>
      {message ? <p className="form-message wide">{message}</p> : null}
    </form>
  );
}

export function AdminExamConfiguration({
  mockExamId,
  subjects,
  sections,
  questions,
}: {
  mockExamId: string;
  subjects: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; title: string }>;
  questions: Array<{ id: string; title: string }>;
}) {
  const [message, setMessage] = useState("");
  async function saveSection(formData: FormData) {
    const response = await fetch("/api/admin/mock-exam-sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mockExamId,
        subjectId: formData.get("subjectId"),
        title: formData.get("title"),
        questionCount: formData.get("questionCount"),
        scoreWeight: formData.get("scoreWeight"),
        displayOrder: formData.get("displayOrder"),
      }),
    });
    setMessage(response.ok ? "섹션을 저장했습니다." : "섹션 저장 실패");
    if (response.ok) window.location.reload();
  }
  async function assignQuestion(formData: FormData) {
    const response = await fetch("/api/admin/mock-exam-questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mockExamId,
        sectionId: formData.get("sectionId"),
        questionId: formData.get("questionId"),
        score: formData.get("score"),
        displayOrder: formData.get("displayOrder"),
      }),
    });
    setMessage(response.ok ? "문제를 배정했습니다." : "문제 배정 실패");
    if (response.ok) window.location.reload();
  }
  return (
    <div className="admin-actions-grid">
      <form className="admin-form admin-action-card" action={saveSection}>
        <h2 className="wide">섹션 추가</h2>
        <label>과목<select name="subjectId"><option value="">종합</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label>제목<input name="title" required /></label>
        <label>문제 수<input name="questionCount" type="number" min={1} defaultValue={10} /></label>
        <label>점수 가중치<input name="scoreWeight" type="number" min={1} defaultValue={100} /></label>
        <label>순서<input name="displayOrder" type="number" min={0} defaultValue={1} /></label>
        <button className="button button-dark" type="submit">섹션 저장</button>
      </form>
      <form className="admin-form admin-action-card" action={assignQuestion}>
        <h2 className="wide">문제 배정</h2>
        <label className="wide">문제<select name="questionId" required><option value="">선택</option>{questions.map((question) => <option key={question.id} value={question.id}>{question.title}</option>)}</select></label>
        <label>섹션<select name="sectionId"><option value="">없음</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
        <label>배점<input name="score" type="number" min={1} defaultValue={10} /></label>
        <label>순서<input name="displayOrder" type="number" min={0} defaultValue={1} /></label>
        <button className="button button-dark" type="submit">문제 배정</button>
      </form>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}
