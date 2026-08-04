import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  type Tone,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getCourseById,
  listAllCourseGroups,
  listAllCourses,
  listSubjectsForCourse,
} from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";
import { CourseForm } from "../page";

type PageProps = { params: Promise<{ courseId: string }> };

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

export default async function AdminCourseDetailPage({ params }: PageProps) {
  await requireCatalogManager("/admin/courses");
  const { courseId } = await params;
  const [course, groups, courseRows, subjects] = await Promise.all([
    getCourseById(courseId),
    listAllCourseGroups(),
    listAllCourses(),
    listSubjectsForCourse(courseId),
  ]);
  if (!course) notFound();
  const courseView = courseRows.find((row) => row.id === course.id);
  if (!courseView) notFound();

  const activeSubjects = subjects.filter((subject) => subject.active).length;

  return (
    <>
      <SectionHeader
        eyebrow="COURSE SETTINGS"
        title={course.name}
        description="과정을 비활성화해도 기존 수강·진도·풀이 기록은 삭제되지 않습니다. 공개 상태와 학습 구조를 신중하게 관리하세요."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정", href: "/admin/courses" },
          { label: course.name, current: true },
        ]}
        actions={
          <>
            <StatusBadge tone={statusTone(courseView.published)}>
              {courseView.published ? "공개" : "비공개"}
            </StatusBadge>
            <StatusBadge tone={statusTone(courseView.active)}>
              {courseView.active ? "활성" : "비활성"}
            </StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="brand">
              {courseView.code}
            </StatusBadge>
            <StatusBadge compact tone="info">
              {courseView.slug}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/courses">
              과정 목록
            </Link>
            <Link
              className="button ghost"
              href={`/admin/courses/${course.id}/subjects`}
            >
              과목 관리
            </Link>
          </>
        }
      >
        <span>과정 설정은 공개 목록, 학습 경로, 수강 CTA, 관리자 커리큘럼 연결에 함께 반영됩니다.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="과정 상세 현황">
        <MetricCard
          label="과목"
          value={subjects.length}
          description={`활성 ${activeSubjects}개`}
        />
        <MetricCard
          label="표시 단계"
          value={courseView.totalLevels}
          description="실제 단계는 Level 테이블에서 관리"
        />
        <MetricCard
          label="통과 기준"
          value={`${courseView.passingScore}점`}
          description="과정 기본 기준"
        />
        <MetricCard
          label="난이도"
          value={difficultyLabel(courseView.difficulty)}
          description="학습자 과정 카드에 표시"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">EDIT COURSE</p>
                  <h2>과정 기본 정보</h2>
                </div>
                <StatusBadge compact tone="brand">
                  DB 기반
                </StatusBadge>
              </div>
              <CourseForm groups={groups} course={courseView} />
            </section>

            <section className="admin-panel inline-panel">
              <div>
                <p className="eyebrow">CURRICULUM STRUCTURE</p>
                <h2>과목과 주제 구성</h2>
                <p>과정별 과목과 주제를 구성하고, 이후 CurriculumTree와 학습 콘텐츠를 연결합니다.</p>
              </div>
              <Link
                className="button button-dark"
                href={`/admin/courses/${course.id}/subjects`}
              >
                과목 관리
              </Link>
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={courseView.shortName}
            description={courseView.description || "과정 설명이 아직 입력되지 않았습니다."}
            badges={[
              {
                label: courseView.published ? "공개" : "비공개",
                tone: statusTone(courseView.published),
              },
              {
                label: courseView.active ? "활성" : "비활성",
                tone: statusTone(courseView.active),
              },
              {
                label: courseView.isSample ? "샘플" : "운영",
                tone: courseView.isSample ? "warning" : "success",
              },
            ]}
            meta={[
              { label: "과정군", value: courseView.groupName },
              { label: "Course ID", value: courseView.id },
              { label: "코드", value: courseView.code },
              { label: "Slug", value: courseView.slug },
              { label: "정렬순서", value: courseView.displayOrder },
              { label: "최근 수정", value: formatDate(courseView.updatedAt) },
            ]}
            actions={
              <>
                <Link className="button ghost" href={`/courses/${courseView.slug}`}>
                  공개 상세 보기
                </Link>
                <Link className="button ghost" href={`/learn/${courseView.slug}`}>
                  학습 화면 보기
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>데이터 격리</span>
                <strong>수강·진도·문제풀이 기록은 courseId 기준</strong>
                <small>기사와 산업기사는 같은 과정군이어도 기록이 분리됩니다.</small>
              </div>
              <div className="admin-record">
                <span>운영 주의</span>
                <strong>비공개는 노출 제어, 비활성은 학습 진입 제어</strong>
                <small>운영 전 두 상태의 의미를 구분해 확인하세요.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
