import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  getSubjectTheoryProgress,
  listPublishedLearningUnitsForSubject,
} from "@/db/lesson-repositories";
import { ProgressBar } from "@/components/progress-bar";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
  getSubjectById,
  listTopicsForSubject,
} from "@/db/repositories";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseSlug: string; subjectId: string }>;
};

export default async function SubjectPage({ params }: PageProps) {
  const { courseSlug, subjectId } = await params;
  return (
    <ProtectedSubject courseSlug={courseSlug} subjectId={subjectId} />
  );
}

async function ProtectedSubject({
  courseSlug,
  subjectId,
}: {
  courseSlug: string;
  subjectId: string;
}) {
  const user = await requireCurrentAppUser(
    `/learn/${courseSlug}/subjects/${subjectId}`,
  );
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

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <Link className="breadcrumb" href={`/learn/${course.slug}`}>
            ← {course.shortName} 과정
          </Link>
          <p className="eyebrow">SUBJECT</p>
          <h1>{subject.name}</h1>
          <p>{subject.description}</p>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">TOPICS</p>
              <h2>주제 목록</h2>
            </div>
          </div>
          <div className="topic-grid">
            {topics.map((topic, index) => (
              <article className="topic-card" key={topic.id}>
                <span className="topic-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{topic.name}</h3>
                <p>{topic.description}</p>
                <span className="sample-label">
                  {topic.isSample ? "개발용 샘플" : "학습 주제"}
                </span>
              </article>
            ))}
          </div>
          <div className="section-heading compact section-block">
            <div>
              <p className="eyebrow">THEORY LESSONS</p>
              <h2>본문형 이론 레슨</h2>
            </div>
            <span className="count-label">
              {theoryProgress.completedLessons}/{theoryProgress.totalLessons} 완료
            </span>
          </div>
          <ProgressBar
            value={theoryProgress.progressPercent}
            label="과목 이론 진도율"
          />
          {learningUnits.length ? (
            <div className="learning-unit-list">
              {learningUnits.map((unit, unitIndex) => (
                <section className="learning-unit-card" key={unit.id}>
                  <header>
                    <span className="lesson-list-number">
                      {String(unitIndex + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <small>{unit.topicName ?? "과목 공통"}</small>
                      <h3>{unit.title}</h3>
                      <p>{unit.description}</p>
                    </div>
                    <strong>{unit.progressPercent}%</strong>
                  </header>
                  {unit.lessons.length ? (
                    <div className="lesson-list">
                      {unit.lessons.map((lesson, lessonIndex) => (
                        <Link
                          className="lesson-list-item"
                          href={`/learn/${course.slug}/lessons/${lesson.id}`}
                          key={lesson.id}
                        >
                          <span className="lesson-list-number">
                            {String(lessonIndex + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <h4>{lesson.title}</h4>
                            <p>{lesson.summary}</p>
                          </div>
                          <div className="lesson-list-meta">
                            <span>{lesson.estimatedMinutes}분</span>
                            <strong>
                              {lesson.status === "COMPLETED"
                                ? "완료"
                                : lesson.status === "IN_PROGRESS"
                                  ? `학습 중 ${lesson.progressPercent}%`
                                  : "시작"}
                            </strong>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">공개된 레슨이 없습니다.</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>공개된 이론 레슨이 없습니다.</h3>
              <p>관리자가 이 과목의 레슨을 공개하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
