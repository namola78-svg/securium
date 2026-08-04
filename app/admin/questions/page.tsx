import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
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
  const publishedCount = rows.filter(
    (question) => question.status === "PUBLISHED",
  ).length;
  const reviewQueueCount = rows.filter((question) =>
    ["REVIEW_REQUESTED", "IN_REVIEW", "APPROVED"].includes(question.status),
  ).length;
  const draftCount = rows.filter((question) => question.status === "DRAFT").length;
  const archivedCount = rows.filter(
    (question) => question.status === "ARCHIVED",
  ).length;
  const selectedCourse = filters.courseId
    ? courses.find((course) => course.id === filters.courseId)
    : null;
  const activeFilterCount = [
    filters.courseId,
    filters.subjectId,
    filters.topicId,
    filters.type,
    filters.difficulty,
    filters.status,
    filters.createdBy,
    filters.reviewedBy,
    filters.keyword,
  ].filter(Boolean).length;

  return (
    <>
      <SectionHeader
        eyebrow="QUESTION BANK"
        title="통합 문제은행"
        description="한 문제를 여러 과정·과목·주제와 연결하고 검수 상태와 버전을 관리합니다."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Questions", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/ai-explainability">
              AI Trace
            </Link>
            <Link className="button button-primary" href="/admin/questions/new">
              새 문제 등록
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats">
        <MetricCard
          label="검색 결과"
          value={rows.length}
          description={`활성 필터 ${activeFilterCount}개`}
        />
        <MetricCard
          label="게시 문제"
          value={publishedCount}
          description={`초안 ${draftCount}개 · 보관 ${archivedCount}개`}
        />
        <MetricCard
          label="검수 대기"
          value={reviewQueueCount}
          description="요청·검수·승인 상태"
        />
      </section>

      <section className="admin-panel inline-panel">
        <div>
          <h2>문제 {rows.length}개</h2>
          <p>필터 조건에 맞는 문제 목록과 검수 상태를 확인합니다.</p>
        </div>
        <Link className="button button-dark" href="/admin/questions/new">
          새 문제 등록
        </Link>
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={activeFilterCount ? "info" : "neutral"}>
              FILTER {activeFilterCount}
            </StatusBadge>
            <StatusBadge compact tone={selectedCourse ? "brand" : "neutral"}>
              {selectedCourse?.shortName ?? "ALL COURSES"}
            </StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/questions">
            필터 초기화
          </Link>
        }
      >
        <strong>문제 검색과 검수 큐</strong>
        <span>게시 전 정답과 해설은 관리자 범위에서만 관리합니다.</span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <form className="admin-filter-grid" method="get">
                <input
                  name="keyword"
                  defaultValue={value("keyword")}
                  placeholder="제목·본문 검색"
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
                        {question.type} · {question.difficulty} · v
                        {question.version}
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
        }
        inspector={
          <InspectorPanel
            eyebrow="QUESTION INSPECTOR"
            title="문제은행 운영 요약"
            description="필터 결과와 검수 상태를 기준으로 출제·검수·게시 흐름을 점검합니다."
            badges={[
              { label: `PUBLISHED ${publishedCount}`, tone: "success" },
              {
                label: `REVIEW ${reviewQueueCount}`,
                tone: reviewQueueCount ? "warning" : "neutral",
              },
            ]}
            meta={[
              { label: "검색 결과", value: `${rows.length}개` },
              { label: "초안", value: `${draftCount}개` },
              { label: "게시", value: `${publishedCount}개` },
              { label: "보관", value: `${archivedCount}개` },
              { label: "선택 과정", value: selectedCourse?.name ?? "전체 과정" },
            ]}
            actions={
              <>
                <Link className="button button-ghost" href="/admin/question-reports">
                  신고 관리
                </Link>
                <Link className="button button-ghost" href="/admin/ai-explainability">
                  AI Trace
                </Link>
              </>
            }
          >
            <div className="admin-card-meta">
              <span>
                문제 본문·선택지·정답·연결 정보는 저장 시 트랜잭션으로 관리됩니다.
              </span>
              <span>
                일반 사용자 API에는 제출 전 정답과 해설을 노출하지 않습니다.
              </span>
              <span>
                검수 상태를 기준으로 승인되지 않은 문제의 학습자 노출을 차단합니다.
              </span>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
