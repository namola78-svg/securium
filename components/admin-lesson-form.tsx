"use client";

import { useMemo, useRef, useState } from "react";

type ScopeOptions = {
  courses: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; courseId: string; name: string }>;
  topics: Array<{ id: string; subjectId: string; name: string }>;
};

type LearningUnitInput = {
  id: string;
  courseId: string;
  subjectId: string;
  topicId: string | null;
  code: string;
  title: string;
  description: string;
  displayOrder: number;
  active: boolean;
  published: boolean;
  completionPolicy: string;
  minimumProgressPercent: number;
  minimumStudySeconds: number;
};

type LessonInput = {
  id: string;
  learningUnitId: string | null;
  topicId: string;
  code: string;
  title: string;
  summary: string;
  content: string;
  contentFormat: string;
  estimatedMinutes: number;
  displayOrder: number;
  active: boolean;
  published: boolean;
};

export function AdminLearningUnitForm({
  scopes,
  initial,
}: {
  scopes: ScopeOptions;
  initial?: LearningUnitInput;
}) {
  const [courseId, setCourseId] = useState(initial?.courseId ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const subjects = useMemo(
    () => scopes.subjects.filter((subject) => subject.courseId === courseId),
    [courseId, scopes.subjects],
  );
  const topics = useMemo(
    () => scopes.topics.filter((topic) => topic.subjectId === subjectId),
    [subjectId, scopes.topics],
  );

  async function save(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch("/api/admin/learning-units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          courseId: formData.get("courseId"),
          subjectId: formData.get("subjectId"),
          topicId: formData.get("topicId"),
          code: formData.get("code"),
          title: formData.get("title"),
          description: formData.get("description"),
          displayOrder: formData.get("displayOrder"),
          active: formData.get("active") === "on",
          published: formData.get("published") === "on",
          completionPolicy: formData.get("completionPolicy"),
          minimumProgressPercent: formData.get("minimumProgressPercent"),
          minimumStudySeconds: formData.get("minimumStudySeconds"),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "학습단위를 저장하지 못했습니다.");
        return;
      }
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-form" action={save}>
      <label>
        과정
        <select
          name="courseId"
          value={courseId}
          disabled={Boolean(initial)}
          onChange={(event) => {
            setCourseId(event.target.value);
            setSubjectId("");
          }}
          required
        >
          <option value="">선택</option>
          {scopes.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
        {initial ? (
          <input type="hidden" name="courseId" value={initial.courseId} />
        ) : null}
      </label>
      <label>
        과목
        <select
          name="subjectId"
          value={subjectId}
          disabled={Boolean(initial)}
          onChange={(event) => setSubjectId(event.target.value)}
          required
        >
          <option value="">선택</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        {initial ? (
          <input type="hidden" name="subjectId" value={initial.subjectId} />
        ) : null}
      </label>
      <label>
        선택 주제
        <select name="topicId" defaultValue={initial?.topicId ?? ""}>
          <option value="">과목 공통</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        코드
        <input
          name="code"
          defaultValue={initial?.code}
          pattern="[A-Z0-9_]+"
          required
        />
      </label>
      <label className="wide">
        제목
        <input name="title" defaultValue={initial?.title} required />
      </label>
      <label className="wide">
        설명
        <textarea name="description" defaultValue={initial?.description} />
      </label>
      <label>
        완료 정책
        <select
          name="completionPolicy"
          defaultValue={initial?.completionPolicy ?? "MANUAL"}
        >
          <option value="MANUAL">사용자 직접 완료</option>
          <option value="SCROLL_END">본문 하단 도달</option>
          <option value="MINIMUM_REQUIREMENTS">최소 학습 조건</option>
        </select>
      </label>
      <label>
        최소 읽기 비율
        <input
          name="minimumProgressPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={initial?.minimumProgressPercent ?? 100}
          required
        />
      </label>
      <label>
        최소 학습시간(초)
        <input
          name="minimumStudySeconds"
          type="number"
          min={0}
          max={86400}
          defaultValue={initial?.minimumStudySeconds ?? 0}
          required
        />
      </label>
      <label>
        정렬순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          defaultValue={initial?.displayOrder ?? 0}
          required
        />
      </label>
      <label className="check-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={initial?.active ?? true}
        />
        활성
      </label>
      <label className="check-label">
        <input
          name="published"
          type="checkbox"
          defaultChecked={initial?.published ?? false}
        />
        공개
      </label>
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "저장 중…" : "학습단위 저장"}
      </button>
      {message ? <p className="form-message wide">{message}</p> : null}
    </form>
  );
}

export function AdminLessonForm({
  units,
  topics,
  initial,
}: {
  units: Array<{
    id: string;
    title: string;
    courseName: string;
    subjectName: string;
    subjectId: string;
    topicId: string | null;
  }>;
  topics: ScopeOptions["topics"];
  initial?: LessonInput;
}) {
  const initialUnit = units.find((unit) => unit.id === initial?.learningUnitId);
  const [unitId, setUnitId] = useState(initial?.learningUnitId ?? "");
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? initialUnit;
  const availableTopics = topics.filter(
    (topic) => topic.subjectId === selectedUnit?.subjectId,
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  async function save(formData: FormData) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          learningUnitId: formData.get("learningUnitId"),
          topicId: formData.get("topicId"),
          code: formData.get("code"),
          title: formData.get("title"),
          summary: formData.get("summary"),
          content: formData.get("content"),
          contentFormat: formData.get("contentFormat"),
          estimatedMinutes: formData.get("estimatedMinutes"),
          displayOrder: formData.get("displayOrder"),
          active: formData.get("active") === "on",
          published: formData.get("published") === "on",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "레슨을 저장하지 못했습니다.");
        return;
      }
      window.location.reload();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form className="admin-form" action={save}>
      <label className="wide">
        학습단위
        <select
          name="learningUnitId"
          value={unitId}
          disabled={Boolean(initial)}
          onChange={(event) => setUnitId(event.target.value)}
          required
        >
          <option value="">선택</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.courseName} · {unit.subjectName} · {unit.title}
            </option>
          ))}
        </select>
        {initial ? (
          <input
            type="hidden"
            name="learningUnitId"
            value={initial.learningUnitId ?? ""}
          />
        ) : null}
      </label>
      <label>
        주제
        <select
          name="topicId"
          defaultValue={initial?.topicId ?? selectedUnit?.topicId ?? ""}
          disabled={Boolean(initial)}
          required
        >
          <option value="">선택</option>
          {availableTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
        {initial ? (
          <input type="hidden" name="topicId" value={initial.topicId} />
        ) : null}
      </label>
      <label>
        코드
        <input
          name="code"
          defaultValue={initial?.code}
          pattern="[A-Z0-9_]+"
          minLength={2}
          maxLength={50}
          required
        />
      </label>
      <label className="wide">
        제목
        <input
          name="title"
          defaultValue={initial?.title}
          minLength={2}
          maxLength={200}
          required
        />
      </label>
      <label className="wide">
        요약
        <textarea name="summary" defaultValue={initial?.summary} />
      </label>
      <label className="wide">
        본문
        <textarea
          className="lesson-editor"
          name="content"
          defaultValue={initial?.content}
          minLength={2}
          maxLength={100000}
          required
        />
        <small>
          Markdown은 제목, 문단, 목록, 표, 인용, 강조, 코드 블록과 HTTPS
          이미지·첨부 참조를 지원합니다. HTML은 실행하지 않습니다.
        </small>
      </label>
      <label>
        본문 형식
        <select
          name="contentFormat"
          defaultValue={initial?.contentFormat ?? "MARKDOWN"}
        >
          <option value="PLAIN_TEXT">일반 텍스트</option>
          <option value="MARKDOWN">검증된 Markdown</option>
        </select>
      </label>
      <label>
        예상 학습시간(분)
        <input
          name="estimatedMinutes"
          type="number"
          min={1}
          max={1440}
          defaultValue={initial?.estimatedMinutes ?? 10}
          required
        />
      </label>
      <label>
        정렬순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          max={10000}
          defaultValue={initial?.displayOrder ?? 0}
          required
        />
      </label>
      <label className="check-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={initial?.active ?? true}
        />
        활성
      </label>
      <label className="check-label">
        <input
          name="published"
          type="checkbox"
          defaultChecked={initial?.published ?? false}
        />
        공개
      </label>
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "저장 중…" : "레슨 저장"}
      </button>
      {message ? <p className="form-message wide">{message}</p> : null}
    </form>
  );
}

export function AdminArchiveButton({
  id,
  endpoint,
  label,
}: {
  id: string;
  endpoint: string;
  label: string;
}) {
  const [pending, setPending] = useState(false);
  async function archive() {
    if (!window.confirm(`${label}을 비공개 보관하시겠습니까?`)) return;
    setPending(true);
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) window.location.reload();
    setPending(false);
  }
  return (
    <button
      className="button button-ghost"
      type="button"
      disabled={pending}
      onClick={archive}
    >
      {pending ? "처리 중…" : "비공개 보관"}
    </button>
  );
}
