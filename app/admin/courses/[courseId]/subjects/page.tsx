import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseById,
  listSubjectsForCourse,
} from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function AdminSubjectsPage({ params }: PageProps) {
  await requireCatalogManager("/admin/courses");
  const { courseId } = await params;
  const [course, subjects] = await Promise.all([
    getCourseById(courseId),
    listSubjectsForCourse(courseId),
  ]);
  if (!course) notFound();
  const returnTo = `/admin/courses/${course.id}/subjects`;

  return (
    <>
      <header className="admin-page-header">
        <Link className="breadcrumb" href={`/admin/courses/${course.id}`}>
          ← {course.name}
        </Link>
        <p className="eyebrow">SUBJECTS</p>
        <h1>과목 관리</h1>
        <p>{course.name}의 과목 구조를 관리합니다.</p>
      </header>
      <section className="admin-panel">
        <h2>새 과목</h2>
        <SubjectForm courseId={course.id} returnTo={returnTo} />
      </section>
      <section className="admin-panel">
        <h2>등록된 과목</h2>
        <div className="admin-record-list">
          {subjects.map((subject) => (
            <details key={subject.id} className="admin-record">
              <summary>
                <span>
                  <strong>{subject.name}</strong>
                  <small>{subject.code}</small>
                </span>
                <Link
                  className="text-link"
                  href={`/admin/subjects/${subject.id}/topics`}
                >
                  주제 관리
                </Link>
              </summary>
              <SubjectForm
                courseId={course.id}
                returnTo={returnTo}
                subject={subject}
              />
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function SubjectForm({
  courseId,
  returnTo,
  subject,
}: {
  courseId: string;
  returnTo: string;
  subject?: Awaited<ReturnType<typeof listSubjectsForCourse>>[number];
}) {
  return (
    <form className="admin-form" action="/api/admin/subjects" method="post">
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        코드
        <input name="code" required pattern="[A-Z0-9_]+" minLength={2} maxLength={50} defaultValue={subject?.code} />
      </label>
      <label>
        이름
        <input name="name" required minLength={2} maxLength={120} defaultValue={subject?.name} />
      </label>
      <label className="wide">
        설명
        <textarea name="description" maxLength={2000} defaultValue={subject?.description} />
      </label>
      <label>
        정렬순서
        <input name="displayOrder" type="number" min={0} max={10000} required defaultValue={subject?.displayOrder ?? 0} />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={subject?.active ?? true} />
        활성
      </label>
      <button className="button button-dark" type="submit">
        {subject ? "과목 변경 저장" : "과목 등록"}
      </button>
    </form>
  );
}
