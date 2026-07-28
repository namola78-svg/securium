import Link from "next/link";
import { AdminMockExamForm } from "@/components/admin-mock-exam-form";
import {
  getAdminOperationalStats,
  listAdminMockExams,
} from "@/db/phase3-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminMockExamsPage() {
  await requireCatalogManager("/admin/mock-exams");
  const [courses, exams, stats] = await Promise.all([
    listAllCourses(),
    listAdminMockExams(),
    getAdminOperationalStats(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">MOCK EXAMS</p>
        <h1>모의고사 관리</h1>
        <p>시험 기간, 제한시간, 결과 공개 시점과 문제 구성을 관리합니다.</p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card"><span>전체 응시</span><strong>{stats.attemptCount}</strong></div>
        <div className="stat-card"><span>제출 완료</span><strong>{stats.submittedCount}</strong></div>
        <div className="stat-card"><span>평균 점수</span><strong>{stats.averageScore}점</strong></div>
      </section>
      <section className="admin-panel">
        <h2>새 모의고사</h2>
        <AdminMockExamForm courses={courses} />
      </section>
      <section className="admin-panel">
        <h2>등록된 모의고사 {exams.length}개</h2>
        <div className="admin-record-list">
          {exams.map((exam) => (
            <Link className="admin-record admin-record-link" href={`/admin/mock-exams/${exam.id}`} key={exam.id}>
              <span>{exam.courseName} · {exam.examType}</span>
              <strong>{exam.title}</strong>
              <small>{exam.questionCount}문제 · {exam.timeLimitMinutes}분 · {exam.status} · {exam.published ? "공개" : "비공개"}</small>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
