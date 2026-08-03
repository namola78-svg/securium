"use client";

import { useMemo, useState } from "react";

type Course = {
  id: string;
  name: string;
  shortName: string;
  groupName: string;
};

type SharedContent = {
  id: string;
  slug: string;
  canonicalKey: string;
  title: string;
  summary: string;
  body: string;
  bodyFormat: string;
  learningObjectivesJson: string;
  coreConceptsJson: string;
  practicalExamplesJson: string;
  version: string;
  status: string;
  updatedAt: string;
};

type CourseLesson = {
  id: string;
  courseId: string;
  curriculumNodeId: string | null;
  contentId: string;
  contentTitle: string;
  displayTitle: string;
  sortOrder: number;
  difficulty: string | null;
  importance: number | null;
  estimatedMinutes: number;
  isRequired: boolean;
  completionRule: string;
  status: string;
  updatedAt: string;
  extensionId: string | null;
  extensionLearningObjectivesOverrideJson: string | null;
  extensionAdditionalBody: string | null;
  extensionExamPointsJson: string | null;
  extensionPracticalNotes: string | null;
  extensionLegalNotes: string | null;
  extensionStandardNotes: string | null;
  extensionEvidenceNotes: string | null;
  extensionCommonMistakes: string | null;
  extensionInstructorNotes: string | null;
  extensionVersion: string | null;
  extensionStatus: string | null;
};

type CurriculumTree = {
  id: string;
  courseId: string;
  title: string;
  version: string;
  status: string;
};

type CurriculumNode = {
  id: string;
  title: string;
  nodeType: string;
  depth: number;
  path: string | null;
  status: string;
};

type ContentUsage = {
  courseLessonId: string;
  courseId: string;
  courseName: string;
  displayTitle: string;
  status: string;
};

const statuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const bodyFormats = ["MARKDOWN", "STRUCTURED_JSON", "PLAIN_TEXT"] as const;
const completionRules = ["MANUAL", "SCROLL_END", "MINIMUM_REQUIREMENTS"] as const;

function optionalId(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function jsonDefault(value: string | null | undefined) {
  return value?.trim() || "[]";
}

export function AdminSharedContentManager({
  courses,
  contents,
  courseLessons,
  curriculumTrees,
  curriculumNodes,
  usage,
  selectedCourseId,
  selectedContentId,
  selectedCurriculumNodeId,
}: {
  courses: Course[];
  contents: SharedContent[];
  courseLessons: CourseLesson[];
  curriculumTrees: CurriculumTree[];
  curriculumNodes: CurriculumNode[];
  usage: ContentUsage[];
  selectedCourseId: string;
  selectedContentId: string;
  selectedCurriculumNodeId: string;
}) {
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [editingContentId, setEditingContentId] = useState(
    selectedContentId || contents[0]?.id || "",
  );
  const initialCourseLessonId =
    selectedCurriculumNodeId
      ? courseLessons.find(
          (lesson) => lesson.curriculumNodeId === selectedCurriculumNodeId,
        )?.id
      : "";
  const [editingCourseLessonId, setEditingCourseLessonId] = useState(
    initialCourseLessonId || courseLessons[0]?.id || "",
  );
  const [showSelectedNodeOnly, setShowSelectedNodeOnly] = useState(
    Boolean(selectedCurriculumNodeId),
  );
  const [contentQuery, setContentQuery] = useState("");
  const [contentStatusFilter, setContentStatusFilter] = useState("ALL");
  const [contentPage, setContentPage] = useState(1);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const editingContent =
    contents.find((content) => content.id === editingContentId) ?? null;
  const editingCourseLesson =
    courseLessons.find((lesson) => lesson.id === editingCourseLessonId) ?? null;
  const selectedContent =
    contents.find((content) => content.id === selectedContentId) ??
    contents[0] ??
    null;
  const selectedCurriculumNode =
    curriculumNodes.find((node) => node.id === selectedCurriculumNodeId) ?? null;
  const selectedNodeCourseLessons = selectedCurriculumNodeId
    ? courseLessons.filter(
        (lesson) => lesson.curriculumNodeId === selectedCurriculumNodeId,
      )
    : [];
  const displayedCourseLessons =
    selectedCurriculumNodeId && showSelectedNodeOnly
      ? selectedNodeCourseLessons
      : courseLessons;
  const selectedTreeLabel = useMemo(() => {
    const active = curriculumTrees.find((tree) => tree.status === "ACTIVE");
    const fallback = curriculumTrees[0];
    const tree = active ?? fallback;
    return tree ? `${tree.title} · ${tree.version}` : "연결 가능한 커리큘럼 없음";
  }, [curriculumTrees]);

  const filteredContents = useMemo(() => {
    const query = contentQuery.trim().toLowerCase();
    return contents.filter((content) => {
      const matchesQuery =
        !query ||
        [content.title, content.summary, content.slug, content.canonicalKey]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        contentStatusFilter === "ALL" || content.status === contentStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [contentQuery, contentStatusFilter, contents]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredContents.length / pageSize));
  const safePage = Math.min(contentPage, pageCount);
  const pagedContents = filteredContents.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function updateContentQuery(value: string) {
    setContentQuery(value);
    setContentPage(1);
  }

  function updateContentStatusFilter(value: string) {
    setContentStatusFilter(value);
    setContentPage(1);
  }

  async function submitJson(body: Record<string, unknown>, pendingLabel: string) {
    setPendingAction(pendingLabel);
    setMessage("");
    try {
      const response = await fetch("/api/admin/shared-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setMessage(
          payload.error ??
            "요청을 처리하지 못했습니다. 입력값과 권한을 확인해 주세요.",
        );
        return;
      }
      window.location.reload();
    } finally {
      setPendingAction("");
    }
  }

  async function saveContent(formData: FormData) {
    await submitJson(
      {
        operation: "saveContent",
        content: {
          id: optionalId(formData.get("id")),
          slug: formData.get("slug"),
          canonicalKey: formData.get("canonicalKey"),
          title: formData.get("title"),
          summary: formData.get("summary"),
          body: formData.get("body"),
          bodyFormat: formData.get("bodyFormat"),
          learningObjectivesJson: formData.get("learningObjectivesJson"),
          coreConceptsJson: formData.get("coreConceptsJson"),
          practicalExamplesJson: formData.get("practicalExamplesJson"),
          diagramsJson: "[]",
          mediaJson: "[]",
          version: formData.get("version"),
          status: formData.get("status"),
        },
      },
      "content-save",
    );
  }

  async function saveCourseLesson(formData: FormData) {
    await submitJson(
      {
        operation: "saveCourseLesson",
        courseLesson: {
          id: optionalId(formData.get("id")),
          courseId: selectedCourseId,
          curriculumNodeId: formData.get("curriculumNodeId"),
          contentId: formData.get("contentId"),
          displayTitle: formData.get("displayTitle"),
          sortOrder: formData.get("sortOrder"),
          difficulty: formData.get("difficulty"),
          importance: formData.get("importance"),
          estimatedMinutes: formData.get("estimatedMinutes"),
          isRequired: formData.get("isRequired") === "on",
          completionRule: formData.get("completionRule"),
          status: formData.get("status"),
        },
      },
      "course-lesson-save",
    );
  }

  async function saveExtension(formData: FormData) {
    await submitJson(
      {
        operation: "saveCourseLessonExtension",
        extension: {
          id: optionalId(formData.get("id")),
          courseLessonId: formData.get("courseLessonId"),
          learningObjectivesOverrideJson: formData.get(
            "learningObjectivesOverrideJson",
          ),
          additionalBody: formData.get("additionalBody"),
          examPointsJson: formData.get("examPointsJson"),
          practicalNotes: formData.get("practicalNotes"),
          legalNotes: formData.get("legalNotes"),
          standardNotes: formData.get("standardNotes"),
          evidenceNotes: formData.get("evidenceNotes"),
          commonMistakes: formData.get("commonMistakes"),
          instructorNotes: formData.get("instructorNotes"),
          version: formData.get("version"),
          status: formData.get("status"),
        },
      },
      "extension-save",
    );
  }

  return (
    <div className="curriculum-admin-grid">
      {message ? (
        <p className="inline-error" role="alert">
          {message}
        </p>
      ) : null}

      <section className="admin-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">CONTENT</p>
            <h2>공통 Content 등록·수정</h2>
            <p>
              여러 과정에서 공유하는 이론 원문입니다. 과정별 표현과 보강 설명은
              CourseLesson과 Extension에서 따로 관리합니다.
            </p>
          </div>
          <div className="admin-inline-actions">
            <select
              aria-label="수정할 공통 Content 선택"
              className="admin-inline-select"
              value={editingContentId}
              onChange={(event) => setEditingContentId(event.target.value)}
            >
              {contents.map((content) => (
                <option key={content.id} value={content.id}>
                  {content.title} · {content.status}
                </option>
              ))}
            </select>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setEditingContentId("")}
            >
              새 Content
            </button>
          </div>
        </div>
        <form
          className="admin-form"
          action={saveContent}
          key={editingContent?.id ?? "new-content"}
        >
          <input name="id" type="hidden" value={editingContent?.id ?? ""} />
          <label>
            Slug
            <input
              name="slug"
              placeholder="privacy-access-control"
              required
              defaultValue={editingContent?.slug ?? ""}
            />
          </label>
          <label>
            Canonical Key
            <input
              name="canonicalKey"
              placeholder="privacy.access-control"
              required
              defaultValue={editingContent?.canonicalKey ?? ""}
            />
          </label>
          <label>
            제목
            <input
              name="title"
              placeholder="접근통제 기본 개념"
              required
              defaultValue={editingContent?.title ?? ""}
            />
          </label>
          <label>
            버전
            <input name="version" defaultValue={editingContent?.version ?? "1.0.0"} required />
          </label>
          <label>
            본문 형식
            <select name="bodyFormat" defaultValue={editingContent?.bodyFormat ?? "MARKDOWN"}>
              {bodyFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select name="status" defaultValue={editingContent?.status ?? "DRAFT"}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            요약
            <textarea name="summary" rows={2} defaultValue={editingContent?.summary ?? ""} />
          </label>
          <label className="wide">
            본문
            <textarea
              name="body"
              rows={8}
              required
              defaultValue={editingContent?.body ?? ""}
              placeholder="Markdown 또는 Plain text 본문을 입력하세요."
            />
          </label>
          <label className="wide">
            학습 목표 JSON 배열
            <textarea
              name="learningObjectivesJson"
              rows={2}
              defaultValue={jsonDefault(editingContent?.learningObjectivesJson)}
            />
          </label>
          <label className="wide">
            핵심 개념 JSON 배열
            <textarea
              name="coreConceptsJson"
              rows={2}
              defaultValue={jsonDefault(editingContent?.coreConceptsJson)}
            />
          </label>
          <label className="wide">
            실무 예시 JSON 배열
            <textarea
              name="practicalExamplesJson"
              rows={2}
              defaultValue={jsonDefault(editingContent?.practicalExamplesJson)}
            />
          </label>
          <button
            className="button button-dark"
            disabled={pendingAction === "content-save"}
            type="submit"
          >
            {pendingAction === "content-save"
              ? "저장 중..."
              : editingContent
                ? "Content 수정"
                : "Content 등록"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">COURSE LESSON</p>
            <h2>과정별 CourseLesson 연결·수정</h2>
            <p>
              선택 과정: {selectedCourse?.name ?? "과정 없음"} · {selectedTreeLabel}
            </p>
          </div>
          <div className="admin-inline-actions">
            <select
              aria-label="관리할 과정 선택"
              className="admin-inline-select"
              defaultValue={selectedCourseId}
              onChange={(event) => {
                window.location.href = `/admin/shared-content?courseId=${event.target.value}`;
              }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.groupName} · {course.shortName}
                </option>
              ))}
            </select>
            <select
              aria-label="수정할 CourseLesson 선택"
              className="admin-inline-select"
              value={editingCourseLessonId}
              onChange={(event) => setEditingCourseLessonId(event.target.value)}
            >
              <option value="">새 CourseLesson</option>
              {displayedCourseLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.displayTitle} · {lesson.status}
                </option>
              ))}
            </select>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setEditingCourseLessonId("")}
            >
              새 연결
            </button>
          </div>
        </div>
        {selectedCurriculumNode ? (
          <div className="admin-record selected-record">
            <div className="admin-record-summary">
              <span>
                <strong>선택된 커리큘럼 노드</strong>
                <small>
                  {selectedCurriculumNode.title} · {selectedCurriculumNode.nodeType}
                  {" · "}
                  연결 CourseLesson {selectedNodeCourseLessons.length}개
                </small>
              </span>
              <span className="status-badge compact">
                {selectedCurriculumNode.status}
              </span>
            </div>
            <p className="admin-helper">
              커버리지 화면에서 넘어온 노드입니다. 새 CourseLesson을 만들 때
              아래 커리큘럼 노드 필드에 기본 선택됩니다.
            </p>
            <div className="admin-inline-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  const nextValue = !showSelectedNodeOnly;
                  setShowSelectedNodeOnly(nextValue);
                  if (
                    nextValue &&
                    editingCourseLessonId &&
                    !selectedNodeCourseLessons.some(
                      (lesson) => lesson.id === editingCourseLessonId,
                    )
                  ) {
                    setEditingCourseLessonId("");
                  }
                }}
              >
                {showSelectedNodeOnly
                  ? "전체 CourseLesson 보기"
                  : "선택 노드 연결만 보기"}
              </button>
              <button
                className="button button-dark"
                type="button"
                onClick={() => setEditingCourseLessonId("")}
              >
                이 노드에 새 CourseLesson 연결
              </button>
            </div>
          </div>
        ) : null}
        <form
          className="admin-form"
          action={saveCourseLesson}
          key={editingCourseLesson?.id ?? "new-course-lesson"}
        >
          <input name="id" type="hidden" value={editingCourseLesson?.id ?? ""} />
          <label>
            공통 Content
            <select
              name="contentId"
              required
              defaultValue={editingCourseLesson?.contentId ?? contents[0]?.id ?? ""}
            >
              {contents.map((content) => (
                <option key={content.id} value={content.id}>
                  {content.title} · {content.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            커리큘럼 노드
            <select
              name="curriculumNodeId"
              defaultValue={
                editingCourseLesson?.curriculumNodeId ??
                selectedCurriculumNodeId ??
                ""
              }
            >
              <option value="">노드 미연결</option>
              {curriculumNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {"—".repeat(Math.max(0, node.depth))} {node.title} ·{" "}
                  {node.nodeType}
                </option>
              ))}
            </select>
          </label>
          <label>
            과정 표시 제목
            <input
              name="displayTitle"
              required
              defaultValue={editingCourseLesson?.displayTitle ?? ""}
            />
          </label>
          <label>
            정렬 순서
            <input
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={editingCourseLesson?.sortOrder ?? 10}
            />
          </label>
          <label>
            난이도
            <input
              name="difficulty"
              placeholder="중급"
              defaultValue={editingCourseLesson?.difficulty ?? ""}
            />
          </label>
          <label>
            중요도
            <input
              name="importance"
              type="number"
              min={0}
              max={100}
              defaultValue={editingCourseLesson?.importance ?? ""}
            />
          </label>
          <label>
            예상 학습 시간
            <input
              name="estimatedMinutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={editingCourseLesson?.estimatedMinutes ?? 10}
            />
          </label>
          <label>
            완료 규칙
            <select
              name="completionRule"
              defaultValue={editingCourseLesson?.completionRule ?? "MANUAL"}
            >
              {completionRules.map((rule) => (
                <option key={rule} value={rule}>
                  {rule}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select name="status" defaultValue={editingCourseLesson?.status ?? "DRAFT"}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              name="isRequired"
              type="checkbox"
              defaultChecked={editingCourseLesson?.isRequired ?? true}
            />
            필수 학습
          </label>
          <button
            className="button button-dark"
            disabled={pendingAction === "course-lesson-save" || !contents.length}
            type="submit"
          >
            {pendingAction === "course-lesson-save"
              ? "저장 중..."
              : editingCourseLesson
                ? "CourseLesson 수정"
                : "CourseLesson 연결"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">EXTENSION</p>
            <h2>과정별 보강 설명</h2>
            <p>
              원본 Content를 유지하면서 시험 포인트, 실무 메모, 법령·기준 메모를
              과정별로 보강합니다.
            </p>
          </div>
        </div>
        <form
          className="admin-form"
          action={saveExtension}
          key={editingCourseLesson?.id ?? "new-extension"}
        >
          <input name="id" type="hidden" value={editingCourseLesson?.extensionId ?? ""} />
          <label>
            CourseLesson
            <select
              name="courseLessonId"
              required
              value={editingCourseLessonId}
              onChange={(event) => setEditingCourseLessonId(event.target.value)}
            >
              <option value="">CourseLesson 선택</option>
              {courseLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.displayTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            버전
            <input
              name="version"
              defaultValue={editingCourseLesson?.extensionVersion ?? "1.0.0"}
              required
            />
          </label>
          <label>
            상태
            <select
              name="status"
              defaultValue={editingCourseLesson?.extensionStatus ?? "DRAFT"}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            학습 목표 Override JSON 배열
            <textarea
              name="learningObjectivesOverrideJson"
              rows={2}
              defaultValue={editingCourseLesson?.extensionLearningObjectivesOverrideJson ?? ""}
            />
          </label>
          <label className="wide">
            추가 본문
            <textarea
              name="additionalBody"
              rows={5}
              defaultValue={editingCourseLesson?.extensionAdditionalBody ?? ""}
            />
          </label>
          <label className="wide">
            시험 포인트 JSON 배열
            <textarea
              name="examPointsJson"
              rows={2}
              defaultValue={jsonDefault(editingCourseLesson?.extensionExamPointsJson)}
            />
          </label>
          <label className="wide">
            실무 메모
            <textarea
              name="practicalNotes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionPracticalNotes ?? ""}
            />
          </label>
          <label className="wide">
            법령 메모
            <textarea
              name="legalNotes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionLegalNotes ?? ""}
            />
          </label>
          <label className="wide">
            기준 메모
            <textarea
              name="standardNotes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionStandardNotes ?? ""}
            />
          </label>
          <label className="wide">
            증적 메모
            <textarea
              name="evidenceNotes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionEvidenceNotes ?? ""}
            />
          </label>
          <label className="wide">
            자주 하는 실수
            <textarea
              name="commonMistakes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionCommonMistakes ?? ""}
            />
          </label>
          <label className="wide">
            관리자 메모
            <textarea
              name="instructorNotes"
              rows={2}
              defaultValue={editingCourseLesson?.extensionInstructorNotes ?? ""}
            />
          </label>
          <button
            className="button button-dark"
            disabled={pendingAction === "extension-save" || !editingCourseLesson}
            type="submit"
          >
            {pendingAction === "extension-save" ? "저장 중..." : "Extension 저장"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>공유 Content 목록</h2>
        <div className="admin-list-toolbar">
          <label>
            검색
            <input
              type="search"
              value={contentQuery}
              onChange={(event) => updateContentQuery(event.target.value)}
              placeholder="제목, slug, canonical key"
            />
          </label>
          <label>
            상태
            <select
              value={contentStatusFilter}
              onChange={(event) => updateContentStatusFilter(event.target.value)}
            >
              <option value="ALL">전체</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <span className="admin-helper">
            {filteredContents.length}개 결과 · {safePage}/{pageCount}쪽
          </span>
        </div>
        <div className="admin-record-list">
          {pagedContents.length ? (
            pagedContents.map((content) => (
              <article className="admin-record shared-content-record" key={content.id}>
                <div>
                  <strong>{content.title}</strong>
                  <small>
                    {content.canonicalKey} · {content.version} · {content.status}
                  </small>
                  <p>{content.summary || "요약 없음"}</p>
                </div>
                <div className="admin-inline-actions">
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => setEditingContentId(content.id)}
                  >
                    수정
                  </button>
                  <a
                    className="button button-ghost"
                    href={`/admin/shared-content?courseId=${selectedCourseId}&contentId=${content.id}`}
                  >
                    사용처 보기
                  </a>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-copy">아직 등록된 공통 Content가 없습니다.</p>
          )}
        </div>
        <div className="pagination" aria-label="공통 Content 페이지 이동">
          <button
            className="button button-ghost"
            type="button"
            disabled={safePage <= 1}
            onClick={() => setContentPage((page) => Math.max(1, page - 1))}
          >
            이전
          </button>
          <span>
            {safePage} / {pageCount}
          </span>
          <button
            className="button button-ghost"
            type="button"
            disabled={safePage >= pageCount}
            onClick={() =>
              setContentPage((page) => Math.min(pageCount, page + 1))
            }
          >
            다음
          </button>
        </div>
      </section>

      <section className="admin-panel">
        <h2>선택 Content 사용처</h2>
        <p className="admin-helper">
          {selectedContent
            ? `${selectedContent.title} 콘텐츠가 연결된 과정 레슨입니다.`
            : "사용처를 확인할 Content를 먼저 등록하세요."}
        </p>
        <div className="admin-record-list">
          {usage.length ? (
            usage.map((item) => (
              <article className="admin-record shared-content-record" key={item.courseLessonId}>
                <div>
                  <strong>{item.displayTitle}</strong>
                  <small>
                    {item.courseName} · {item.status}
                  </small>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-copy">아직 연결된 CourseLesson이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
