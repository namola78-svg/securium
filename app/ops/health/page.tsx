import type { Metadata } from "next";
import { getDatabaseProvider } from "@/db";
import {
  isProductionEnvironment,
  validateRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/environment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "운영 상태 | SECURIUM",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OperationsHealthPage() {
  const snapshot = await getOperationsHealthSnapshot();

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">OPERATIONS HEALTH</p>
            <h1>운영 상태</h1>
            <p>
              공개 가능한 런타임 지연 시간만 표시합니다. 비밀키, 토큰, DB 연결
              문자열은 표시하지 않습니다.
            </p>
          </div>
        </header>

        <section className="stats-grid" aria-label="운영 상태 지표">
          <Metric label="상태" value={snapshot.status} />
          <Metric
            label="DB 지연"
            value={
              snapshot.databaseLatencyMs === null
                ? "측정 실패"
                : `${snapshot.databaseLatencyMs}ms`
            }
          />
          <Metric label="전체 지연" value={`${snapshot.durationMs}ms`} />
          <Metric label="런타임" value="nodejs" />
        </section>

        <section className="section-block admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">REQUEST</p>
              <h2>요청 식별자</h2>
              <p>
                문제가 재현될 때 이 값을 Vercel 로그와 대조하면 같은 요청을
                추적할 수 있습니다.
              </p>
            </div>
          </div>
          <code>{snapshot.requestId}</code>
        </section>
      </div>
    </main>
  );
}

async function getOperationsHealthSnapshot() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let databaseLatencyMs: number | null = null;
  let status: "ok" | "unavailable" = "unavailable";

  try {
    const environment = process.env as RuntimeEnvironment;
    const production =
      isProductionEnvironment(environment) ||
      process.env.VERCEL_ENV === "production";
    validateRuntimeEnvironment(environment, production);

    const database = await getDatabaseProvider();
    const databaseStartedAt = Date.now();
    const healthy = await database.healthCheck();
    databaseLatencyMs = Date.now() - databaseStartedAt;
    status = healthy ? "ok" : "unavailable";
  } catch {
    status = "unavailable";
  }

  const durationMs = Date.now() - startedAt;

  return { databaseLatencyMs, durationMs, requestId, status };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
