import Link from "next/link";
import {
  AdminArchiveButton,
  AdminLearningUnitForm,
  AdminLessonForm,
} from "@/components/admin-lesson-form";
import {
  listAdminLearningUnits,
  listAdminLessons,
  listLearningScopeOptions,
} from "@/db/lesson-repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  await requireCatalogManager("/admin/lessons");
  const [scopes, learningUnits, lessons] = await Promise.all([
    listLearningScopeOptions(),
    listAdminLearningUnits(),
    listAdminLessons(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">THEORY CMS</p>
        <h1>학습단위와 본문형 레슨</h1>
        <p>
          과정·과목·주제 구조를 재사용해 학습단위, 완료 정책, 안전한 본문과
          공개 상태를 관리합니다. 삭제는 학습 기록을 보존하는 비공개
          보관으로 처리합니다.
        </p>
      </header>
      <section className="admin-panel">
        <h2>새 학습단위</h2>
        <AdminLearningUnitForm scopes={scopes} />
      </section>
      <section className="admin-panel">
        <h2>학습단위 {learningUnits.length}개</h2>
        <div className="admin-record-list">
          {learningUnits.map((unit) => (
            <details className="admin-record" key={unit.id}>
              <summary>
                <span>
                  <strong>{unit.title}</strong>
                  <small>
                    {unit.courseName} · {unit.subjectName} ·{" "}
                    {unit.topicName ?? "과목 공통"}
                  </small>
                </span>
                <small>
                  {unit.completionPolicy} ·{" "}
                  {unit.published ? "공개" : "비공개"}
                </small>
              </summary>
              <AdminLearningUnitForm scopes={scopes} initial={unit} />
              <AdminArchiveButton
                id={unit.id}
                endpoint="/api/admin/learning-units"
                label={unit.title}
              />
            </details>
          ))}
        </div>
      </section>
      <section className="admin-panel">
        <h2>새 레슨</h2>
        <AdminLessonForm
          units={learningUnits}
          topics={scopes.topics}
        />
      </section>
      <section className="admin-panel">
        <h2>등록된 레슨 {lessons.length}개</h2>
        <div className="admin-record-list">
          {lessons.map((lesson) => (
            <details className="admin-record" key={lesson.id}>
              <summary>
                <span>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.courseName} · {lesson.subjectName} ·{" "}
                    {lesson.learningUnitTitle ?? "연결 이전 레슨"}
                  </small>
                </span>
                <small>
                  v{lesson.version} · {lesson.published ? "공개" : "비공개"}
                </small>
              </summary>
              <div className="button-row">
                <Link
                  className="button button-ghost"
                  href={`/admin/lessons/${lesson.id}/preview`}
                >
                  미리보기
                </Link>
                <AdminArchiveButton
                  id={lesson.id}
                  endpoint="/api/admin/lessons"
                  label={lesson.title}
                />
              </div>
              <AdminLessonForm
                units={learningUnits}
                topics={scopes.topics}
                initial={lesson}
              />
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
