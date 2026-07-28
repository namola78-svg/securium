import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseEnrollAction } from "@/components/course-enroll-action";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import {
  getPublicCourseBySlugCached,
  listCurriculumCached,
} from "@/lib/cached-catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getPublicCourseBySlugCached(courseSlug);
  return course
    ? { title: course.name, description: course.description }
    : { title: "과정을 찾을 수 없음" };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseSlug } = await params;
  const course = await getPublicCourseBySlugCached(courseSlug);
  if (!course) notFound();

  const [curriculum, identity] = await Promise.all([
    listCurriculumCached(course.id),
    getOptionalCurrentAppUser(),
  ]);

  return (
    <main className="page-main">
      <section className="course-detail-hero">
        <div className="shell course-detail-grid">
          <div>
            <Link className="breadcrumb" href="/courses">
              ← 과정 목록
            </Link>
            <p className="eyebrow light">{course.groupName}</p>
            <h1>{course.name}</h1>
            <p>{course.description}</p>
            <div className="hero-tags">
              <span>{course.totalLevels}단계</span>
              <span>통과 기준 {course.passingScore}점</span>
              {course.isSample ? <span>개발용 샘플</span> : null}
            </div>
          </div>
          <aside className="enroll-panel">
            <span className="eyebrow">START LEARNING</span>
            <h2>이 과정을 내 학습에 추가</h2>
            <p>수강 후 과정별 진도와 단계가 다른 과정과 분리되어 기록됩니다.</p>
            <CourseEnrollAction
              courseId={course.id}
              courseSlug={course.slug}
              initialSignedIn={Boolean(identity)}
            />
          </aside>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CURRICULUM</p>
              <h2>과목과 주제</h2>
            </div>
            <span className="count-label">{curriculum.length}개 과목</span>
          </div>
          <div className="curriculum-list">
            {curriculum.map((subject, index) => (
              <article key={subject.id} className="curriculum-item">
                <span className="curriculum-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{subject.name}</h3>
                  <p>{subject.description}</p>
                  <ul>
                    {subject.topics.map((topic) => (
                      <li key={topic.id}>
                        {topic.name}
                        {topic.isSample ? (
                          <span className="sample-label">샘플 · 준비 중</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
