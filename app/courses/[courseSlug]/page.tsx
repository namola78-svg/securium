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
import { getPublicCourseAvailability, getPublicCourseAvailabilityState } from "@/lib/services/course-availability";

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
  const [curriculum, identity, availability] = await Promise.all([listCurriculumCached(course.id), getOptionalCurrentAppUser(), getPublicCourseAvailability(course.id)]);
  const enrollment = identity ? await getEnrollmentForCourse(identity.id, course.id) : null;
  const description = courseDescription(course.description);
  const topicCount = safeCount(course.topicCount) || curriculum.reduce((sum, subject) => sum + subject.topics.length, 0);
  const questionCount = safeCount(course.questionCount);
  const availabilityState = getPublicCourseAvailabilityState(availability);
  const contentMissing = availabilityState === "NO_PUBLISHED_LEARNER_CONTENT";
  const learnerHref = availabilityState === "QUESTION_CONTENT"
    ? `/practice/${course.slug}`
    : `/learn/${course.slug}`;
  const learnerActionLabel = availabilityState === "QUESTION_CONTENT"
    ? "문제 콘텐츠 확인"
    : "이론 콘텐츠 보기";
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
          <div><dt>구성 주제 수</dt><dd>{formatCount(topicCount, "개", "주제 정보 없음")}</dd></div><div><dt>연결 문제 수</dt><dd>{formatCount(questionCount, "문제", "연결 문제 없음")}</dd></div>
          <div><dt>합격 기준</dt><dd>{course.passingScore}% 이상</dd></div><div><dt>최근 업데이트</dt><dd>{formatCourseDate(course.updatedAt)}</dd></div>
        </dl>
        <p><span className={`course-status ${contentMissing ? "planned" : "available"}`}>{availabilityLabel(availabilityState)}</span></p>
      </div><aside className="enroll-panel course-detail-cta"><span className="eyebrow">학습 경로</span><h2>확인된 콘텐츠로 이동하기</h2><p>{availabilityDescription(availabilityState)}</p>{contentMissing ? <CourseAvailabilityNotice /> : <CourseEnrollAction courseId={course.id} courseSlug={course.slug} learnerHref={learnerHref} learnerActionLabel={learnerActionLabel} initialSignedIn={Boolean(identity)} initialEnrollmentStatus={enrollment?.status ?? null} />}</aside></div></section>
      <section className="section course-detail-content"><div className="shell narrow">
        <article className="course-detail-section"><p className="eyebrow">{courseType} 과정</p><h2>이 과정에서 배우는 내용</h2><p>{description}</p></article>
        <article className="course-detail-section"><p className="eyebrow">추천 대상</p><h2>이런 학습자에게 적합합니다</h2><ul className="feature-list">{audience.split(/\s*[·,]\s*/).filter(Boolean).map((target) => <li key={target}>{target}</li>)}</ul></article>
        <article className="course-detail-section"><p className="eyebrow">학습 목표</p><h2>학습 후 달라지는 점</h2><ul className="feature-list">{goals.map((goal) => <li key={goal}>{goal}</li>)}</ul></article>
        <article className="course-detail-section"><div className="section-heading"><div><p className="eyebrow">학습 구성</p><h2>커리큘럼</h2></div><span className="count-label">{curriculum.length}개 과목</span></div><div className="curriculum-list">{curriculum.length ? curriculum.map((subject, index) => <article key={subject.id} className="curriculum-item"><span className="curriculum-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{subject.name}</h3><p>{publicCopy(subject.description)}</p>{subject.topics.length ? <ul>{subject.topics.map((topic) => <li key={topic.id}>{topic.name}{topic.isSample ? <span className="sample-label">개설 예정</span> : null}</li>)}</ul> : <p className="muted-text">학습 주제를 준비하고 있습니다.</p>}</div></article>) : <EmptyState title="커리큘럼을 준비하고 있습니다" description="과목과 주제가 공개되면 학습 순서와 내용을 확인할 수 있습니다." />}</div></article>
        <article className="course-detail-section"><p className="eyebrow">완료 기준</p><h2>평가와 학습 진도 기준</h2><dl className="course-criteria-list"><div><dt>합격 기준</dt><dd>{course.passingScore}% 이상</dd></div><div><dt>학습 단계</dt><dd>{course.totalLevels}단계 기반으로 진행</dd></div><div><dt>진도 관리</dt><dd>문제풀이와 이론 학습 기록을 과정별로 관리합니다.</dd></div></dl></article>
        <article className="course-detail-section course-detail-bottom-cta"><div><p className="eyebrow">다음 행동</p><h2>확인된 콘텐츠 살펴보기</h2><p>{availabilityDescription(availabilityState)}</p></div>{contentMissing ? <CourseAvailabilityNotice /> : <CourseEnrollAction courseId={course.id} courseSlug={course.slug} learnerHref={learnerHref} learnerActionLabel={learnerActionLabel} initialSignedIn={Boolean(identity)} initialEnrollmentStatus={enrollment?.status ?? null} />}</article>
      </div></section>
    </main>
  );
}

function availabilityLabel(state: ReturnType<typeof getPublicCourseAvailabilityState>) {
  switch (state) {
    case "THEORY_CONTENT": return "이론 콘텐츠 있음";
    case "QUESTION_CONTENT": return "문제 콘텐츠 있음";
    case "THEORY_AND_QUESTION_CONTENT": return "이론·문제 콘텐츠 있음";
    case "NO_PUBLISHED_LEARNER_CONTENT": return "콘텐츠 준비 중";
  }
}

function availabilityDescription(state: ReturnType<typeof getPublicCourseAvailabilityState>) {
  switch (state) {
    case "THEORY_CONTENT": return "게시된 이론 콘텐츠 연결을 확인했습니다. 로그인·등록 상태에 따라 이론 학습 경로가 열립니다.";
    case "QUESTION_CONTENT": return "게시된 문제 연결을 확인했습니다. 로그인·등록 상태에 따라 문제 콘텐츠 화면이 열립니다. 실제 응시 가능 여부는 해당 화면에서 확인하세요.";
    case "THEORY_AND_QUESTION_CONTENT": return "게시된 이론·문제 연결을 확인했습니다. 로그인·등록 상태에 따라 이론 학습 경로가 열립니다.";
    case "NO_PUBLISHED_LEARNER_CONTENT": return "현재 게시된 이론·문제 콘텐츠 연결을 확인하지 못했습니다.";
  }
}

function CourseAvailabilityNotice() { return <div className="enroll-action course-unavailable" aria-live="polite"><span className="course-status planned">콘텐츠 준비 중</span><p>게시된 이론 또는 문제 콘텐츠 연결이 확인되면 이곳에서 해당 콘텐츠 화면으로 이동할 수 있습니다.</p></div>; }
