import Link from "next/link";

import { AdminSpecializedForms } from "@/components/admin-specialized-forms";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAdminQuestions } from "@/db/question-repositories";
import { listAllCourses } from "@/db/repositories";
import { getAdminSpecializedData } from "@/db/specialized-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "미지정";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "미지정";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function AdminSpecializedPage() {
  await requireQuestionAdministrator("/admin/specialized");
  const [data, courses, questions] = await Promise.all([
    getAdminSpecializedData(),
    listAllCourses(),
    listAdminQuestions({ limit: 200 }),
  ]);

  const activeStandards = data.standards.filter((standard) => standard.active).length;
  const activeLegalArticles = data.legal.filter((article) => article.active).length;
  const activeRiskMethods = data.methods.filter((method) => method.active).length;
  const latestScenario = data.scenarios[0];
  const latestStandard = data.standards[0];
  const latestLegalArticle = data.legal[0];

  return (
    <>
      <SectionHeader
        eyebrow="SPECIALIZED CONTENT"
        title="과정별 특화 콘텐츠"
        description="ISMS-P 기준, 법령 조문, 위험 시나리오, 서술형 채점규칙을 과정 공통 엔진에 연결해 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정별 특화 콘텐츠", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="brand">공유 콘텐츠</StatusBadge>
            <StatusBadge tone="info">Repository 관리</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="success">
              공개 기준 {activeStandards}
            </StatusBadge>
            <StatusBadge compact tone="info">
              활성 법령 {activeLegalArticles}
            </StatusBadge>
            <StatusBadge compact tone="warning">
              위험평가 방법 {activeRiskMethods}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/content-revisions">
              버전 관리
            </Link>
            <Link className="button ghost" href="/admin/coverage">
              커버리지 확인
            </Link>
          </>
        }
      >
        <span>과정 간 콘텐츠 연결과 특화 도메인 자료를 한 화면에서 점검합니다.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="특화 콘텐츠 현황">
        <MetricCard
          label="ISMS-P 인증기준"
          value={data.standards.length}
          description={`활성 ${activeStandards}개 · 결함사례 ${data.defectCases.length}개`}
        />
        <MetricCard
          label="법령·조문"
          value={data.legal.length}
          description={`활성 ${activeLegalArticles}개 · 최근 기준 ${formatDate(
            latestLegalArticle?.effectiveDate,
          )}`}
        />
        <MetricCard
          label="서술형 채점규칙"
          value={data.writtenRules.length}
          description="정보보안기사·산업기사 보조채점 규칙"
        />
        <MetricCard
          label="위험관리 시나리오"
          value={data.scenarios.length}
          description={`평가 방법 ${data.methods.length}개 · 활성 ${activeRiskMethods}개`}
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <AdminSpecializedForms
              courses={courses.map((course) => ({
                id: course.id,
                name: course.shortName,
              }))}
              standards={data.standards.map((standard) => ({
                id: standard.id,
                name: `${standard.code} ${standard.title}`,
              }))}
              questions={questions.map((question) => ({
                id: question.id,
                name: question.title,
              }))}
              methods={data.methods.map((method) => ({
                id: method.id,
                name: method.name,
              }))}
            />

            <section className="admin-panel section-block">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">CONTENT LINKS</p>
                  <h2>과정 간 콘텐츠 연결</h2>
                </div>
                <StatusBadge compact tone={data.links.length ? "info" : "neutral"}>
                  {data.links.length}건
                </StatusBadge>
              </div>

              {data.links.length ? (
                <div className="admin-record-list">
                  {data.links.slice(0, 100).map((link) => (
                    <div className="admin-record" key={link.id}>
                      <span>{link.contentId}</span>
                      <strong>{link.courseId}</strong>
                      <small>
                        <StatusBadge compact tone="brand">
                          {link.contentType}
                        </StatusBadge>{" "}
                        {link.relationType}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <strong>아직 연결된 특화 콘텐츠가 없습니다.</strong>
                  <p>과정 연결을 추가하면 학습·문제·AI 근거에서 함께 활용됩니다.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={latestScenario?.title ?? latestStandard?.title ?? "선택 가능한 콘텐츠 없음"}
            description="최근 등록된 시나리오 또는 인증기준을 기준으로 운영 점검 포인트를 보여줍니다."
            badges={[
              {
                label: latestScenario ? "위험 시나리오" : latestStandard ? "ISMS-P 기준" : "대기",
                tone: latestScenario || latestStandard ? "info" : "neutral",
              },
              { label: "학습 엔진 연결", tone: "success" },
            ]}
            meta={
              latestScenario
                ? [
                    { label: "과정", value: latestScenario.courseId },
                    { label: "자산", value: latestScenario.asset },
                    { label: "위협", value: latestScenario.threat },
                    { label: "취약점", value: latestScenario.vulnerability },
                    { label: "위험등급", value: latestScenario.riskLevel },
                  ]
                : latestStandard
                  ? [
                      { label: "기준번호", value: latestStandard.code },
                      { label: "대분류", value: latestStandard.majorCategory },
                      { label: "중분류", value: latestStandard.middleCategory },
                      { label: "버전", value: latestStandard.version },
                      { label: "시행일", value: formatDate(latestStandard.effectiveDate) },
                    ]
                  : []
            }
            actions={
              <>
                <Link className="button ghost" href="/admin/ai-reviews">
                  AI 검수 보기
                </Link>
                <Link className="button ghost" href="/admin/audit-logs">
                  감사로그 보기
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>운영 기준</span>
                <strong>공식 자료와 샘플 콘텐츠를 분리 관리</strong>
                <small>기준일, 버전, 출처 URL을 함께 확인하세요.</small>
              </div>
              <div className="admin-record">
                <span>재사용 정책</span>
                <strong>콘텐츠는 과정별로 복제하지 않고 연결</strong>
                <small>문제·레슨·AI Retrieval에서 같은 근거를 공유합니다.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
