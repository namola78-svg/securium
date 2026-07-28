"use client";

import { useState } from "react";

export function ReportAdminActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) {
    const response = await fetch("/api/admin/question-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        status: formData.get("status"),
        resolutionNote: formData.get("resolutionNote"),
      }),
    });
    setMessage(response.ok ? "처리 상태를 저장했습니다." : "저장하지 못했습니다.");
  }
  return (
    <form className="report-admin-form" action={save}>
      <select name="status" defaultValue={currentStatus}>
        <option value="OPEN">접수</option>
        <option value="IN_REVIEW">검토 중</option>
        <option value="RESOLVED">처리 완료</option>
        <option value="REJECTED">반려</option>
      </select>
      <input
        name="resolutionNote"
        maxLength={2000}
        placeholder="처리 메모"
      />
      <button className="button button-ghost" type="submit">
        저장
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
