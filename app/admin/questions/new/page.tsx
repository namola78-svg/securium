import { AdminQuestionForm } from "@/components/admin-question-form";
import {
  listAllActiveSubjects,
  listAllActiveTopics,
  listAllCourses,
} from "@/db/repositories";
import { requireQuestionEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  await requireQuestionEditor("/admin/questions/new");
  const [courses, subjects, topics] = await Promise.all([
    listAllCourses(),
    listAllActiveSubjects(),
    listAllActiveTopics(),
  ]);
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">NEW QUESTION</p>
        <h1>문제 초안 등록</h1>
        <p>저장 후 검수 요청을 해야 하며 승인 전에는 학습자에게 노출되지 않습니다.</p>
      </header>
      <section className="admin-panel">
        <AdminQuestionForm courses={courses} subjects={subjects} topics={topics} />
      </section>
    </>
  );
}

