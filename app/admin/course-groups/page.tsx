import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CourseGroup = Awaited<ReturnType<typeof listAllCourseGroups>>[number];

export default async function AdminCourseGroupsPage() {
  await requireCatalogManager("/admin/course-groups");
  const [groups, courses] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
  ]);

  const activeGroups = groups.filter((group) => group.active).length;
  const inactiveGroups = groups.length - activeGroups;
  const publishedCourses = courses.filter((course) => course.published).length;
  const primaryGroup = groups[0];
  const coursesByGroup = new Map<string, number>();
  const publishedCoursesByGroup = new Map<string, number>();
  for (const course of courses) {
    coursesByGroup.set(
      course.courseGroupId,
      (coursesByGroup.get(course.courseGroupId) ?? 0) + 1,
    );
    if (course.published) {
      publishedCoursesByGroup.set(
        course.courseGroupId,
        (publishedCoursesByGroup.get(course.courseGroupId) ?? 0) + 1,
      );
    }
  }

  return (
    <>
      <SectionHeader
        eyebrow="COURSE GROUPS"
        title="과정군 관리"
        description="여러 전문과정을 코드 수정 없이 분류하고, 공개 과정의 상위 탐색 구조를 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정군", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="success">활성 {activeGroups}</StatusBadge>
            <StatusBadge tone={inactiveGroups ? "warning" : "neutral"}>
              비활성 {inactiveGroups}
            </StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="info">
              전체 과정 {courses.length}
            </StatusBadge>
            <StatusBadge compact tone="success">
              공개 과정 {publishedCourses}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/courses">
              과정 관리
            </Link>
            <Link className="button ghost" href="/courses">
              공개 목록 보기
            </Link>
          </>
        }
      >
        <span>과정군은 과정 목록의 묶음과 정렬 기준입니다. 삭제보다 비활성화를 우선 사용하세요.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="과정군 현황">
        <MetricCard
          label="전체 과정군"
          value={groups.length}
          description="삭제되지 않은 과정군"
        />
        <MetricCard
          label="활성 과정군"
          value={activeGroups}
          description="공개 과정 목록에서 사용할 수 있는 상위 묶음"
        />
        <MetricCard
          label="전체 과정"
          value={courses.length}
          description="과정군에 연결된 전체 과정"
        />
        <MetricCard
          label="공개 과정"
          value={publishedCourses}
          description="학습자에게 노출 가능한 과정"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">CREATE GROUP</p>
                  <h2>새 과정군 등록</h2>
                </div>
                <StatusBadge compact tone="brand">
                  상위 분류
                </StatusBadge>
              </div>
              <CourseGroupForm />
            </section>

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">GROUP LIST</p>
                  <h2>등록된 과정군</h2>
                </div>
                <StatusBadge compact tone={groups.length ? "info" : "neutral"}>
                  {groups.length}건
                </StatusBadge>
              </div>

              {groups.length ? (
                <div className="admin-record-list">
                  {groups.map((group) => (
                    <details key={group.id} className="admin-record">
                      <summary>
                        <span>
                          <strong>{group.name}</strong>
                          <small>
                            {group.code} · 정렬 {group.displayOrder} · 과정{" "}
                            {coursesByGroup.get(group.id) ?? 0}개
                          </small>
                        </span>
                        <StatusBadge compact tone={group.active ? "success" : "neutral"}>
                          {group.active ? "활성" : "비활성"}
                        </StatusBadge>
                      </summary>
                      <CourseGroupForm group={group} />
                    </details>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 과정군이 없습니다.</strong>
                  <p>첫 과정군을 등록하면 과정 관리에서 연결할 수 있습니다.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={primaryGroup?.name ?? "과정군 없음"}
            description="가장 먼저 노출되는 과정군을 기준으로 공개 구조와 정렬 상태를 확인합니다."
            badges={
              primaryGroup
                ? [
                    {
                      label: primaryGroup.active ? "활성" : "비활성",
                      tone: primaryGroup.active ? "success" : "neutral",
                    },
                    { label: primaryGroup.code, tone: "brand" },
                  ]
                : [{ label: "등록 필요", tone: "warning" }]
            }
            meta={
              primaryGroup
                ? [
                    { label: "Stable ID", value: primaryGroup.id },
                    { label: "정렬순서", value: primaryGroup.displayOrder },
                    {
                      label: "연결 과정",
                      value: `${coursesByGroup.get(primaryGroup.id) ?? 0}개`,
                    },
                    {
                      label: "공개 과정",
                      value: `${publishedCoursesByGroup.get(primaryGroup.id) ?? 0}개`,
                    },
                  ]
                : []
            }
            actions={
              <>
                <Link className="button ghost" href="/admin/courses">
                  과정 연결 확인
                </Link>
                <Link className="button ghost" href="/admin/curriculum">
                  커리큘럼 확인
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>운영 정책</span>
                <strong>과정명과 과정군은 DB에서 관리</strong>
                <small>새 과정 추가 시 프론트엔드 코드 수정 없이 노출되어야 합니다.</small>
              </div>
              <div className="admin-record">
                <span>삭제 정책</span>
                <strong>학습 기록 보호를 위해 비활성화 우선</strong>
                <small>과정군 변경은 연결된 과정 목록에 즉시 영향을 줍니다.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}

function CourseGroupForm({ group }: { group?: CourseGroup }) {
  return (
    <form className="admin-form" action="/api/admin/course-groups" method="post">
      {group ? <input type="hidden" name="id" value={group.id} /> : null}
      <input type="hidden" name="returnTo" value="/admin/course-groups" />
      <label>
        코드
        <input
          name="code"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Z0-9_]+"
          defaultValue={group?.code}
          placeholder="SECURITY_CERT"
        />
      </label>
      <label>
        이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={group?.name}
          placeholder="정보보안 국가기술자격"
        />
      </label>
      <label className="wide">
        설명
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={group?.description}
          placeholder="과정군의 목적과 포함되는 과정 범위를 입력하세요."
        />
      </label>
      <label>
        정렬순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          max={10000}
          required
          defaultValue={group?.displayOrder ?? 0}
        />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={group?.active ?? true} />
        활성
      </label>
      <button className="button button-dark" type="submit">
        {group ? "변경 저장" : "과정군 등록"}
      </button>
    </form>
  );
}
