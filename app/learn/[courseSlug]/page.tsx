import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LearnCurriculumPathTree } from "@/components/learn-curriculum-path-tree";
import { ProgressBar } from "@/components/progress-bar";
import { getPublishedCurriculumPathOverviewForCourse } from "@/db/curriculum-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  getLearnCourseAccessBySlug,
  listCurriculumForLearnOverview,
} from "@/db/repositories";
import {
  getLearnCourseActivitySummary,
  listCourseLevelsForOverview,
} from "@/db/phase3-repositories";
import { listCourseSpecializations } from "@/db/specialized-repositories";
import { getCourseTheoryProgress } from "@/db/lesson-repositories";
import { getPublishedCourseLessonProgressSummary } from "@/db/shared-content-repositories";
import { publicCopy } from "@/lib/public-copy";
import { hasPrimaryCurriculumPath } from "@/lib/services/learn-overview-service";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}`);
  const { course, enrollment } = await getLearnCourseAccessBySlug(
    user.id,
    courseSlug,
  );
  if (!course) notFound();
  if (!enrollment) redirect(`/courses/${course.slug}`);

  const curriculumPromise = listCurriculumForLearnOverview(course.id);
  const specializationsPromise = listCourseSpecializations(course.id);
  const curriculumPathPromise = getPublishedCurriculumPathOverviewForCourse(
    course.id,
    user.id,
  );
  const sharedLessonSummaryPromise = getPublishedCourseLessonProgressSummary(
    user.id,
    course.id,
  );
  const theoryProgressViewPromise = getTheoryProgressView(
    user.id,
    course.id,
    sharedLessonSummaryPromise,
  );
  const activitySummaryPromise = getLearnCourseActivitySummary(user.id, course.id);
  const levelRowsPromise = listCourseLevelsForOverview(user.id, course.id);

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
              <p>
                공식 커리큘럼을 따라 이론을 익히고, 문제풀이와 복습까지 한
                흐름으로 이어갑니다.
              </p>
              <div className="button-row">
                <Link
                  className="button button-primary"
                  href="#today-learning-board"
                >
                  오늘 학습 보기
                </Link>
                <Link
                  className="button button-outline-light"
                  href={`/practice/${course.slug}?random=1&count=10`}
                >
                  문제 풀기
                </Link>
                <Link className="button button-outline-light" href="/reviews">
                  오늘의 복습
                </Link>
              </div>
            </div>
            <Suspense fallback={<LearnProgressPanelFallback />}>
              <LearnProgressPanel
                activitySummaryPromise={activitySummaryPromise}
                levelRowsPromise={levelRowsPromise}
                theoryProgressViewPromise={theoryProgressViewPromise}
              />
            </Suspense>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <Suspense fallback={<LearnActionBoardFallback />}>
            <LearnActionBoard
              activitySummaryPromise={activitySummaryPromise}
              courseId={course.id}
              courseSlug={course.slug}
              levelRowsPromise={levelRowsPromise}
              theoryProgressViewPromise={theoryProgressViewPromise}
            />
          </Suspense>

          <Suspense fallback={<LearnLevelPathFallback />}>
            <LearnLevelPathLoader
              courseSlug={course.slug}
              levelRowsPromise={levelRowsPromise}
            />
          </Suspense>

          <Suspense fallback={<CurriculumPathFallback />}>
            <CurriculumPathLoader
              courseSlug={course.slug}
              curriculumPathPromise={curriculumPathPromise}
            />
          </Suspense>

          <Suspense fallback={<SharedTheorySectionFallback />}>
            <SharedTheorySectionLoader
              courseSlug={course.slug}
              curriculumPathPromise={curriculumPathPromise}
              sharedLessonSummaryPromise={sharedLessonSummaryPromise}
            />
          </Suspense>

          <div className="dashboard-layout section-block">
            <Suspense fallback={<SubjectsSectionFallback />}>
              <SubjectsSectionLoader
                courseSlug={course.slug}
                curriculumPathPromise={curriculumPathPromise}
                curriculumPromise={curriculumPromise}
              />
            </Suspense>
            <aside className="side-stack">
              <Suspense fallback={<TheorySideCardFallback />}>
                <TheorySideCardLoader
                  courseSlug={course.slug}
                  theoryProgressViewPromise={theoryProgressViewPromise}
                />
              </Suspense>
              <Suspense fallback={null}>
                <SpecializationSideCardLoader
                  courseSlug={course.slug}
                  specializationsPromise={specializationsPromise}
                />
              </Suspense>
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
type CourseLevelRows = Awaited<ReturnType<typeof listCourseLevelsForOverview>>;
type CourseLevelRow = CourseLevelRows[number];
type LearnCurriculum = Awaited<ReturnType<typeof listCurriculumForLearnOverview>>;
type SharedLessonSummary = Awaited<
  ReturnType<typeof getPublishedCourseLessonProgressSummary>
>;
type CourseSpecializations = Awaited<ReturnType<typeof listCourseSpecializations>>;
type TheoryProgressView = Awaited<ReturnType<typeof getTheoryProgressView>>;

async function LearnProgressPanel({
  activitySummaryPromise,
  levelRowsPromise,
  theoryProgressViewPromise,
}: {
  activitySummaryPromise: Promise<LearnCourseActivitySummary>;
  levelRowsPromise: Promise<CourseLevelRows>;
  theoryProgressViewPromise: Promise<TheoryProgressView>;
}) {
  const [
    { dueReviewCount, mockExamCount, stats },
    levelRows,
    { displayedTheoryProgress },
  ] = await Promise.all([
    activitySummaryPromise,
    levelRowsPromise,
    theoryProgressViewPromise,
  ]);
  const levelCompletion = getLevelCompletion(levelRows);

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

function LearnProgressPanelFallback() {
  return (
    <div className="learn-progress-panel" aria-live="polite">
      <ProgressBar value={0} label="단계 완료율" />
      <dl className="metric-list">
        <div><dt>전체 정답률</dt><dd>--</dd></div>
        <div><dt>복습 예정</dt><dd>--</dd></div>
        <div><dt>모의고사</dt><dd>--</dd></div>
        <div>
          <dt>이론 진도</dt>
          <dd>--</dd>
        </div>
      </dl>
    </div>
  );
}

function getLevelCompletion(levelRows: CourseLevelRows) {
  if (!levelRows.length) return 0;
  return Math.round(
    (levelRows.filter((level) =>
      ["COMPLETED", "MASTERED"].includes(level.status),
    ).length /
      levelRows.length) *
      100,
  );
}

async function LearnActionBoard({
  activitySummaryPromise,
  courseId,
  courseSlug,
  levelRowsPromise,
  theoryProgressViewPromise,
}: {
  activitySummaryPromise: Promise<LearnCourseActivitySummary>;
  courseId: string;
  courseSlug: string;
  levelRowsPromise: Promise<CourseLevelRows>;
  theoryProgressViewPromise: Promise<TheoryProgressView>;
}) {
  const [
    { dueReviewCount, stats },
    levelRows,
    { displayedTheoryProgress, nextSharedLesson, legacyTheoryProgress },
  ] = await Promise.all([
    activitySummaryPromise,
    levelRowsPromise,
    theoryProgressViewPromise,
  ]);
  const nextLegacyLesson = legacyTheoryProgress?.nextLesson ?? null;
  const continueHref = nextSharedLesson
    ? `/learn/${courseSlug}/course-lessons/${nextSharedLesson.id}`
    : nextLegacyLesson
      ? `/learn/${courseSlug}/lessons/${nextLegacyLesson.id}`
      : `/practice/${courseSlug}?random=1&count=10`;
  const continueTitle = nextSharedLesson
    ? publicCopy(nextSharedLesson.title)
    : nextLegacyLesson
      ? publicCopy(nextLegacyLesson.title)
      : "문제풀이로 학습을 시작하세요";

  return (
    <section
      className="learn-action-board section-block"
      id="today-learning-board"
    >
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">TODAY LEARNING</p>
          <h2>오늘의 학습 보드</h2>
          <p>
            이어서 볼 이론, 풀 문제, 복습과 분석을 한눈에 확인하세요.
          </p>
        </div>
        <span className="count-label">
          단계 완료율 {getLevelCompletion(levelRows)}%
        </span>
      </div>
      <div className="learn-action-grid">
        <Link
          className="learn-action-card learn-action-card-primary"
          href={continueHref}
        >
          <span>01 · 이어서 학습</span>
          <strong>{continueTitle}</strong>
          <p>
            이론 진도 {displayedTheoryProgress.completedLessons}/
            {displayedTheoryProgress.totalLessons} 완료
          </p>
          <small>학습 계속하기 →</small>
        </Link>
        <Link
          className="learn-action-card"
          href={`/practice/${courseSlug}?random=1&count=10`}
        >
          <span>02 · 문제풀이</span>
          <strong>10문항으로 실력 점검</strong>
          <p>최근 7일 {stats.recent7Days}문제를 풀이했습니다.</p>
          <small>문제 풀기 →</small>
        </Link>
        <Link
          className="learn-action-card"
          href={`/practice/${courseSlug}?reviewOnly=1&count=50`}
        >
          <span>03 · 복습</span>
          <strong>{dueReviewCount}개 복습 예정</strong>
          <p>오답과 취약 영역을 먼저 정리합니다.</p>
          <small>복습 시작 →</small>
        </Link>
        <Link className="learn-action-card" href={`/analytics/${courseId}`}>
          <span>04 · 분석</span>
          <strong>과정별 학습 분석</strong>
          <p>
            전체 정답률 {stats.overallAccuracy}% · 반복 오답{" "}
            {stats.repeatedWrongCount}개
          </p>
          <small>분석 보기 →</small>
        </Link>
      </div>
    </section>
  );
}

function LearnActionBoardFallback() {
  return (
    <section
      className="learn-action-board section-block"
      id="today-learning-board"
      aria-live="polite"
    >
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">TODAY LEARNING</p>
          <h2>오늘의 학습 보드를 불러오고 있습니다</h2>
        </div>
      </div>
      <div className="learn-action-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className="card-skeleton compact" key={item}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}

async function getTheoryProgressView(
  userId: string,
  courseId: string,
  sharedLessonSummaryPromise: Promise<SharedLessonSummary>,
) {
  const sharedLessonSummary = await sharedLessonSummaryPromise;
  const legacyTheoryProgress = sharedLessonSummary.totalLessons
    ? null
    : await getCourseTheoryProgress(userId, courseId);
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

  return {
    displayedTheoryProgress,
    latestSharedLesson: sharedLessonSummary.latestLesson,
    nextSharedLesson: sharedLessonSummary.nextLesson,
    legacyTheoryProgress,
  };
}

async function LearnLevelPathLoader({
  courseSlug,
  levelRowsPromise,
}: {
  courseSlug: string;
  levelRowsPromise: Promise<CourseLevelRows>;
}) {
  const levelRows = await levelRowsPromise;
  return <LearnLevelPath courseSlug={courseSlug} levelRows={levelRows} />;
}

function LearnLevelPath({
  courseSlug,
  levelRows,
}: {
  courseSlug: string;
  levelRows: CourseLevelRows;
}) {
  return (
    <>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">LEVEL PATH</p>
          <h2>단계 학습</h2>
        </div>
        <span className="count-label">학습 단계 {levelRows.length}개</span>
      </div>
      <div className="level-path">
        {levelRows.map((level) => (
          <LearnLevelCard
            courseSlug={courseSlug}
            key={level.id}
            level={level}
          />
        ))}
      </div>
    </>
  );
}

function LearnLevelCard({
  courseSlug,
  level,
}: {
  courseSlug: string;
  level: CourseLevelRow;
}) {
  return (
    <article className={`level-card level-${level.status.toLowerCase()}`}>
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
          href={`/learn/${courseSlug}/levels/${level.id}`}
        >
          {["COMPLETED", "MASTERED"].includes(level.status)
            ? "다시 학습"
            : "단계 학습"}
        </Link>
      )}
    </article>
  );
}

function LearnLevelPathFallback() {
  return (
    <>
      <div className="section-heading compact" aria-live="polite">
        <div>
          <p className="eyebrow">LEVEL PATH</p>
          <h2>단계 학습을 불러오고 있습니다</h2>
        </div>
      </div>
      <div className="level-path" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <article className="level-card" key={item}>
            <span className="level-number">--</span>
            <div className="card-skeleton" />
          </article>
        ))}
      </div>
    </>
  );
}

async function SharedTheorySectionLoader({
  courseSlug,
  curriculumPathPromise,
  sharedLessonSummaryPromise,
}: {
  courseSlug: string;
  curriculumPathPromise: Promise<CurriculumPathOverview>;
  sharedLessonSummaryPromise: Promise<SharedLessonSummary>;
}) {
  const [curriculumPath, sharedLessonSummary] = await Promise.all([
    curriculumPathPromise,
    sharedLessonSummaryPromise,
  ]);
  if (hasPrimaryCurriculumPath(curriculumPath)) return null;
  if (!sharedLessonSummary.totalLessons) return null;

  return (
    <section className="section-block">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">THEORY FALLBACK</p>
          <h2>보조 이론 학습</h2>
          <p>
            공식 커리큘럼 연결이 충분하지 않은 과정에서는 기존 이론 레슨으로
            학습을 이어갑니다.
          </p>
        </div>
        <span className="count-label">
          {sharedLessonSummary.completedLessons}/
          {sharedLessonSummary.totalLessons} 완료
        </span>
      </div>
      <ProgressBar
        value={sharedLessonSummary.progressPercent}
        label="보조 이론 진도"
      />
      <div className="course-lesson-grid">
        {sharedLessonSummary.lessons.map((lesson) => (
          <Link
            className="course-lesson-card"
            href={`/learn/${courseSlug}/course-lessons/${lesson.id}`}
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
  );
}

function SharedTheorySectionFallback() {
  return (
    <section className="section-block" aria-live="polite">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">SHARED THEORY</p>
          <h2>공통 이론 레슨을 불러오고 있습니다</h2>
        </div>
      </div>
      <div className="card-skeleton" aria-hidden="true" />
    </section>
  );
}

async function SubjectsSectionLoader({
  courseSlug,
  curriculumPathPromise,
  curriculumPromise,
}: {
  courseSlug: string;
  curriculumPathPromise: Promise<CurriculumPathOverview>;
  curriculumPromise: Promise<LearnCurriculum>;
}) {
  const [curriculumPath, curriculum] = await Promise.all([
    curriculumPathPromise,
    curriculumPromise,
  ]);
  if (hasPrimaryCurriculumPath(curriculumPath)) return null;
  const hasOfficialTreeWithoutLessons = Boolean(curriculumPath);
  const heading = hasOfficialTreeWithoutLessons
    ? "기존 학습 자료"
    : "과목별 학습";
  const description = hasOfficialTreeWithoutLessons
    ? "공식 커리큘럼은 준비되어 있지만 연결된 레슨이 아직 부족해 기존 과목 구조로 학습을 제공합니다."
    : "공식 커리큘럼이 없는 과정은 기존 과목과 주제 구조로 학습을 제공합니다.";

  return (
    <div>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">
            {hasOfficialTreeWithoutLessons ? "LEGACY FALLBACK" : "SUBJECTS"}
          </p>
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="subject-list">
        {curriculum.map((subject, index) => (
          <Link
            className="subject-row"
            href={`/learn/${courseSlug}/subjects/${subject.id}`}
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
  );
}

function SubjectsSectionFallback() {
  return (
    <div aria-live="polite">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">SUBJECTS</p>
          <h2>과목 목록을 불러오고 있습니다</h2>
        </div>
      </div>
      <div className="subject-list" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="subject-row" key={item}>
            <span>--</span>
            <div className="card-skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function TheorySideCardLoader({
  courseSlug,
  theoryProgressViewPromise,
}: {
  courseSlug: string;
  theoryProgressViewPromise: Promise<TheoryProgressView>;
}) {
  const {
    displayedTheoryProgress,
    latestSharedLesson,
    nextSharedLesson,
    legacyTheoryProgress,
  } = await theoryProgressViewPromise;

  return (
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
          href={`/learn/${courseSlug}/course-lessons/${nextSharedLesson.id}`}
        >
          다음 추천 · {publicCopy(nextSharedLesson.title)}
        </Link>
      ) : legacyTheoryProgress?.nextLesson ? (
        <Link
          className="button button-dark full-width"
          href={`/learn/${courseSlug}/lessons/${legacyTheoryProgress.nextLesson.id}`}
        >
          다음 추천 · {publicCopy(legacyTheoryProgress.nextLesson.title)}
        </Link>
      ) : (
        <span className="sample-label">공개 레슨 학습 완료</span>
      )}
    </div>
  );
}

function TheorySideCardFallback() {
  return (
    <div className="side-card" aria-live="polite">
      <span className="eyebrow">THEORY</span>
      <h3>이론 학습을 불러오고 있습니다</h3>
      <div className="card-skeleton" aria-hidden="true" />
    </div>
  );
}

async function SpecializationSideCardLoader({
  courseSlug,
  specializationsPromise,
}: {
  courseSlug: string;
  specializationsPromise: Promise<CourseSpecializations>;
}) {
  const specializations = await specializationsPromise;
  if (!specializations.length) return null;

  return (
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
            ? `/practical/${courseSlug}`
            : `/specialized/${courseSlug}`
        }
      >
        특화 학습 열기
      </Link>
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
type CurriculumPathOverview = Awaited<
  ReturnType<typeof getPublishedCurriculumPathOverviewForCourse>
>;

async function CurriculumPathLoader({
  courseSlug,
  curriculumPathPromise,
}: {
  courseSlug: string;
  curriculumPathPromise: Promise<CurriculumPathOverview>;
}) {
  const path = await curriculumPathPromise;
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
  const hasLinkedLessons = hasPrimaryCurriculumPath(path);
  return (
    <section className="curriculum-path-section section-block">
      {hasLinkedLessons ? (
        <div className="curriculum-path-summary">
          <ProgressBar
            value={path.progressPercent}
            label={`커리큘럼 연결 레슨 ${path.completedLinkedLessons}/${path.linkedLessonCount} 완료`}
          />
        </div>
      ) : null}
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">OFFICIAL CURRICULUM</p>
          <h2>공식 커리큘럼</h2>
          <p>
            {path.tree.title} · v{path.tree.version}
            {path.tree.effectiveFrom ? ` · 기준일 ${path.tree.effectiveFrom}` : ""}
          </p>
          {!hasLinkedLessons ? (
            <p>
              공식 분류는 준비되어 있지만 연결된 학습 레슨이 아직 부족합니다.
              아래 기존 학습 자료로 먼저 학습을 이어갈 수 있습니다.
            </p>
          ) : null}
        </div>
        <span className="count-label">{path.nodeCount}개 노드</span>
      </div>
      <LearnCurriculumPathTree courseSlug={courseSlug} nodes={path.nodes} />
    </section>
  );
}
