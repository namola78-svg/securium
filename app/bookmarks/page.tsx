import Link from "next/link";
import { listQuestionBookmarks } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

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
            <h1>즐겨찾기</h1>
            <p>학습 맥락을 유지한 채 저장한 문제를 다시 확인합니다.</p>
          </div>
        </header>
        {items.length ? (
          <div className="review-grid">
            {items.map((item) => (
              <article className="review-card" key={item.id}>
                <span className="badge">{item.difficulty}</span>
                <h2>{item.title}</h2>
                <p>{item.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>즐겨찾기한 문제가 없습니다.</strong>
            <p>문제풀이 화면에서 필요한 문제를 저장하세요.</p>
            <Link className="button button-dark" href="/my-courses">
              내 과정 보기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
