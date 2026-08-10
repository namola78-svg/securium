import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/state-ui";
import { getReviewSummary } from "@/db/phase3-repositories";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI 튜터",
  description: "문제 해설과 맞춤 복습을 돕는 SECURIUM AI 튜터 안내입니다.",
};
export const dynamic = "force-dynamic";

export default async function AiTutorPage() {
  const user = await requireCurrentAppUser("/ai-tutor");
  const [enrollments, reviewSummary] = await Promise.all([
    listUserEnrollments(user.id),
    getReviewSummary(user.id),
  ]);
  const availableEnrollments = enrollments.filter(
    (enrollment) => enrollment.status !== "CANCELLED",
  );

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">AI 튜터</p>
          <h1>공식 기준과 근거로 이해를 넓혀보세요</h1>
          <p>
            문제를 푼 뒤 정답과 오답의 이유, 관련 기준과 복습 방향을 확인하세요.
            AI 설명은 참고용이며 공식 채점 결과를 대신하지 않습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">작동 방식</p>
            <h2>AI 튜터가 이어주는 학습 흐름</h2>
            <ol className="ai-tutor-flow" aria-label="AI 튜터 학습 흐름">
              <li><span>01</span><strong>문제를 풉니다</strong><p>먼저 자신의 답을 제출하고 공식 채점 결과를 확인합니다.</p></li>
              <li><span>02</span><strong>AI 해설을 확인합니다</strong><p>정답과 오답의 이유를 참고 설명으로 확인합니다.</p></li>
              <li><span>03</span><strong>근거를 확인합니다</strong><p>관련 기준과 연결 콘텐츠가 있으면 함께 확인합니다.</p></li>
              <li><span>04</span><strong>복습으로 이어갑니다</strong><p>반복 오답과 취약 주제를 다음 학습 행동으로 연결합니다.</p></li>
            </ol>
            <ul className="feature-list">
              <li>채점 결과를 바꾸지 않고 이해를 돕는 설명만 제공합니다.</li>
              <li>공식 기준과 연결된 근거가 있을 때 함께 표시합니다.</li>
              <li>AI 설명과 공식 콘텐츠·채점 결과를 구분해 보여줍니다.</li>
              <li>AI 기능이 제공되지 않는 문제도 일반 해설로 학습할 수 있습니다.</li>
            </ul>
          </article>

          <article className="course-detail-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">시작 지점</p>
                <h2>AI 해설을 확인할 수 있는 과정</h2>
              </div>
              <Link className="text-link" href="/courses">과정 둘러보기 →</Link>
            </div>
            {availableEnrollments.length ? (
              <div className="recommendation-list">
                {availableEnrollments.slice(0, 4).map((enrollment) => (
                  <Link
                    className="recommendation-card"
                    href={`/practice/${enrollment.courseSlug}?random=1&count=5`}
                    key={enrollment.id}
                  >
                    <span className="badge">{enrollment.groupName}</span>
                    <div>
                      <strong>{enrollment.courseName}</strong>
                      <p>문제를 풀고 채점 후 AI 해설을 확인하세요.</p>
                    </div>
                    <small>5문제</small>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="AI 해설을 시작할 수 있는 수강 과정이 없습니다"
                description="먼저 과정을 추가한 뒤 문제풀이에서 AI 해설을 확인해보세요."
                action={{ href: "/courses", label: "과정 둘러보기" }}
              />
            )}
          </article>

          <article className="course-detail-section">
            <p className="eyebrow">학습 데이터 연결</p>
            <h2>현재 학습 기록에서 다음 행동을 찾습니다</h2>
            {reviewSummary.dueCount > 0 ? (
              <div className="review-context-card">
                <div>
                  <p className="eyebrow">오늘의 복습</p>
                  <h3>{reviewSummary.dueCount}개 항목을 먼저 확인하세요</h3>
                  <p>오래 미룬 복습과 반복 오답을 우선순위로 정리했습니다. AI 해설과 함께 다시 풀어보세요.</p>
                </div>
                <Link className="button button-dark" href="/reviews">복습 계획 보기</Link>
              </div>
            ) : (
              <EmptyState
                title="아직 예정된 복습이 없습니다"
                description="새 문제를 풀면 정답 여부와 학습 기록을 바탕으로 다음 복습 일정이 만들어집니다."
                action={{ href: "/practice", label: "문제풀이 시작" }}
              />
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
