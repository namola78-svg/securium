import Link from "next/link";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getAuditLogById,
  listAuditActors,
  listAuditFilterOptions,
  listAuditLogs,
} from "@/db/audit-repositories";
import { requireAuditViewer } from "@/lib/auth";
import { auditLogFilterSchema, parseInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuditViewer("/admin/audit-logs");
  const raw = await searchParams;
  const normalized = Object.fromEntries(
    Object.entries(raw)
      .filter(([, value]) => typeof value === "string" && value !== "")
      .map(([key, value]) => [key, value]),
  );
  const filters = parseInput(auditLogFilterSchema, normalized);
  const detailId =
    typeof raw.detailId === "string" ? raw.detailId.slice(0, 200) : null;
  const [result, actors, options, detail] = await Promise.all([
    listAuditLogs(filters),
    listAuditActors(),
    listAuditFilterOptions(),
    detailId ? getAuditLogById(detailId) : null,
  ]);
  const filterQuery = buildQuery(filters, ["page", "pageSize"]);
  const successCount = result.rows.filter((row) => row.result === "SUCCESS").length;
  const failureCount = result.rows.filter((row) => row.result === "FAILURE").length;
  const deniedCount = result.rows.filter((row) => row.result === "DENIED").length;

  return (
    <>
      <SectionHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Audit", current: true },
        ]}
        eyebrow="IMMUTABLE AUDIT TRAIL"
        title="관리자 감사로그"
        description={
          <>
            중요 관리자 작업의 주체·결과·리소스와 최소 요청정보를 조회합니다.
            로그 수정과 삭제 기능은 제공하지 않습니다.
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="감사로그 조회 요약">
        <MetricCard
          label="조회 결과"
          value={result.total}
          description={`${result.page} / ${result.totalPages} 페이지`}
        />
        <MetricCard
          label="성공"
          value={successCount}
          description="현재 페이지 기준"
        />
        <MetricCard
          label="실패"
          value={failureCount}
          description="현재 페이지 기준"
        />
        <MetricCard
          label="거부"
          value={deniedCount}
          description="현재 페이지 기준"
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <Link className="button button-ghost" href="/admin">
              Dashboard
            </Link>
            <Link className="button button-ghost" href="/admin/ai-explainability">
              AI Trace
            </Link>
          </>
        }
        primary={
          user.roles.includes("SUPER_ADMIN") ? (
            <Link
              className="button button-primary"
              href={`/api/admin/audit-logs/export?${filterQuery}`}
            >
              CSV 내보내기
            </Link>
          ) : null
        }
      >
        <span className="admin-toolbar-kicker">Audit scope</span>
        <strong>
          {filters.action ?? "전체 작업"} · {filters.result ?? "전체 결과"} ·{" "}
          {filters.resourceType ?? "전체 리소스"}
        </strong>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
      <section className="admin-panel">
        <form className="audit-filter-form" method="get">
          <label>
            시작일
            <input name="fromDate" type="date" defaultValue={filters.fromDate} />
          </label>
          <label>
            종료일
            <input name="toDate" type="date" defaultValue={filters.toDate} />
          </label>
          <label>
            작업
            <select name="action" defaultValue={filters.action ?? ""}>
              <option value="">전체 작업</option>
              {options.actions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </label>
          <label>
            관리자
            <select name="actorUserId" defaultValue={filters.actorUserId ?? ""}>
              <option value="">전체 관리자</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.email}</option>
              ))}
            </select>
          </label>
          <label>
            리소스 유형
            <select name="resourceType" defaultValue={filters.resourceType ?? ""}>
              <option value="">전체 리소스</option>
              {options.resources.map((resource) => (
                <option key={resource} value={resource}>{resource}</option>
              ))}
            </select>
          </label>
          <label>
            리소스 ID
            <input
              name="resourceId"
              maxLength={100}
              defaultValue={filters.resourceId ?? ""}
            />
          </label>
          <label>
            결과
            <select name="result" defaultValue={filters.result ?? ""}>
              <option value="">전체 결과</option>
              <option value="SUCCESS">성공</option>
              <option value="FAILURE">실패</option>
              <option value="DENIED">거부</option>
            </select>
          </label>
          <label>
            페이지 크기
            <select name="pageSize" defaultValue={String(result.pageSize)}>
              <option value="30">30개</option>
              <option value="50">50개</option>
              <option value="100">100개</option>
            </select>
          </label>
          <button className="button button-dark" type="submit">조회</button>
        </form>
      </section>

      <section className="admin-panel section-block">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">AUDIT EVENTS</p>
            <h2>조회 결과</h2>
          </div>
          <span>{result.total}건</span>
        </div>
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>관리자</th>
                <th>작업</th>
                <th>리소스</th>
                <th>결과</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt}</td>
                  <td>{row.actorEmail}<small>{row.actorRole}</small></td>
                  <td>{row.action}</td>
                  <td>{row.resourceType}<small>{row.resourceId}</small></td>
                  <td><span className={`audit-result ${row.result.toLowerCase()}`}>{row.result}</span></td>
                  <td>
                    <Link href={`?${buildQuery({ ...filters, detailId: row.id })}`}>
                      조회
                    </Link>
                  </td>
                </tr>
              ))}
              {!result.rows.length ? (
                <tr><td colSpan={6}>조건에 맞는 감사로그가 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav className="pagination" aria-label="감사로그 페이지">
          {result.page > 1 ? (
            <Link href={`?${buildQuery({ ...filters, page: result.page - 1 })}`}>
              ← 이전
            </Link>
          ) : <span />}
          <span>{result.page} / {result.totalPages}</span>
          {result.page < result.totalPages ? (
            <Link href={`?${buildQuery({ ...filters, page: result.page + 1 })}`}>
              다음 →
            </Link>
          ) : <span />}
        </nav>
      </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="AUDIT INSPECTOR"
            title={detail ? detail.action : "감사로그 상세"}
            description={
              detail
                ? "선택한 감사로그의 허용된 메타데이터와 요청 식별 정보를 확인합니다."
                : "목록에서 감사로그를 선택하면 상세 정보가 이 패널에 표시됩니다."
            }
            badges={[
              {
                label: detail?.result ?? "No selection",
                tone:
                  detail?.result === "SUCCESS"
                    ? "success"
                    : detail?.result === "FAILURE"
                      ? "danger"
                      : detail?.result === "DENIED"
                        ? "warning"
                        : "info",
              },
              {
                label: "수정·삭제 없음",
                tone: "brand",
              },
            ]}
            meta={
              detail
                ? [
                    { label: "관리자", value: detail.actorEmail },
                    { label: "역할", value: detail.actorRole },
                    { label: "리소스", value: detail.resourceType },
                    { label: "기록 시각", value: detail.createdAt },
                  ]
                : [
                    { label: "조회 결과", value: result.total },
                    { label: "현재 페이지", value: `${result.page}/${result.totalPages}` },
                    { label: "성공", value: successCount },
                    { label: "거부", value: deniedCount },
                  ]
            }
          >
            {detail ? (
              <dl className="content-facts audit-inspector-facts">
                <div><dt>ID</dt><dd>{detail.id}</dd></div>
                <div><dt>리소스 ID</dt><dd>{detail.resourceId}</dd></div>
                <div><dt>IP 식별값</dt><dd>{detail.ipHash ?? "미수집"}</dd></div>
                <div><dt>접속 환경</dt><dd>{detail.userAgentSummary ?? "미수집"}</dd></div>
                <div><dt>요청 ID</dt><dd>{detail.requestId ?? "미수집"}</dd></div>
                <div>
                  <dt>허용된 metadata</dt>
                  <dd><pre>{JSON.stringify(detail.metadata, null, 2)}</pre></dd>
                </div>
              </dl>
            ) : (
              <p>
                감사로그는 운영 신뢰성의 근거입니다. 민감정보 원문은 저장하지 않고,
                action별 allowlist metadata만 표시합니다.
              </p>
            )}
          </InspectorPanel>
        }
      />
    </>
  );
}

function buildQuery(
  values: Record<string, unknown>,
  omitted: string[] = [],
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (
      omitted.includes(key) ||
      value === undefined ||
      value === null ||
      value === ""
    ) continue;
    params.set(key, String(value));
  }
  return params.toString();
}
