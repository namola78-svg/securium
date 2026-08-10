import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentVersionInfo } from "@/components/content-version-info";
import { getPublicContentRevision } from "@/db/content-revision-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  CONTENT_REVISION_TYPE_LABELS,
  type ContentRevisionType,
} from "@/lib/services/content-revision-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "콘텐츠 버전 | Securium",
  description: "학습 콘텐츠의 기준일과 공개 버전을 확인합니다.",
};

export default async function ContentVersionPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const { revisionId } = await params;
  const user = await requireCurrentAppUser(`/content-versions/${revisionId}`);
  const revision = await getPublicContentRevision(revisionId, user.id);
  if (!revision) notFound();

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell narrow">
          <p className="eyebrow">
            {CONTENT_REVISION_TYPE_LABELS[revision.contentType as ContentRevisionType]}
          </p>
          <h1>{revision.title}</h1>
          <ContentVersionInfo revision={revision} />
        </div>
      </section>
      <section className="section">
        <article className="shell narrow version-snapshot">
          {revision.isLatest ? null : (
            <div className="warning-banner" role="alert">
              이 화면은 이전 버전입니다. 학습과 채점에는 최신 공개 버전을 우선
              확인하세요.
            </div>
          )}
          <h2>버전 콘텐츠 스냅샷</h2>
          <dl className="content-facts">
            {Object.entries(revision.snapshot).map(([field, value]) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>{formatSnapshotValue(value)}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>
    </main>
  );
}

function formatSnapshotValue(value: unknown) {
  if (typeof value === "boolean") return value ? "예" : "아니요";
  if (value === null || value === undefined) return "없음";
  return typeof value === "string" ? value : JSON.stringify(value);
}
