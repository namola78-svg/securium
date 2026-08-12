import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/state-ui";
import styles from "@/components/v2/learn-experience.module.css";
import {
  getSubjectTheoryProgress,
  listPublishedLearningUnitsForSubject,
} from "@/db/lesson-repositories";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
  getSubjectById,
  listTopicsForSubject,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "과목 학습 | Securium",
  description: "과목의 주제와 레슨을 순서대로 확인하고 학습을 이어가세요.",
};

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ courseSlug: string; subjectId: string }>;
}) {
  const { courseSlug, subjectId } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}/subjects/${subjectId}`);
  const [course, subject] = await Promise.all([
    getPublicCourseBySlug(courseSlug),
    getSubjectById(subjectId),
  ]);
  if (!course || !subject || subject.courseId !== course.id) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);

  const [topics, learningUnits, theoryProgress] = await Promise.all([
    listTopicsForSubject(subject.id),
    listPublishedLearningUnitsForSubject(user.id, course.id, subject.id),
    getSubjectTheoryProgress(user.id, course.id, subject.id),
  ]);
  const allLessons = learningUnits.flatMap((unit) => unit.lessons);
  const nextLesson = allLessons.find((lesson) => lesson.status !== "COMPLETED") ?? allLessons[0];

  return (
    <main className={styles.page} data-learn-subject-v2="">
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="현재 위치">
          <Link href="/dashboard">대시보드</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/learn/${course.slug}`}>{course.shortName}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{subject.name}</span>
        </nav>

        <header className={styles.subjectHeader}>
          <div>
            <p className={styles.eyebrow}>과목 학습</p>
            <h1>{subject.name}</h1>
            <p>{publicCopy(subject.description) || "이 과목의 핵심 개념을 순서대로 학습하세요."}</p>
          </div>
          <div className={styles.subjectProgress}>
            <strong>{theoryProgress.progressPercent}%</strong>
            <ProgressBar value={theoryProgress.progressPercent} label="과목 이론 진도" />
            <span>{theoryProgress.completedLessons}/{theoryProgress.totalLessons} 레슨 완료</span>
          </div>
        </header>

        {nextLesson ? (
          <section className={styles.subjectNext} aria-labelledby="subject-next-title">
            <div>
              <p className={styles.eyebrow}>지금 배울 내용</p>
              <h2 id="subject-next-title">{publicCopy(nextLesson.title)}</h2>
              <p>{publicCopy(nextLesson.summary)}</p>
            </div>
            <Link className={styles.primaryButton} href={`/learn/${course.slug}/lessons/${nextLesson.id}`}>
              {nextLesson.status === "IN_PROGRESS" ? "이어서 학습" : "레슨 시작"}
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="lesson-order-title">
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>학습 순서</p>
              <h2 id="lesson-order-title">핵심 개념을 레슨으로 익히기</h2>
              <span>내부 구조 대신 실제로 읽을 레슨 순서만 보여줍니다.</span>
            </div>
          </header>
          {learningUnits.length ? (
            <div className={styles.unitList}>
              {learningUnits.map((unit, unitIndex) => (
                <section className={styles.unit} key={unit.id}>
                  <header>
                    <span>{String(unitIndex + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{unit.topicName ?? "과목 공통"}</small>
                      <h3>{publicCopy(unit.title)}</h3>
                      <p>{publicCopy(unit.description)}</p>
                    </div>
                    <strong>{unit.progressPercent}%</strong>
                  </header>
                  <div className={styles.lessonList}>
                    {unit.lessons.map((lesson, lessonIndex) => (
                      <Link
                        className={styles.lessonRow}
                        href={`/learn/${course.slug}/lessons/${lesson.id}`}
                        key={lesson.id}
                        aria-current={lesson.id === nextLesson?.id ? "step" : undefined}
                      >
                        <span className={styles.lessonNumber}>{String(lessonIndex + 1).padStart(2, "0")}</span>
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
                          <h4>{publicCopy(lesson.title)}</h4>
                          <p>{publicCopy(lesson.summary)}</p>
                        </div>
                        <span className={styles.lessonMeta}>{lesson.estimatedMinutes}분</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="아직 공개된 이론 콘텐츠가 없습니다"
              description="콘텐츠가 준비되면 이곳에서 학습 순서와 레슨을 확인할 수 있습니다."
              action={{ href: `/practice/${course.slug}`, label: "문제 연습하기" }}
              secondaryAction={{ href: `/learn/${course.slug}`, label: "과정으로 돌아가기" }}
            />
          )}
        </section>

        {topics.length ? (
          <details className={styles.topicDisclosure}>
            <summary>
              <span>
                <b>이 과목에서 다루는 주제</b>
                <small>전체 주제 {topics.length}개</small>
              </span>
            </summary>
            <ul className={styles.topicList}>
              {topics.map((topic) => (
                <li key={topic.id}>
                  <strong>{topic.name}</strong>
                  <span>{publicCopy(topic.description) || "학습 레슨에서 핵심 개념을 확인합니다."}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </main>
  );
}
