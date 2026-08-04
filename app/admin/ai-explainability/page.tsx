import { AdminAIExplainabilityFeedbackForm } from "@/components/admin-ai-explainability-feedback";
import {
  InspectorPanel,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAdminAIExplainabilityTraces } from "@/db/ai-explainability-repositories";
import type { AIExplainabilityTraceSource } from "@/lib/ai/explainability";
import { requireAuditViewer } from "@/lib/auth";
import Link from "next/link";

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
    feedbackRating: parseFeedbackRating(readParam(rawParams.feedbackRating)),
    feedbackIssueType: parseFeedbackIssueType(
      readParam(rawParams.feedbackIssueType),
    ),
  };
  const { traces, summary } = await listAdminAIExplainabilityTraces(50, filters);
  const feedbackTotal = traces.reduce(
    (total, trace) => total + trace.feedbackSummary.total,
    0,
  );
  const selectedTrace = traces[0] ?? null;
  const failedTraceCount = traces.filter((trace) =>
    String(trace.generationStatus).toLowerCase().includes("fail"),
  ).length;
  const reviewedTraceCount = traces.filter((trace) =>
    String(trace.reviewStatus ?? "").toLowerCase().includes("review"),
  ).length;

  return (
    <>
      <SectionHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI Trace", current: true },
        ]}
        eyebrow="AI EXPLAINABILITY"
        title="AI 설명 가능성 콘솔"
        description={
          <>
            AI 요청이 어떤 개념을 감지했고, 어떤 검색어로 확장됐으며, 어떤
            검수 근거와 citation을 사용했는지 관리자 전용으로 확인합니다.
          </>
        }
      />

      <section className="admin-summary-grid" aria-label="AI trace summary">
        <div className="admin-panel">
          <p className="eyebrow">TRACE</p>
          <strong>{summary.count}</strong>
          <span>최근 기록</span>
        </div>
        <div className="admin-panel">
          <p className="eyebrow">TOKENS</p>
          <strong>{summary.totalTokens.toLocaleString()}</strong>
          <span>입력과 출력 합계</span>
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
        <div className="admin-panel">
          <p className="eyebrow">FEEDBACK</p>
          <strong>{feedbackTotal.toLocaleString()}</strong>
          <span>관리자 피드백</span>
        </div>
      </section>

      <PageToolbar
        secondary={
          <>
            <Link className="button button-ghost" href="/admin/ontology">
              Ontology
            </Link>
            <Link className="button button-ghost" href="/admin/curriculum">
              Curriculum
            </Link>
          </>
        }
        primary={
          <Link className="button button-primary" href="/admin/ai-explainability">
            Reset trace view
          </Link>
        }
      >
        <span className="admin-toolbar-kicker">Trace scope</span>
        <strong>
          Source {filters.source ?? "all"} · Provider {filters.provider ?? "all"} ·
          Status {filters.status ?? "all"}
        </strong>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
      <section className="admin-panel ai-explainability-policy">
        <h2>보안 정책</h2>
        <p>
          Prompt Viewer는 전체 프롬프트, 원문 답안, 민감정보를 저장하거나
          노출하지 않습니다. 관리자 콘솔에는 fingerprint, 검수 근거,
          citation, token/latency/cost 지표만 표시합니다.
        </p>
      </section>

      <form
        className="admin-panel ai-trace-filter-form"
        action="/admin/ai-explainability"
      >
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
        <label>
          Feedback
          <select
            name="feedbackRating"
            defaultValue={filters.feedbackRating ?? ""}
          >
            <option value="">All</option>
            <option value="HELPFUL">Helpful</option>
            <option value="NOT_HELPFUL">Not helpful</option>
            <option value="NEEDS_REVIEW">Needs review</option>
          </select>
        </label>
        <label>
          Issue
          <select
            name="feedbackIssueType"
            defaultValue={filters.feedbackIssueType ?? ""}
          >
            <option value="">All</option>
            <option value="NONE">None</option>
            <option value="LOW_QUALITY_CONTEXT">Low quality context</option>
            <option value="MISSING_CITATION">Missing citation</option>
            <option value="WRONG_CONCEPT">Wrong concept</option>
            <option value="PROMPT_ISSUE">Prompt issue</option>
            <option value="SENSITIVE_CONTENT_RISK">
              Sensitive content risk
            </option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <div className="ai-trace-filter-actions">
          <button className="button button-dark" type="submit">
            Filter
          </button>
          <a className="button button-ghost" href="/admin/ai-explainability">
            Reset
          </a>
        </div>
      </form>

      <section className="ai-trace-list" aria-label="AI explainability traces">
        {traces.length ? (
          traces.map((trace) => (
            <article className="admin-panel ai-trace-card" key={trace.id}>
              <header className="ai-trace-header">
                <div>
                  <p className="eyebrow">{trace.source.replaceAll("_", " ")}</p>
                  <h2>
                    {trace.courseName} · {trace.targetType}
                  </h2>
                  <p>
                    {trace.userEmail} · {trace.generatedAt}
                  </p>
                </div>
                <div className="admin-ai-badges">
                  <span className="status-badge">{trace.provider}</span>
                  <span className="status-badge">{trace.generationStatus}</span>
                  {trace.reviewStatus ? (
                    <span className="status-badge">{trace.reviewStatus}</span>
                  ) : null}
                  {trace.feedbackSummary.total ? (
                    <span className="status-badge">
                      Feedback {trace.feedbackSummary.total}
                    </span>
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
                  <dl className="ai-feedback-summary">
                    <div>
                      <dt>Original query</dt>
                      <dd>{trace.aliasExpansion.originalQuery || "none"}</dd>
                    </div>
                    <div>
                      <dt>Expanded queries</dt>
                      <dd>
                        {trace.aliasExpansion.expandedQueries.join(", ") ||
                          "none"}
                      </dd>
                    </div>
                    <div>
                      <dt>Added queries</dt>
                      <dd>
                        {trace.aliasExpansion.addedQueries.join(", ") ||
                          "none"}
                      </dd>
                    </div>
                    <div>
                      <dt>Concept candidates</dt>
                      <dd>
                        {trace.aliasExpansion.scopedCandidateCount.toLocaleString()}{" "}
                        / {trace.aliasExpansion.candidateCount.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt>Course scope</dt>
                      <dd>{trace.aliasExpansion.courseId ?? "global"}</dd>
                    </div>
                  </dl>
                </details>

                <details>
                  <summary>Retrieval Trace / Context Viewer</summary>
                  {trace.contexts.length ? (
                    <ol>
                      {trace.contexts.map((context) => (
                        <li key={context.id}>
                          <strong>{context.title}</strong>
                          <small>
                            {context.kind} · {context.id}
                          </small>
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
                  <dl className="ai-feedback-summary">
                    <div>
                      <dt>Feedback count</dt>
                      <dd>{trace.feedbackSummary.total}</dd>
                    </div>
                    <div>
                      <dt>Helpful / Not helpful / Review</dt>
                      <dd>
                        {trace.feedbackSummary.helpful} /{" "}
                        {trace.feedbackSummary.notHelpful} /{" "}
                        {trace.feedbackSummary.needsReview}
                      </dd>
                    </div>
                    <div>
                      <dt>Latest</dt>
                      <dd>
                        {trace.feedbackSummary.latestRating ?? "None"}
                        {trace.feedbackSummary.latestIssueType
                          ? ` · ${trace.feedbackSummary.latestIssueType}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                  <AdminAIExplainabilityFeedbackForm
                    traceId={trace.id}
                    traceSource={trace.source}
                  />
                  <pre>{JSON.stringify(trace.result, null, 2)}</pre>
                </details>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>표시할 AI trace가 없습니다.</strong>
            <p>
              학습자가 AI 해설 또는 특화 AI 검토를 요청하면 이곳에 기록됩니다.
            </p>
          </div>
        )}
      </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="AI TRACE INSPECTOR"
            title={selectedTrace?.requestId ?? "No trace selected"}
            description={
              selectedTrace
                ? "The first visible trace is used as the current preview until row selection is introduced."
                : "AI explanation and specialized review requests will appear here after learners use AI features."
            }
            badges={[
              {
                label: selectedTrace?.provider ?? "No provider",
                tone: selectedTrace ? "info" : "warning",
              },
              {
                label: selectedTrace?.generationStatus ?? "No status",
                tone:
                  !selectedTrace
                    ? "warning"
                    : String(selectedTrace.generationStatus).toLowerCase().includes("fail")
                      ? "danger"
                      : "success",
              },
            ]}
            meta={[
              { label: "Visible traces", value: traces.length },
              { label: "Failed traces", value: failedTraceCount },
              { label: "Reviewed traces", value: reviewedTraceCount },
              { label: "Feedback", value: feedbackTotal },
            ]}
            actions={
              <>
                <Link className="button button-primary" href="/admin/ontology">
                  Ontology
                </Link>
                <Link className="button button-ghost" href="/admin/ai-reviews">
                  AI Reviews
                </Link>
              </>
            }
          >
            <div>
              <StatusBadge compact tone="brand">
                Prompt 원문과 민감정보는 표시하지 않습니다.
              </StatusBadge>
            </div>
            <p>
              이 패널은 앞으로 선택한 trace의 concept detection, alias expansion,
              retrieval context, citation, token, latency, cost, reviewer note를
              한곳에서 확인하는 Inspector로 확장됩니다.
            </p>
          </InspectorPanel>
        }
      />
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

function parseFeedbackRating(value: string | undefined) {
  return value === "HELPFUL" ||
    value === "NOT_HELPFUL" ||
    value === "NEEDS_REVIEW"
    ? value
    : undefined;
}

function parseFeedbackIssueType(value: string | undefined) {
  return value === "NONE" ||
    value === "LOW_QUALITY_CONTEXT" ||
    value === "MISSING_CITATION" ||
    value === "WRONG_CONCEPT" ||
    value === "PROMPT_ISSUE" ||
    value === "SENSITIVE_CONTENT_RISK" ||
    value === "OTHER"
    ? value
    : undefined;
}
