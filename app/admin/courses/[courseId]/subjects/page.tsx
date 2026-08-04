import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { getCourseById, listSubjectsForCourse } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

type PageProps = { params: Promise<{ courseId: string }> };
type Subject = Awaited<ReturnType<typeof listSubjectsForCourse>>[number];

export default async function AdminSubjectsPage({ params }: PageProps) {
  await requireCatalogManager("/admin/courses");
  const { courseId } = await params;
  const [course, subjects] = await Promise.all([
    getCourseById(courseId),
    listSubjectsForCourse(courseId),
  ]);
  if (!course) notFound();
  const returnTo = `/admin/courses/${course.id}/subjects`;
  const activeSubjects = subjects.filter((subject) => subject.active).length;
  const inactiveSubjects = subjects.length - activeSubjects;
  const firstSubject = subjects[0];

  return (
    <>
      <SectionHeader
        eyebrow="SUBJECTS"
        title={`${course.name} 과목 관리`}
        description="과정별 과목 구조를 관리합니다. 과목은 주제, 레슨, 문제 연결의 상위 단위로 사용됩니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정", href: "/admin/courses" },
          { label: course.name, href: `/admin/courses/${course.id}` },
          { label: "과목", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="success">활성 {activeSubjects}</StatusBadge>
            <StatusBadge tone={inactiveSubjects ? "warning" : "neutral"}>
              비활성 {inactiveSubjects}
            </StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="brand">
              {course.code}
            </StatusBadge>
            <StatusBadge compact tone="info">
              {subjects.length}개 과목
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href={`/admin/courses/${course.id}`}>
              과정 설정
            </Link>
            <Link className="button ghost" href="/admin/curriculum">
              커리큘럼 관리
            </Link>
          </>
        }
      >
        <span>과목 정렬과 활성 상태는 학습자 커리큘럼 탐색과 관리자 문제 분류에 함께 영향을 줍니다.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="과목 운영 현황">
        <MetricCard
          label="전체 과목"
          value={subjects.length}
          description="삭제되지 않은 과목"
        />
        <MetricCard
          label="활성 과목"
          value={activeSubjects}
          description="학습 흐름에 사용할 수 있는 과목"
        />
        <MetricCard
          label="비활성 과목"
          value={inactiveSubjects}
          description="숨김 또는 운영 보류 과목"
        />
        <MetricCard
          label="다음 작업"
          value="주제 연결"
          description="과목별 세부 주제를 구성하세요"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">CREATE SUBJECT</p>
                  <h2>새 과목 등록</h2>
                </div>
                <StatusBadge compact tone="brand">
                  과정 하위 단위
                </StatusBadge>
              </div>
              <SubjectForm courseId={course.id} returnTo={returnTo} />
            </section>

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">SUBJECT LIST</p>
                  <h2>등록된 과목</h2>
                </div>
                <StatusBadge compact tone={subjects.length ? "info" : "neutral"}>
                  {subjects.length}건
                </StatusBadge>
              </div>

              {subjects.length ? (
                <div className="admin-record-list">
                  {subjects.map((subject) => (
                    <details key={subject.id} className="admin-record">
                      <summary>
                        <span>
                          <strong>{subject.name}</strong>
                          <small>
                            {subject.code} · 정렬 {subject.displayOrder}
                          </small>
                        </span>
                        <span className="row-actions">
                          <StatusBadge compact tone={subject.active ? "success" : "neutral"}>
                            {subject.active ? "활성" : "비활성"}
                          </StatusBadge>
                          <Link
                            className="text-link"
                            href={`/admin/subjects/${subject.id}/topics`}
                          >
                            주제 관리
                          </Link>
                        </span>
                      </summary>
                      <SubjectForm
                        courseId={course.id}
                        returnTo={returnTo}
                        subject={subject}
                      />
                    </details>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 과목이 없습니다.</strong>
                  <p>첫 과목을 등록하면 주제와 커리큘럼 노드를 연결할 수 있습니다.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={firstSubject?.name ?? "과목 없음"}
            description={
              firstSubject?.description ||
              "과목을 선택하거나 등록하면 세부 정보와 다음 작업이 이곳에 표시됩니다."
            }
            badges={
              firstSubject
                ? [
                    {
                      label: firstSubject.active ? "활성" : "비활성",
                      tone: firstSubject.active ? "success" : "neutral",
                    },
                    { label: firstSubject.code, tone: "brand" },
                  ]
                : [{ label: "등록 필요", tone: "warning" }]
            }
            meta={
              firstSubject
                ? [
                    { label: "Subject ID", value: firstSubject.id },
                    { label: "과정", value: course.name },
                    { label: "코드", value: firstSubject.code },
                    { label: "정렬순서", value: firstSubject.displayOrder },
                  ]
                : []
            }
            actions={
              firstSubject ? (
                <Link
                  className="button ghost"
                  href={`/admin/subjects/${firstSubject.id}/topics`}
                >
                  주제 관리
                </Link>
              ) : (
                <Link className="button ghost" href={`/admin/courses/${course.id}`}>
                  과정 설정으로 이동
                </Link>
              )
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>과정별 분리</span>
                <strong>과목은 courseId 기준으로 완전히 분리</strong>
                <small>동일 과정군 안에서도 기사·산업기사 과목과 진도는 별도로 관리됩니다.</small>
              </div>
              <div className="admin-record">
                <span>다음 연결</span>
                <strong>주제 → CurriculumNode → 콘텐츠</strong>
                <small>과목 등록 후 주제 관리 화면에서 세부 구조를 구성하세요.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}

function SubjectForm({
  courseId,
  returnTo,
  subject,
}: {
  courseId: string;
  returnTo: string;
  subject?: Subject;
}) {
  return (
    <form className="admin-form" action="/api/admin/subjects" method="post">
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        코드
        <input
          name="code"
          required
          pattern="[A-Z0-9_]+"
          minLength={2}
          maxLength={50}
          defaultValue={subject?.code}
          placeholder="NETWORK_SECURITY"
        />
      </label>
      <label>
        이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={subject?.name}
          placeholder="네트워크 보안"
        />
      </label>
      <label className="wide">
        설명
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={subject?.description}
          placeholder="과목의 학습 범위와 목표를 입력하세요."
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
          defaultValue={subject?.displayOrder ?? 0}
        />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={subject?.active ?? true} />
        활성
      </label>
      <button className="button button-dark" type="submit">
        {subject ? "과목 변경 저장" : "과목 등록"}
      </button>
    </form>
  );
}
