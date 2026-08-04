import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminQuestionForm } from "@/components/admin-question-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  type Tone,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { QuestionWorkflowActions } from "@/components/question-workflow-actions";
import { getAdminQuestion } from "@/db/question-repositories";
import {
  listAllActiveSubjects,
  listAllActiveTopics,
  listAllCourses,
} from "@/db/repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "초안",
    REVIEW_REQUESTED: "검수 요청",
    IN_REVIEW: "검토 중",
    APPROVED: "승인",
    PUBLISHED: "게시",
    REJECTED: "반려",
    ARCHIVED: "보관",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): Tone {
  if (status === "PUBLISHED" || status === "APPROVED") return "success";
  if (status === "REVIEW_REQUESTED" || status === "IN_REVIEW") return "warning";
  if (status === "REJECTED") return "danger";
  if (status === "ARCHIVED") return "neutral";
  return "info";
}

function questionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TRUE_FALSE: "OX",
    SINGLE_CHOICE: "단일선택",
    MULTIPLE_CHOICE: "복수선택",
    SHORT_ANSWER: "단답형",
    ESSAY: "서술형",
    ORDERING: "순서배열",
    FILL_BLANK: "빈칸",
    CASE_ANALYSIS: "사례분석",
    CODE_ANALYSIS: "코드분석",
    LOG_ANALYSIS: "로그분석",
    CALCULATION: "계산형",
  };
  return labels[type] ?? type;
}

function difficultyLabel(value: string) {
  const labels: Record<string, string> = {
    EASY: "쉬움",
    MEDIUM: "보통",
    HARD: "어려움",
  };
  return labels[value] ?? value;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "미지정";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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

  const correctChoiceCount = question.choices.filter((choice) => choice.isCorrect).length;

  return (
    <>
      <SectionHeader
        eyebrow="QUESTION DETAIL"
        title={question.title}
        description="문제 본문, 선택지, 정답, 과정 연결, 검수 상태와 버전 이력을 함께 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "문제은행", href: "/admin/questions" },
          { label: question.title, current: true },
        ]}
        actions={
          <>
            <StatusBadge tone={statusTone(question.status)}>
              {statusLabel(question.status)}
            </StatusBadge>
            <StatusBadge tone="brand">v{question.version}</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="info">
              {questionTypeLabel(question.type)}
            </StatusBadge>
            <StatusBadge compact tone="neutral">
              {difficultyLabel(question.difficulty)}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/questions">
              문제 목록
            </Link>
            <Link className="button ghost" href="/admin/reviews">
              검수 대기열
            </Link>
          </>
        }
      >
        <span>승인 전 문제는 일반 사용자에게 노출되지 않도록 검수 상태를 확인하세요.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="문제 상세 현황">
        <MetricCard
          label="선택지"
          value={question.choices.length}
          description={`정답 표시 ${correctChoiceCount}개`}
        />
        <MetricCard
          label="연결 과정"
          value={question.courseIds.length}
          description="하나의 문제를 여러 과정에 연결 가능"
        />
        <MetricCard
          label="연결 과목"
          value={question.subjectIds.length}
          description="과정 범위와 일치해야 함"
        />
        <MetricCard
          label="버전"
          value={question.versions.length}
          description="수정 이력 보존"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <QuestionWorkflowActions
              questionId={question.id}
              status={question.status}
            />

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">QUESTION EDITOR</p>
                  <h2>문제 수정 및 미리보기</h2>
                </div>
                <StatusBadge compact tone="brand">
                  트랜잭션 저장
                </StatusBadge>
              </div>
              <div className="question-preview">
                <strong>{question.content}</strong>
                {question.choices.length ? (
                  <ul>
                    {question.choices.map((choice) => (
                      <li key={choice.id}>
                        {choice.content} {choice.isCorrect ? "· 정답" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>선택지가 없는 문제 유형입니다.</p>
                )}
              </div>
              <AdminQuestionForm
                courses={courses}
                subjects={subjects}
                topics={topics}
                initial={question}
              />
            </section>

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">VERSION HISTORY</p>
                  <h2>버전 이력</h2>
                </div>
                <StatusBadge compact tone="info">
                  {question.versions.length}건
                </StatusBadge>
              </div>
              {question.versions.length ? (
                <div className="admin-record-list">
                  {question.versions.map((version) => (
                    <div className="admin-record" key={version.id}>
                      <div className="version-row">
                        <strong>버전 {version.version}</strong>
                        <span>{version.createdBy}</span>
                        <span>{formatDate(version.createdAt)}</span>
                        <span>{version.reviewComment || "의견 없음"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <strong>저장된 버전 이력이 없습니다.</strong>
                  <p>문제를 저장하면 버전 스냅샷이 생성됩니다.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title="검수 기준"
            description="정답 데이터가 사용자 API에 사전 노출되지 않도록 게시 전 상태를 점검합니다."
            badges={[
              { label: statusLabel(question.status), tone: statusTone(question.status) },
              { label: question.isSample ? "샘플" : "운영", tone: question.isSample ? "warning" : "success" },
            ]}
            meta={[
              { label: "Question ID", value: question.id },
              { label: "작성자", value: question.createdBy },
              { label: "검수자", value: question.reviewedBy ?? "미배정" },
              { label: "문제 유형", value: questionTypeLabel(question.type) },
              { label: "난이도", value: difficultyLabel(question.difficulty) },
              { label: "출처", value: question.source ?? "미지정" },
              { label: "출처 기준일", value: formatDate(question.sourceDate) },
            ]}
            actions={
              <>
                <Link className="button ghost" href="/admin/question-reports">
                  신고 확인
                </Link>
                <Link className="button ghost" href="/admin/ai-explainability">
                  AI Trace
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>노출 정책</span>
                <strong>게시 전 문제는 일반 사용자에게 노출하지 않음</strong>
                <small>검수 승인과 게시 상태를 분리해서 확인하세요.</small>
              </div>
              <div className="admin-record">
                <span>저장 정책</span>
                <strong>본문·선택지·정답·연결 정보를 함께 저장</strong>
                <small>부분 저장을 막기 위해 기존 트랜잭션 경로를 유지합니다.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
