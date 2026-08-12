import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { getReviewSummary } from "@/db/phase3-repositories";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import styles from "@/components/v2/phase11-v2.module.css";

export const metadata: Metadata = {
  title: "AI 튜터",
  description: "공식 해설과 근거를 보완하는 SECURIUM AI 학습 지원 안내입니다.",
};
export const dynamic = "force-dynamic";

export default async function AiTutorPage() {
  const user = await requireCurrentAppUser("/ai-tutor");
  const [enrollments, reviewSummary] = await Promise.all([
    listUserEnrollments(user.id),
    getReviewSummary(user.id),
  ]);
  const availableEnrollments = enrollments.filter((item) => item.status !== "CANCELLED");
  const currentCourse = availableEnrollments[0];

  return (
    <main className={`page-main dashboard-page ${styles.page}`}>
      <div className="shell">
        <header className={`dashboard-intro ${styles.pageHeader}`}>
          <div>
            <p className="eyebrow">AI LEARNING SUPPORT</p>
            <h1>AI 튜터</h1>
            <p>학습 중 궁금한 개념을 공식 해설과 근거에 이어서 이해해보세요.</p>
          </div>
          <span className={styles.assistBadge}>AI 보조 설명</span>
        </header>

        <section className={styles.aiWorkspace} aria-label="AI 튜터 학습 시작">
          <div className={styles.aiMain}>
            <section className={styles.aiIntro} aria-labelledby="ai-start-title">
              <div className={styles.aiIdentity} aria-hidden="true">AI</div>
              <div>
                <p className="eyebrow">새 AI 설명 시작</p>
                <h2 id="ai-start-title">무엇이 궁금한가요?</h2>
                <p>현재 AI 설명은 문제를 먼저 풀고 채점 결과를 확인한 뒤 요청할 수 있습니다. 독립적인 자유 대화나 정답 대행 기능은 제공하지 않습니다.</p>
              </div>
            </section>

            <div className={styles.suggestionGrid} aria-label="AI 설명으로 확인할 수 있는 내용">
              <Link href={currentCourse ? `/practice/${currentCourse.courseSlug}?random=1&count=5` : "/practice"}>
                <span>개념 이해</span><strong>핵심을 쉽게 정리하기</strong><small>문제를 푼 뒤 관련 개념을 다시 확인합니다.</small>
              </Link>
              <Link href={currentCourse ? `/practice/${currentCourse.courseSlug}?random=1&count=5` : "/practice"}>
                <span>오답 이해</span><strong>왜 틀렸는지 확인하기</strong><small>공식 채점 결과를 먼저 보고 AI 보조 설명을 요청합니다.</small>
              </Link>
              <Link href={currentCourse ? `/practice/${currentCourse.courseSlug}?random=1&count=5` : "/practice"}>
                <span>근거 확인</span><strong>출처와 함께 살펴보기</strong><small>연결된 공식 콘텐츠가 있을 때 근거와 함께 표시합니다.</small>
              </Link>
            </div>

            <div className={styles.entryComposer} aria-labelledby="ai-entry-label">
              <div>
                <span id="ai-entry-label">질문할 문제 선택</span>
                <strong>{currentCourse ? `${currentCourse.shortName} 문제에서 시작` : "수강 과정을 선택한 뒤 시작"}</strong>
              </div>
              <ActionButton href={currentCourse ? `/practice/${currentCourse.courseSlug}?random=1&count=5` : "/courses"} variant="dark">
                {currentCourse ? "문제 풀고 질문하기" : "과정 둘러보기"}
              </ActionButton>
            </div>
            <p className={styles.aiNotice}>AI 설명은 학습 보조용입니다. 공식 해설과 검수된 근거를 먼저 확인하세요.</p>
          </div>

          <aside className={styles.contextPanel} aria-labelledby="ai-context-title">
            <p className="eyebrow">LEARNING CONTEXT</p>
            <h2 id="ai-context-title">현재 학습 맥락</h2>
            {currentCourse ? (
              <dl>
                <div><dt>현재 과정</dt><dd>{currentCourse.courseName}</dd></div>
                <div><dt>과정 진도</dt><dd>{currentCourse.progressPercent}%</dd></div>
                <div><dt>선택된 문제</dt><dd>아직 선택되지 않음</dd></div>
              </dl>
            ) : (
              <div className={styles.localEmpty}><strong>연결된 학습 맥락이 없습니다.</strong><p>과정을 선택하고 문제를 풀면 해당 문제의 맥락에서 AI 설명을 요청할 수 있습니다.</p></div>
            )}
            <div className={styles.contextActions}>
              {reviewSummary.dueCount > 0 ? <Link href="/reviews">예정된 복습 {reviewSummary.dueCount}개 확인</Link> : <Link href="/practice">문제풀이 시작</Link>}
              <Link href="/wrong-notes">반복 오답 확인</Link>
            </div>
          </aside>
        </section>

        <section className={styles.sourceSection} aria-labelledby="ai-source-title">
          <div className={styles.sectionHeading}>
            <div><p className="eyebrow">SOURCE &amp; VERIFICATION</p><h2 id="ai-source-title">공식 결과와 AI 설명을 구분합니다</h2></div>
            <p>AI 응답이 제공되는 문제에서는 현재 backend가 반환한 출처와 검수 상태를 그대로 표시합니다.</p>
          </div>
          <ol className={styles.authorityList}>
            <li><span>1</span><div><strong>공식 채점 결과와 해설</strong><p>정답 여부와 공식 해설이 학습 판단의 기준입니다.</p></div></li>
            <li><span>2</span><div><strong>연결된 근거와 학습 콘텐츠</strong><p>실제 연결 정보가 있을 때만 출처를 함께 표시합니다.</p></div></li>
            <li><span>3</span><div><strong>AI 보조 설명</strong><p>이해를 돕는 참고 설명이며 공식 결과를 변경하지 않습니다.</p></div></li>
          </ol>
        </section>

        <section className={styles.courseSection} aria-labelledby="ai-course-title">
          <div className={styles.sectionHeading}>
            <div><p className="eyebrow">학습 과정</p><h2 id="ai-course-title">과정에서 AI 설명 시작하기</h2></div>
            <p>실제 수강 과정의 문제풀이로 이동합니다.</p>
          </div>
          {availableEnrollments.length ? (
            <ul className={styles.compactCourseList}>
              {availableEnrollments.slice(0, 4).map((item) => (
                <li key={item.id}><div><strong>{item.courseName}</strong><span>진도 {item.progressPercent}% · 문제풀이 후 AI 설명 제공</span></div><ActionButton href={`/practice/${item.courseSlug}?random=1&count=5`} variant="ghost">5문제 풀기</ActionButton></li>
              ))}
            </ul>
          ) : (
            <div className={styles.localEmpty}><strong>아직 학습 중인 과정이 없습니다.</strong><p>과정을 선택하면 학습 맥락에 맞는 문제에서 AI 설명을 시작할 수 있습니다.</p><ActionButton href="/courses" variant="dark">과정 둘러보기</ActionButton></div>
          )}
        </section>
      </div>
    </main>
  );
}
