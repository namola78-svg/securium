import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/state-ui";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "문제풀이",
  description: "수강 중인 과정별 문제풀이를 시작합니다.",
};
export const dynamic = "force-dynamic";

export default async function PracticeHubPage() {
  const user = await requireCurrentAppUser("/practice");
  const enrollments = await listUserEnrollments(user.id);
  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.status !== "CANCELLED",
  );

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">문제풀이</p>
          <h1>문제풀이</h1>
          <p>
            수강 중인 과정에서 문제풀이를 시작하세요. 과정별 풀이 기록과
            오답노트는 서로 분리되어 관리됩니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">내 과정</p>
              <h2>과정별 문제풀이</h2>
            </div>
            <Link className="text-link" href="/courses">
              과정 추가하기 →
            </Link>
          </div>

          {activeEnrollments.length ? (
            <div className="course-grid">
              {activeEnrollments.map((enrollment) => (
                <article className="course-card" key={enrollment.id}>
                  <div className="course-card-top">
                    <span className="course-code">{enrollment.groupName}</span>
                    <span className="course-status available">
                      {enrollment.status === "COMPLETED" ? "복습 가능" : "학습 가능"}
                    </span>
                  </div>
                  <h3>{enrollment.courseName}</h3>
                  <p className="course-summary">
                    현재 진도 {enrollment.progressPercent}% · 현재 단계{" "}
                    {enrollment.currentLevel}/{enrollment.totalLevels}
                  </p>
                  <dl className="course-comparison-list">
                    <div>
                      <dt>정답률</dt>
                      <dd>
                        {enrollment.accuracy === null
                          ? "풀이 기록 없음"
                          : `${enrollment.accuracy}%`}
                      </dd>
                    </div>
                    <div>
                      <dt>최근 학습</dt>
                      <dd>
                        {enrollment.lastStudiedAt
                          ? new Date(enrollment.lastStudiedAt).toLocaleDateString(
                              "ko-KR",
                            )
                          : "기록 없음"}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    className="button button-dark full-width course-card-cta"
                    href={`/practice/${enrollment.courseSlug}?random=1&count=10`}
                  >
                    10문제 풀기
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="문제를 풀 수 있는 수강 과정이 없습니다"
              description="관심 있는 과정을 찾아 학습을 시작해보세요"
              action={{ href: "/courses", label: "과정 둘러보기" }}
            />
          )}
        </div>
      </section>
    </main>
  );
}
