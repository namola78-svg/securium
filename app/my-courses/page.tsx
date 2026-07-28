import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { requireCurrentAppUser } from "@/lib/auth";
import { listUserEnrollments } from "@/db/repositories";

export const metadata: Metadata = { title: "내 과정" };
export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireCurrentAppUser("/my-courses");
  const enrollments = await listUserEnrollments(user.id);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">ENROLLMENT CENTER</p>
          <h1>내 과정</h1>
          <p>수강 상태를 관리하고 각 과정의 독립된 학습 공간으로 이동합니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          {enrollments.length ? (
            <div className="table-card">
              {enrollments.map((enrollment) => (
                <article className="my-course-row" key={enrollment.id}>
                  <div>
                    <span className="badge">{enrollment.status}</span>
                    <h2>{enrollment.courseName}</h2>
                    <p>{enrollment.groupName}</p>
                  </div>
                  <ProgressBar
                    value={enrollment.progressPercent}
                    label={`${enrollment.courseName} 진도`}
                  />
                  <div className="row-actions">
                    <Link
                      className="button button-dark button-small"
                      href={`/practice/${enrollment.courseSlug}?random=1&count=10`}
                    >
                      문제 풀기
                    </Link>
                    <Link
                      className="button button-dark button-small"
                      href={`/learn/${enrollment.courseSlug}`}
                    >
                      학습 공간
                    </Link>
                    <form action="/api/enrollments/status" method="post">
                      <input
                        type="hidden"
                        name="enrollmentId"
                        value={enrollment.id}
                      />
                      <input type="hidden" name="returnTo" value="/my-courses" />
                      <select
                        name="status"
                        defaultValue={enrollment.status}
                        aria-label={`${enrollment.courseName} 수강 상태`}
                      >
                        <option value="ACTIVE">수강 중</option>
                        <option value="PAUSED">일시정지</option>
                        <option value="COMPLETED">완료</option>
                        <option value="CANCELLED">취소</option>
                      </select>
                      <button className="button button-ghost button-small" type="submit">
                        상태 저장
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>등록된 과정이 없습니다.</strong>
              <Link className="button button-dark" href="/courses">
                과정 찾기
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
