import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { getPublishedCurriculumPathOverviewForCourse } from "@/db/curriculum-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
  listCurriculumWithSubjectTheoryProgress,
} from "@/db/repositories";
import {
  getLearnCourseActivitySummary,
  listCourseLevelsForOverview,
} from "@/db/phase3-repositories";
import { listCourseSpecializations } from "@/db/specialized-repositories";
import { getCourseTheoryProgress } from "@/db/lesson-repositories";
import { getPublishedCourseLessonProgressSummary } from "@/db/shared-content-repositories";
import { publicCopy } from "@/lib/public-copy";

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

  const [curriculum, levelRows, specializations, sharedLessonSummary] =
    await Promise.all([
      listCurriculumWithSubjectTheoryProgress(user.id, course.id),
      listCourseLevelsForOverview(user.id, course.id),
      listCourseSpecializations(course.id),
      getPublishedCourseLessonProgressSummary(user.id, course.id),
    ]);
  const activitySummaryPromise = getLearnCourseActivitySummary(user.id, course.id);
  const legacyTheoryProgress = sharedLessonSummary.totalLessons
    ? null
    : await getCourseTheoryProgress(user.id, course.id);
  const levelCompletion = levelRows.length
    ? Math.round(
        (levelRows.filter((level) =>
          ["COMPLETED", "MASTERED"].includes(level.status),
        ).length /
          levelRows.length) *
          100,
      )
    : 0;
  const displayedTheoryProgress = sharedLessonSummary.totalLessons
    ? {
        completedLessons: sharedLessonSummary.completedLessons,
        totalLessons: sharedLessonSummary.totalLessons,
        progressPercent: sharedLessonSummary.progressPercent,
      }
    : (legacyTheoryProgress ?? {
        completedLessons: 0,
        totalLessons: 0,
        progressPercent: 0,
        latestLesson: null,
        nextLesson: null,
      });
  const nextSharedLesson = sharedLessonSummary.nextLesson;
  const latestSharedLesson = sharedLessonSummary.latestLesson;

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
            <Suspense
              fallback={
                <LearnProgressPanelFallback
                  displayedTheoryProgress={displayedTheoryProgress}
                  levelCompletion={levelCompletion}
                />
              }
            >
              <LearnProgressPanel
                activitySummaryPromise={activitySummaryPromise}
                displayedTheoryProgress={displayedTheoryProgress}
                levelCompletion={levelCompletion}
              />
            </Suspense>
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
            <span className="count-label">학습 단계 {levelRows.length}개</span>
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

          <Suspense fallback={<CurriculumPathFallback />}>
            <CurriculumPathLoader
              courseId={course.id}
              courseSlug={course.slug}
              userId={user.id}
            />
          </Suspense>

          {sharedLessonSummary.totalLessons ? (
            <section className="section-block">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">SHARED THEORY</p>
                  <h2>공통 이론 레슨</h2>
                  <p>
                    여러 과정에서 함께 사용하는 핵심 이론을 이 과정 맥락에
                    맞춰 학습합니다.
                  </p>
                </div>
                <span className="count-label">
                  {sharedLessonSummary.completedLessons}/
                  {sharedLessonSummary.totalLessons} 완료
                </span>
              </div>
              <ProgressBar
                value={sharedLessonSummary.progressPercent}
                label="공통 이론 진도"
              />
              <div className="course-lesson-grid">
                {sharedLessonSummary.lessons.map((lesson) => (
                  <Link
                    className="course-lesson-card"
                    href={`/learn/${course.slug}/course-lessons/${lesson.id}`}
                    key={lesson.id}
                  >
                    <div className="course-card-top">
                      <span className="badge">
                        {lesson.status === "COMPLETED"
                          ? "완료"
                          : lesson.status === "IN_PROGRESS"
                            ? "학습 중"
                            : "시작 전"}
                      </span>
                      <span>{lesson.estimatedMinutes}분</span>
                    </div>
                    <h3>{publicCopy(lesson.title)}</h3>
                    <p>{publicCopy(lesson.summary)}</p>
                    <div className="course-lesson-meta">
                      {lesson.isRequired ? <span>필수</span> : <span>선택</span>}
                      {lesson.difficulty ? <span>{lesson.difficulty}</span> : null}
                      {lesson.importance !== null ? (
                        <span>중요도 {lesson.importance}</span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
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
                      <p>{publicCopy(subject.description)}</p>
                    </div>
                    <strong>
                      {subject.theoryProgress.progressPercent}
                      % · {subject.topics.length}개 주제 →
                    </strong>
                  </Link>
                ))}
              </div>
            </div>
            <aside className="side-stack">
              <div className="side-card">
                <span className="eyebrow">THEORY</span>
                <h3>이론 학습 {displayedTheoryProgress.progressPercent}%</h3>
                <p>
                  {latestSharedLesson
                    ? `최근: ${publicCopy(latestSharedLesson.title)}`
                    : legacyTheoryProgress?.latestLesson
                      ? `최근: ${publicCopy(legacyTheoryProgress.latestLesson.title)}`
                    : "아직 학습한 레슨이 없습니다."}
                </p>
                {nextSharedLesson ? (
                  <Link
                    className="button button-dark full-width"
                    href={`/learn/${course.slug}/course-lessons/${nextSharedLesson.id}`}
                  >
                    다음 추천 · {publicCopy(nextSharedLesson.title)}
                  </Link>
                ) : legacyTheoryProgress?.nextLesson ? (
                  <Link
                    className="button button-dark full-width"
                    href={`/learn/${course.slug}/lessons/${legacyTheoryProgress.nextLesson.id}`}
                  >
                    다음 추천 · {publicCopy(legacyTheoryProgress.nextLesson.title)}
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
              <Suspense fallback={<LearnActivitySideCardsFallback />}>
                <LearnActivitySideCards
                  activitySummaryPromise={activitySummaryPromise}
                  courseId={course.id}
                  courseSlug={course.slug}
                />
              </Suspense>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

type LearnCourseActivitySummary = Awaited<
  ReturnType<typeof getLearnCourseActivitySummary>
>;
type DisplayedTheoryProgress = {
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
};

async function LearnProgressPanel({
  activitySummaryPromise,
  displayedTheoryProgress,
  levelCompletion,
}: {
  activitySummaryPromise: Promise<LearnCourseActivitySummary>;
  displayedTheoryProgress: DisplayedTheoryProgress;
  levelCompletion: number;
}) {
  const { dueReviewCount, mockExamCount, stats } =
    await activitySummaryPromise;

  return (
    <div className="learn-progress-panel">
      <ProgressBar value={levelCompletion} label="단계 완료율" />
      <dl className="metric-list">
        <div><dt>전체 정답률</dt><dd>{stats.overallAccuracy}%</dd></div>
        <div><dt>복습 예정</dt><dd>{dueReviewCount}개</dd></div>
        <div><dt>모의고사</dt><dd>{mockExamCount}개</dd></div>
        <div>
          <dt>이론 진도</dt>
          <dd>
            {displayedTheoryProgress.completedLessons}/
            {displayedTheoryProgress.totalLessons}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function LearnProgressPanelFallback({
  displayedTheoryProgress,
  levelCompletion,
}: {
  displayedTheoryProgress: DisplayedTheoryProgress;
  levelCompletion: number;
}) {
  return (
    <div className="learn-progress-panel" aria-live="polite">
      <ProgressBar value={levelCompletion} label="단계 완료율" />
      <dl className="metric-list">
        <div><dt>전체 정답률</dt><dd>--</dd></div>
        <div><dt>복습 예정</dt><dd>--</dd></div>
        <div><dt>모의고사</dt><dd>--</dd></div>
        <div>
          <dt>이론 진도</dt>
          <dd>
            {displayedTheoryProgress.completedLessons}/
            {displayedTheoryProgress.totalLessons}
          </dd>
        </div>
      </dl>
    </div>
  );
}

async function LearnActivitySideCards({
  activitySummaryPromise,
  courseId,
  courseSlug,
}: {
  activitySummaryPromise: Promise<LearnCourseActivitySummary>;
  courseId: string;
  courseSlug: string;
}) {
  const { dueReviewCount, mockExamCount, stats } =
    await activitySummaryPromise;

  return (
    <>
      <div className="side-card">
        <span className="eyebrow">REVIEW</span>
        <h3>오늘의 복습</h3>
        <p>{dueReviewCount}개 문제가 예정되어 있습니다.</p>
        <Link
          className="button button-dark full-width"
          href={`/practice/${courseSlug}?reviewOnly=1&count=50`}
        >
          복습 시작
        </Link>
      </div>
      <div className="side-card">
        <span className="eyebrow">모의고사</span>
        <h3>실력 점검</h3>
        <p>{mockExamCount}개 시험에 응시할 수 있습니다.</p>
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
          href={`/analytics/${courseId}`}
        >
          상세 분석
        </Link>
      </div>
    </>
  );
}

function LearnActivitySideCardsFallback() {
  return (
    <>
      <div className="side-card" aria-live="polite">
        <span className="eyebrow">REVIEW</span>
        <h3>오늘의 복습</h3>
        <p>복습 정보를 불러오고 있습니다.</p>
        <div className="card-skeleton" aria-hidden="true" />
      </div>
      <div className="side-card" aria-live="polite">
        <span className="eyebrow">모의고사</span>
        <h3>실력 점검</h3>
        <p>모의고사 정보를 불러오고 있습니다.</p>
        <div className="card-skeleton" aria-hidden="true" />
      </div>
      <div className="side-card" aria-live="polite">
        <span className="eyebrow">ANALYTICS</span>
        <h3>과정 분석</h3>
        <p>분석 정보를 불러오고 있습니다.</p>
        <div className="card-skeleton" aria-hidden="true" />
      </div>
    </>
  );
}

type CurriculumPath = NonNullable<
  Awaited<ReturnType<typeof getPublishedCurriculumPathOverviewForCourse>>
>;
type CurriculumPathNode = CurriculumPath["nodes"][number];

async function CurriculumPathLoader({
  courseId,
  courseSlug,
  userId,
}: {
  courseId: string;
  courseSlug: string;
  userId: string;
}) {
  const path = await getPublishedCurriculumPathOverviewForCourse(
    courseId,
    userId,
  );
  return path ? <CurriculumPathSection courseSlug={courseSlug} path={path} /> : null;
}

function CurriculumPathFallback() {
  return (
    <section className="curriculum-path-section section-block" aria-live="polite">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">CURRICULUM PATH</p>
          <h2>커리큘럼 경로를 불러오고 있습니다</h2>
        </div>
      </div>
      <div className="card-skeleton" aria-hidden="true" />
    </section>
  );
}

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
            href={`/learn/${courseSlug}/course-lessons/${node.linkedLesson.id}`}
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
