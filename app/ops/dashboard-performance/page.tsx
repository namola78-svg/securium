import type { Metadata } from "next";
import { requireAuditViewer } from "@/lib/auth";
import { getDashboardPerformanceSnapshot } from "@/lib/ops-dashboard-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "대시보드 성능 진단 | SECURIUM",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPerformancePage() {
  const user = await requireAuditViewer("/ops/dashboard-performance");
  const snapshot = await getDashboardPerformanceSnapshot(user.id);
  const slowest = Object.entries(snapshot.timings).sort(
    ([, a], [, b]) => b.durationMs - a.durationMs,
  )[0];

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">OPERATIONS DIAGNOSTICS</p>
            <h1>대시보드 성능 진단</h1>
            <p>
              현재 관리자 계정의 대시보드 구성 함수별 응답 시간을 측정합니다.
              민감정보와 원본 학습 데이터는 표시하지 않습니다.
            </p>
          </div>
        </header>

        <section className="stats-grid" aria-label="대시보드 성능 요약">
          <Metric label="전체 지연" value={`${snapshot.durationMs}ms`} />
          <Metric
            label="가장 느린 구간"
            value={slowest ? `${slowest[0]} · ${slowest[1].durationMs}ms` : "-"}
          />
          <Metric
            label="수강 과정"
            value={`${snapshot.counts.enrollments ?? "-"}개`}
          />
          <Metric
            label="추천 항목"
            value={`${snapshot.counts.todayRecommendations ?? "-"}개`}
          />
        </section>

        <section className="section-block admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">TIMINGS</p>
              <h2>함수별 측정값</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">구간</th>
                  <th scope="col">상태</th>
                  <th scope="col">소요시간</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(snapshot.timings).map(([name, timing]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{timing.ok ? "정상" : "실패"}</td>
                    <td>{timing.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {snapshot.details.getTodayLearningPlan ? (
          <section className="section-block admin-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">TODAY PLAN BREAKDOWN</p>
                <h2>오늘 학습 계획 내부 측정값</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">상태</th>
                    <th scope="col">소요시간</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(snapshot.details.getTodayLearningPlan).map(
                    ([name, timing]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{timing.ok ? "정상" : "실패"}</td>
                        <td>{timing.durationMs}ms</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="section-block admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">REQUEST</p>
              <h2>요청 식별자</h2>
              <p>Vercel 로그와 대조할 때 사용할 수 있는 공개 식별자입니다.</p>
            </div>
          </div>
          <code>{snapshot.requestId}</code>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
