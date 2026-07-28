import {
  AdminLevelContentForm,
  AdminLevelForm,
} from "@/components/admin-level-form";
import { listAdminLevels } from "@/db/phase3-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLevelsPage() {
  await requireCatalogManager("/admin/levels");
  const [courses, levels] = await Promise.all([
    listAllCourses(),
    listAdminLevels(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">LEARNING PATH</p>
        <h1>과정별 단계 관리</h1>
        <p>단계, 통과점수, 선행 단계와 공개 상태를 DB 기준으로 관리합니다.</p>
      </header>
      <section className="admin-panel">
        <h2>새 단계 등록</h2>
        <AdminLevelForm courses={courses} levels={levels} />
      </section>
      <section className="admin-panel">
        <h2>등록된 단계 {levels.length}개</h2>
        <div className="admin-record-list">
          {levels.map((level) => (
            <details className="admin-record" key={level.id}>
              <summary>
                <span>{level.courseName}</span>
                <strong>{level.number}. {level.title}</strong>
                <small>{level.published ? "공개" : "비공개"} · 통과 {level.passingScore}점</small>
              </summary>
              <AdminLevelForm courses={courses} levels={levels} initial={level} />
              <h3>콘텐츠 연결</h3>
              <AdminLevelContentForm levelId={level.id} />
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
