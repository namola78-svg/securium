import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
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
  const target = detail?.target ?? null;
  const selectedDetail = target && detail ? detail : null;
  const selectedTarget = selectedDetail?.target ?? null;
  const returnTo = `/admin/content-revisions?contentType=${contentType}${
    selectedId ? `&contentId=${selectedId}` : ""
  }`;
  const latestRevision = detail?.revisions.find((revision) => revision.isLatest);
  const draftCount =
    detail?.revisions.filter((revision) => revision.revisionStatus === "draft")
      .length ?? 0;
  const reviewCount =
    detail?.revisions.filter((revision) => revision.revisionStatus === "review")
      .length ?? 0;
  const publishedCount =
    detail?.revisions.filter((revision) => revision.revisionStatus === "published")
      .length ?? 0;
  const archivedCount =
    detail?.revisions.filter((revision) => revision.revisionStatus === "archived")
      .length ?? 0;
  const impactTotal = detail
    ? detail.impact.questions.length +
      detail.impact.explanations.length +
      detail.impact.lectures.length +
      detail.impact.audio.length
    : 0;

  return (
    <>
      <SectionHeader
        eyebrow="CONTENT REVISION CONTROL"
        title="콘텐츠 기준일·버전 관리"
        description="기존 콘텐츠 ID와 학습 기록을 유지하면서 초안, 검수, 게시, 이전 버전 보관 상태를 관리합니다."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Content Revisions", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/shared-content">
              Shared Content
            </Link>
            <Link className="button button-primary" href="/admin/ai-explainability">
              AI Retrieval 영향 확인
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats">
        <MetricCard
          label="관리 대상"
          value={targets.length}
          description={CONTENT_REVISION_TYPE_LABELS[contentType]}
        />
        <MetricCard
          label="버전 이력"
          value={detail?.revisions.length ?? 0}
          description={`게시 ${publishedCount} · 초안 ${draftCount}`}
        />
        <MetricCard
          label="영향 콘텐츠"
          value={impactTotal}
          description={`변경 비교 ${detail?.comparisons.length ?? 0}건`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={latestRevision ? "success" : "warning"}>
              {latestRevision ? "LATEST READY" : "NO LATEST"}
            </StatusBadge>
            <StatusBadge compact tone={reviewCount ? "warning" : "neutral"}>
              REVIEW {reviewCount}
            </StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/content-revisions">
            선택 초기화
          </Link>
        }
      >
        <strong>{target?.title ?? "콘텐츠를 선택하세요"}</strong>
        <span>
          기준일 {target?.contentDate ?? "-"} · 현재 버전 {target?.version ?? "-"}
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel revision-target-picker">
              <h2>관리 대상 선택</h2>
              <div className="revision-type-links">
                {CONTENT_REVISION_TYPES.map((type) => (
                  <Link
                    className={
                      type === contentType ? "badge" : "button button-ghost button-small"
                    }
                    href={`/admin/content-revisions?contentType=${type}`}
                    key={type}
                  >
                    {CONTENT_REVISION_TYPE_LABELS[type]}
                  </Link>
                ))}
              </div>
              <div className="admin-record-list compact-list">
                {targets.map((revisionTarget) => (
                  <Link
                    className={`admin-record ${
                      revisionTarget.id === selectedId ? "selected-record" : ""
                    }`}
                    href={`/admin/content-revisions?contentType=${contentType}&contentId=${revisionTarget.id}`}
                    key={revisionTarget.id}
                  >
                    <strong>{revisionTarget.title}</strong>
                    <small>{revisionTarget.id}</small>
                  </Link>
                ))}
                {!targets.length ? <p>관리할 콘텐츠가 없습니다.</p> : null}
              </div>
            </section>

            {selectedDetail && selectedTarget ? (
              <>
                <section className="admin-panel section-block">
                  <p className="eyebrow">{selectedDetail.label}</p>
                  <h2>{selectedTarget.title}</h2>
                  <p>
                    현재 기준일 {selectedTarget.contentDate} · 원본 버전{" "}
                    {selectedTarget.version}
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
                          selectedDetail.revisions[0]?.version ??
                            selectedTarget.version,
                        )}
                        required
                      />
                    </label>
                    <label>
                      콘텐츠 기준일
                      <input
                        name="contentDate"
                        type="date"
                        defaultValue={selectedTarget.contentDate.slice(0, 10)}
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
                            selectedTarget.allowedFields.map((field) => [
                              field,
                              selectedTarget.snapshot[field],
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
                        허용된 콘텐츠 필드만 반영합니다. ID와 관계 필드는 변경할 수
                        없습니다.
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
                    {selectedDetail.revisions.map((revision) => (
                      <article
                        className="admin-record revision-record"
                        key={revision.id}
                      >
                        <div>
                          <strong>
                            v{revision.version}{" "}
                            {revision.isLatest ? (
                              <span className="badge">최신</span>
                            ) : null}
                          </strong>
                          <p>{revision.changeSummary || "변경 요약 없음"}</p>
                          <small>
                            기준일 {revision.contentDate} ·{" "}
                            {revision.revisionStatus}
                            {revision.reviewedAt
                              ? ` · 검수 ${revision.reviewedAt.slice(0, 10)}`
                              : ""}
                          </small>
                        </div>
                        <div className="inline-actions">
                          {["draft", "review"].includes(revision.revisionStatus) ? (
                            <form action="/api/admin/content-revisions" method="post">
                              <input name="operation" type="hidden" value="PUBLISH" />
                              <input
                                name="revisionId"
                                type="hidden"
                                value={revision.id}
                              />
                              <input name="returnTo" type="hidden" value={returnTo} />
                              <button
                                className="button button-dark button-small"
                                type="submit"
                              >
                                게시
                              </button>
                            </form>
                          ) : null}
                          {!revision.isLatest &&
                          revision.revisionStatus !== "archived" ? (
                            <form action="/api/admin/content-revisions" method="post">
                              <input name="operation" type="hidden" value="ARCHIVE" />
                              <input
                                name="revisionId"
                                type="hidden"
                                value={revision.id}
                              />
                              <input name="returnTo" type="hidden" value={returnTo} />
                              <button
                                className="button button-ghost button-small"
                                type="submit"
                              >
                                보관
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    ))}
                    {!selectedDetail.revisions.length ? (
                      <p>아직 공통 버전 이력이 없습니다.</p>
                    ) : null}
                  </div>
                </section>

                <section className="admin-panel section-block">
                  <h2>최신 변경 비교</h2>
                  {selectedDetail.comparisons.length ? (
                    <div className="revision-comparison">
                      {selectedDetail.comparisons.map((change) => (
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
                    <MetricCard
                      label="문제"
                      value={selectedDetail.impact.questions.length}
                    />
                    <MetricCard
                      label="해설"
                      value={selectedDetail.impact.explanations.length}
                    />
                    <MetricCard
                      label="강의"
                      value={selectedDetail.impact.lectures.length}
                    />
                    <MetricCard
                      label="오디오"
                      value={selectedDetail.impact.audio.length}
                    />
                  </div>
                  <p className="muted-copy">
                    과정 연결 범위를 기준으로 재검토가 필요한 콘텐츠를 계산합니다.
                  </p>
                </section>
              </>
            ) : null}
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="REVISION INSPECTOR"
            title={target?.title ?? "콘텐츠를 선택하세요"}
            description={
              detail
                ? "최신 버전, 검수 상태, 영향 콘텐츠, 변경 비교 범위를 점검합니다."
                : "관리 대상 콘텐츠를 선택하면 버전 상세와 영향 범위가 표시됩니다."
            }
            badges={[
              {
                label: CONTENT_REVISION_TYPE_LABELS[contentType],
                tone: "brand",
              },
              {
                label: latestRevision?.revisionStatus ?? "NO LATEST",
                tone: latestRevision ? "success" : "warning",
              },
            ]}
            meta={[
              { label: "콘텐츠 ID", value: selectedId ?? "없음" },
              { label: "현재 버전", value: target?.version ?? "-" },
              { label: "최신 버전", value: latestRevision?.version ?? "-" },
              { label: "초안", value: `${draftCount}개` },
              { label: "검수", value: `${reviewCount}개` },
              { label: "보관", value: `${archivedCount}개` },
              { label: "영향 콘텐츠", value: `${impactTotal}개` },
            ]}
            actions={
              <>
                <Link className="button button-ghost" href="/admin/questions">
                  문제은행
                </Link>
                <Link className="button button-ghost" href="/admin/shared-content">
                  공통 콘텐츠
                </Link>
              </>
            }
          >
            <div className="admin-card-meta">
              <span>
                새 버전 게시 시 이전 최신 버전은 자동으로 superseded 처리됩니다.
              </span>
              <span>초안은 일반 사용자 검색과 AI Retrieval에서 제외됩니다.</span>
              <span>기존 학습 기록은 콘텐츠 버전 작업으로 삭제되지 않습니다.</span>
            </div>
          </InspectorPanel>
        }
      />
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
