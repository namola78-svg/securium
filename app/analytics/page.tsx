import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { ProgressBar } from "@/components/progress-bar";
import { getIntegratedStatistics } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import styles from "./analytics-v2.module.css";

export const dynamic = "force-dynamic";

type IntegratedAnalytics = Awaited<ReturnType<typeof getIntegratedStatistics>>;

export default async function IntegratedAnalyticsPage() {
  const user = await requireCurrentAppUser("/analytics");
  const analytics = await getIntegratedStatistics(user.id);
  const coursesWithAttempts = analytics.courses.filter(
    (course) => course.stats.totalQuestions > 0,
  );
  const topCourse = coursesWithAttempts
    .slice()
    .sort((a, b) => a.stats.overallAccuracy - b.stats.overallAccuracy)[0];
  const hasLearningData = analytics.enrolledCourses > 0;
  const hasQuestionData = analytics.totalQuestions > 0;

  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <header className={`dashboard-intro ${styles.header}`}>
          <div>
            <p className="eyebrow">LEARNING ANALYTICS</p>
            <h1>학습 분석</h1>
            <p>학습 기록과 취약 영역을 확인하고 다음 학습을 결정하세요.</p>
          </div>
          <ActionButton
            href={topCourse ? `/analytics/${topCourse.courseId}` : "/practice"}
            variant="dark"
          >
            {topCourse ? "취약 영역 확인" : "문제 풀기"}
          </ActionButton>
        </header>

        <section className={styles.summarySection} aria-labelledby="analytics-summary-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">현재 학습 상태</p>
              <h2 id="analytics-summary-title">학습 결과 요약</h2>
            </div>
            <p>{hasQuestionData ? "누적 문제풀이 기록을 기준으로 집계했습니다." : "문제를 풀면 정답률과 취약 영역을 확인할 수 있습니다."}</p>
          </div>
          <dl className={styles.metrics}>
            <Metric label="정답률" value={hasQuestionData ? `${analytics.overallAccuracy}%` : "기록 없음"} />
            <Metric label="문제 풀이" value={`${analytics.totalQuestions}개`} />
            <Metric label="학습일" value={`${analytics.cumulativeStudyDays}일`} />
            <Metric label="수강 과정" value={`${analytics.enrolledCourses}개`} />
          </dl>
        </section>

        {!hasLearningData ? (
          <section className={styles.emptyState} aria-labelledby="analytics-empty-title">
            <p className="eyebrow">분석 준비</p>
            <h2 id="analytics-empty-title">아직 학습 기록이 충분하지 않습니다.</h2>
            <p>학습을 시작하면 문제풀이와 학습 기록을 바탕으로 분석 결과를 확인할 수 있습니다.</p>
            <ActionButton href="/courses" variant="dark">학습 시작하기</ActionButton>
          </section>
        ) : (
          <>
            <section className={styles.primaryGrid} aria-label="취약 영역과 다음 학습 행동">
              <article className={styles.weaknessPanel} aria-labelledby="top-weakness-title">
                <div className={styles.panelLabel}>우선 확인</div>
                <div className={styles.panelHeading}>
                  <div>
                    <p className="eyebrow">취약 영역</p>
                    <h2 id="top-weakness-title">
                      {topCourse ? topCourse.courseName : "아직 확인된 취약 영역이 없습니다."}
                    </h2>
                  </div>
                  {topCourse ? <span className={styles.accuracyBadge}>정답률 {topCourse.stats.overallAccuracy}%</span> : null}
                </div>
                <p>
                  {topCourse
                    ? `${topCourse.stats.totalQuestions}개 문제 기록 중 정답률이 가장 낮은 수강 과정입니다.`
                    : "문제를 풀면 과정별 정답률을 비교해 먼저 확인할 영역을 보여드립니다."}
                </p>
                {topCourse ? (
                  <div className={styles.primaryAction}>
                    <ActionButton variant="dark" href={`/analytics/${topCourse.courseId}`}>과정 분석 보기</ActionButton>
                    <Link href={`/practice/${topCourse.courseSlug}?count=10`}>바로 문제 풀기</Link>
                  </div>
                ) : <ActionButton variant="dark" href="/practice">문제 풀기</ActionButton>}
              </article>

              <aside className={styles.nextPanel} aria-labelledby="next-action-title">
                <p className="eyebrow">NEXT ACTION</p>
                <h2 id="next-action-title">다음 학습으로 연결</h2>
                <nav aria-label="분석 결과 다음 행동">
                  <Link href="/reviews"><span>복습 일정</span><strong>오늘의 복습 확인</strong></Link>
                  <Link href="/wrong-notes"><span>반복 오답</span><strong>오답노트 확인</strong></Link>
                  <Link href={topCourse ? `/practice/${topCourse.courseSlug}?count=10` : "/practice"}><span>문제풀이</span><strong>문제로 다시 확인</strong></Link>
                </nav>
              </aside>
            </section>

            <AnalyticsCourseActions analytics={analytics} />
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function AnalyticsCourseActions({ analytics }: { analytics: IntegratedAnalytics }) {
  return (
    <section className={styles.courseSection} aria-labelledby="course-performance-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className="eyebrow">과정별 성과</p>
          <h2 id="course-performance-title">과정별 학습 상태</h2>
        </div>
        <p>정답률과 이론 학습 진도를 실제 누적 기록으로 비교합니다.</p>
      </div>
      <ul className={styles.courseList}>
        {analytics.courses.map((course) => (
          <li key={course.courseId}>
            <div className={styles.courseIdentity}>
              <Link href={`/analytics/${course.courseId}`}>{course.courseName}</Link>
              <span>{course.stats.totalQuestions}문제 풀이</span>
            </div>
            <div className={styles.courseProgress}>
              <div><span>정답률</span><strong>{course.stats.totalQuestions ? `${course.stats.overallAccuracy}%` : "기록 없음"}</strong></div>
              <ProgressBar value={course.stats.overallAccuracy} label={`${course.courseName} 정답률`} />
            </div>
            <dl className={styles.courseFacts}>
              <div><dt>단계 완료</dt><dd>{course.stats.levelCompletionRate}%</dd></div>
              <div><dt>이론 학습</dt><dd>{course.stats.theoryProgressPercent}%</dd></div>
            </dl>
            <div className={styles.rowActions}>
              <ActionButton variant="ghost" href={`/analytics/${course.courseId}`}>상세 분석</ActionButton>
              <ActionButton variant="dark" href={`/practice/${course.courseSlug}?count=10`}>문제 풀기</ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
