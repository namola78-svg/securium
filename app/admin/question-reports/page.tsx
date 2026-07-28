import { ReportAdminActions } from "@/components/report-admin-actions";
import { listQuestionReports } from "@/db/question-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function QuestionReportsPage() {
  await requireQuestionAdministrator("/admin/question-reports");
  const reports = await listQuestionReports();
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">QUESTION REPORTS</p>
        <h1>문제 신고 관리</h1>
        <p>정답·해설 오류, 오탈자, 오래된 기준, 중복 신고를 처리합니다.</p>
      </header>
      <section className="admin-panel">
        {reports.length ? (
          <div className="admin-record-list">
            {reports.map((report) => (
              <article className="admin-record report-record" key={report.id}>
                <div>
                  <span className="badge">{report.status}</span>
                  <strong>{report.questionTitle}</strong>
                  <small>{report.reason}</small>
                  <p>{report.content || "상세 내용 없음"}</p>
                </div>
                <ReportAdminActions
                  id={report.id}
                  currentStatus={report.status}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>접수된 신고가 없습니다.</strong>
          </div>
        )}
      </section>
    </>
  );
}
