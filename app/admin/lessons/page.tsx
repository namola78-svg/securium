import Link from "next/link";

import {
  AdminArchiveButton,
  AdminLearningUnitForm,
  AdminLessonForm,
} from "@/components/admin-lesson-form";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  listAdminLearningUnits,
  listAdminLessons,
  listLearningScopeOptions,
} from "@/db/lesson-repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function publicationBadge(active: boolean, published: boolean) {
  if (!active) return { label: "비활성", tone: "danger" as const };
  if (!published) return { label: "비공개", tone: "warning" as const };
  return { label: "공개", tone: "success" as const };
}

export default async function AdminLessonsPage() {
  await requireCatalogManager("/admin/lessons");
  const [scopes, learningUnits, lessons] = await Promise.all([
    listLearningScopeOptions(),
    listAdminLearningUnits(),
    listAdminLessons(),
  ]);

  const publishedUnits = learningUnits.filter(
    (unit) => unit.active && unit.published,
  ).length;
  const unpublishedUnits = learningUnits.length - publishedUnits;
  const publishedLessons = lessons.filter(
    (lesson) => lesson.active && lesson.published,
  ).length;
  const draftLessons = lessons.length - publishedLessons;
  const totalMinutes = lessons.reduce(
    (sum, lesson) => sum + Number(lesson.estimatedMinutes ?? 0),
    0,
  );
  const latestLesson = lessons[0];

  return (
    <>
      <SectionHeader
        eyebrow="THEORY CMS"
        title="학습단위와 본문 레슨"
        description="Course, Subject, Topic 구조를 재사용해 학습단위, 완료 정책, 본문 레슨, 공개 상태를 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "콘텐츠", href: "/admin/shared-content" },
          { label: "이론 레슨", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/shared-content">
              공유 콘텐츠
            </Link>
            <Link className="button button-secondary" href="/admin/curriculum">
              커리큘럼 연결
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="이론 학습 CMS 현황">
        <MetricCard
          label="학습단위"
          value={learningUnits.length}
          description={`${publishedUnits}개 공개 · ${unpublishedUnits}개 비공개/비활성`}
        />
        <MetricCard
          label="본문 레슨"
          value={lessons.length}
          description={`${publishedLessons}개 공개 · ${draftLessons}개 검토/비공개`}
        />
        <MetricCard
          label="예상 학습량"
          value={`${totalMinutes}분`}
          description="등록된 레슨 예상 시간 합계"
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone={draftLessons ? "warning" : "success"}>
              {draftLessons ? "검토 필요" : "전체 공개 가능"}
            </StatusBadge>
            <StatusBadge tone="info">진도 기록 보존</StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/lessons">
            새로고침
          </Link>
        }
      >
        <strong>이론 콘텐츠 작업공간</strong>
        <span>
          공개된 레슨을 수정해도 사용자 진도 기록은 삭제하지 않고, 보관 또는
          비공개 처리를 우선합니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <h2>새 학습단위</h2>
              <AdminLearningUnitForm scopes={scopes} />
            </section>

            <section className="admin-panel">
              <h2>학습단위 {learningUnits.length}개</h2>
              {learningUnits.length ? (
                <div className="admin-record-list">
                  {learningUnits.map((unit) => {
                    const badge = publicationBadge(unit.active, unit.published);
                    return (
                      <details className="admin-record" key={unit.id}>
                        <summary>
                          <span>
                            <strong>{unit.title}</strong>
                            <small>
                              {unit.courseName} · {unit.subjectName} ·{" "}
                              {unit.topicName ?? "과목 공통"}
                            </small>
                          </span>
                          <span className="button-row">
                            <StatusBadge compact tone={badge.tone}>
                              {badge.label}
                            </StatusBadge>
                            <small>{unit.completionPolicy}</small>
                          </span>
                        </summary>
                        <AdminLearningUnitForm scopes={scopes} initial={unit} />
                        <AdminArchiveButton
                          id={unit.id}
                          endpoint="/api/admin/learning-units"
                          label={unit.title}
                        />
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 학습단위가 없습니다.</strong>
                  <p>과정과 과목을 선택해 첫 학습단위를 생성하세요.</p>
                </div>
              )}
            </section>

            <section className="admin-panel">
              <h2>새 레슨</h2>
              <AdminLessonForm units={learningUnits} topics={scopes.topics} />
            </section>

            <section className="admin-panel">
              <h2>등록된 레슨 {lessons.length}개</h2>
              {lessons.length ? (
                <div className="admin-record-list">
                  {lessons.map((lesson) => {
                    const badge = publicationBadge(
                      lesson.active,
                      lesson.published,
                    );
                    return (
                      <details className="admin-record" key={lesson.id}>
                        <summary>
                          <span>
                            <strong>{lesson.title}</strong>
                            <small>
                              {lesson.courseName} · {lesson.subjectName} ·{" "}
                              {lesson.learningUnitTitle ?? "연결 전 레슨"}
                            </small>
                          </span>
                          <span className="button-row">
                            <StatusBadge compact tone={badge.tone}>
                              {badge.label}
                            </StatusBadge>
                            <small>
                              v{lesson.version} · {lesson.estimatedMinutes}분
                            </small>
                          </span>
                        </summary>
                        <div className="button-row">
                          <Link
                            className="button button-ghost"
                            href={`/admin/lessons/${lesson.id}/preview`}
                          >
                            미리보기
                          </Link>
                          <AdminArchiveButton
                            id={lesson.id}
                            endpoint="/api/admin/lessons"
                            label={lesson.title}
                          />
                        </div>
                        <AdminLessonForm
                          units={learningUnits}
                          topics={scopes.topics}
                          initial={lesson}
                        />
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 본문 레슨이 없습니다.</strong>
                  <p>학습단위를 만든 뒤 레슨 본문을 연결하세요.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="LESSON INSPECTOR"
            title={latestLesson ? latestLesson.title : "검토할 레슨이 없습니다"}
            description={
              latestLesson
                ? "가장 최근 목록 기준 레슨의 공개 상태와 연결 범위를 확인합니다."
                : "레슨을 생성하면 과정·과목·주제 연결과 공개 상태가 표시됩니다."
            }
            badges={
              latestLesson
                ? [
                    publicationBadge(latestLesson.active, latestLesson.published),
                    { label: latestLesson.contentFormat, tone: "info" },
                  ]
                : [{ label: "EMPTY", tone: "neutral" }]
            }
            meta={
              latestLesson
                ? [
                    { label: "레슨 ID", value: latestLesson.id },
                    { label: "과정", value: latestLesson.courseName },
                    { label: "과목", value: latestLesson.subjectName },
                    { label: "주제", value: latestLesson.topicName },
                    {
                      label: "학습단위",
                      value: latestLesson.learningUnitTitle ?? "연결 전",
                    },
                    {
                      label: "예상 시간",
                      value: `${latestLesson.estimatedMinutes}분`,
                    },
                    { label: "버전", value: `v${latestLesson.version}` },
                    { label: "수정일", value: formatDate(latestLesson.updatedAt) },
                  ]
                : [
                    { label: "학습단위", value: learningUnits.length },
                    { label: "본문 레슨", value: lessons.length },
                  ]
            }
            actions={
              latestLesson ? (
                <Link
                  className="button button-secondary"
                  href={`/admin/lessons/${latestLesson.id}/preview`}
                >
                  최신 레슨 미리보기
                </Link>
              ) : (
                <Link className="button button-secondary" href="/admin/curriculum">
                  커리큘럼 확인
                </Link>
              )
            }
          >
            <p>
              진행 기록이 있는 레슨은 물리 삭제보다 비공개 또는 보관 처리를
              우선합니다. CourseLesson 연결이 필요한 경우 커리큘럼 연결 화면에서
              과정별 노드와 매핑하세요.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
