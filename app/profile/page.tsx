import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/state-ui";
import { ProfileLogoutButton } from "@/components/profile-logout-button";
import { listQuestionBookmarks } from "@/db/question-repositories";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import styles from "@/components/v2/phase11-v2.module.css";

export const metadata: Metadata = {
  title: "마이페이지",
  description: "SECURIUM 계정과 학습 상태를 확인합니다.",
};
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireCurrentAppUser("/profile");
  const [enrollments, bookmarks] = await Promise.all([
    listUserEnrollments(user.id),
    listQuestionBookmarks(user.id),
  ]);
  const availableEnrollments = enrollments.filter((item) => item.status !== "CANCELLED");
  const currentCourse = availableEnrollments[0];

  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <header className={`dashboard-intro ${styles.pageHeader}`}>
          <div><p className="eyebrow">내 프로필</p><h1>마이페이지</h1><p>내 계정과 학습 상태, 저장한 자료와 개인 설정을 관리하세요.</p></div>
        </header>

        <section className={styles.profileGrid} aria-label="사용자 정보와 학습 요약">
          <article className={styles.accountCard} aria-labelledby="profile-account-title">
            <div className={styles.avatar} aria-hidden="true">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</div>
            <div><p className="eyebrow">ACCOUNT</p><h2 id="profile-account-title">{user.displayName || "이름 미설정"}</h2><p>{user.email}</p></div>
            <span>학습자 계정</span>
          </article>

          <article className={styles.learningSummary} aria-labelledby="profile-learning-title">
            <div className={styles.sectionHeading}><div><p className="eyebrow">현재 학습</p><h2 id="profile-learning-title">학습 상태</h2></div><Link href="/analytics">상세 분석 보기</Link></div>
            {currentCourse ? (
              <div className={styles.currentCourse}>
                <div><strong>{currentCourse.courseName}</strong><span>{availableEnrollments.length}개 과정 수강 중</span></div>
                <div className={styles.courseProgress}><div><span>현재 진도</span><strong>{currentCourse.progressPercent}%</strong></div><ProgressBar value={currentCourse.progressPercent} label={`${currentCourse.courseName} 진도`} /></div>
                <ActionButton href={`/learn/${currentCourse.courseSlug}`} variant="ghost">이어서 학습</ActionButton>
              </div>
            ) : (
              <EmptyState title="아직 학습 중인 과정이 없습니다." description="과정을 선택하면 학습 상태를 여기에서 확인할 수 있습니다." action={{ href: "/courses", label: "과정 둘러보기" }} />
            )}
          </article>
        </section>

        <section className={styles.quickSection} aria-labelledby="profile-quick-title">
          <div className={styles.sectionHeading}><div><p className="eyebrow">MY LEARNING</p><h2 id="profile-quick-title">학습 기록과 설정</h2></div><p>상세 내용은 기존 전용 화면에서 확인합니다.</p></div>
          <nav className={styles.quickLinks} aria-label="마이페이지 빠른 이동">
            <Link href="/my-courses"><span>내 과정</span><strong>{availableEnrollments.length}개 과정 관리</strong><small>수강 중인 과정과 진도 확인</small></Link>
            <Link href="/analytics"><span>학습 분석</span><strong>취약 영역과 성과 보기</strong><small>상세 학습 데이터 확인</small></Link>
            <Link href="/bookmarks"><span>북마크</span><strong>{bookmarks.length}개 저장한 문제</strong><small>저장한 문제 다시 풀기</small></Link>
            <Link href="/settings"><span>학습 설정</span><strong>하루 목표 관리</strong><small>문제 수와 학습 시간 설정</small></Link>
          </nav>
        </section>

        {availableEnrollments.length > 1 ? (
          <section className={styles.courseSection} aria-labelledby="profile-course-list-title">
            <div className={styles.sectionHeading}><div><p className="eyebrow">수강 과정</p><h2 id="profile-course-list-title">내 과정</h2></div><Link href="/my-courses">전체 과정 보기</Link></div>
            <ul className={styles.compactCourseList}>{availableEnrollments.slice(0, 4).map((item) => <li key={item.id}><div><strong>{item.courseName}</strong><span>진도 {item.progressPercent}%</span></div><ActionButton href={`/learn/${item.courseSlug}`} variant="ghost">학습하기</ActionButton></li>)}</ul>
          </section>
        ) : null}

        <section className={styles.accountActions} aria-labelledby="profile-account-actions-title">
          <div><p className="eyebrow">계정</p><h2 id="profile-account-actions-title">개인 설정과 로그아웃</h2><p>학습 목표를 변경하거나 현재 계정에서 안전하게 로그아웃할 수 있습니다.</p></div>
          <div><ActionButton href="/settings" variant="ghost">설정 열기</ActionButton><ProfileLogoutButton /></div>
        </section>
      </div>
    </main>
  );
}
