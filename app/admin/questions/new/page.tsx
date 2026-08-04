import Link from "next/link";

import { AdminQuestionForm } from "@/components/admin-question-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
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

  const publishedCourses = courses.filter((course) => course.published).length;

  return (
    <>
      <SectionHeader
        eyebrow="NEW QUESTION"
        title="문제 초안 등록"
        description="문제는 초안으로 저장된 뒤 검수 요청, 승인, 게시 절차를 거쳐 학습자에게 노출됩니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "문제은행", href: "/admin/questions" },
          { label: "새 문제", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="info">초안 저장</StatusBadge>
            <StatusBadge tone="warning">검수 필요</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="brand">
              연결 과정 {courses.length}
            </StatusBadge>
            <StatusBadge compact tone="info">
              활성 과목 {subjects.length}
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
        <span>정답 데이터는 관리자 저장 경로에서만 처리하고, 일반 사용자 API에는 사전 노출하지 않습니다.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="문제 등록 준비 현황">
        <MetricCard
          label="연결 가능 과정"
          value={courses.length}
          description={`공개 과정 ${publishedCourses}개`}
        />
        <MetricCard
          label="연결 가능 과목"
          value={subjects.length}
          description="활성 과목 기준"
        />
        <MetricCard
          label="연결 가능 주제"
          value={topics.length}
          description="활성 주제 기준"
        />
        <MetricCard
          label="초기 상태"
          value="초안"
          description="저장 후 검수 요청 가능"
        />
      </section>

      <WorkspaceLayout
        main={
          <section className="admin-panel">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">QUESTION FORM</p>
                <h2>문제 정보 입력</h2>
              </div>
              <StatusBadge compact tone="brand">
                트랜잭션 저장
              </StatusBadge>
            </div>
            <AdminQuestionForm courses={courses} subjects={subjects} topics={topics} />
          </section>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title="등록 전 확인"
            description="문제 품질과 과정 연결 범위를 확인한 뒤 초안으로 저장하세요."
            badges={[
              { label: "작성자 권한", tone: "success" },
              { label: "검수 전 비노출", tone: "warning" },
            ]}
            meta={[
              { label: "저장 상태", value: "DRAFT" },
              { label: "과정 연결", value: "1개 이상 권장" },
              { label: "과목·주제 연결", value: "가능한 범위에서 지정" },
              { label: "정답 근거", value: "해설과 오답 해설 확인" },
            ]}
            actions={
              <>
                <Link className="button ghost" href="/admin/questions">
                  문제 목록으로
                </Link>
                <Link className="button ghost" href="/admin/ai-explainability">
                  AI 근거 확인
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>검수 흐름</span>
                <strong>초안 → 검수 요청 → 검토 → 승인 → 게시</strong>
                <small>승인되지 않은 문제는 일반 사용자에게 노출하지 않습니다.</small>
              </div>
              <div className="admin-record">
                <span>저장 범위</span>
                <strong>본문·선택지·정답·과정 연결을 함께 저장</strong>
                <small>기존 문제 저장 트랜잭션 경로를 그대로 사용합니다.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
