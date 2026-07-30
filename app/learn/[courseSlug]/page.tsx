import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { getPublishedCurriculumPathForCourse } from "@/db/curriculum-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
  listCurriculum,
} from "@/db/repositories";
import {
  getCourseStatistics,
  getReviewSummary,
  listCourseLevels,
  listPublicMockExams,
} from "@/db/phase3-repositories";
import { listCourseSpecializations } from "@/db/specialized-repositories";
import {
  getCourseTheoryProgress,
  listSubjectTheoryProgress,
} from "@/db/lesson-repositories";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);

  const [
    curriculum,
    levelRows,
    reviews,
    exams,
    stats,
    specializations,
    theoryProgress,
    subjectTheoryProgress,
    curriculumPath,
  ] =
    await Promise.all([
      listCurriculum(course.id),
      listCourseLevels(user.id, course.id),
      getReviewSummary(user.id),
      listPublicMockExams(user.id, course.id),
      getCourseStatistics(user.id, course.id),
      listCourseSpecializations(course.id),
      getCourseTheoryProgress(user.id, course.id),
      listSubjectTheoryProgress(user.id, course.id),
      getPublishedCurriculumPathForCourse(course.id, user.id),
    ]);
  const courseReviews = reviews.byCourse.find(
    (item) => item.courseId === course.id,
  );
  const levelCompletion = levelRows.length
    ? Math.round(
        (levelRows.filter((level) =>
          ["COMPLETED", "MASTERED"].includes(level.status),
        ).length /
          levelRows.length) *
          100,
      )
    : 0;

  return (
    <main className="page-main">
      <section className="learn-hero">
        <div className="shell">
          <Link className="breadcrumb" href="/dashboard">
            ← 통합 대시보드
          </Link>
          <div className="learn-hero-grid">
            <div>
              <p className="eyebrow light">{course.groupName}</p>
              <h1>{course.name}</h1>
              <p>단계 학습, 복습, 문제풀이와 모의고사를 한곳에서 관리합니다.</p>
              <div className="button-row">
                <Link
                  className="button button-outline-light"
                  href={`/practice/${course.slug}?random=1&count=10`}
                >
                  랜덤 문제 풀기
                </Link>
                <Link className="button button-outline-light" href="/reviews">
                  오늘의 복습
                </Link>
                <Link
                  className="button button-outline-light"
                  href={`/lectures/${course.slug}`}
                >
                  강의 보기
                </Link>
              </div>
            </div>
            <div className="learn-progress-panel">
              <ProgressBar value={levelCompletion} label="단계 완료율" />
              <dl className="metric-list">
                <div><dt>전체 정답률</dt><dd>{stats.overallAccuracy}%</dd></div>
                <div><dt>복습 예정</dt><dd>{courseReviews?.count ?? 0}개</dd></div>
                <div><dt>모의고사</dt><dd>{exams.length}개</dd></div>
                <div>
                  <dt>이론 진도</dt>
                  <dd>
                    {theoryProgress.completedLessons}/{theoryProgress.totalLessons}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">LEVEL PATH</p>
              <h2>단계 학습</h2>
            </div>
            <span className="count-label">실제 단계 {levelRows.length}개</span>
          </div>
          <div className="level-path">
            {levelRows.map((level) => (
              <article
                className={`level-card level-${level.status.toLowerCase()}`}
                key={level.id}
              >
                <span className="level-number">
                  {String(level.number).padStart(2, "0")}
                </span>
                <div>
                  <div className="course-card-top">
                    <span className="badge">{level.status}</span>
                    <span>통과 {level.passingScore}점</span>
                  </div>
                  <h3>{level.title}</h3>
                  <p>{level.description}</p>
                  <p>
                    최고 {level.bestScore}점 · {level.attemptCount}회 시도
                  </p>
                </div>
                {level.status === "LOCKED" ? (
                  <button className="button button-disabled" disabled>
                    선행 단계 필요
                  </button>
                ) : (
                  <Link
                    className="button button-dark"
                    href={`/learn/${course.slug}/levels/${level.id}`}
                  >
                    {["COMPLETED", "MASTERED"].includes(level.status)
                      ? "다시 학습"
                      : "단계 학습"}
                  </Link>
                )}
              </article>
            ))}
          </div>

          {curriculumPath ? (
            <CurriculumPathSection
              courseSlug={course.slug}
              path={curriculumPath}
            />
          ) : null}

          <div className="dashboard-layout section-block">
            <div>
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">SUBJECTS</p>
                  <h2>과목 목록</h2>
                </div>
              </div>
              <div className="subject-list">
                {curriculum.map((subject, index) => (
                  <Link
                    className="subject-row"
                    href={`/learn/${course.slug}/subjects/${subject.id}`}
                    key={subject.id}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{subject.name}</h3>
                      <p>{subject.description}</p>
                    </div>
                    <strong>
                      {subjectTheoryProgress.find(
                        (item) => item.subjectId === subject.id,
                      )?.progressPercent ?? 0}
                      % · {subject.topics.length}개 주제 →
                    </strong>
                  </Link>
                ))}
              </div>
            </div>
            <aside className="side-stack">
              <div className="side-card">
                <span className="eyebrow">THEORY</span>
                <h3>이론 학습 {theoryProgress.progressPercent}%</h3>
                <p>
                  {theoryProgress.latestLesson
                    ? `최근: ${theoryProgress.latestLesson.title}`
                    : "아직 학습한 레슨이 없습니다."}
                </p>
                {theoryProgress.nextLesson ? (
                  <Link
                    className="button button-dark full-width"
                    href={`/learn/${course.slug}/lessons/${theoryProgress.nextLesson.id}`}
                  >
                    다음 추천 · {theoryProgress.nextLesson.title}
                  </Link>
                ) : (
                  <span className="sample-label">공개 레슨 학습 완료</span>
                )}
              </div>
              {specializations.length ? (
                <div className="side-card specialization-callout">
                  <span className="eyebrow">SPECIALIZATION</span>
                  <h3>과정 특화 학습</h3>
                  <p>{specializations.map((item) => item.displayName).join(" · ")}</p>
                  <Link
                    className="button button-dark full-width"
                    href={
                      specializations.some((item) =>
                        ["SECURE_CODE_ANALYSIS", "PRIVACY_IMPACT_ASSESSMENT"].includes(
                          item.featureType,
                        ),
                      )
                        ? `/practical/${course.slug}`
                        : `/specialized/${course.slug}`
                    }
                  >
                    특화 학습 열기
                  </Link>
                </div>
              ) : null}
              <div className="side-card">
                <span className="eyebrow">REVIEW</span>
                <h3>오늘의 복습</h3>
                <p>{courseReviews?.count ?? 0}개 문제가 예정되어 있습니다.</p>
                <Link
                  className="button button-dark full-width"
                  href={`/practice/${course.slug}?reviewOnly=1&count=50`}
                >
                  복습 시작
                </Link>
              </div>
              <div className="side-card">
                <span className="eyebrow">모의고사</span>
                <h3>실력 점검</h3>
                <p>{exams.length}개 시험에 응시할 수 있습니다.</p>
                <Link className="button button-ghost full-width" href="/mock-exams">
                  모의고사 보기
                </Link>
              </div>
              <div className="side-card">
                <span className="eyebrow">ANALYTICS</span>
                <h3>과정 분석</h3>
                <p>
                  최근 7일 {stats.recent7Days}문제 · 반복 오답{" "}
                  {stats.repeatedWrongCount}개
                </p>
                <Link
                  className="button button-ghost full-width"
                  href={`/analytics/${course.id}`}
                >
                  상세 분석
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

type CurriculumPath = NonNullable<
  Awaited<ReturnType<typeof getPublishedCurriculumPathForCourse>>
>;
type CurriculumPathNode = CurriculumPath["nodes"][number];

function CurriculumPathSection({
  courseSlug,
  path,
}: {
  courseSlug: string;
  path: CurriculumPath;
}) {
  return (
    <section className="curriculum-path-section section-block">
      {path.linkedLessonCount ? (
        <div className="curriculum-path-summary">
          <ProgressBar
            value={path.progressPercent}
            label={`커리큘럼 연결 레슨 ${path.completedLinkedLessons}/${path.linkedLessonCount} 완료`}
          />
        </div>
      ) : null}
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">CURRICULUM PATH</p>
          <h2>통합 커리큘럼 경로</h2>
          <p>
            {path.tree.title} · v{path.tree.version}
            {path.tree.effectiveFrom ? ` · 기준일 ${path.tree.effectiveFrom}` : ""}
          </p>
        </div>
        <span className="count-label">{path.nodeCount}개 노드</span>
      </div>
      <div className="curriculum-path-tree">
        {path.nodes.map((node) => (
          <CurriculumPathNodeCard
            courseSlug={courseSlug}
            key={node.id}
            node={node}
          />
        ))}
      </div>
    </section>
  );
}

function CurriculumPathNodeCard({
  courseSlug,
  node,
}: {
  courseSlug: string;
  node: CurriculumPathNode;
}) {
  const practiceHref = getCurriculumPracticeHref(courseSlug, node);

  return (
    <article className="curriculum-path-node">
      <div className="curriculum-path-node-body">
        <div className="course-card-top">
          <span className="badge">{node.nodeType}</span>
          {node.isRequired ? <span className="sample-label">필수</span> : null}
          {node.isPractical ? <span className="sample-label">실무</span> : null}
        </div>
        <h3>
          {node.officialCode ? `${node.officialCode} · ` : ""}
          {node.title}
        </h3>
        {node.description ? <p>{node.description}</p> : null}
        {node.linkedLessonCount ? (
          <p className="curriculum-path-progress">
            연결 레슨 {node.completedLinkedLessons}/{node.linkedLessonCount} 완료 ·{" "}
            {node.linkedLessonProgressPercent}%
          </p>
        ) : null}
        {node.questionStats.questionCount ? (
          <dl className="curriculum-path-stats" aria-label={`${node.title} 문제 통계`}>
            <div>
              <dt>문제</dt>
              <dd>{node.questionStats.questionCount}개</dd>
            </div>
            <div>
              <dt>정답률</dt>
              <dd>
                {node.questionStats.attemptCount
                  ? `${node.questionStats.accuracy}%`
                  : "기록 없음"}
              </dd>
            </div>
            <div>
              <dt>오답</dt>
              <dd>{node.questionStats.wrongQuestionCount}개</dd>
            </div>
            <div>
              <dt>복습</dt>
              <dd>{node.questionStats.dueReviewCount}개</dd>
            </div>
          </dl>
        ) : null}
        <p className="curriculum-path-meta">
          연결 콘텐츠 {node.linkedContentCount}개
          {node.importance !== null ? ` · 중요도 ${node.importance}` : ""}
        </p>
        {node.linkedLesson ? (
          <Link
            className="button button-ghost"
            href={`/learn/${courseSlug}/lessons/${node.linkedLesson.id}`}
          >
            연결 레슨 보기 · {node.linkedLesson.title}
          </Link>
        ) : null}
        {practiceHref ? (
          <Link className="button button-dark" href={practiceHref}>
            커리큘럼 문제 풀기
          </Link>
        ) : null}
      </div>
      {node.children.length ? (
        <div className="curriculum-path-children">
          {node.children.map((child) => (
            <CurriculumPathNodeCard
              courseSlug={courseSlug}
              key={child.id}
              node={child}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function getCurriculumPracticeHref(
  courseSlug: string,
  node: CurriculumPathNode,
) {
  if (!node.questionStats.questionCount) return null;
  const topicLink = node.linkedContent.find((link) => link.type === "TOPIC");
  const subjectLink = node.linkedContent.find(
    (link) => link.type === "SUBJECT",
  );
  if (!subjectLink && !topicLink) return null;

  const params = new URLSearchParams({ count: "10" });
  if (subjectLink) params.set("subjectId", subjectLink.id);
  if (topicLink) params.set("topicId", topicLink.id);
  return `/practice/${courseSlug}?${params.toString()}`;
}
