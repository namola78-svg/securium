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
  bodyFormat: string;
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

export function AdminSharedContentManager({
  courses,
  contents,
  courseLessons,
  curriculumTrees,
  curriculumNodes,
  usage,
  selectedCourseId,
  selectedContentId,
}: {
  courses: Course[];
  contents: SharedContent[];
  courseLessons: CourseLesson[];
  curriculumTrees: CurriculumTree[];
  curriculumNodes: CurriculumNode[];
  usage: ContentUsage[];
  selectedCourseId: string;
  selectedContentId: string;
}) {
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedContent =
    contents.find((content) => content.id === selectedContentId) ??
    contents[0] ??
    null;
  const selectedTreeLabel = useMemo(() => {
    const active = curriculumTrees.find((tree) => tree.status === "ACTIVE");
    const fallback = curriculumTrees[0];
    const tree = active ?? fallback;
    return tree ? `${tree.title} · ${tree.version}` : "연결 가능한 커리큘럼 트리 없음";
  }, [curriculumTrees]);

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
      "content-create",
    );
  }

  async function saveCourseLesson(formData: FormData) {
    await submitJson(
      {
        operation: "saveCourseLesson",
        courseLesson: {
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
      "course-lesson-create",
    );
  }

  async function saveExtension(formData: FormData) {
    await submitJson(
      {
        operation: "saveCourseLessonExtension",
        extension: {
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
      "extension-create",
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
            <h2>공통 Content 등록</h2>
            <p>
              여러 과정에서 공유할 원문 학습 콘텐츠입니다. 과정별 차이는
              CourseLesson과 Extension에서 별도로 관리합니다.
            </p>
          </div>
        </div>
        <form className="admin-form" action={saveContent}>
          <label>
            Slug
            <input name="slug" placeholder="privacy-access-control" required />
          </label>
          <label>
            Canonical Key
            <input
              name="canonicalKey"
              placeholder="privacy.access-control"
              required
            />
          </label>
          <label>
            제목
            <input name="title" placeholder="접근통제 기본 개념" required />
          </label>
          <label>
            버전
            <input name="version" defaultValue="1.0.0" required />
          </label>
          <label>
            본문 형식
            <select name="bodyFormat" defaultValue="MARKDOWN">
              {bodyFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select name="status" defaultValue="DRAFT">
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            요약
            <textarea name="summary" rows={2} />
          </label>
          <label className="wide">
            본문
            <textarea name="body" rows={8} required />
          </label>
          <label className="wide">
            학습 목표 JSON 배열
            <textarea
              name="learningObjectivesJson"
              rows={2}
              defaultValue="[]"
            />
          </label>
          <label className="wide">
            핵심 개념 JSON 배열
            <textarea name="coreConceptsJson" rows={2} defaultValue="[]" />
          </label>
          <label className="wide">
            실무 예시 JSON 배열
            <textarea name="practicalExamplesJson" rows={2} defaultValue="[]" />
          </label>
          <button
            className="button button-dark"
            disabled={pendingAction === "content-create"}
            type="submit"
          >
            {pendingAction === "content-create" ? "저장 중..." : "Content 저장"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">COURSE LESSON</p>
            <h2>과정별 CourseLesson 연결</h2>
            <p>
              선택한 과정: {selectedCourse?.name ?? "과정 없음"} ·{" "}
              {selectedTreeLabel}
            </p>
          </div>
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
        </div>
        <form className="admin-form" action={saveCourseLesson}>
          <label>
            공통 Content
            <select name="contentId" required>
              {contents.map((content) => (
                <option key={content.id} value={content.id}>
                  {content.title} · {content.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            커리큘럼 노드
            <select name="curriculumNodeId">
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
            <input name="displayTitle" required />
          </label>
          <label>
            정렬 순서
            <input name="sortOrder" type="number" min={0} defaultValue={10} />
          </label>
          <label>
            난이도
            <input name="difficulty" placeholder="중급" />
          </label>
          <label>
            중요도
            <input name="importance" type="number" min={0} max={100} />
          </label>
          <label>
            예상 학습 시간
            <input
              name="estimatedMinutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={10}
            />
          </label>
          <label>
            완료 규칙
            <select name="completionRule" defaultValue="MANUAL">
              {completionRules.map((rule) => (
                <option key={rule} value={rule}>
                  {rule}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select name="status" defaultValue="DRAFT">
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input name="isRequired" type="checkbox" defaultChecked />
            필수 학습
          </label>
          <button
            className="button button-dark"
            disabled={
              pendingAction === "course-lesson-create" || !contents.length
            }
            type="submit"
          >
            {pendingAction === "course-lesson-create"
              ? "연결 중..."
              : "CourseLesson 연결"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">EXTENSION</p>
            <h2>과정별 보충 설명</h2>
            <p>
              원본 Content는 유지하고, 시험 포인트·증적·실무 메모처럼 과정별로
              달라지는 내용을 분리합니다.
            </p>
          </div>
        </div>
        <form className="admin-form" action={saveExtension}>
          <label>
            CourseLesson
            <select name="courseLessonId" required>
              {courseLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.displayTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            버전
            <input name="version" defaultValue="1.0.0" required />
          </label>
          <label>
            상태
            <select name="status" defaultValue="DRAFT">
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
              defaultValue=""
            />
          </label>
          <label className="wide">
            추가 본문
            <textarea name="additionalBody" rows={5} />
          </label>
          <label className="wide">
            시험 포인트 JSON 배열
            <textarea name="examPointsJson" rows={2} defaultValue="[]" />
          </label>
          <label className="wide">
            실무 메모
            <textarea name="practicalNotes" rows={2} />
          </label>
          <label className="wide">
            법령 메모
            <textarea name="legalNotes" rows={2} />
          </label>
          <label className="wide">
            기준 메모
            <textarea name="standardNotes" rows={2} />
          </label>
          <label className="wide">
            증적 메모
            <textarea name="evidenceNotes" rows={2} />
          </label>
          <label className="wide">
            자주 하는 실수
            <textarea name="commonMistakes" rows={2} />
          </label>
          <label className="wide">
            관리자 메모
            <textarea name="instructorNotes" rows={2} />
          </label>
          <button
            className="button button-dark"
            disabled={
              pendingAction === "extension-create" || !courseLessons.length
            }
            type="submit"
          >
            {pendingAction === "extension-create" ? "저장 중..." : "Extension 저장"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>공유 Content 목록</h2>
        <div className="admin-record-list">
          {contents.length ? (
            contents.map((content) => (
              <article className="admin-record shared-content-record" key={content.id}>
                <div>
                  <strong>{content.title}</strong>
                  <small>
                    {content.canonicalKey} · {content.version} · {content.status}
                  </small>
                  <p>{content.summary || "요약 없음"}</p>
                </div>
                <a
                  className="button button-ghost"
                  href={`/admin/shared-content?courseId=${selectedCourseId}&contentId=${content.id}`}
                >
                  사용처 보기
                </a>
              </article>
            ))
          ) : (
            <p className="empty-copy">아직 등록된 공통 Content가 없습니다.</p>
          )}
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
