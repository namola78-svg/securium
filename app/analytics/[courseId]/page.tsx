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
  const weakestTopic = weakTopics[0];
  const weakestTopicMeta = weakestTopic
    ? topicMetaById.get(weakestTopic.id)
    : undefined;
  const weakestTopicParams = weakestTopic
    ? new URLSearchParams({ topicId: weakestTopic.id, count: "10" })
    : undefined;
  if (weakestTopicParams && weakestTopicMeta?.subjectId) {
    weakestTopicParams.set("subjectId", weakestTopicMeta.subjectId);
  }

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">과정 학습분석</p>
            <h1>{course.name} 학습분석</h1>
            <p>
              정답률, 최근 학습량, 반복 오답, 복습 성공률을 과정 범위 안에서
              분석합니다.
            </p>
          </div>
          <Link
            className="button button-dark"
            href={`/practice/${course.slug}?count=10`}
          >
            문제풀이 시작
          </Link>
        </header>

        <section className="analytics-overview-panel" aria-label="과정 분석 요약">
          <div>
            <p className="eyebrow">과정 학습 신호</p>
            <h2>
              {stats.totalQuestions
                ? `현재 정답률 ${stats.overallAccuracy}%`
                : "이 과정의 학습 기록이 아직 없습니다"}
            </h2>
            <p>
              분모가 없는 지표는 안전하게 0으로 표시합니다. 학습 기록이 쌓이면
              취약 과목과 주제를 더 정확하게 추천합니다.
            </p>
          </div>
          <dl>
            <div>
              <dt>전체 정답률</dt>
              <dd>{stats.overallAccuracy}%</dd>
            </div>
            <div>
              <dt>최근 7일</dt>
              <dd>{stats.recent7Days}문제</dd>
            </div>
            <div>
              <dt>반복 오답</dt>
              <dd>{stats.repeatedWrongCount}문제</dd>
            </div>
            <div>
              <dt>단계 완료</dt>
              <dd>{stats.levelCompletionRate}%</dd>
            </div>
          </dl>
        </section>

        <section className="analytics-action-panel" aria-label="과정 분석 추천 행동">
          <div>
            <p className="eyebrow">우선 확인 영역</p>
            <h2>우선 확인할 취약 영역</h2>
            {weakestTopic ? (
              <p>
                {weakestTopicMeta?.name ?? weakestTopic.id} 정답률이{" "}
                {weakestTopic.accuracy}%입니다. 해당 주제 문제를 먼저 풀어보세요.
              </p>
            ) : (
              <p>주제별 분석은 문제풀이 기록이 쌓이면 표시됩니다.</p>
            )}
          </div>
          {weakestTopic && weakestTopicParams ? (
            <Link
              className="button button-dark"
              href={`/practice/${course.slug}?${weakestTopicParams.toString()}`}
            >
              취약 주제 풀기
            </Link>
          ) : (
            <Link className="button button-dark" href={`/practice/${course.slug}?count=10`}>
              문제 10개 풀기
            </Link>
          )}
        </section>

        <section className="analytics-learner-answer-panel section-block" aria-label="학습 상태 핵심 질문">
          <div>
            <span>01</span>
            <strong>어디까지 했지?</strong>
            <p>단계 완료율 {stats.levelCompletionRate}% · 최근 7일 {stats.recent7Days}문제</p>
          </div>
          <div>
            <span>02</span>
            <strong>다음은 뭘 하지?</strong>
            <p>
              {weakestTopic
                ? `${weakestTopicMeta?.name ?? weakestTopic.id} 문제부터 보완`
                : "과정 문제 10개를 풀어 분석 신호 만들기"}
            </p>
          </div>
          <div>
            <span>03</span>
            <strong>얼마나 남았지?</strong>
            <p>전체 정답률 {stats.overallAccuracy}% · 이 과정 기준으로 계속 집계</p>
          </div>
          <div>
            <span>04</span>
            <strong>어디가 약하지?</strong>
            <p>
              {weakestTopic
                ? `최저 정답률 ${weakestTopic.accuracy}% 영역 우선`
                : `반복 오답 ${stats.repeatedWrongCount}문제 확인`}
            </p>
          </div>
        </section>

        <section className="analytics-action-strip section-block" aria-label="과정 분석 다음 행동">
          <Link
            className="analytics-action-card analytics-action-card-primary"
            href={
              weakestTopic && weakestTopicParams
                ? `/practice/${course.slug}?${weakestTopicParams.toString()}`
                : `/practice/${course.slug}?count=10`
            }
          >
            <span>01 · 취약 영역</span>
            <strong>
              {weakestTopic
                ? weakestTopicMeta?.name ?? weakestTopic.id
                : "학습 기록이 더 필요해요"}
            </strong>
            <p>
              {weakestTopic
                ? `정답률 ${weakestTopic.accuracy}% 영역을 먼저 보완하세요.`
                : "문제풀이 기록이 쌓이면 우선 영역을 추천합니다."}
            </p>
          </Link>
          <Link
            className="analytics-action-card"
            href={`/practice/${course.slug}?count=10`}
          >
            <span>02 · 추가 풀이</span>
            <strong>과정 문제 10개 풀기</strong>
            <p>새 풀이 기록으로 과목·주제별 분석 정확도를 높입니다.</p>
          </Link>
          <Link className="analytics-action-card" href="/reviews">
            <span>03 · 복습 연결</span>
            <strong>오늘의 복습으로 이동</strong>
            <p>반복 오답과 예정 복습을 정리해 취약 신호를 줄입니다.</p>
          </Link>
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
              const practiceParams = new URLSearchParams({
                topicId: row.id,
                count: "10",
              });
              if (topic?.subjectId) practiceParams.set("subjectId", topic.subjectId);
              return {
                ...row,
                label: topic?.name ?? row.id,
                href: `/practice/${course.slug}?${practiceParams.toString()}`,
              };
            })}
            weakFirst
          />
        </section>

        <section className="stats-grid section-block">
          <Metric label="최근 30일" value={stats.recent30Days} unit="문제" />
          <Metric
            label="평균 응답"
            value={Math.round(stats.averageResponseTime / 1000)}
            unit="초"
          />
          <Metric label="복습 성공률" value={stats.reviewSuccessRate} unit="%" />
          <Metric label="모의고사 평균" value={stats.mockExamAverageScore} unit="점" />
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
