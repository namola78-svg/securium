import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseStatistics } from "@/db/phase3-repositories";
import {
  getCourseById,
  getEnrollmentForCourse,
  listCurriculum,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await requireCurrentAppUser(`/analytics/${courseId}`);
  const [course, enrollment, curriculum] = await Promise.all([
    getCourseById(courseId),
    getEnrollmentForCourse(user.id, courseId),
    listCurriculum(courseId),
  ]);
  if (!course || !enrollment) notFound();
  const stats = await getCourseStatistics(user.id, courseId);
  const subjectNameById = new Map(
    curriculum.map((subject) => [subject.id, subject.name]),
  );
  const topicMetaById = new Map(
    curriculum.flatMap((subject) =>
      subject.topics.map((topic) => [
        topic.id,
        { name: topic.name, subjectId: subject.id },
      ] as const),
    ),
  );
  const weakTopics = [...stats.byTopic]
    .filter((item) => item.id !== "UNMAPPED")
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">COURSE ANALYTICS</p>
            <h1>{course.name} 학습분석</h1>
            <p>
              정답률 분모가 없는 항목은 0%로 안전하게 표시합니다. 낮은
              정답률 영역은 바로 문제풀이로 이어갈 수 있습니다.
            </p>
          </div>
          <Link
            className="button button-dark"
            href={`/practice/${course.slug}?count=10`}
          >
            문제풀이 시작
          </Link>
        </header>
        <section className="stats-grid">
          <Metric label="전체 정답률" value={stats.overallAccuracy} unit="%" />
          <Metric label="최근 7일" value={stats.recent7Days} unit="문제" />
          <Metric
            label="평균 응답"
            value={Math.round(stats.averageResponseTime / 1000)}
            unit="초"
          />
          <Metric label="모의고사 평균" value={stats.mockExamAverageScore} unit="점" />
        </section>
        <section className="analytics-grid section-block">
          <Breakdown title="난이도별 정답률" rows={stats.byDifficulty} />
          <Breakdown title="문제 유형별 정답률" rows={stats.byType} />
          <Breakdown
            title="과목별 정답률"
            rows={stats.bySubject.map((row) => ({
              ...row,
              label: subjectNameById.get(row.id) ?? row.id,
              href:
                row.id === "UNMAPPED"
                  ? undefined
                  : `/practice/${course.slug}?subjectId=${row.id}&count=10`,
            }))}
          />
          <Breakdown
            title="주제별 우선 복습 영역"
            rows={weakTopics.map((row) => {
              const topic = topicMetaById.get(row.id);
              const params = new URLSearchParams({ topicId: row.id, count: "10" });
              if (topic?.subjectId) params.set("subjectId", topic.subjectId);
              return {
                ...row,
                label: topic?.name ?? row.id,
                href: `/practice/${course.slug}?${params.toString()}`,
              };
            })}
            weakFirst
          />
        </section>
        <section className="stats-grid section-block">
          <Metric label="최근 30일" value={stats.recent30Days} unit="문제" />
          <Metric label="반복 오답" value={stats.repeatedWrongCount} unit="문제" />
          <Metric label="복습 성공률" value={stats.reviewSuccessRate} unit="%" />
          <Metric label="단계 완료율" value={stats.levelCompletionRate} unit="%" />
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  weakFirst = false,
}: {
  title: string;
  rows: Array<{
    id: string;
    total: number;
    accuracy: number;
    label?: string;
    href?: string;
  }>;
  weakFirst?: boolean;
}) {
  return (
    <section className="admin-panel analytics-panel">
      <h2>{title}</h2>
      {rows.length ? (
        rows.map((row) => (
          <div className="bar-row analytics-action-row" key={row.id}>
            <div>
              <strong>{row.label ?? row.id}</strong>
              <span>
                {row.total}문제 · {row.accuracy}%
                {weakFirst && row.accuracy < 70 ? " · 우선 복습 권장" : ""}
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${row.accuracy}%` }} />
            </div>
            {row.href ? (
              <Link className="button button-ghost" href={row.href}>
                문제 풀기
              </Link>
            ) : null}
          </div>
        ))
      ) : (
        <p>집계할 학습 기록이 없습니다.</p>
      )}
    </section>
  );
}
