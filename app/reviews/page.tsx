import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { getReviewSummary } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await requireCurrentAppUser("/reviews");
  const summary = await getReviewSummary(user.id);
  const hasDueReviews = summary.dueCount > 0;
  const topItem = summary.items[0];
  const primaryReviewCourse = summary.byCourse[0];

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">스마트 복습</p>
            <h1>오늘의 복습</h1>
            <p>
              오답과 복습 예정일을 기준으로 오늘 다시 확인할 문제를
              우선순위대로 정리합니다.
            </p>
          </div>
          <Link className="button button-ghost" href="/wrong-notes">
            전체 오답노트
          </Link>
        </header>

        <section className="review-overview-panel" aria-label="오늘의 복습 요약">
          <div>
            <p className="eyebrow">오늘의 복습 계획</p>
            <h2>
              {hasDueReviews
                ? `${summary.dueCount}문제를 먼저 복습하세요`
                : "오늘 예정된 복습이 없습니다"}
            </h2>
            <p>
              복습은 오래 미룬 항목과 반복 오답을 먼저 보여줍니다. 풀이가
              끝나면 다음 복습 간격이 자동으로 조정됩니다.
            </p>
          </div>
          <dl>
            <div>
              <dt>복습 예정</dt>
              <dd>{summary.dueCount}문제</dd>
            </div>
            <div>
              <dt>연체 복습</dt>
              <dd>{summary.overdueCount}문제</dd>
            </div>
            <div>
              <dt>예상 시간</dt>
              <dd>{summary.estimatedMinutes}분</dd>
            </div>
            <div>
              <dt>오늘 완료</dt>
              <dd>{summary.completedToday}문제</dd>
            </div>
          </dl>
        </section>

        <section className="section-block">
          <ProgressBar
            value={summary.completionRate}
            label="오늘의 복습 완료율"
          />
        </section>

        <section className="review-action-strip section-block" aria-label="복습 실행 메뉴">
          <Link
            className="review-action-card review-action-card-primary"
            href={
              primaryReviewCourse
                ? `/practice/${primaryReviewCourse.slug}?reviewOnly=1&count=50`
                : "/practice"
            }
          >
            <span>01 · 오늘 복습</span>
            <strong>
              {hasDueReviews ? "예정 문제부터 풀기" : "새 문제로 복습 일정 만들기"}
            </strong>
            <p>
              {hasDueReviews
                ? `${summary.dueCount}개 항목을 우선순위대로 정리했습니다.`
                : "문제를 풀면 정답 여부에 따라 다음 복습일이 만들어집니다."}
            </p>
          </Link>
          <Link className="review-action-card" href="/wrong-notes">
            <span>02 · 오답 정리</span>
            <strong>반복 오답 확인</strong>
            <p>메모와 숙지 상태를 보며 헷갈린 개념을 다시 정리합니다.</p>
          </Link>
          <Link className="review-action-card" href="/practice">
            <span>03 · 추가 풀이</span>
            <strong>부족한 문제 더 풀기</strong>
            <p>새 풀이 기록을 쌓아 복습 추천을 더 정확하게 만듭니다.</p>
          </Link>
        </section>

        <section className="section-block review-grid">
          {summary.byCourse.map((course) => (
            <article className="review-card review-course-card" key={course.courseId}>
              <div className="course-card-top">
                <span className="badge">{course.count}개 예정</span>
                <span className="status-on">과정별 복습</span>
              </div>
              <h2>{course.name}</h2>
              <p>예정일이 빠른 문제부터 다시 풀며 취약한 개념을 확인합니다.</p>
              <Link
                className="button button-dark"
                href={`/practice/${course.slug}?reviewOnly=1&count=50`}
              >
                복습 시작
              </Link>
            </article>
          ))}
        </section>

        {summary.items.length ? (
          <section className="section-block review-priority-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">복습 우선순위</p>
                <h2>우선 복습 항목</h2>
                <p>가장 먼저 확인할 복습 항목 5개를 보여줍니다.</p>
              </div>
            </div>
            <div className="review-workspace">
              <div className="admin-record-list">
                {summary.items.slice(0, 5).map((item, index) => (
                  <article
                    className="admin-record review-priority-item"
                    key={item.id}
                  >
                    <summary>
                      <span>
                        <small>#{index + 1} · {item.courseName}</small>
                        <strong>
                          {item.questionTitle ?? `${item.targetType} ${item.targetId}`}
                        </strong>
                        <small>
                          예정일 {item.nextReviewAt.slice(0, 10)} · 반복 오답{" "}
                          {item.consecutiveWrong}회
                        </small>
                      </span>
                      <span className="status-on">{formatTargetType(item.targetType)}</span>
                    </summary>
                  </article>
                ))}
              </div>
              <aside className="review-inspector" aria-label="복습 인스펙터">
                <p className="eyebrow">복습 인스펙터</p>
                <h2>다음 복습</h2>
                {topItem ? (
                  <>
                    <strong>{topItem.questionTitle ?? topItem.targetId}</strong>
                    <p>
                      {topItem.courseName} · 예정일{" "}
                      {topItem.nextReviewAt.slice(0, 10)}
                    </p>
                    <Link
                      className="button button-dark"
                      href={`/practice/${topItem.courseSlug}?reviewOnly=1&count=50`}
                    >
                      바로 복습하기
                    </Link>
                  </>
                ) : (
                  <p>복습 항목이 생기면 다음 행동을 안내합니다.</p>
                )}
              </aside>
            </div>
          </section>
        ) : null}

        {!hasDueReviews ? (
          <div className="empty-state">
            <strong>오늘 예정된 복습이 없습니다.</strong>
            <p>
              새 문제를 풀면 정답 여부에 따라 복습 일정이 자동으로 생성됩니다.
            </p>
            <Link className="button button-dark" href="/practice">
              문제풀이 시작
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function formatTargetType(targetType: string) {
  const labels: Record<string, string> = {
    QUESTION: "문제",
    WRONG_NOTE: "오답",
    MOCK_EXAM_WRONG: "모의고사 오답",
    CONTENT: "콘텐츠",
    TOPIC: "주제",
  };
  return labels[targetType] ?? targetType;
}
