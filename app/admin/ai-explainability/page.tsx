import { listAdminAIExplainabilityTraces } from "@/db/ai-explainability-repositories";
import type { AIExplainabilityTraceSource } from "@/lib/ai/explainability";
import { requireAuditViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAIExplainabilityPage({
  searchParams,
}: PageProps) {
  await requireAuditViewer("/admin/ai-explainability");
  const rawParams = (await searchParams) ?? {};
  const filters = {
    source: parseSource(readParam(rawParams.source)),
    courseId: readParam(rawParams.courseId),
    provider: readParam(rawParams.provider),
    status: readParam(rawParams.status),
    requestId: readParam(rawParams.requestId),
  };
  const { traces, summary } = await listAdminAIExplainabilityTraces(50, filters);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">AI EXPLAINABILITY</p>
        <h1>AI 설명 가능성 콘솔</h1>
        <p>
          AI 요청이 어떤 개념을 감지했고, 어떤 별칭으로 확장했으며,
          어떤 근거와 지표를 사용했는지 관리자 전용으로 확인합니다.
        </p>
      </header>

      <section className="admin-summary-grid" aria-label="AI trace summary">
        <div className="admin-panel">
          <p className="eyebrow">TRACE</p>
          <strong>{summary.count}</strong>
          <span>최근 기록</span>
        </div>
        <div className="admin-panel">
          <p className="eyebrow">TOKENS</p>
          <strong>{summary.totalTokens.toLocaleString()}</strong>
          <span>입력+출력 합계</span>
        </div>
        <div className="admin-panel">
          <p className="eyebrow">LATENCY</p>
          <strong>{summary.averageLatencyMs.toLocaleString()}ms</strong>
          <span>평균 응답 시간</span>
        </div>
        <div className="admin-panel">
          <p className="eyebrow">COST</p>
          <strong>{summary.totalCostMicros.toLocaleString()}</strong>
          <span>추정 비용(micros)</span>
        </div>
      </section>

      <section className="admin-panel ai-explainability-policy">
        <h2>보안 정책</h2>
        <p>
          Prompt Viewer는 원문 프롬프트와 답안 원문을 저장하거나 노출하지
          않습니다. 대신 fingerprint, 검색 근거, citation, token/latency/cost
          지표만 표시합니다.
        </p>
      </section>

      <form className="admin-panel ai-trace-filter-form" action="/admin/ai-explainability">
        <label>
          Source
          <select name="source" defaultValue={filters.source ?? ""}>
            <option value="">All</option>
            <option value="QUESTION_EXPLANATION">Question explanation</option>
            <option value="SPECIALIZED_REVIEW">Specialized review</option>
          </select>
        </label>
        <label>
          Course ID
          <input
            name="courseId"
            defaultValue={filters.courseId ?? ""}
            placeholder="course-ise"
            maxLength={120}
          />
        </label>
        <label>
          Provider
          <select name="provider" defaultValue={filters.provider ?? ""}>
            <option value="">All</option>
            <option value="mock">Mock</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>
          Status
          <input
            name="status"
            defaultValue={filters.status ?? ""}
            placeholder="generated, failed, PENDING..."
            maxLength={80}
          />
        </label>
        <label>
          Request ID
          <input
            name="requestId"
            defaultValue={filters.requestId ?? ""}
            placeholder="partial request id"
            maxLength={200}
          />
        </label>
        <div className="ai-trace-filter-actions">
          <button className="button button-dark" type="submit">Filter</button>
          <a className="button button-ghost" href="/admin/ai-explainability">Reset</a>
        </div>
      </form>

      <section className="ai-trace-list" aria-label="AI explainability traces">
        {traces.length ? (
          traces.map((trace) => (
            <article className="admin-panel ai-trace-card" key={trace.id}>
              <header className="ai-trace-header">
                <div>
                  <p className="eyebrow">{trace.source.replaceAll("_", " ")}</p>
                  <h2>{trace.courseName} · {trace.targetType}</h2>
                  <p>{trace.userEmail} · {trace.generatedAt}</p>
                </div>
                <div className="admin-ai-badges">
                  <span className="status-badge">{trace.provider}</span>
                  <span className="status-badge">{trace.generationStatus}</span>
                  {trace.reviewStatus ? (
                    <span className="status-badge">{trace.reviewStatus}</span>
                  ) : null}
                </div>
              </header>

              <dl className="ai-trace-facts">
                <div>
                  <dt>Request ID</dt>
                  <dd>{trace.requestId}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{trace.model}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{trace.targetId}</dd>
                </div>
                <div>
                  <dt>Token / Latency / Cost</dt>
                  <dd>
                    {trace.metrics.totalTokens.toLocaleString()} tokens ·{" "}
                    {trace.metrics.latencyMs.toLocaleString()}ms ·{" "}
                    {trace.metrics.estimatedCostMicros.toLocaleString()} micros
                  </dd>
                </div>
              </dl>

              <div className="ai-trace-grid">
                <details open>
                  <summary>Concept Detection</summary>
                  {trace.detectedConcepts.length ? (
                    <ul>
                      {trace.detectedConcepts.map((concept) => (
                        <li key={concept}>{concept}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>감지된 ontology concept이 없습니다.</p>
                  )}
                </details>

                <details open>
                  <summary>Alias Expansion</summary>
                  <p>원문: {trace.aliasExpansion.originalQuery}</p>
                  <p>
                    확장: {trace.aliasExpansion.expandedQueries.join(", ") || "없음"}
                  </p>
                </details>

                <details>
                  <summary>Retrieval Trace / Context Viewer</summary>
                  {trace.contexts.length ? (
                    <ol>
                      {trace.contexts.map((context) => (
                        <li key={context.id}>
                          <strong>{context.title}</strong>
                          <small>{context.kind} · {context.id}</small>
                          <p>{context.excerpt}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>저장된 근거 context가 없습니다.</p>
                  )}
                </details>

                <details>
                  <summary>Prompt Viewer</summary>
                  <dl>
                    <div>
                      <dt>Fingerprint</dt>
                      <dd>{trace.promptViewer.fingerprint}</dd>
                    </div>
                    <div>
                      <dt>Full prompt stored</dt>
                      <dd>{String(trace.promptViewer.fullPromptStored)}</dd>
                    </div>
                  </dl>
                  <p>{trace.promptViewer.note}</p>
                </details>

                <details>
                  <summary>Citation Viewer</summary>
                  {trace.citations.length ? (
                    <ul>
                      {trace.citations.map((citation) => (
                        <li key={citation.id}>
                          {citation.title} · {citation.kind}
                          {citation.reviewedAt ? ` · ${citation.reviewedAt}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>표시할 citation이 없습니다.</p>
                  )}
                </details>

                <details>
                  <summary>AI Feedback / Result</summary>
                  <p>{trace.disclaimer}</p>
                  {trace.errorCode ? <p>오류 코드: {trace.errorCode}</p> : null}
                  <pre>{JSON.stringify(trace.result, null, 2)}</pre>
                </details>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>표시할 AI trace가 없습니다.</strong>
            <p>학습자가 AI 해설 또는 특화 AI 검토를 요청하면 여기에 기록됩니다.</p>
          </div>
        )}
      </section>
    </>
  );
}

function readParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}

function parseSource(
  value: string | undefined,
): AIExplainabilityTraceSource | undefined {
  return value === "QUESTION_EXPLANATION" || value === "SPECIALIZED_REVIEW"
    ? value
    : undefined;
}
