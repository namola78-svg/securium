import { AdminSpecializedForms } from "@/components/admin-specialized-forms";
import { listAdminQuestions } from "@/db/question-repositories";
import { listAllCourses } from "@/db/repositories";
import { getAdminSpecializedData } from "@/db/specialized-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSpecializedPage() {
  await requireQuestionAdministrator("/admin/specialized");
  const [data, courses, questions] = await Promise.all([
    getAdminSpecializedData(),
    listAllCourses(),
    listAdminQuestions({ limit: 200 }),
  ]);
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">SPECIALIZED CONTENT</p>
        <h1>과정 특화 콘텐츠 관리</h1>
        <p>기준·법령·서술형 규칙·위험평가 데이터를 한 곳에서 버전 및 기준일과 함께 관리합니다.</p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card"><span>ISMS-P 기준</span><strong>{data.standards.length}</strong></div>
        <div className="stat-card"><span>결함사례</span><strong>{data.defectCases.length}</strong></div>
        <div className="stat-card"><span>법령 조문</span><strong>{data.legal.length}</strong></div>
        <div className="stat-card"><span>위험 시나리오</span><strong>{data.scenarios.length}</strong></div>
      </section>
      <AdminSpecializedForms
        courses={courses.map((course) => ({ id: course.id, name: course.shortName }))}
        standards={data.standards.map((standard) => ({ id: standard.id, name: `${standard.code} ${standard.title}` }))}
        questions={questions.map((question) => ({ id: question.id, name: question.title }))}
        methods={data.methods.map((method) => ({ id: method.id, name: method.name }))}
      />
      <section className="admin-panel section-block">
        <h2>연결 현황 {data.links.length}건</h2>
        <div className="admin-record-list">
          {data.links.slice(0, 100).map((link) => (
            <div className="admin-record" key={link.id}>
              <span>{link.contentType}</span>
              <strong>{link.contentId}</strong>
              <small>{link.courseId} · {link.relationType}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
