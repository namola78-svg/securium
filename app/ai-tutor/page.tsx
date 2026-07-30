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
          <p className="eyebrow">AI TUTOR</p>
          <h1>AI 튜터</h1>
          <p>
            문제풀이 후 핵심 의도, 정답 이유, 오답 이유를 학습 보조 설명으로
            확인하고 취약 영역 복습으로 이어갈 수 있습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>AI 튜터로 할 수 있는 일</h2>
            <ul className="feature-list">
              <li>문제풀이 결과를 바탕으로 정답과 오답 이유를 이해합니다.</li>
              <li>관련 기준, 법령, 이론 콘텐츠를 함께 확인합니다.</li>
              <li>반복 오답과 취약 주제를 기준으로 복습 방향을 정합니다.</li>
              <li>AI 설명은 참고용이며 공식 기준·법령·채점 결과가 아닙니다.</li>
            </ul>
          </article>

          <article className="course-detail-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">START POINTS</p>
                <h2>AI 해설을 시작할 수 있는 과정</h2>
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
                      <p>문제를 푼 뒤 AI 해설 버튼으로 설명을 확인하세요.</p>
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
            <p className="eyebrow">RECOMMENDED</p>
            <h2>오늘 참고할 학습 추천</h2>
            <EmptyState
              title="AI 맞춤 추천을 준비하고 있습니다"
              description="문제풀이와 복습 기록이 쌓이면 추천 학습과 AI 해설을 더 정교하게 연결할 예정입니다."
              action={{ href: "/practice", label: "문제풀이 시작" }}
            />
          </article>
        </div>
      </section>
    </main>
  );
}
