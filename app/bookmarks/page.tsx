import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { listQuestionBookmarks } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "저장한 문제 | Securium",
  description: "다시 풀고 싶은 문제를 모아보고 학습을 이어가세요.",
};

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await requireCurrentAppUser("/bookmarks");
  const items = await listQuestionBookmarks(user.id);

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">SAVED QUESTIONS</p>
            <h1>저장한 문제</h1>
            <p>다시 확인하고 싶은 문제를 저장해두고 과정별로 복습하세요.</p>
          </div>
          <ActionButton href="/practice" variant="ghost">문제 풀러 가기</ActionButton>
        </header>

        {items.length ? (
          <>
            <section className="review-overview-panel" aria-label="저장한 문제 요약">
              <div>
                <p className="eyebrow">복습 자료</p>
                <h2>{items.length}개의 문제를 저장해두었습니다</h2>
                <p>문제를 다시 풀고 해설을 확인하면 복습 기록에도 반영됩니다.</p>
              </div>
              <dl>
                <div><dt>저장한 문제</dt><dd>{items.length}개</dd></div>
                <div><dt>다음 행동</dt><dd>다시 풀기</dd></div>
              </dl>
            </section>
            <div className="review-grid">
              {items.map((item) => (
                <article className="review-card" key={item.id}>
                  <div className="course-card-top">
                    <span className="badge">{item.difficulty}</span>
                    <span className="status-on">저장한 문제</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.content}</p>
                  <ActionButton href={`/practice/${item.courseSlug}?questionId=${item.questionId}`} variant="dark" className="full-width">
                    다시 풀기
                  </ActionButton>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>저장한 문제가 없습니다.</strong>
            <p>문제 풀이 중 다시 확인하고 싶은 문제를 저장하면 이곳에서 바로 복습할 수 있습니다.</p>
            <ActionButton href="/practice" variant="dark">문제 풀이 시작</ActionButton>
          </div>
        )}
      </div>
    </main>
  );
}
