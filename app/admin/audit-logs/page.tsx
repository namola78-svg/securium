import Link from "next/link";
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

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">IMMUTABLE AUDIT TRAIL</p>
        <h1>관리자 감사로그</h1>
        <p>
          중요 관리자 작업의 주체·결과·리소스와 최소 요청정보를 조회합니다.
          로그 수정과 삭제 기능은 제공하지 않습니다.
        </p>
      </header>

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
          {user.roles.includes("SUPER_ADMIN") ? (
            <Link
              className="button button-ghost"
              href={`/api/admin/audit-logs/export?${filterQuery}`}
            >
              CSV 내보내기
            </Link>
          ) : null}
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

      {detail ? (
        <section className="admin-panel section-block" aria-labelledby="audit-detail-title">
          <h2 id="audit-detail-title">감사로그 상세</h2>
          <dl className="content-facts">
            <div><dt>ID</dt><dd>{detail.id}</dd></div>
            <div><dt>관리자</dt><dd>{detail.actorEmail} · {detail.actorRole}</dd></div>
            <div><dt>작업</dt><dd>{detail.action}</dd></div>
            <div><dt>리소스</dt><dd>{detail.resourceType} · {detail.resourceId}</dd></div>
            <div><dt>결과</dt><dd>{detail.result}</dd></div>
            <div><dt>IP 식별값</dt><dd>{detail.ipHash ?? "미수집"}</dd></div>
            <div><dt>접속 환경</dt><dd>{detail.userAgentSummary ?? "미수집"}</dd></div>
            <div><dt>요청 ID</dt><dd>{detail.requestId ?? "미수집"}</dd></div>
            <div><dt>기록 시각</dt><dd>{detail.createdAt}</dd></div>
            <div>
              <dt>허용된 metadata</dt>
              <dd><pre>{JSON.stringify(detail.metadata, null, 2)}</pre></dd>
            </div>
          </dl>
        </section>
      ) : null}
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

