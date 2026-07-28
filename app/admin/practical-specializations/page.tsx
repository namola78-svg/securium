import { AdminPracticalForms } from "@/components/admin-practical-forms";
import { getAdminPracticalData } from "@/db/practical-specialization-repositories";
import { listAdminQuestions } from "@/db/question-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPracticalSpecializationsPage() {
  await requireQuestionAdministrator("/admin/practical-specializations");
  const [data, courses, questions] = await Promise.all([
    getAdminPracticalData(), listAllCourses(), listAdminQuestions({ limit: 300 }),
  ]);
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">PRACTICAL SPECIALIZATIONS</p>
        <h1>실무형 과정 콘텐츠 관리</h1>
        <p>SW 보안약점 코드 분석과 개인정보 영향평가 항목·시나리오·흐름을 관리합니다.</p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card"><span>보안약점</span><strong>{data.weaknesses.length}</strong></div>
        <div className="stat-card"><span>코드 샘플</span><strong>{data.samples.length}</strong></div>
        <div className="stat-card"><span>평가항목</span><strong>{data.items.length}</strong></div>
        <div className="stat-card"><span>시나리오</span><strong>{data.scenarios.length}</strong></div>
      </section>
      <AdminPracticalForms
        courses={courses.map((item) => ({ id: item.id, name: item.shortName }))}
        questions={questions.map((item) => ({ id: item.id, name: item.title }))}
        weaknesses={data.weaknesses.map((item) => ({ id: item.id, name: `${item.code} · ${item.name}` }))}
        samples={data.samples.map((item) => ({ id: item.id, name: `${item.language} · ${item.title}` }))}
        items={data.items.map((item) => ({ id: item.id, name: `${item.code} · ${item.title}` }))}
        scenarios={data.scenarios.map((item) => ({ id: item.id, name: item.title }))}
        nodes={data.nodes.map((item) => ({ id: item.id, name: `${item.title} · ${item.scenarioId}` }))}
      />
    </>
  );
}
