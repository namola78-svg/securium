import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseById,
  listAllCourseGroups,
  listAllCourses,
} from "@/db/repositories";
import { CourseForm } from "../page";
import { requireCatalogManager } from "@/lib/auth";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function AdminCourseDetailPage({ params }: PageProps) {
  await requireCatalogManager("/admin/courses");
  const { courseId } = await params;
  const [course, groups, courseRows] = await Promise.all([
    getCourseById(courseId),
    listAllCourseGroups(),
    listAllCourses(),
  ]);
  if (!course) notFound();
  const courseView = courseRows.find((row) => row.id === course.id);
  if (!courseView) notFound();

  return (
    <>
      <header className="admin-page-header">
        <Link className="breadcrumb" href="/admin/courses">
          ← 과정 목록
        </Link>
        <p className="eyebrow">COURSE SETTINGS</p>
        <h1>{course.name}</h1>
        <p>비활성화해도 기존 수강 및 진도 기록은 삭제되지 않습니다.</p>
      </header>
      <section className="admin-panel">
        <CourseForm groups={groups} course={courseView} />
      </section>
      <section className="admin-panel inline-panel">
        <div>
          <h2>커리큘럼 구조</h2>
          <p>과목과 주제를 과정별로 구성합니다.</p>
        </div>
        <Link
          className="button button-dark"
          href={`/admin/courses/${course.id}/subjects`}
        >
          과목 관리
        </Link>
      </section>
    </>
  );
}
