import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnCurriculumPathTree } from "@/components/learn-curriculum-path-tree";
import { ProgressBar } from "@/components/progress-bar";
import styles from "@/components/v2/learn-experience.module.css";
import { getPublishedCurriculumPathOverviewForCourse } from "@/db/curriculum-repositories";
import { getCourseTheoryProgress } from "@/db/lesson-repositories";
import { getLearnCourseActivitySummary } from "@/db/phase3-repositories";
import { getLearnCourseAccessBySlug, listCurriculumForLearnOverview } from "@/db/repositories";
import { getPublishedCourseLessonProgressSummary } from "@/db/shared-content-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";
import { hasPrimaryCurriculumPath } from "@/lib/services/learn-overview-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "학습 개요 | Securium",
  description: "현재 과정과 다음 학습을 확인하고 핵심 레슨을 이어가세요.",
};

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}`);
  const { course, enrollment } = await getLearnCourseAccessBySlug(user.id, courseSlug);

  if (!course) notFound();
  if (!enrollment) redirect(`/courses/${course.slug}`);

  const [activity, curriculum, curriculumPath, lessonSummary, legacyTheory] =
    await Promise.all([
      getLearnCourseActivitySummary(user.id, course.id),
      listCurriculumForLearnOverview(course.id),
      getPublishedCurriculumPathOverviewForCourse(course.id, user.id),
      getPublishedCourseLessonProgressSummary(user.id, course.id),
      getCourseTheoryProgress(user.id, course.id),
    ]);

  const theory = lessonSummary.totalLessons ? lessonSummary : legacyTheory;
  const nextLesson = lessonSummary.nextLesson ?? legacyTheory?.nextLesson ?? null;
  const continueHref = nextLesson
    ? lessonSummary.nextLesson
      ? `/learn/${course.slug}/course-lessons/${nextLesson.id}`
      : `/learn/${course.slug}/lessons/${nextLesson.id}`
    : `/practice/${course.slug}?random=1&count=10`;
  const isSecurityCertificationCourse =
    course.id === "course-ise" || course.id === "course-isie";

  return (
    <main className={styles.page} data-learn-overview-v2="">
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="현재 위치">
          <Link href="/dashboard">대시보드</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{course.shortName}</span>
        </nav>

        <header className={styles.courseHeader}>
          <p className={styles.eyebrow}>{course.groupName}</p>
          <h1>{course.name}</h1>
          <p>복잡한 과정 구조보다 지금 배울 내용부터 확인하세요.</p>
        </header>

        <section className={styles.overviewGrid} aria-label="현재 과정 학습 상태">
          <article className={styles.nextLearning} data-learn-primary="">
            <p className={styles.eyebrow}>다음 학습</p>
            <h2>{nextLesson ? publicCopy(nextLesson.title) : "문제로 학습 시작하기"}</h2>
            <p>
              {nextLesson
                ? "최근 학습 흐름을 이어서 핵심 개념을 확인합니다."
                : "공개된 다음 레슨이 없어 문제 연습으로 이동합니다."}
            </p>
            <div className={styles.nextMeta}>
              <span>{theory.completedLessons}/{theory.totalLessons} 레슨 완료</span>
              {activity.dueReviewCount > 0 ? (
                <span>오늘 복습 {activity.dueReviewCount}개</span>
              ) : null}
            </div>
            <Link className={styles.primaryButton} href={continueHref}>
              {nextLesson ? "이어서 학습" : "문제 연습하기"}
              <span aria-hidden="true">→</span>
            </Link>
          </article>

          <aside className={styles.progressCard} aria-labelledby="course-progress-title">
            <div className={styles.progressTitle}>
              <div>
                <p className={styles.eyebrow}>학습 상태</p>
                <h2 id="course-progress-title">전체 이론 진도</h2>
              </div>
              <strong>{theory.progressPercent}%</strong>
            </div>
            <ProgressBar value={theory.progressPercent} label="전체 이론 학습 진도" />
            <p>완료한 레슨 {theory.completedLessons}개 · 전체 {theory.totalLessons}개</p>
          </aside>
        </section>

        <nav className={styles.secondaryActions} aria-label="과정 보조 학습">
          <Link href={`/practice/${course.slug}?random=1&count=10`}>문제 풀기</Link>
          <Link href={`/practice/${course.slug}?reviewOnly=1&count=50`}>
            {activity.dueReviewCount > 0
              ? `예정된 복습 ${activity.dueReviewCount}개`
              : "복습 확인"}
          </Link>
          <Link href={`/analytics/${course.id}`}>학습 분석 보기</Link>
        </nav>

        {lessonSummary.totalLessons ? (
          <section className={styles.section} aria-labelledby="course-lessons-title">
            <SectionHeading
              eyebrow="과정 구성"
              title="순서대로 배우는 핵심 레슨"
              description="현재 위치와 완료 상태를 확인하고 다음 레슨으로 이동하세요."
              id="course-lessons-title"
              aside={`${lessonSummary.completedLessons}/${lessonSummary.totalLessons} 완료`}
            />
            <div className={styles.lessonList}>
              {lessonSummary.lessons.map((lesson, index) => (
                <Link
                  className={styles.lessonRow}
                  href={`/learn/${course.slug}/course-lessons/${lesson.id}`}
                  key={lesson.id}
                  aria-current={lesson.id === nextLesson?.id ? "step" : undefined}
                >
                  <span className={styles.lessonNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className={styles.statusLine}>
                      <span data-status={lesson.status}>
                        {lesson.status === "COMPLETED"
                          ? "완료"
                          : lesson.status === "IN_PROGRESS"
                            ? "학습 중"
                            : "시작 전"}
                      </span>
                      {lesson.id === nextLesson?.id ? <b>현재 학습</b> : null}
                    </div>
                    <h3>{publicCopy(lesson.title)}</h3>
                    <p>{publicCopy(lesson.summary)}</p>
                  </div>
                  <span className={styles.lessonMeta}>{lesson.estimatedMinutes}분</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {curriculum.length && !isSecurityCertificationCourse ? (
          <section className={styles.section} aria-labelledby="subjects-title">
            <SectionHeading
              eyebrow="과목별 학습"
              title="과목과 주제 살펴보기"
              description="필요한 과목을 선택해 주제와 레슨을 확인하세요."
              id="subjects-title"
              aside={`${curriculum.length}개 과목`}
            />
            <div className={styles.subjectList}>
              {curriculum.map((subject, index) => (
                <Link
                  className={styles.subjectRow}
                  href={`/learn/${course.slug}/subjects/${subject.id}`}
                  key={subject.id}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{subject.name}</h3>
                    <p>{publicCopy(subject.description)}</p>
                  </div>
                  <strong>{subject.theoryProgress.progressPercent}%</strong>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {curriculumPath ? (
          <details className={styles.curriculumDisclosure} data-learn-curriculum="">
            <summary>
              <span>
                <b>{isSecurityCertificationCourse ? "필기·실기 과정 구성" : "전체 커리큘럼"}</b>
                <small>필요할 때 전체 학습 범위를 펼쳐볼 수 있습니다.</small>
              </span>
              <strong>{curriculumPath.nodeCount}개 항목</strong>
            </summary>
            <div className={styles.curriculumBody}>
              {hasPrimaryCurriculumPath(curriculumPath) ? (
                <ProgressBar
                  value={curriculumPath.progressPercent}
                  label={`커리큘럼 진도 ${curriculumPath.completedLinkedLessons}/${curriculumPath.linkedLessonCount} 완료`}
                />
              ) : null}
              <LearnCurriculumPathTree courseSlug={course.slug} nodes={curriculumPath.nodes} />
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}

function SectionHeading({
  aside,
  description,
  eyebrow,
  id,
  title,
}: {
  aside?: string;
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <header className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <span>{description}</span>
      </div>
      {aside ? <strong>{aside}</strong> : null}
    </header>
  );
}
