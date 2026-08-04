import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  type Tone,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CourseGroup = Awaited<ReturnType<typeof listAllCourseGroups>>[number];
type AdminCourse = Awaited<ReturnType<typeof listAllCourses>>[number];

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

function difficultyLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    BEGINNER: "입문",
    INTERMEDIATE: "중급",
    ADVANCED: "심화",
  };
  return labels[value ?? ""] ?? value ?? "미지정";
}

function statusTone(enabled: boolean): Tone {
  return enabled ? "success" : "neutral";
}

export default async function AdminCoursesPage() {
  await requireCatalogManager("/admin/courses");
  const [groups, courses] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
  ]);

  const activeCourses = courses.filter((course) => course.active).length;
  const publishedCourses = courses.filter((course) => course.published).length;
  const sampleCourses = courses.filter((course) => course.isSample).length;
  const latestCourse = [...courses].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  return (
    <>
      <SectionHeader
        eyebrow="COURSES"
        title="과정 관리"
        description="과정 정보를 DB에서 관리하고 공개, 활성화, 정렬 상태를 공통 과정 템플릿에 반영합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="success">활성 {activeCourses}</StatusBadge>
            <StatusBadge tone="info">공개 {publishedCourses}</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="brand">
              과정군 {groups.length}
            </StatusBadge>
            <StatusBadge compact tone={sampleCourses ? "warning" : "neutral"}>
              샘플 콘텐츠 {sampleCourses}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/course-groups">
              과정군 관리
            </Link>
            <Link className="button ghost" href="/courses">
              공개 과정 보기
            </Link>
          </>
        }
      >
        <span>
          신규 과정은 이 화면에서 추가한 뒤 과목, 주제, 커리큘럼을 연결합니다.
        </span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="과정 운영 현황">
        <MetricCard
          label="전체 과정"
          value={courses.length}
          description="삭제되지 않은 등록 과정"
        />
        <MetricCard
          label="활성 과정"
          value={activeCourses}
          description="수강과 학습 흐름에 사용할 수 있는 과정"
        />
        <MetricCard
          label="공개 과정"
          value={publishedCourses}
          description="학습자 과정 목록에 노출되는 과정"
        />
        <MetricCard
          label="샘플 콘텐츠"
          value={sampleCourses}
          description="운영 콘텐츠와 구분해 관리"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">CREATE COURSE</p>
                  <h2>새 과정 등록</h2>
                </div>
                <StatusBadge compact tone="brand">
                  동적 라우트
                </StatusBadge>
              </div>
              <CourseForm groups={groups} />
            </section>

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">COURSE LIST</p>
                  <h2>등록된 과정</h2>
                </div>
                <StatusBadge compact tone={courses.length ? "info" : "neutral"}>
                  {courses.length}건
                </StatusBadge>
              </div>

              {courses.length ? (
                <div className="admin-table" role="table" aria-label="과정 목록">
                  {courses.map((course) => (
                    <div className="admin-table-row" role="row" key={course.id}>
                      <div>
                        <strong>{course.name}</strong>
                        <small>
                          {groupNameById.get(course.courseGroupId) ?? course.groupName} ·{" "}
                          {course.code} · {course.slug}
                        </small>
                      </div>
                      <StatusBadge compact tone={statusTone(course.published)}>
                        {course.published ? "공개" : "비공개"}
                      </StatusBadge>
                      <StatusBadge compact tone={statusTone(course.active)}>
                        {course.active ? "활성" : "비활성"}
                      </StatusBadge>
                      <span>{difficultyLabel(course.difficulty)}</span>
                      <div className="row-actions">
                        <Link className="text-link" href={`/admin/courses/${course.id}`}>
                          설정
                        </Link>
                        <Link
                          className="text-link"
                          href={`/admin/courses/${course.id}/subjects`}
                        >
                          과목
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 과정이 없습니다.</strong>
                  <p>먼저 과정군을 만든 다음 과정을 등록하세요.</p>
                  <Link className="button ghost" href="/admin/course-groups">
                    과정군 관리
                  </Link>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={latestCourse?.name ?? "과정 없음"}
            description="최근 수정된 과정을 기준으로 공개 상태와 학습 연결 상태를 확인합니다."
            badges={
              latestCourse
                ? [
                    {
                      label: latestCourse.published ? "공개" : "비공개",
                      tone: statusTone(latestCourse.published),
                    },
                    {
                      label: latestCourse.active ? "활성" : "비활성",
                      tone: statusTone(latestCourse.active),
                    },
                  ]
                : [{ label: "등록 필요", tone: "warning" }]
            }
            meta={
              latestCourse
                ? [
                    { label: "과정군", value: latestCourse.groupName },
                    { label: "코드", value: latestCourse.code },
                    { label: "Slug", value: latestCourse.slug },
                    { label: "단계 수", value: latestCourse.totalLevels },
                    { label: "통과 기준", value: `${latestCourse.passingScore}점` },
                    { label: "최근 수정", value: formatDate(latestCourse.updatedAt) },
                  ]
                : []
            }
            actions={
              latestCourse ? (
                <>
                  <Link
                    className="button ghost"
                    href={`/admin/courses/${latestCourse.id}`}
                  >
                    과정 설정
                  </Link>
                  <Link
                    className="button ghost"
                    href={`/admin/courses/${latestCourse.id}/subjects`}
                  >
                    과목 관리
                  </Link>
                </>
              ) : (
                <Link className="button ghost" href="/admin/course-groups">
                  과정군 먼저 만들기
                </Link>
              )
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>동적 구조</span>
                <strong>과정별 페이지를 복사하지 않음</strong>
                <small>
                  slug와 DB 데이터를 기반으로 공통 과정 템플릿을 사용합니다.
                </small>
              </div>
              <div className="admin-record">
                <span>학습 기록 보호</span>
                <strong>삭제보다 비활성화 우선</strong>
                <small>
                  학습 이력이 있는 과정은 active/published 상태 전환으로 운영하세요.
                </small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}

export function CourseForm({
  groups,
  course,
}: {
  groups: CourseGroup[];
  course?: AdminCourse;
}) {
  return (
    <form className="admin-form" action="/api/admin/courses" method="post">
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <input
        type="hidden"
        name="returnTo"
        value={course ? `/admin/courses/${course.id}` : "/admin/courses"}
      />
      <label>
        과정군
        <select name="courseGroupId" required defaultValue={course?.courseGroupId}>
          <option value="">선택</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        코드
        <input
          name="code"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Z0-9_]+"
          defaultValue={course?.code}
          placeholder="SECURITY_ENGINEER"
        />
      </label>
      <label>
        Slug
        <input
          name="slug"
          required
          minLength={2}
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={course?.slug}
          placeholder="information-security-engineer"
        />
      </label>
      <label>
        과정명
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={course?.name}
        />
      </label>
      <label>
        짧은 이름
        <input
          name="shortName"
          required
          maxLength={50}
          defaultValue={course?.shortName}
        />
      </label>
      <label>
        난이도
        <select name="difficulty" defaultValue={course?.difficulty ?? "BEGINNER"}>
          <option value="BEGINNER">입문</option>
          <option value="INTERMEDIATE">중급</option>
          <option value="ADVANCED">심화</option>
        </select>
      </label>
      <label className="wide">
        설명
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={course?.description}
          placeholder="과정 소개와 추천 대상을 입력하세요."
        />
      </label>
      <label className="wide">
        썸네일 HTTPS URL
        <input
          name="thumbnailUrl"
          type="url"
          maxLength={500}
          defaultValue={course?.thumbnailUrl ?? ""}
        />
      </label>
      <label>
        전체 단계
        <input
          name="totalLevels"
          type="number"
          min={1}
          max={1000}
          defaultValue={course?.totalLevels ?? 100}
          required
        />
      </label>
      <label>
        통과 점수
        <input
          name="passingScore"
          type="number"
          min={0}
          max={100}
          defaultValue={course?.passingScore ?? 60}
          required
        />
      </label>
      <label>
        정렬 순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          max={10000}
          defaultValue={course?.displayOrder ?? 0}
          required
        />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={course?.active ?? true} />
        활성
      </label>
      <label className="check-label">
        <input
          name="published"
          type="checkbox"
          defaultChecked={course?.published ?? false}
        />
        공개
      </label>
      <button className="button button-dark" type="submit">
        {course ? "과정 변경사항 저장" : "과정 등록"}
      </button>
    </form>
  );
}
