import Link from "next/link";
import {
  listAdminQuestions,
  type QuestionFilters,
} from "@/db/question-repositories";
import {
  listAllActiveSubjects,
  listAllActiveTopics,
  listAllCourses,
} from "@/db/repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireQuestionAdministrator("/admin/questions");
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? query[key] : undefined;
  const filters: QuestionFilters = {
    courseId: value("courseId"),
    subjectId: value("subjectId"),
    topicId: value("topicId"),
    type: value("type"),
    difficulty: value("difficulty"),
    status: value("status"),
    createdBy: value("createdBy"),
    reviewedBy: value("reviewedBy"),
    keyword: value("keyword"),
    limit: 100,
  };
  const [rows, courses, subjects, topics] = await Promise.all([
    listAdminQuestions(filters),
    listAllCourses(),
    listAllActiveSubjects(),
    listAllActiveTopics(),
  ]);
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">QUESTION BANK</p>
        <h1>통합 문제은행</h1>
        <p>
          한 문제를 여러 과정·과목·주제와 연결하고 검수 상태와 버전을
          관리합니다.
        </p>
      </header>
      <section className="admin-panel inline-panel">
        <div>
          <h2>문제 {rows.length}개</h2>
          <p>대량 삭제 대신 보관 상태를 사용합니다.</p>
        </div>
        <Link className="button button-dark" href="/admin/questions/new">
          새 문제 등록
        </Link>
      </section>
      <section className="admin-panel">
        <form className="admin-filter-grid" method="get">
          <input
            name="keyword"
            defaultValue={value("keyword")}
            placeholder="제목·본문 키워드"
          />
          <select name="courseId" defaultValue={value("courseId") ?? ""}>
            <option value="">전체 과정</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.shortName}
              </option>
            ))}
          </select>
          <select name="subjectId" defaultValue={value("subjectId") ?? ""}>
            <option value="">전체 과목</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select name="topicId" defaultValue={value("topicId") ?? ""}>
            <option value="">전체 주제</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={value("type") ?? ""}>
            <option value="">전체 유형</option>
            <option value="TRUE_FALSE">OX</option>
            <option value="SINGLE_CHOICE">단일선택</option>
            <option value="MULTIPLE_CHOICE">복수선택</option>
            <option value="SHORT_ANSWER">단답형</option>
            <option value="ESSAY">서술형</option>
            <option value="CALCULATION">계산형</option>
          </select>
          <select name="difficulty" defaultValue={value("difficulty") ?? ""}>
            <option value="">전체 난이도</option>
            <option value="EASY">쉬움</option>
            <option value="MEDIUM">보통</option>
            <option value="HARD">어려움</option>
          </select>
          <select name="status" defaultValue={value("status") ?? ""}>
            <option value="">전체 상태</option>
            {[
              "DRAFT",
              "REVIEW_REQUESTED",
              "IN_REVIEW",
              "APPROVED",
              "PUBLISHED",
              "REJECTED",
              "ARCHIVED",
            ].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            name="createdBy"
            defaultValue={value("createdBy")}
            placeholder="작성자 ID"
          />
          <input
            name="reviewedBy"
            defaultValue={value("reviewedBy")}
            placeholder="검수자 ID"
          />
          <button className="button button-ghost" type="submit">
            검색
          </button>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-table">
          {rows.map((question) => (
            <Link
              className="admin-question-row"
              href={`/admin/questions/${question.id}`}
              key={question.id}
            >
              <div>
                <strong>{question.title}</strong>
                <small>
                  {question.type} · {question.difficulty} · v{question.version}
                </small>
              </div>
              <span className="badge">{question.status}</span>
              <span>{question.createdBy}</span>
              <span>{question.reviewedBy ?? "미배정"}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

