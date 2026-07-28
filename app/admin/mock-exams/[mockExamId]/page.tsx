import { notFound } from "next/navigation";
import { AdminExamConfiguration } from "@/components/admin-mock-exam-form";
import { getAdminMockExamConfiguration } from "@/db/phase3-repositories";
import { listAdminQuestions } from "@/db/question-repositories";
import { listSubjectsForCourse } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminMockExamDetailPage({
  params,
}: {
  params: Promise<{ mockExamId: string }>;
}) {
  await requireCatalogManager("/admin/mock-exams");
  const { mockExamId } = await params;
  const configuration = await getAdminMockExamConfiguration(mockExamId);
  if (!configuration) notFound();
  const [subjects, questions] = await Promise.all([
    listSubjectsForCourse(configuration.exam.courseId),
    listAdminQuestions({
      courseId: configuration.exam.courseId,
      status: "PUBLISHED",
      limit: 200,
    }),
  ]);
  const supportedQuestions = questions.filter((question) =>
    ["TRUE_FALSE", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER"].includes(question.type),
  );

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">EXAM CONFIGURATION</p>
        <h1>{configuration.exam.title}</h1>
        <p>자동채점 지원 문제만 배정할 수 있습니다. 배정 점수와 표시 순서는 서버에서 저장됩니다.</p>
      </header>
      <AdminExamConfiguration
        mockExamId={mockExamId}
        subjects={subjects}
        sections={configuration.sections}
        questions={supportedQuestions}
      />
      <section className="admin-panel">
        <h2>배정 문제 {configuration.assigned.length}개</h2>
        <div className="admin-record-list">
          {configuration.assigned.map((question) => (
            <div className="admin-record" key={question.questionId}>
              <span>순서 {question.displayOrder} · {question.score}점</span>
              <strong>{question.title}</strong>
              <small>{question.questionId}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
