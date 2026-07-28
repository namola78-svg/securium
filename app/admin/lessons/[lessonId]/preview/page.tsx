import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import { getAdminLessonPreview } from "@/db/lesson-repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLessonPreviewPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  await requireCatalogManager("/admin/lessons");
  const { lessonId } = await params;
  const lesson = await getAdminLessonPreview(lessonId);
  if (!lesson) notFound();
  return (
    <>
      <header className="admin-page-header">
        <Link className="breadcrumb" href="/admin/lessons">
          ← 이론 레슨 관리
        </Link>
        <p className="eyebrow">LESSON PREVIEW</p>
        <h1>{lesson.title}</h1>
        <p>
          {lesson.courseName} · {lesson.subjectName} ·{" "}
          {lesson.learningUnitTitle ?? lesson.topicName}
        </p>
        <span className="badge">
          v{lesson.version} · {lesson.published ? "공개" : "비공개"}
        </span>
      </header>
      <article className="admin-panel lesson-reader">
        <p>{lesson.summary}</p>
        <SafeLessonContent
          content={lesson.content}
          format={lesson.contentFormat}
        />
      </article>
    </>
  );
}
