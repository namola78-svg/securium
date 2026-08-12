import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/v2/review-v2.module.css";
import { getReviewSummary } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "오늘의 복습 | SECURIUM",
  description: "오답과 다시 확인할 개념을 학습 일정에 맞춰 복습합니다.",
};

export default async function ReviewsPage() {
  const user = await requireCurrentAppUser("/reviews");
  const summary = await getReviewSummary(user.id);
  const hasDue = summary.dueCount > 0;
  const firstItem = summary.items[0];
  const primaryCourse = firstItem
    ? { slug: firstItem.courseSlug }
    : summary.byCourse[0];
  const primaryHref = primaryCourse
    ? `/practice/${primaryCourse.slug}?reviewOnly=1&count=50`
    : "/practice";
  const repeatedCount = summary.items.filter((item) => item.consecutiveWrong > 1).length;

  return (
    <main className={styles.page} data-review-v2="">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>학습 일정</p>
            <h1>오늘의 복습</h1>
            <p>오답과 다시 확인할 개념을 학습 일정에 맞춰 복습하세요.</p>
          </div>
          <Link className={styles.secondaryAction} href="/wrong-notes">오답노트 보기</Link>
        </header>

        <section className={styles.reviewHero} aria-labelledby="review-today-title" data-review-overview-panel="">
          <div className={styles.reviewLead}>
            <p className={styles.eyebrow}>오늘 먼저 복습할 항목</p>
            <h2 id="review-today-title">
              {hasDue
                ? `${summary.dueCount}개 항목이 복습을 기다리고 있어요.`
                : summary.completedToday > 0
                  ? "오늘 복습을 모두 마쳤습니다."
                  : "오늘 예정된 복습이 없습니다."}
            </h2>
            <p>
              {hasDue
                ? "기존 학습 일정과 우선순위 순서대로 집중 복습을 시작합니다."
                : "문제를 풀고 결과를 확인하면 학습 기록에 따라 복습 항목이 만들어집니다."}
            </p>
            <Link className={styles.primaryAction} href={primaryHref}>
              {hasDue ? "복습 시작" : "문제 풀기"}<span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className={styles.reviewSummary} aria-label="복습 요약">
            <div className={styles.summaryHeading}>
              <p className={styles.eyebrow}>복습 요약</p>
              <strong>{hasDue ? "오늘 학습할 범위" : "오늘 학습 상태"}</strong>
            </div>
            <dl className={styles.summaryMetrics}>
              <div><dt>오늘 복습</dt><dd>{summary.dueCount}개</dd></div>
              <div><dt>반복 오답</dt><dd>{repeatedCount}개</dd></div>
              <div><dt>과정</dt><dd>{summary.byCourse.length}개</dd></div>
            </dl>
            {summary.overdueCount > 0 ? <p className={styles.summaryNotice}>예정일이 지난 항목 {summary.overdueCount}개가 포함되어 있습니다.</p> : null}
          </div>
        </section>

        {summary.items.length ? (
          <section className={styles.section} aria-labelledby="review-priority-title">
            <header className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>집중 복습</p><h2 id="review-priority-title">먼저 확인할 항목</h2></div>
              <p>현재 복습 일정의 순서를 유지해 최대 5개 항목을 보여줍니다.</p>
            </header>
            <ol className={styles.priorityList}>
              {summary.items.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <div className={styles.itemBody}>
                    <div className={styles.itemMeta}>
                      <span>{item.courseName}</span>
                      <span>{formatType(item.targetType)}</span>
                      {item.consecutiveWrong > 1 ? <span className={styles.warningBadge}>반복 오답 {item.consecutiveWrong}회</span> : null}
                    </div>
                    <strong>{formatTitle(item)}</strong>
                    <p>{formatReviewDate(item.nextReviewAt)}</p>
                  </div>
                  <Link className={styles.rowAction} href={`/practice/${item.courseSlug}?reviewOnly=1&count=50`}>복습하기</Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {summary.byCourse.length ? (
          <section className={styles.section} aria-labelledby="review-course-title">
            <header className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>과정별 복습</p><h2 id="review-course-title">과정별로 이어서 학습</h2></div>
            </header>
            <ul className={styles.courseList}>
              {summary.byCourse.map((course) => (
                <li key={course.courseId}>
                  <div><strong>{course.name}</strong><span>{course.count}개 복습 예정</span></div>
                  <Link className={styles.rowAction} href={`/practice/${course.slug}?reviewOnly=1&count=50`}>복습 시작</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className={styles.emptyState} aria-labelledby="review-empty-title">
            <span className={styles.emptyMark} aria-hidden="true">✓</span>
            <h2 id="review-empty-title">오늘 예정된 복습이 없습니다.</h2>
            <p>문제를 풀고 결과를 확인하면 학습 기록에 따라 복습 항목이 만들어집니다.</p>
            <Link className={styles.primaryAction} href="/practice">문제 풀기<span aria-hidden="true">→</span></Link>
          </section>
        )}
      </div>
    </main>
  );
}

function formatType(type: string) {
  const labels: Record<string, string> = {
    QUESTION: "문제",
    MOCK_EXAM_QUESTION: "모의고사 문제",
    WRONG_NOTE: "오답",
    MOCK_EXAM_WRONG: "모의고사 오답",
    CONTENT: "학습 콘텐츠",
    TOPIC: "개념",
  };
  return labels[type] ?? "학습 항목";
}

function formatTitle(item: { questionTitle: string | null; targetType: string }) {
  return item.questionTitle || `${formatType(item.targetType)} 다시 확인`;
}

function formatReviewDate(value: string) {
  const today = new Date().toISOString().slice(0, 10);
  const date = value.slice(0, 10);
  return date <= today ? "오늘 복습" : `${date} 복습 예정`;
}
