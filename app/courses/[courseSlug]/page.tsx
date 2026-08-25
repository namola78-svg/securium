import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseEnrollAction } from "@/components/course-enroll-action";
import { EmptyState } from "@/components/state-ui";
import { getEnrollmentForCourse } from "@/db/repositories";
import { courseAudienceLabel, courseDescription, courseLearningGoals, courseTypeLabel, estimateWeeks, formatCount, formatCourseDate, safeCount } from "@/lib/course-display";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { getPublicCourseBySlugCached, listCurriculumCached } from "@/lib/cached-catalog";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ courseSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getPublicCourseBySlugCached(courseSlug);
  return course ? { title: `${course.name} | Securium`, description: courseDescription(course.description), alternates: { canonical: `/courses/${course.slug}` } } : { title: "과정을 찾을 수 없음 | Securium" };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseSlug } = await params;
  const course = await getPublicCourseBySlugCached(courseSlug);
  if (!course) notFound();
  const [curriculum, identity] = await Promise.all([listCurriculumCached(course.id), getOptionalCurrentAppUser()]);
  const enrollment = identity ? await getEnrollmentForCourse(identity.id, course.id) : null;
  const description = courseDescription(course.description);
  const topicCount = safeCount(course.topicCount) || curriculum.reduce((sum, subject) => sum + subject.topics.length, 0);
  const questionCount = safeCount(course.questionCount);
  const available = course.active && course.published && (curriculum.length > 0 || topicCount > 0 || questionCount > 0);
  const audience = courseAudienceLabel(course);
  const courseType = courseTypeLabel(course);
  const goals = courseLearningGoals(course.name);

  return (
    <main className="page-main">
      <section className="course-detail-hero"><div className="shell course-detail-grid"><div className="course-detail-intro">
        <Link className="breadcrumb" href="/courses">← 과정 목록</Link>
        <p className="eyebrow light">{course.groupName} · {courseType}</p>
        <h1>{course.name}</h1><p className="course-detail-lead">{description}</p>
        <dl className="course-fact-grid" aria-label="과정 핵심 정보">
          <div><dt>추천 대상</dt><dd>{audience}</dd></div><div><dt>예상 학습 기간</dt><dd>{estimateWeeks(course.totalLevels)}주</dd></div>
          <div><dt>공개 주제 수</dt><dd>{formatCount(topicCount, "개", "주제 업데이트 예정")}</dd></div><div><dt>공개 문제 수</dt><dd>{formatCount(questionCount, "문제", "문제 업데이트 예정")}</dd></div>
          <div><dt>합격 기준</dt><dd>{course.passingScore}% 이상</dd></div><div><dt>최근 업데이트</dt><dd>{formatCourseDate(course.updatedAt)}</dd></div>
        </dl>
      </div><aside className="enroll-panel course-detail-cta"><span className="eyebrow">학습 시작</span><h2>이 과정으로 시작하기</h2><p>수강 등록 후 과정별 진도, 문제풀이와 복습 기록을 관리할 수 있습니다.</p>{available ? <CourseEnrollAction courseId={course.id} courseSlug={course.slug} initialSignedIn={Boolean(identity)} initialEnrollmentStatus={enrollment?.status ?? null} /> : <CourseAvailabilityNotice />}</aside></div></section>
      <section className="section course-detail-content"><div className="shell narrow">
        <article className="course-detail-section"><p className="eyebrow">{courseType} 과정</p><h2>이 과정에서 배우는 내용</h2><p>{description}</p></article>
        <article className="course-detail-section"><p className="eyebrow">추천 대상</p><h2>이런 학습자에게 적합합니다</h2><ul className="feature-list">{audience.split(/\s*[·,]\s*/).filter(Boolean).map((target) => <li key={target}>{target}</li>)}</ul></article>
        <article className="course-detail-section"><p className="eyebrow">학습 목표</p><h2>학습 후 달라지는 점</h2><ul className="feature-list">{goals.map((goal) => <li key={goal}>{goal}</li>)}</ul></article>
        <article className="course-detail-section"><div className="section-heading"><div><p className="eyebrow">학습 구성</p><h2>커리큘럼</h2></div><span className="count-label">{curriculum.length}개 과목</span></div><div className="curriculum-list">{curriculum.length ? curriculum.map((subject, index) => <article key={subject.id} className="curriculum-item"><span className="curriculum-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{subject.name}</h3><p>{publicCopy(subject.description)}</p>{subject.topics.length ? <ul>{subject.topics.map((topic) => <li key={topic.id}>{topic.name}{topic.isSample ? <span className="sample-label">개설 예정</span> : null}</li>)}</ul> : <p className="muted-text">학습 주제를 준비하고 있습니다.</p>}</div></article>) : <EmptyState title="커리큘럼을 준비하고 있습니다" description="과목과 주제가 공개되면 학습 순서와 내용을 확인할 수 있습니다." />}</div></article>
        <article className="course-detail-section"><p className="eyebrow">완료 기준</p><h2>평가와 학습 진도 기준</h2><dl className="course-criteria-list"><div><dt>합격 기준</dt><dd>{course.passingScore}% 이상</dd></div><div><dt>학습 단계</dt><dd>{course.totalLevels}단계 기반으로 진행</dd></div><div><dt>진도 관리</dt><dd>문제풀이와 이론 학습 기록을 과정별로 관리합니다.</dd></div></dl></article>
        <article className="course-detail-section course-detail-bottom-cta"><div><p className="eyebrow">다음 행동</p><h2>과정을 등록하고 학습을 시작하세요</h2><p>선택한 과정의 학습 기록은 다른 과정과 분리되어 관리됩니다.</p></div>{available ? <CourseEnrollAction courseId={course.id} courseSlug={course.slug} initialSignedIn={Boolean(identity)} initialEnrollmentStatus={enrollment?.status ?? null} /> : <CourseAvailabilityNotice />}</article>
      </div></section>
    </main>
  );
}

function CourseAvailabilityNotice() { return <div className="enroll-action course-unavailable" aria-live="polite"><span className="course-status planned">개설 예정</span><p>학습 콘텐츠를 준비하고 있습니다. 과정이 공개되면 이 페이지에서 바로 시작할 수 있습니다.</p></div>; }
