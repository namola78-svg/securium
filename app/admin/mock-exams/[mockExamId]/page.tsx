import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminExamConfiguration } from "@/components/admin-mock-exam-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { getAdminMockExamConfiguration } from "@/db/phase3-repositories";
import { listAdminQuestions } from "@/db/question-repositories";
import { listSubjectsForCourse } from "@/db/repositories";
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
    ["TRUE_FALSE", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER"].includes(
      question.type,
    ),
  );
  const assignedScore = configuration.assigned.reduce(
    (sum, question) => sum + Number(question.score ?? 0),
    0,
  );
  const assignedCount = configuration.assigned.length;
  const targetQuestionCount = configuration.exam.questionCount;
  const remainingCount = Math.max(targetQuestionCount - assignedCount, 0);
  const assignmentCoverage =
    targetQuestionCount > 0
      ? Math.min(Math.round((assignedCount / targetQuestionCount) * 100), 100)
      : 0;

  return (
    <>
      <SectionHeader
        eyebrow="EXAM CONFIGURATION"
        title={configuration.exam.title}
        description="자동채점 지원 문제만 배정할 수 있습니다. 섹션 구성과 문제 배정은 서버에서 저장됩니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "모의고사", href: "/admin/mock-exams" },
          { label: "시험 구성", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/mock-exams">
              목록으로
            </Link>
            <Link
              className="button button-secondary"
              href={`/mock-exams/${mockExamId}`}
            >
              사용자 화면
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="모의고사 구성 현황">
        <MetricCard
          label="배정 문제"
          value={`${assignedCount}/${targetQuestionCount}`}
          description={`남은 배정 ${remainingCount}문제`}
        />
        <MetricCard
          label="섹션"
          value={configuration.sections.length}
          description={`${subjects.length}개 과목에서 구성 가능`}
        />
        <MetricCard
          label="배점 합계"
          value={`${assignedScore}점`}
          description={`구성률 ${assignmentCoverage}%`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone={statusTones[configuration.exam.status] ?? "neutral"}>
              {statusLabels[configuration.exam.status] ??
                configuration.exam.status}
            </StatusBadge>
            <StatusBadge
              tone={configuration.exam.published ? "success" : "warning"}
            >
              {configuration.exam.published ? "공개" : "비공개"}
            </StatusBadge>
          </>
        }
        primary={
          <Link
            className="button button-secondary"
            href={`/admin/questions?courseId=${configuration.exam.courseId}`}
          >
            출제 가능 문제 보기
          </Link>
        }
      >
        <strong>시험 구성 작업공간</strong>
        <span>
          섹션을 먼저 구성한 뒤, 공개된 자동채점 지원 문제를 시험에 배정합니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <AdminExamConfiguration
              mockExamId={mockExamId}
              subjects={subjects}
              sections={configuration.sections}
              questions={supportedQuestions}
            />

            <section className="admin-panel">
              <h2>배정 문제 {assignedCount}개</h2>
              {configuration.assigned.length ? (
                <div className="admin-record-list">
                  {configuration.assigned.map((question) => (
                    <div className="admin-record" key={question.questionId}>
                      <span>
                        순서 {question.displayOrder} · {question.score}점
                      </span>
                      <strong>{question.title}</strong>
                      <small>{question.questionId}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>아직 배정된 문제가 없습니다.</strong>
                  <p>
                    섹션을 생성한 뒤 출제 가능한 문제를 선택해 모의고사를
                    구성하세요.
                  </p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="CONFIG INSPECTOR"
            title="시험 운영 조건"
            description="공개 전 시험 기간, 결과 공개일, 문제 구성률을 함께 점검합니다."
            badges={[
              {
                label:
                  examTypeLabels[configuration.exam.examType] ??
                  configuration.exam.examType,
                tone: "info",
              },
              {
                label:
                  statusLabels[configuration.exam.status] ??
                  configuration.exam.status,
                tone: statusTones[configuration.exam.status] ?? "neutral",
              },
            ]}
            meta={[
              { label: "시험 ID", value: configuration.exam.id },
              { label: "과정 ID", value: configuration.exam.courseId },
              {
                label: "제한시간",
                value: `${configuration.exam.timeLimitMinutes}분`,
              },
              {
                label: "통과 기준",
                value: `${configuration.exam.passingScore}점`,
              },
              {
                label: "최대 응시",
                value: `${configuration.exam.maxAttempts}회`,
              },
              {
                label: "응시 시작",
                value: formatDate(configuration.exam.startAt),
              },
              {
                label: "응시 종료",
                value: formatDate(configuration.exam.endAt),
              },
              {
                label: "결과 공개",
                value: formatDate(configuration.exam.resultOpenAt),
              },
              {
                label: "출제 가능 문제",
                value: `${supportedQuestions.length}개`,
              },
            ]}
          >
            <p>
              공개 전에는 목표 문제 수와 실제 배정 문제가 일치하는지, 배점 합계가
              운영 기준에 맞는지, 결과 공개 시점이 시험 종료 이후인지 확인하세요.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
