import Link from "next/link";

import { AdminMockExamForm } from "@/components/admin-mock-exam-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getAdminOperationalStats,
  listAdminMockExams,
} from "@/db/phase3-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

const examTypeLabels: Record<string, string> = {
  QUICK: "빠른 모의고사",
  SUBJECT: "과목별",
  REALISTIC: "실전",
  WRONG_ANSWER: "오답",
  WEAK_AREA: "취약 영역",
  MANAGED: "관리자 지정",
};

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  READY: "준비",
  OPEN: "응시 가능",
  CLOSED: "종료",
  ARCHIVED: "보관",
};

const statusTones: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  DRAFT: "neutral",
  READY: "info",
  OPEN: "success",
  CLOSED: "warning",
  ARCHIVED: "danger",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "미설정";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminMockExamsPage() {
  await requireCatalogManager("/admin/mock-exams");
  const [courses, exams, stats] = await Promise.all([
    listAllCourses(),
    listAdminMockExams(),
    getAdminOperationalStats(),
  ]);
  const publishedCount = exams.filter((exam) => exam.published).length;
  const openCount = exams.filter((exam) => exam.status === "OPEN").length;
  const draftCount = exams.filter((exam) => exam.status === "DRAFT").length;
  const latestExam = exams[0];

  return (
    <>
      <SectionHeader
        eyebrow="MOCK EXAMS"
        title="모의고사 관리"
        description="시험 기간, 제한시간, 결과 공개 시점, 문제 구성을 과정별로 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "학습 운영", href: "/admin" },
          { label: "모의고사", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/mock-exams">
              사용자 화면
            </Link>
            <Link className="button button-secondary" href="/admin/questions">
              문제은행
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="모의고사 운영 현황">
        <MetricCard
          label="전체 응시"
          value={stats.attemptCount}
          description={`${stats.submittedCount}건 제출 완료`}
        />
        <MetricCard
          label="평균 점수"
          value={`${stats.averageScore}점`}
          description="제출된 모의고사 기준"
        />
        <MetricCard
          label="공개 시험"
          value={publishedCount}
          description={`${openCount}건 응시 가능 · ${draftCount}건 초안`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone={openCount ? "success" : "warning"}>
              {openCount ? "응시 가능 시험 있음" : "응시 가능 시험 없음"}
            </StatusBadge>
            <StatusBadge tone="info">과정별 분리</StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/mock-exams">
            새로고침
          </Link>
        }
      >
        <strong>시험 운영 큐</strong>
        <span>
          새 모의고사를 생성한 뒤 상세 화면에서 섹션과 출제 문제를 배정합니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <h2>새 모의고사</h2>
              <AdminMockExamForm courses={courses} />
            </section>

            <section className="admin-panel">
              <h2>등록된 모의고사 {exams.length}개</h2>
              {exams.length ? (
                <div className="admin-record-list">
                  {exams.map((exam) => (
                    <Link
                      className="admin-record admin-record-link"
                      href={`/admin/mock-exams/${exam.id}`}
                      key={exam.id}
                    >
                      <span>
                        {exam.courseName} ·{" "}
                        {examTypeLabels[exam.examType] ?? exam.examType}
                      </span>
                      <strong>{exam.title}</strong>
                      <small>
                        {exam.questionCount}문제 · {exam.timeLimitMinutes}분 ·
                        통과 {exam.passingScore}점 ·{" "}
                        {exam.published ? "공개" : "비공개"}
                      </small>
                      <StatusBadge
                        compact
                        tone={statusTones[exam.status] ?? "neutral"}
                      >
                        {statusLabels[exam.status] ?? exam.status}
                      </StatusBadge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 모의고사가 없습니다.</strong>
                  <p>과정을 선택해 첫 모의고사를 생성하세요.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="EXAM INSPECTOR"
            title={latestExam ? latestExam.title : "검토할 모의고사가 없습니다"}
            description={
              latestExam
                ? "가장 최근 수정된 모의고사의 운영 상태를 확인합니다."
                : "모의고사를 생성하면 공개 상태와 시험 기간을 확인할 수 있습니다."
            }
            badges={
              latestExam
                ? [
                    {
                      label: statusLabels[latestExam.status] ?? latestExam.status,
                      tone: statusTones[latestExam.status] ?? "neutral",
                    },
                    {
                      label: latestExam.published ? "공개" : "비공개",
                      tone: latestExam.published ? "success" : "warning",
                    },
                  ]
                : [{ label: "EMPTY", tone: "neutral" }]
            }
            meta={
              latestExam
                ? [
                    { label: "과정", value: latestExam.courseName },
                    {
                      label: "시험 유형",
                      value:
                        examTypeLabels[latestExam.examType] ??
                        latestExam.examType,
                    },
                    { label: "문제 수", value: latestExam.questionCount },
                    { label: "제한시간", value: `${latestExam.timeLimitMinutes}분` },
                    { label: "응시 시작", value: formatDate(latestExam.startAt) },
                    { label: "응시 종료", value: formatDate(latestExam.endAt) },
                    {
                      label: "결과 공개",
                      value: formatDate(latestExam.resultOpenAt),
                    },
                  ]
                : [
                    { label: "전체 응시", value: stats.attemptCount },
                    { label: "평균 점수", value: `${stats.averageScore}점` },
                  ]
            }
            actions={
              latestExam ? (
                <Link
                  className="button button-secondary"
                  href={`/admin/mock-exams/${latestExam.id}`}
                >
                  시험 구성 열기
                </Link>
              ) : (
                <Link className="button button-secondary" href="/admin/questions">
                  문제은행 확인
                </Link>
              )
            }
          >
            <p>
              모의고사는 과정별 진도와 통계를 분리해서 반영해야 합니다. 공개 전
              문제 수, 섹션 구성, 결과 공개 시점, 중복 응시 제한을 함께 확인하세요.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
