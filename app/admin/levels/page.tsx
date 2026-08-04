import Link from "next/link";

import {
  AdminLevelContentForm,
  AdminLevelForm,
} from "@/components/admin-level-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAdminLevels } from "@/db/phase3-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

function publicationBadge(active: boolean, published: boolean) {
  if (!active) return { label: "비활성", tone: "danger" as const };
  if (!published) return { label: "비공개", tone: "warning" as const };
  return { label: "공개", tone: "success" as const };
}

export default async function AdminLevelsPage() {
  await requireCatalogManager("/admin/levels");
  const [courses, levels] = await Promise.all([
    listAllCourses(),
    listAdminLevels(),
  ]);

  const publishedLevels = levels.filter(
    (level) => level.active && level.published,
  ).length;
  const inactiveLevels = levels.filter((level) => !level.active).length;
  const prerequisiteLevels = levels.filter(
    (level) => level.requiredLevelId,
  ).length;
  const averagePassingScore = levels.length
    ? Math.round(
        levels.reduce((sum, level) => sum + Number(level.passingScore), 0) /
          levels.length,
      )
    : 0;
  const latestLevel = levels[0];
  const courseCount = new Set(levels.map((level) => level.courseId)).size;

  return (
    <>
      <SectionHeader
        eyebrow="LEARNING PATH"
        title="과정별 단계 관리"
        description="단계, 통과점수, 선행 단계, 공개 상태를 DB 기준으로 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "학습 운영", href: "/admin" },
          { label: "단계 학습", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/curriculum">
              커리큘럼
            </Link>
            <Link className="button button-secondary" href="/admin/mock-exams">
              모의고사
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="단계 학습 운영 현황">
        <MetricCard
          label="전체 단계"
          value={levels.length}
          description={`${courseCount}개 과정에 연결`}
        />
        <MetricCard
          label="공개 단계"
          value={publishedLevels}
          description={`${inactiveLevels}개 비활성 · ${levels.length - publishedLevels - inactiveLevels}개 비공개`}
        />
        <MetricCard
          label="평균 통과 기준"
          value={`${averagePassingScore}점`}
          description={`${prerequisiteLevels}개 단계에 선행 조건`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone={inactiveLevels ? "warning" : "success"}>
              {inactiveLevels ? "비활성 단계 있음" : "활성 상태 양호"}
            </StatusBadge>
            <StatusBadge tone="info">과정별 독립 진도</StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/levels">
            새로고침
          </Link>
        }
      >
        <strong>단계 학습 작업공간</strong>
        <span>
          첫 단계는 수강 시 열리고, 선행 단계 통과 후 다음 단계가 해제됩니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <h2>새 단계 등록</h2>
              <AdminLevelForm courses={courses} levels={levels} />
            </section>

            <section className="admin-panel">
              <h2>등록된 단계 {levels.length}개</h2>
              {levels.length ? (
                <div className="admin-record-list">
                  {levels.map((level) => {
                    const badge = publicationBadge(
                      level.active,
                      level.published,
                    );
                    const requiredLevel = level.requiredLevelId
                      ? levels.find(
                          (candidate) => candidate.id === level.requiredLevelId,
                        )
                      : null;
                    return (
                      <details className="admin-record" key={level.id}>
                        <summary>
                          <span>
                            <small>{level.courseName}</small>
                            <strong>
                              {level.number}. {level.title}
                            </strong>
                            <small>
                              통과 {level.passingScore}점 ·{" "}
                              {requiredLevel
                                ? `선행: ${requiredLevel.title}`
                                : "첫 단계 또는 선행 없음"}
                            </small>
                          </span>
                          <span className="button-row">
                            <StatusBadge compact tone={badge.tone}>
                              {badge.label}
                            </StatusBadge>
                            <small>{level.code}</small>
                          </span>
                        </summary>
                        <AdminLevelForm
                          courses={courses}
                          levels={levels}
                          initial={level}
                        />
                        <h3>콘텐츠 연결</h3>
                        <AdminLevelContentForm levelId={level.id} />
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 단계가 없습니다.</strong>
                  <p>과정을 선택해 첫 단계를 등록하세요.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="LEVEL INSPECTOR"
            title={latestLevel ? latestLevel.title : "검토할 단계가 없습니다"}
            description={
              latestLevel
                ? "목록 첫 단계의 공개 상태와 잠금 조건을 확인합니다."
                : "단계를 생성하면 통과 기준과 선행 단계가 표시됩니다."
            }
            badges={
              latestLevel
                ? [
                    publicationBadge(latestLevel.active, latestLevel.published),
                    {
                      label: latestLevel.requiredLevelId
                        ? "선행 조건 있음"
                        : "선행 없음",
                      tone: latestLevel.requiredLevelId ? "info" : "brand",
                    },
                  ]
                : [{ label: "EMPTY", tone: "neutral" }]
            }
            meta={
              latestLevel
                ? [
                    { label: "단계 ID", value: latestLevel.id },
                    { label: "과정", value: latestLevel.courseName },
                    { label: "코드", value: latestLevel.code },
                    { label: "번호", value: latestLevel.number },
                    { label: "통과 기준", value: `${latestLevel.passingScore}점` },
                    { label: "정렬 순서", value: latestLevel.displayOrder },
                    {
                      label: "선행 단계",
                      value:
                        levels.find(
                          (level) => level.id === latestLevel.requiredLevelId,
                        )?.title ?? "없음",
                    },
                  ]
                : [
                    { label: "등록 과정", value: courseCount },
                    { label: "전체 단계", value: levels.length },
                  ]
            }
            actions={
              <Link className="button button-secondary" href="/admin/curriculum">
                커리큘럼 연결 확인
              </Link>
            }
          >
            <p>
              단계 접근 권한은 서버에서 검증됩니다. 공개 전에는 선행 단계가 같은
              과정 안에서만 연결되는지, 통과 기준과 콘텐츠 배정이 학습 정책과
              일치하는지 확인하세요.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
