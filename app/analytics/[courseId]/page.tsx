import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/design-system-primitives";
import { getCourseStatistics } from "@/db/phase3-repositories";
import { getCourseById, getEnrollmentForCourse, listCurriculum } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import styles from "../analytics-v2.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "과정 분석 | SECURIUM",
  description: "과정별 정답률과 복습이 필요한 영역을 확인합니다.",
};

type BreakdownRow = {
  id: string;
  total: number;
  accuracy: number;
  label?: string;
  href?: string;
};

export default async function CourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireCurrentAppUser(`/analytics/${courseId}`);
  const [course, enrollment, curriculum] = await Promise.all([
    getCourseById(courseId),
    getEnrollmentForCourse(user.id, courseId),
    listCurriculum(courseId),
  ]);
  if (!course || !enrollment) notFound();

  const stats = await getCourseStatistics(user.id, courseId);
  const subjectNames = new Map(curriculum.map((subject) => [subject.id, subject.name]));
  const topicMeta = new Map(
    curriculum.flatMap((subject) =>
      subject.topics.map((topic) => [topic.id, { name: topic.name, subjectId: subject.id }] as const),
    ),
  );
  const weakTopics = [...stats.byTopic]
    .filter((item) => item.id !== "UNMAPPED" && item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy);
  const weakest = weakTopics[0];
  const weakestMeta = weakest ? topicMeta.get(weakest.id) : undefined;
  const practiceHref = weakest
    ? buildPracticeHref(course.slug, weakest.id, weakestMeta?.subjectId)
    : `/practice/${course.slug}?count=10`;
  const hasQuestionData = stats.totalQuestions > 0;

  const subjectRows = stats.bySubject.map((row) => ({
    ...row,
    label: subjectNames.get(row.id) ?? "과목 정보 확인 중",
    href: row.id === "UNMAPPED" ? undefined : `/practice/${course.slug}?subjectId=${row.id}&count=10`,
  }));
  const topicRows = weakTopics.map((row) => ({
    ...row,
    label: topicMeta.get(row.id)?.name ?? "주제 정보 확인 중",
    href: buildPracticeHref(course.slug, row.id, topicMeta.get(row.id)?.subjectId),
  }));

  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <Link className={styles.backLink} href="/analytics">학습 분석으로 돌아가기</Link>
        <header className={`dashboard-intro ${styles.header}`}>
          <div>
            <p className="eyebrow">과정 학습 분석</p>
            <h1>{course.name} 분석</h1>
            <p>문제풀이와 이론 진도를 바탕으로 먼저 보완할 영역을 확인하세요.</p>
          </div>
          <ActionButton variant="dark" href={`/practice/${course.slug}?count=10`}>문제풀이 시작</ActionButton>
        </header>

        <section className={styles.summarySection} aria-labelledby="course-summary-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">현재 학습 상태</p>
              <h2 id="course-summary-title">과정 결과 요약</h2>
            </div>
            <p>{hasQuestionData ? "누적 문제풀이와 과정 진행 기록을 기준으로 집계했습니다." : "문제를 풀면 과목별 정답률과 취약 영역을 확인할 수 있습니다."}</p>
          </div>
          <dl className={styles.metrics}>
            <Metric label="정답률" value={hasQuestionData ? `${stats.overallAccuracy}%` : "기록 없음"} />
            <Metric label="문제 풀이" value={`${stats.totalQuestions}개`} />
            <Metric label="반복 오답" value={`${stats.repeatedWrongCount}개`} />
            <Metric label="단계 완료" value={`${stats.levelCompletionRate}%`} />
          </dl>
        </section>

        <section className={styles.primaryGrid} aria-label="취약 영역과 다음 학습 행동">
          <article className={styles.weaknessPanel} aria-labelledby="course-weakness-title">
            <div className={styles.panelLabel}>우선 확인</div>
            <div className={styles.panelHeading}>
              <div>
                <p className="eyebrow">가장 취약한 영역</p>
                <h2 id="course-weakness-title">{weakest ? weakestMeta?.name ?? "확인할 주제" : "아직 확인된 취약 영역이 없습니다."}</h2>
              </div>
              {weakest ? <span className={styles.accuracyBadge}>정답률 {weakest.accuracy}%</span> : null}
            </div>
            <p>{weakest ? `${weakest.total}문제 기록에서 확인된 정답률입니다. 낮은 정답률의 주제부터 다시 확인하세요.` : "학습 기록이 더 쌓이면 주제별 정답률을 기준으로 우선 확인할 영역을 보여드립니다."}</p>
            <div className={styles.primaryAction}>
              <ActionButton variant="dark" href={practiceHref}>{weakest ? "집중 복습" : "문제 풀기"}</ActionButton>
              {stats.repeatedWrongCount > 0 ? <Link href="/wrong-notes">반복 오답 보기</Link> : <Link href="/reviews">복습 일정 보기</Link>}
            </div>
          </article>

          <aside className={styles.nextPanel} aria-labelledby="course-next-title">
            <p className="eyebrow">다음 학습 행동</p>
            <h2 id="course-next-title">기록에서 학습으로</h2>
            <nav aria-label="과정 분석 다음 행동">
              <Link href={practiceHref}><span>취약 주제</span><strong>문제로 다시 확인</strong></Link>
              <Link href="/reviews"><span>복습 일정</span><strong>오늘의 복습 확인</strong></Link>
              <Link href="/wrong-notes"><span>반복 오답</span><strong>오답노트 확인</strong></Link>
            </nav>
          </aside>
        </section>

        {hasQuestionData ? (
          <>
            <section className={styles.performanceGrid} aria-label="과목과 주제별 성과">
              <Breakdown title="과목별 성과" description="과목별 누적 정답률" rows={subjectRows} />
              <Breakdown title="취약 주제" description="정답률이 낮은 순서" rows={topicRows} />
            </section>
            <section className={styles.secondarySection} aria-labelledby="detail-analysis-title">
              <div className={styles.sectionHeading}>
                <div><p className="eyebrow">상세 데이터</p><h2 id="detail-analysis-title">문제풀이 상세</h2></div>
                <p>난이도와 문제 유형별 누적 결과입니다.</p>
              </div>
              <div className={styles.performanceGrid}>
                <Breakdown title="난이도별 정답률" rows={stats.byDifficulty} />
                <Breakdown title="문제 유형별 정답률" rows={stats.byType} />
              </div>
              <dl className={styles.detailMetrics}>
                <Metric label="최근 7일" value={`${stats.recent7Days}문제`} />
                <Metric label="최근 30일" value={`${stats.recent30Days}문제`} />
                <Metric label="평균 응답 시간" value={`${Math.round(stats.averageResponseTime / 1000)}초`} />
              </dl>
            </section>
          </>
        ) : (
          <section className={styles.emptyState} aria-labelledby="course-empty-title">
            <p className="eyebrow">문제풀이 기록</p>
            <h2 id="course-empty-title">아직 문제 풀이 기록이 없습니다.</h2>
            <p>문제를 풀면 정답률과 취약 영역을 확인할 수 있습니다.</p>
            <ActionButton href={`/practice/${course.slug}?count=10`} variant="dark">문제 풀기</ActionButton>
          </section>
        )}
      </div>
    </main>
  );
}

function buildPracticeHref(courseSlug: string, topicId: string, subjectId?: string) {
  const params = new URLSearchParams({ topicId, count: "10" });
  if (subjectId) params.set("subjectId", subjectId);
  return `/practice/${courseSlug}?${params.toString()}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Breakdown({ title, description, rows }: { title: string; description?: string; rows: BreakdownRow[] }) {
  return (
    <section className={styles.breakdown} aria-labelledby={`breakdown-${title}`}>
      <header><div><h2 id={`breakdown-${title}`}>{title}</h2>{description ? <p>{description}</p> : null}</div><span>{rows.length}개 영역</span></header>
      {rows.length ? (
        <ul>
          {rows.map((row) => {
            const value = row.accuracy;
            return (
              <li key={row.id}>
                <div className={styles.breakdownLabel}><strong>{row.label ?? formatGroupLabel(row.id)}</strong><span>{row.total}문제</span></div>
                <div className={styles.progressLine}>
                  <div role="progressbar" aria-label={`${row.label ?? formatGroupLabel(row.id)} 정답률`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                    <span style={{ width: `${value}%` }} />
                  </div>
                  <strong>{value}%</strong>
                </div>
                {row.href ? <ActionButton href={row.href} variant="ghost">문제 풀기</ActionButton> : null}
              </li>
            );
          })}
        </ul>
      ) : <p className={styles.localEmpty}>아직 충분한 학습 기록이 없습니다.</p>}
    </section>
  );
}

function formatGroupLabel(value: string) {
  const labels: Record<string, string> = {
    EASY: "쉬움",
    MEDIUM: "보통",
    HARD: "어려움",
    MULTIPLE_CHOICE: "객관식",
    TRUE_FALSE: "참·거짓",
    SHORT_ANSWER: "단답형",
    UNMAPPED: "분류되지 않은 문제",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}
