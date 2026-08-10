import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/state-ui";
import { requireCurrentAppUser } from "@/lib/auth";
import { listUserEnrollments } from "@/db/repositories";

export const metadata: Metadata = {
  title: "내 과정",
  description: "등록한 과정을 확인하고 학습과 복습을 이어가세요.",
};
export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireCurrentAppUser("/my-courses");
  const enrollments = await listUserEnrollments(user.id);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">내 학습</p>
          <h1>내 과정</h1>
          <p>등록한 과정을 확인하고 학습, 문제풀이, 복습을 이어가세요.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          {enrollments.length ? (
            <div className="table-card">
              {enrollments.map((enrollment) => {
                const completed = enrollment.status === "COMPLETED";
                const cancelled = enrollment.status === "CANCELLED";
                return (
                  <article className="my-course-row" key={enrollment.id}>
                    <div>
                      <span className="badge">{statusLabel(enrollment.status)}</span>
                      <h2>{enrollment.courseName}</h2>
                      <p>{enrollment.groupName}</p>
                    </div>
                    <ProgressBar
                      value={enrollment.progressPercent}
                      label={`${enrollment.courseName} 진행률`}
                    />
                    <p className="muted-text">현재 진행률 {enrollment.progressPercent}%</p>
                    <div className="row-actions">
                      {enrollment.status === "ACTIVE" || enrollment.status === "PAUSED" ? (
                        <ActionButton
                          className="button-small"
                          href={`/practice/${enrollment.courseSlug}?random=1&count=10`}
                          variant="dark"
                        >
                          문제 10개 풀기
                        </ActionButton>
                      ) : null}
                      <ActionButton
                        className="button-small"
                        href={
                          completed
                              ? `/practice/${enrollment.courseSlug}?mode=review`
                            : cancelled
                              ? `/courses/${enrollment.courseSlug}`
                              : `/learn/${enrollment.courseSlug}`
                        }
                        variant={cancelled ? "secondary" : "dark"}
                      >
                        {completed ? "오답 복습 시작" : cancelled ? "과정 다시 보기" : "이어서 학습"}
                      </ActionButton>
                      <form action="/api/enrollments/status" method="post">
                        <input type="hidden" name="enrollmentId" value={enrollment.id} />
                        <input type="hidden" name="returnTo" value="/my-courses" />
                        <label className="sr-only" htmlFor={`status-${enrollment.id}`}>
                          {enrollment.courseName} 수강 상태
                        </label>
                        <select
                          id={`status-${enrollment.id}`}
                          name="status"
                          defaultValue={enrollment.status}
                        >
                          <option value="ACTIVE">학습 중</option>
                          <option value="PAUSED">일시정지</option>
                          <option value="COMPLETED">완료</option>
                          <option value="CANCELLED">취소</option>
                        </select>
                        <ActionButton className="button-small" variant="ghost" type="submit">
                          상태 저장
                        </ActionButton>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="등록한 과정이 없습니다"
              description="관심 있는 과정을 찾아 학습을 시작해보세요."
              action={{ href: "/courses", label: "과정 둘러보기" }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "학습 중";
  if (status === "PAUSED") return "일시정지";
  if (status === "COMPLETED") return "학습 완료";
  if (status === "CANCELLED") return "취소됨";
  return "상태 확인 필요";
}
