import Link from "next/link";
import {
  InspectorPanel,
  MetricCard,
  SectionHeader,
} from "@/components/design-system-primitives";
import { listCurriculumTrees } from "@/db/curriculum-repositories";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { listSharedContents } from "@/db/shared-content-repositories";
import { requireCatalogManager } from "@/lib/auth";

const adminActions = [
  {
    href: "/admin/curriculum",
    index: "01",
    title: "Curriculum Coverage",
    description:
      "공식 출제기준 트리, 노드 연결, 콘텐츠 커버리지 상태를 확인합니다.",
  },
  {
    href: "/admin/shared-content",
    index: "02",
    title: "Shared Content",
    description:
      "여러 과정에서 재사용되는 본문형 콘텐츠와 CourseLesson 연결을 관리합니다.",
  },
  {
    href: "/admin/ontology",
    index: "03",
    title: "Ontology Explorer",
    description:
      "개념, 별칭, 관계, 과정 간 매핑 상태를 추적하고 검수합니다.",
  },
  {
    href: "/admin/ai-explainability",
    index: "04",
    title: "AI Trace Console",
    description:
      "AI 응답의 검색 근거, Citation, Prompt, 피드백 흐름을 검토합니다.",
  },
  {
    href: "/admin/questions",
    index: "05",
    title: "Question Bank",
    description:
      "문제 등록, 과정 연결, 검수 요청, 게시 상태를 한곳에서 관리합니다.",
  },
  {
    href: "/admin/audit-logs",
    index: "06",
    title: "Audit Log",
    description:
      "중요 관리자 작업의 결과와 리소스 변경 이력을 확인합니다.",
  },
];

export default async function AdminPage() {
  await requireCatalogManager("/admin");
  const [groups, courses, curriculumTrees, sharedContents] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
    listCurriculumTrees(),
    listSharedContents(),
  ]);

  const activeGroups = groups.filter((group) => group.active).length;
  const publishedCourses = courses.filter((course) => course.published).length;
  const activeCurriculumTrees = curriculumTrees.filter(
    (tree) => tree.status === "ACTIVE",
  ).length;
  const publishedSharedContents = sharedContents.filter(
    (content) => content.status === "PUBLISHED",
  ).length;
  const draftSharedContents = sharedContents.filter(
    (content) => content.status === "DRAFT",
  ).length;

  return (
    <>
      <SectionHeader
        eyebrow="ADMIN DASHBOARD"
        title="운영 현황"
        description={
          <>
            과정 구조, 공식 커리큘럼, 공통 콘텐츠, AI 근거 추적 상태를 한 화면에서
            확인합니다. 중요한 관리자 작업은 감사로그에 기록됩니다.
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="관리 현황 요약">
        <MetricCard
          label="과정군"
          value={groups.length}
          description={`활성 ${activeGroups}`}
        />
        <MetricCard
          label="전체 과정"
          value={courses.length}
          description={`공개 ${publishedCourses}`}
        />
        <MetricCard
          label="Curriculum Tree"
          value={curriculumTrees.length}
          description={`ACTIVE ${activeCurriculumTrees}`}
        />
        <MetricCard
          label="공통 콘텐츠"
          value={sharedContents.length}
          description={`PUBLISHED ${publishedSharedContents}`}
        />
      </section>

      <div className="admin-overview-layout">
        <section className="admin-actions-grid" aria-label="관리자 작업 바로가기">
          {adminActions.map((action) => (
            <Link href={action.href} className="admin-action-card" key={action.href}>
              <span>{action.index}</span>
              <h2>{action.title}</h2>
              <p>{action.description}</p>
            </Link>
          ))}
        </section>

        <InspectorPanel
          eyebrow="INSPECTOR"
          title="운영 상태 요약"
          description="SECURIUM 관리자 콘솔에서 우선 확인해야 할 상태입니다."
          badges={[
            { label: "읽기 전용 요약", tone: "info" },
            {
              label:
                activeCurriculumTrees > 0
                  ? "활성 커리큘럼 있음"
                  : "활성 커리큘럼 없음",
              tone: activeCurriculumTrees > 0 ? "success" : "warning",
            },
          ]}
          meta={[
            { label: "공개 과정", value: `${publishedCourses}/${courses.length}` },
            {
              label: "활성 커리큘럼",
              value: `${activeCurriculumTrees}/${curriculumTrees.length}`,
            },
            {
              label: "게시 콘텐츠",
              value: `${publishedSharedContents}/${sharedContents.length}`,
            },
            { label: "초안 콘텐츠", value: draftSharedContents },
          ]}
          actions={
            <>
              <Link className="button button-primary" href="/admin/curriculum">
                커리큘럼 확인
              </Link>
              <Link className="button button-ghost" href="/admin/shared-content">
                콘텐츠 연결
              </Link>
            </>
          }
        >
          <p>
            Inspector Panel은 선택한 과정, 커리큘럼 노드, 콘텐츠, AI Trace의 상세
            정보를 같은 패턴으로 보여주기 위한 공통 UI입니다.
          </p>
          <p>
            이번 UI-3A에서는 관리자 Dashboard에 먼저 시범 적용하고, 이후
            Curriculum·Ontology·AI Trace 화면으로 확장합니다.
          </p>
        </InspectorPanel>
      </div>
    </>
  );
}
