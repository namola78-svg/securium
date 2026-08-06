import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/state-ui";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI 튜터",
  description: "문제 해설과 맞춤 복습을 돕는 SECURIUM AI 튜터 안내입니다.",
};
export const dynamic = "force-dynamic";

export default async function AiTutorPage() {
  const user = await requireCurrentAppUser("/ai-tutor");
  const enrollments = await listUserEnrollments(user.id);
  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.status === "ACTIVE",
  );

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">AI 튜터</p>
          <h1>공식 기준을 근거로 이해를 돕습니다</h1>
          <p>
            문제를 푼 뒤 정답 이유, 오답 이유, 관련 기준과 복습 방향을 확인할
            수 있습니다. AI 설명은 참고용이며 공식 채점 결과를 대체하지 않습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">작동 방식</p>
            <h2>AI 튜터가 도와주는 흐름</h2>
            <ol className="ai-tutor-flow" aria-label="AI 튜터 학습 흐름">
              <li>
                <span>01</span>
                <strong>문제를 풉니다</strong>
                <p>먼저 내 답안을 제출하고 서버 채점 결과를 확인합니다.</p>
              </li>
              <li>
                <span>02</span>
                <strong>AI 설명을 요청합니다</strong>
                <p>정답 이유와 오답 이유를 참고 설명으로 확인합니다.</p>
              </li>
              <li>
                <span>03</span>
                <strong>근거를 확인합니다</strong>
                <p>관련 기준, 법령, 이론 콘텐츠가 있으면 함께 확인합니다.</p>
              </li>
              <li>
                <span>04</span>
                <strong>복습으로 이어갑니다</strong>
                <p>반복 오답과 취약 주제를 다음 학습 행동으로 연결합니다.</p>
              </li>
            </ol>
            <ul className="feature-list">
              <li>문제풀이 결과를 바탕으로 정답과 오답 이유를 설명합니다.</li>
              <li>관련 기준, 법령, 이론 콘텐츠를 근거로 함께 보여줍니다.</li>
              <li>반복 오답과 취약 주제를 기준으로 복습 방향을 제안합니다.</li>
              <li>AI 설명은 참고용이며 공식 기준·법령·채점 결과가 아닙니다.</li>
            </ul>
          </article>

          <article className="course-detail-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">시작 지점</p>
                <h2>AI 해설을 확인할 수 있는 과정</h2>
              </div>
              <Link className="text-link" href="/courses">
                과정 추가하기 →
              </Link>
            </div>
            {activeEnrollments.length ? (
              <div className="recommendation-list">
                {activeEnrollments.slice(0, 4).map((enrollment) => (
                  <Link
                    className="recommendation-card"
                    href={`/practice/${enrollment.courseSlug}?random=1&count=5`}
                    key={enrollment.id}
                  >
                    <span className="badge">{enrollment.groupName}</span>
                    <div>
                      <strong>{enrollment.courseName}</strong>
                      <p>문제를 풀고 채점 후 AI 해설 버튼으로 설명을 확인하세요.</p>
                    </div>
                    <small>5문제</small>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="AI 해설을 시작할 수 있는 수강 과정이 없습니다"
                description="먼저 과정을 내 학습에 추가한 뒤 문제풀이를 시작해 주세요."
                action={{ href: "/courses", label: "과정 둘러보기" }}
              />
            )}
          </article>

          <article className="course-detail-section">
            <p className="eyebrow">맞춤 추천</p>
            <h2>오늘 참고할 학습 추천</h2>
            <EmptyState
              title="AI 맞춤 추천을 준비하고 있습니다"
              description="문제풀이와 복습 기록이 쌓이면 추천 학습과 AI 해설이 더 정확하게 연결됩니다."
              action={{ href: "/practice", label: "문제풀이 시작" }}
            />
          </article>
        </div>
      </section>
    </main>
  );
}
