import { notFound } from "next/navigation";
import { AdminQuestionForm } from "@/components/admin-question-form";
import { QuestionWorkflowActions } from "@/components/question-workflow-actions";
import { getAdminQuestion } from "@/db/question-repositories";
import {
  listAllActiveSubjects,
  listAllActiveTopics,
  listAllCourses,
} from "@/db/repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminQuestionDetailPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  await requireQuestionAdministrator("/admin/questions");
  const { questionId } = await params;
  const [question, courses, subjects, topics] = await Promise.all([
    getAdminQuestion(questionId),
    listAllCourses(),
    listAllActiveSubjects(),
    listAllActiveTopics(),
  ]);
  if (!question) notFound();
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">QUESTION DETAIL</p>
        <h1>{question.title}</h1>
        <p>
          {question.type} · {question.difficulty} · 버전 {question.version}
        </p>
      </header>
      <QuestionWorkflowActions questionId={question.id} status={question.status} />
      <section className="admin-panel">
        <h2>문제 수정 및 미리보기</h2>
        <div className="question-preview">
          <strong>{question.content}</strong>
          <ul>
            {question.choices.map((choice) => (
              <li key={choice.id}>
                {choice.content} {choice.isCorrect ? "· 정답" : ""}
              </li>
            ))}
          </ul>
        </div>
        <AdminQuestionForm
          courses={courses}
          subjects={subjects}
          topics={topics}
          initial={question}
        />
      </section>
      <section className="admin-panel">
        <h2>버전 이력</h2>
        <div className="admin-record-list">
          {question.versions.map((version) => (
            <div className="admin-record" key={version.id}>
              <div className="version-row">
                <strong>버전 {version.version}</strong>
                <span>{version.createdBy}</span>
                <span>{version.createdAt}</span>
                <span>{version.reviewComment || "의견 없음"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

