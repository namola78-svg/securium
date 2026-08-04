import Link from "next/link";

import { AdminPracticalForms } from "@/components/admin-practical-forms";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { getAdminPracticalData } from "@/db/practical-specialization-repositories";
import { listAdminQuestions } from "@/db/question-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function AdminPracticalSpecializationsPage() {
  await requireQuestionAdministrator("/admin/practical-specializations");
  const [data, courses, questions] = await Promise.all([
    getAdminPracticalData(),
    listAllCourses(),
    listAdminQuestions({ limit: 300 }),
  ]);

  const activeWeaknesses = data.weaknesses.filter((item) => item.active).length;
  const activePrivacyItems = data.items.filter((item) => item.active).length;
  const activeScenarios = data.scenarios.filter((item) => item.active).length;
  const languageCount = new Set(data.samples.map((item) => item.language)).size;
  const linkedQuestionCount = data.samples.filter((item) => item.questionId).length;
  const latestScenario = data.scenarios[0];
  const latestWeakness = data.weaknesses[0];

  return (
    <>
      <SectionHeader
        eyebrow="PRACTICAL SPECIALIZATIONS"
        title="실무형 과정 콘텐츠 관리"
        description="SW 보안약점 코드 분석과 개인정보 영향평가 항목·시나리오·흐름도를 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정 특화", href: "/admin/specialized" },
          { label: "실무형 콘텐츠", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/curriculum">
              커리큘럼
            </Link>
            <Link className="button button-secondary" href="/admin/questions">
              문제은행
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="실무형 콘텐츠 현황">
        <MetricCard
          label="보안약점"
          value={data.weaknesses.length}
          description={`${activeWeaknesses}개 활성 · ${languageCount}개 언어 샘플`}
        />
        <MetricCard
          label="코드 샘플"
          value={data.samples.length}
          description={`${linkedQuestionCount}개 문제 연결 · ${data.rules.length}개 채점규칙`}
        />
        <MetricCard
          label="영향평가"
          value={data.items.length}
          description={`${activePrivacyItems}개 활성 항목 · ${activeScenarios}개 활성 시나리오`}
        />
        <MetricCard
          label="흐름도"
          value={data.nodes.length + data.edges.length}
          description={`${data.nodes.length}개 노드 · ${data.edges.length}개 연결`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone="info">코드 실행 금지</StatusBadge>
            <StatusBadge tone={data.rules.length ? "success" : "warning"}>
              {data.rules.length ? "채점규칙 있음" : "채점규칙 필요"}
            </StatusBadge>
          </>
        }
        primary={
          <Link
            className="button button-ghost"
            href="/admin/practical-specializations"
          >
            새로고침
          </Link>
        }
      >
        <strong>실무 콘텐츠 작업공간</strong>
        <span>
          코드 샘플은 실행하지 않고 분석·채점 기준만 관리합니다. 개인정보 흐름도는
          검증된 노드와 연결 데이터로 표시합니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <AdminPracticalForms
            courses={courses.map((item) => ({
              id: item.id,
              name: item.shortName,
            }))}
            questions={questions.map((item) => ({
              id: item.id,
              name: item.title,
            }))}
            weaknesses={data.weaknesses.map((item) => ({
              id: item.id,
              name: `${item.code} · ${item.name}`,
            }))}
            samples={data.samples.map((item) => ({
              id: item.id,
              name: `${item.language} · ${item.title}`,
            }))}
            items={data.items.map((item) => ({
              id: item.id,
              name: `${item.code} · ${item.title}`,
            }))}
            scenarios={data.scenarios.map((item) => ({
              id: item.id,
              name: item.title,
            }))}
            nodes={data.nodes.map((item) => ({
              id: item.id,
              name: `${item.title} · ${item.scenarioId}`,
            }))}
          />
        }
        inspector={
          <InspectorPanel
            eyebrow="PRACTICAL INSPECTOR"
            title={
              latestScenario
                ? latestScenario.title
                : latestWeakness
                  ? latestWeakness.name
                  : "검토할 실무 콘텐츠가 없습니다"
            }
            description={
              latestScenario
                ? "가장 최근 등록된 영향평가 시나리오를 기준으로 흐름도 구성 상태를 확인합니다."
                : "실무 콘텐츠를 등록하면 과정 연결과 활성 상태를 확인할 수 있습니다."
            }
            badges={[
              {
                label: latestScenario ? "영향평가 시나리오" : "보안약점",
                tone: "info",
              },
              {
                label:
                  latestScenario?.active ?? latestWeakness?.active
                    ? "활성"
                    : "비활성/대기",
                tone:
                  latestScenario?.active ?? latestWeakness?.active
                    ? "success"
                    : "warning",
              },
            ]}
            meta={
              latestScenario
                ? [
                    { label: "시나리오 ID", value: latestScenario.id },
                    { label: "과정 ID", value: latestScenario.courseId },
                    { label: "트랙", value: latestScenario.track },
                    { label: "기관 유형", value: latestScenario.organizationType },
                    { label: "시스템 유형", value: latestScenario.systemType },
                    {
                      label: "대상 판단",
                      value: latestScenario.correctTargetDecision,
                    },
                    {
                      label: "흐름 노드",
                      value: data.nodes.filter(
                        (node) => node.scenarioId === latestScenario.id,
                      ).length,
                    },
                    {
                      label: "흐름 연결",
                      value: data.edges.filter(
                        (edge) => edge.scenarioId === latestScenario.id,
                      ).length,
                    },
                  ]
                : latestWeakness
                  ? [
                      { label: "보안약점 ID", value: latestWeakness.id },
                      { label: "코드", value: latestWeakness.code },
                      { label: "분류", value: latestWeakness.category },
                      { label: "언어", value: latestWeakness.language },
                      { label: "CWE", value: latestWeakness.cweCode },
                      { label: "위험도", value: latestWeakness.risk },
                      { label: "버전", value: latestWeakness.version },
                    ]
                  : [
                      { label: "보안약점", value: data.weaknesses.length },
                      { label: "영향평가 항목", value: data.items.length },
                    ]
            }
            actions={
              <>
                <Link className="button button-ghost" href="/admin/coverage">
                  커버리지 확인
                </Link>
                <Link className="button button-secondary" href="/admin/ai-reviews">
                  AI 검수 큐
                </Link>
              </>
            }
          >
            <p>
              사용자 입력 코드는 서버에서 실행하지 않습니다. 코드 샘플은 안전하게
              표시하고, 부분점수 기준과 영향평가 모범답안은 공식 자료가 아닌
              관리자가 검수한 학습용 기준으로 구분하세요.
            </p>
            <p>최신 기준일: {formatDate(latestScenario?.updatedAt)}</p>
          </InspectorPanel>
        }
      />
    </>
  );
}
