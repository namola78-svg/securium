import {
  getAdminOperationalStats,
  listAdminMockExams,
} from "@/db/phase3-repositories";
import Link from "next/link";
import { listAllCourses } from "@/db/repositories";
import {
  InspectorPanel,
  InspectorSection,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  await requireCatalogManager("/admin/analytics");
  const { courseId } = await searchParams;
  const [courses, exams, stats] = await Promise.all([
    listAllCourses(),
    listAdminMockExams(courseId),
    getAdminOperationalStats(courseId),
  ]);
  const selectedCourse = courseId
    ? courses.find((course) => course.id === courseId)
    : null;
  const distributionTotal = stats.scoreDistribution.reduce(
    (total, item) => total + item.count,
    0,
  );
  const hasWeakSignals = stats.mostWrong.length > 0 || stats.weakTopics.length > 0;

  return (
    <>
      <SectionHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Analytics", current: true },
        ]}
        eyebrow="OPERATIONS ANALYTICS"
        title="학습 운영 통계"
        description="개인정보 원문을 노출하지 않는 집계값으로 응시 현황, 점수 분포, 반복 오답, 우선 복습 주제를 확인합니다."
      />

      <section className="stats-grid admin-stats" aria-label="운영 통계 요약">
        <MetricCard
          label="모의고사"
          value={exams.length}
          description={selectedCourse?.shortName ?? "전체 과정"}
        />
        <MetricCard
          label="응시"
          value={stats.attemptCount}
          description="선택 범위의 제출 완료 기준"
        />
        <MetricCard
          label="평균 점수"
          value={`${stats.averageScore}점`}
          description={stats.attemptCount ? "응시 데이터 기준" : "집계 데이터 없음"}
        />
        <MetricCard
          label="취약 신호"
          value={stats.mostWrong.length + stats.weakTopics.length}
          description="반복 오답과 우선 복습 주제"
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={courseId ? "info" : "brand"}>
              {selectedCourse?.shortName ?? "전체 과정"}
            </StatusBadge>
            <StatusBadge compact tone={hasWeakSignals ? "warning" : "success"}>
              {hasWeakSignals ? "복습 신호 있음" : "긴급 신호 없음"}
            </StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/analytics">
            필터 초기화
          </Link>
        }
      >
        <form method="get" className="filter-row analytics-filter-row">
          <label>
            과정 범위
            <select name="courseId" defaultValue={courseId ?? ""}>
              <option value="">전체 과정</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.shortName}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-dark" type="submit">
            조회
          </button>
        </form>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <section className="analytics-grid" aria-label="학습 운영 통계 상세">
            <article className="admin-panel">
              <h2>점수 분포</h2>
              {stats.scoreDistribution.map((item) => (
                <div className="analytics-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="analytics-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${
                          stats.attemptCount
                            ? (item.count / stats.attemptCount) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </article>

            <article className="admin-panel">
              <h2>많이 틀린 문제</h2>
              {stats.mostWrong.length ? (
                stats.mostWrong.map((item) => (
                  <div className="analytics-row" key={item.questionId}>
                    <span>{item.title}</span>
                    <strong>{item.count}회</strong>
                  </div>
                ))
              ) : (
                <p>집계된 오답 문제가 없습니다.</p>
              )}
            </article>

            <article className="admin-panel">
              <h2>우선 복습 주제</h2>
              {stats.weakTopics.length ? (
                stats.weakTopics.map((item) => (
                  <div className="analytics-row" key={item.topicId}>
                    <span>
                      {item.subjectName} · {item.topicName}
                    </span>
                    <strong>{item.wrongCount}회</strong>
                  </div>
                ))
              ) : (
                <p>집계된 주제별 오답이 없습니다.</p>
              )}
            </article>
          </section>
        }
        inspector={
          <InspectorPanel
            eyebrow="ANALYTICS INSPECTOR"
            title={selectedCourse?.name ?? "전체 과정 운영 지표"}
            description="Analytics Inspector는 선택된 과정 범위, 산식, 원천 데이터, 신뢰도 조건을 요약합니다."
            badges={[
              {
                label: courseId ? "과정 범위" : "전체 범위",
                tone: courseId ? "info" : "brand",
              },
              {
                label: stats.attemptCount ? "데이터 있음" : "응시 기록 없음",
                tone: stats.attemptCount ? "success" : "warning",
              },
            ]}
            meta={[
              { label: "과정", value: selectedCourse?.shortName ?? "전체" },
              { label: "응시 수", value: stats.attemptCount },
              { label: "분포 합계", value: distributionTotal },
              { label: "평균 점수", value: `${stats.averageScore}점` },
              { label: "반복 오답", value: stats.mostWrong.length },
              { label: "취약 주제", value: stats.weakTopics.length },
            ]}
            actions={
              <>
                <Link className="button button-primary" href="/admin/coverage">
                  Coverage
                </Link>
                <Link className="button button-ghost" href="/admin/questions">
                  Questions
                </Link>
              </>
            }
          >
            <InspectorSection
              title="Metric formula"
              description="평균 점수와 점수 분포는 선택한 과정 범위의 모의고사 응시 집계값을 기준으로 계산합니다."
            >
              <p>
                응시 수가 0이면 비율 계산을 수행하지 않고 0 또는 빈 상태로 표시하여
                0으로 나누는 오류를 방지합니다.
              </p>
            </InspectorSection>
            <InspectorSection
              title="Source data"
              description="문제·주제 취약 신호는 사용자 원문 답안이 아니라 집계된 오답 횟수만 사용합니다."
            >
              <p>
                운영자는 이 패널에서 지표의 범위와 신뢰 조건을 확인한 뒤 Coverage,
                Question, Review 화면으로 이동해 원인을 좁힐 수 있습니다.
              </p>
            </InspectorSection>
          </InspectorPanel>
        }
      />
    </>
  );
}
