import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/state-ui";
import styles from "@/components/v2/practice-v2.module.css";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "문제풀이 | Securium",
  description: "수강 중인 과정에서 문제를 풀고 공식 해설과 복습 흐름을 확인하세요.",
};
export const dynamic = "force-dynamic";

export default async function PracticeHubPage() {
  const user = await requireCurrentAppUser("/practice");
  const enrollments = await listUserEnrollments(user.id);
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status !== "CANCELLED");

  return (
    <main className={styles.hubPage} data-practice-hub-v2="">
      <div className={styles.hubContainer}>
        <header className={styles.hubHeader}>
          <p className={styles.eyebrow}>문제풀이</p>
          <h1>어떤 과정의 문제를 풀까요?</h1>
          <p>과정을 선택해 문제에 집중하고, 제출 후 공식 해설로 바로 학습하세요.</p>
        </header>

        <section className={styles.hubSection} aria-labelledby="practice-courses-title">
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>내 학습 과정</p>
              <h2 id="practice-courses-title">문제풀이를 시작할 과정</h2>
            </div>
            <Link href="/courses">과정 둘러보기</Link>
          </header>

          {activeEnrollments.length ? (
            <div className={styles.courseGrid}>
              {activeEnrollments.map((enrollment) => (
                <article className={styles.courseCard} key={enrollment.id}>
                  <div className={styles.courseMeta}>
                    <span>{enrollment.groupName}</span>
                    <span>{enrollment.status === "COMPLETED" ? "복습 가능" : "학습 가능"}</span>
                  </div>
                  <h3>{enrollment.courseName}</h3>
                  <dl>
                    <div><dt>과정 진도</dt><dd>{enrollment.progressPercent}%</dd></div>
                    <div><dt>정답률</dt><dd>{enrollment.accuracy === null ? "기록 없음" : `${enrollment.accuracy}%`}</dd></div>
                  </dl>
                  <Link className={styles.courseAction} href={`/practice/${enrollment.courseSlug}?random=1&count=10`}>
                    10문제 풀기 <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="문제를 풀 수 있는 수강 과정이 없습니다"
              description="과정 목록에서 관심 있는 과정을 찾아 수강을 시작해보세요."
              action={{ href: "/courses", label: "과정 둘러보기" }}
            />
          )}
        </section>
      </div>
    </main>
  );
}
