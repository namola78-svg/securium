import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/state-ui";
import { requireCurrentAppUser } from "@/lib/auth";
import { listUserEnrollments } from "@/db/repositories";

export const metadata: Metadata = { title: "내 학습" };
export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireCurrentAppUser("/my-courses");
  const enrollments = await listUserEnrollments(user.id);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">내 학습</p>
          <h1>내 학습</h1>
          <p>
            등록한 과정을 확인하고 이어서 학습, 문제풀이, 복습으로 바로
            이동할 수 있습니다.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          {enrollments.length ? (
            <div className="table-card">
              {enrollments.map((enrollment) => (
                <article className="my-course-row" key={enrollment.id}>
                  <div>
                    <span className="badge">{statusLabel(enrollment.status)}</span>
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
                      이어서 학습
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
            <EmptyState
              title="아직 등록한 과정이 없습니다"
              description="관심 있는 과정을 찾아 학습을 시작해보세요"
              action={{ href: "/courses", label: "과정 둘러보기" }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "수강 중";
  if (status === "PAUSED") return "일시정지";
  if (status === "COMPLETED") return "완료";
  if (status === "CANCELLED") return "취소";
  return status;
}
