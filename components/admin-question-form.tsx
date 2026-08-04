"use client";

import { useState } from "react";

type Choice = {
  id?: string;
  content: string;
  displayOrder: number;
  isCorrect: boolean;
  explanation: string;
};

type Option = { id: string; name: string; courseId?: string; subjectId?: string };

type InitialQuestion = {
  id: string;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  explanation: string;
  wrongAnswerExplanation: string;
  source: string | null;
  sourceDate: string | null;
  answerConfigJson: string;
  choices: Choice[];
  courseIds: string[];
  subjectIds: string[];
  topicIds: string[];
};

const emptyChoices: Choice[] = Array.from({ length: 4 }, (_, index) => ({
  content: "",
  displayOrder: index + 1,
  isCorrect: index === 0,
  explanation: "",
}));

export function AdminQuestionForm({
  courses,
  subjects,
  topics,
  initial,
}: {
  courses: Option[];
  subjects: Option[];
  topics: Option[];
  initial?: InitialQuestion;
}) {
  const [type, setType] = useState(initial?.type ?? "SINGLE_CHOICE");
  const [choices, setChoices] = useState(
    initial?.choices.length ? initial.choices : emptyChoices,
  );
  const [courseIds, setCourseIds] = useState(initial?.courseIds ?? []);
  const [subjectIds, setSubjectIds] = useState(initial?.subjectIds ?? []);
  const [topicIds, setTopicIds] = useState(initial?.topicIds ?? []);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(
    id: string,
    values: string[],
    setter: (value: string[]) => void,
  ) {
    setter(
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage("");
    const effectiveChoices =
      type === "SHORT_ANSWER"
        ? [
            {
              ...choices[0],
              content: choices[0]?.content || "정답을 입력하세요",
              displayOrder: 1,
              isCorrect: true,
            },
          ]
        : choices.filter((choice) => choice.content.trim());
    const response = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        title: formData.get("title"),
        content: formData.get("content"),
        type,
        difficulty: formData.get("difficulty"),
        explanation: formData.get("explanation"),
        wrongAnswerExplanation: formData.get("wrongAnswerExplanation"),
        source: formData.get("source"),
        sourceDate: formData.get("sourceDate"),
        answerConfigJson: formData.get("answerConfigJson"),
        choices: effectiveChoices,
        courseIds,
        subjectIds,
        topicIds,
      }),
    });
    const payload = (await response.json()) as {
      id?: string;
      error?: { message?: string };
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error?.message ?? "문제를 저장하지 못했습니다.");
      return;
    }
    window.location.href = `/admin/questions/${payload.id}`;
  }

  return (
    <form className="admin-form question-form" action={submit}>
      <label className="wide">
        제목
        <input
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial?.title}
        />
      </label>
      <label className="wide">
        문제 내용
        <textarea
          name="content"
          required
          minLength={2}
          maxLength={10000}
          defaultValue={initial?.content}
        />
      </label>
      <label>
        유형
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="TRUE_FALSE">OX</option>
          <option value="SINGLE_CHOICE">단일선택형</option>
          <option value="MULTIPLE_CHOICE">복수선택형</option>
          <option value="SHORT_ANSWER">단답형</option>
          <option value="ESSAY">서술형 · 수동 검수형</option>
          <option value="ORDERING">순서형 · 수동 검수형</option>
          <option value="FILL_BLANK">빈칸형 · 수동 검수형</option>
          <option value="CASE_ANALYSIS">사례분석 · 수동 검수형</option>
          <option value="CODE_ANALYSIS">코드분석 · 수동 검수형</option>
          <option value="LOG_ANALYSIS">로그분석 · 수동 검수형</option>
          <option value="CALCULATION">계산형 · 수동 검수형</option>
        </select>
      </label>
      <label>
        난이도
        <select name="difficulty" defaultValue={initial?.difficulty ?? "MEDIUM"}>
          <option value="EASY">쉬움</option>
          <option value="MEDIUM">보통</option>
          <option value="HARD">어려움</option>
        </select>
      </label>

      <fieldset className="wide mapping-fieldset">
        <legend>연결 과정 · 하나 이상 필수</legend>
        <div className="check-grid">
          {courses.map((course) => (
            <label className="check-label" key={course.id}>
              <input
                type="checkbox"
                checked={courseIds.includes(course.id)}
                onChange={() => toggle(course.id, courseIds, setCourseIds)}
              />
              {course.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="wide mapping-fieldset">
        <legend>연결 과목</legend>
        <div className="check-grid">
          {subjects
            .filter(
              (subject) =>
                !subject.courseId || courseIds.includes(subject.courseId),
            )
            .map((subject) => (
              <label className="check-label" key={subject.id}>
                <input
                  type="checkbox"
                  checked={subjectIds.includes(subject.id)}
                  onChange={() => toggle(subject.id, subjectIds, setSubjectIds)}
                />
                {subject.name}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset className="wide mapping-fieldset">
        <legend>연결 주제</legend>
        <div className="check-grid">
          {topics
            .filter(
              (topic) =>
                !topic.subjectId || subjectIds.includes(topic.subjectId),
            )
            .map((topic) => (
              <label className="check-label" key={topic.id}>
                <input
                  type="checkbox"
                  checked={topicIds.includes(topic.id)}
                  onChange={() => toggle(topic.id, topicIds, setTopicIds)}
                />
                {topic.name}
              </label>
            ))}
        </div>
      </fieldset>

      <section className="wide choice-editor">
        <h3>{type === "SHORT_ANSWER" ? "대표 정답" : "선택지와 정답"}</h3>
        {choices.map((choice, index) => (
          <div className="choice-editor-row" key={choice.id ?? index}>
            <input
              aria-label={`선택지 ${index + 1}`}
              value={choice.content}
              onChange={(event) =>
                setChoices((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, content: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder={
                type === "SHORT_ANSWER" ? "대표 정답" : `선택지 ${index + 1}`
              }
            />
            <label className="check-label">
              <input
                type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                name="correctChoice"
                checked={choice.isCorrect}
                onChange={() =>
                  setChoices((current) =>
                    current.map((item, itemIndex) => ({
                      ...item,
                      isCorrect:
                        type === "MULTIPLE_CHOICE"
                          ? itemIndex === index
                            ? !item.isCorrect
                            : item.isCorrect
                          : itemIndex === index,
                    })),
                  )
                }
              />
              정답
            </label>
          </div>
        ))}
      </section>

      {type === "SHORT_ANSWER" ? (
        <label className="wide">
          단답형 채점 설정 JSON
          <textarea
            name="answerConfigJson"
            defaultValue={
              initial?.answerConfigJson ??
              '{"ignoreCase":true,"normalizeWhitespace":true,"acceptedAnswers":[],"synonyms":[],"useRegex":false,"regexPatterns":[],"partialCreditRules":[]}'
            }
          />
        </label>
      ) : (
        <input
          type="hidden"
          name="answerConfigJson"
          value={initial?.answerConfigJson ?? "{}"}
        />
      )}
      <label className="wide">
        정답 해설
        <textarea
          name="explanation"
          maxLength={10000}
          defaultValue={initial?.explanation}
        />
      </label>
      <label className="wide">
        오답 해설
        <textarea
          name="wrongAnswerExplanation"
          maxLength={10000}
          defaultValue={initial?.wrongAnswerExplanation}
        />
      </label>
      <label>
        출처
        <input name="source" maxLength={300} defaultValue={initial?.source ?? ""} />
      </label>
      <label>
        출처 기준일
        <input
          name="sourceDate"
          type="date"
          defaultValue={initial?.sourceDate ?? ""}
        />
      </label>
      <button
        className="button button-dark"
        type="submit"
        disabled={saving || !courseIds.length}
      >
        {saving ? "저장 중..." : initial ? "변경사항 저장" : "초안 저장"}
      </button>
      {message ? <p className="form-message wide">{message}</p> : null}
    </form>
  );
}
