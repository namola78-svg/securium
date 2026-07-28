import Link from "next/link";
import {
  getRevisionAdminDetail,
  listRevisionTargets,
} from "@/db/content-revision-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";
import {
  CONTENT_REVISION_TYPES,
  CONTENT_REVISION_TYPE_LABELS,
  type ContentRevisionType,
} from "@/lib/services/content-revision-service";

export const dynamic = "force-dynamic";

export default async function ContentRevisionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ contentType?: string; contentId?: string }>;
}) {
  await requireQuestionAdministrator("/admin/content-revisions");
  const query = await searchParams;
  const contentType = CONTENT_REVISION_TYPES.includes(
    query.contentType as ContentRevisionType,
  )
    ? (query.contentType as ContentRevisionType)
    : "LEGAL_ARTICLE";
  const targets = await listRevisionTargets(contentType);
  const selectedId =
    query.contentId && targets.some((target) => target.id === query.contentId)
      ? query.contentId
      : targets[0]?.id;
  const detail = selectedId
    ? await getRevisionAdminDetail(contentType, selectedId)
    : null;
  const returnTo = `/admin/content-revisions?contentType=${contentType}${
    selectedId ? `&contentId=${selectedId}` : ""
  }`;

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">CONTENT REVISION CONTROL</p>
        <h1>콘텐츠 기준일·버전 관리</h1>
        <p>
          기존 콘텐츠 ID와 학습기록을 유지하면서 초안, 검수, 게시 및
          이전 버전 보관 상태를 관리합니다.
        </p>
      </header>

      <section className="admin-panel revision-target-picker">
        <h2>관리 대상 선택</h2>
        <div className="revision-type-links">
          {CONTENT_REVISION_TYPES.map((type) => (
            <Link
              className={type === contentType ? "badge" : "button button-ghost button-small"}
              href={`/admin/content-revisions?contentType=${type}`}
              key={type}
            >
              {CONTENT_REVISION_TYPE_LABELS[type]}
            </Link>
          ))}
        </div>
        <div className="admin-record-list compact-list">
          {targets.map((target) => (
            <Link
              className={`admin-record ${target.id === selectedId ? "selected-record" : ""}`}
              href={`/admin/content-revisions?contentType=${contentType}&contentId=${target.id}`}
              key={target.id}
            >
              <strong>{target.title}</strong>
              <small>{target.id}</small>
            </Link>
          ))}
          {!targets.length ? <p>관리할 콘텐츠가 없습니다.</p> : null}
        </div>
      </section>

      {detail?.target ? (
        <>
          <section className="admin-panel section-block">
            <p className="eyebrow">{detail.label}</p>
            <h2>{detail.target.title}</h2>
            <p>
              현재 기준일 {detail.target.contentDate} · 원본 버전{" "}
              {detail.target.version}
            </p>
            <form
              action="/api/admin/content-revisions"
              className="admin-form revision-form"
              method="post"
            >
              <input name="operation" type="hidden" value="CREATE_DRAFT" />
              <input name="contentType" type="hidden" value={contentType} />
              <input name="contentId" type="hidden" value={selectedId} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <label>
                새 버전
                <input
                  name="version"
                  defaultValue={suggestNextVersion(
                    detail.revisions[0]?.version ?? detail.target.version,
                  )}
                  required
                />
              </label>
              <label>
                콘텐츠 기준일
                <input
                  name="contentDate"
                  type="date"
                  defaultValue={detail.target.contentDate.slice(0, 10)}
                  required
                />
              </label>
              <label className="wide-field">
                변경 요약
                <textarea
                  name="changeSummary"
                  maxLength={2000}
                  placeholder="변경 이유와 주요 내용을 기록하세요."
                  required
                />
              </label>
              <label className="wide-field">
                버전 스냅샷 JSON
                <textarea
                  className="revision-json-editor"
                  name="snapshotJson"
                  defaultValue={JSON.stringify(
                    Object.fromEntries(
                      detail.target.allowedFields.map((field) => [
                        field,
                        detail.target?.snapshot[field],
                      ]),
                    ),
                    null,
                    2,
                  )}
                  maxLength={100000}
                  required
                  spellCheck={false}
                />
                <small>
                  허용된 콘텐츠 필드만 반영됩니다. ID와 관계 필드는 변경할
                  수 없습니다.
                </small>
              </label>
              <button className="button button-dark" type="submit">
                새 버전 초안 생성
              </button>
            </form>
          </section>

          <section className="admin-panel section-block">
            <h2>버전 이력</h2>
            <div className="admin-record-list">
              {detail.revisions.map((revision) => (
                <article className="admin-record revision-record" key={revision.id}>
                  <div>
                    <strong>
                      v{revision.version}{" "}
                      {revision.isLatest ? <span className="badge">최신</span> : null}
                    </strong>
                    <p>{revision.changeSummary || "변경 요약 없음"}</p>
                    <small>
                      기준일 {revision.contentDate} · {revision.revisionStatus}
                      {revision.reviewedAt
                        ? ` · 검수 ${revision.reviewedAt.slice(0, 10)}`
                        : ""}
                    </small>
                  </div>
                  <div className="inline-actions">
                    {["draft", "review"].includes(revision.revisionStatus) ? (
                      <form action="/api/admin/content-revisions" method="post">
                        <input name="operation" type="hidden" value="PUBLISH" />
                        <input name="revisionId" type="hidden" value={revision.id} />
                        <input name="returnTo" type="hidden" value={returnTo} />
                        <button className="button button-dark button-small" type="submit">
                          게시
                        </button>
                      </form>
                    ) : null}
                    {!revision.isLatest &&
                    revision.revisionStatus !== "archived" ? (
                      <form action="/api/admin/content-revisions" method="post">
                        <input name="operation" type="hidden" value="ARCHIVE" />
                        <input name="revisionId" type="hidden" value={revision.id} />
                        <input name="returnTo" type="hidden" value={returnTo} />
                        <button className="button button-ghost button-small" type="submit">
                          보관
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
              {!detail.revisions.length ? (
                <p>아직 공통 버전 이력이 없습니다.</p>
              ) : null}
            </div>
          </section>

          <section className="admin-panel section-block">
            <h2>최신 변경 비교</h2>
            {detail.comparisons.length ? (
              <div className="revision-comparison">
                {detail.comparisons.map((change) => (
                  <div key={change.field}>
                    <strong>{change.field}</strong>
                    <del>{formatValue(change.previous)}</del>
                    <ins>{formatValue(change.current)}</ins>
                  </div>
                ))}
              </div>
            ) : (
              <p>비교할 이전 버전이 없거나 내용 변경이 없습니다.</p>
            )}
          </section>

          <section className="admin-panel section-block">
            <h2>영향 콘텐츠</h2>
            <div className="stats-grid admin-stats">
              <div className="stat-card"><span>문제</span><strong>{detail.impact.questions.length}</strong></div>
              <div className="stat-card"><span>해설</span><strong>{detail.impact.explanations.length}</strong></div>
              <div className="stat-card"><span>강의</span><strong>{detail.impact.lectures.length}</strong></div>
              <div className="stat-card"><span>오디오</span><strong>{detail.impact.audio.length}</strong></div>
            </div>
            <p className="muted-copy">
              과정 연결 범위를 기준으로 재검수가 필요할 수 있는 콘텐츠를
              계산합니다.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}

function suggestNextVersion(value: string) {
  const match = value.match(/^(.*?)(\d+)$/);
  if (!match) return `${value}-2`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

function formatValue(value: unknown) {
  if (value === undefined) return "없음";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

