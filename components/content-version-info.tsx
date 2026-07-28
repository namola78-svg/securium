import Link from "next/link";

type VersionInfo = {
  id: string;
  contentDate: string;
  version: string;
  reviewedAt: string | null;
  revisionStatus: string;
  isLatest: boolean;
  changeSummary: string;
};

export function ContentVersionInfo({
  revision,
  compact = false,
}: {
  revision: VersionInfo | null;
  compact?: boolean;
}) {
  if (!revision) {
    return (
      <aside className={`content-version-info ${compact ? "compact" : ""}`}>
        <strong>검수 정보가 등록되지 않았습니다</strong>
        <span>공통 기준일·검수 이력이 아직 등록되지 않았습니다.</span>
      </aside>
    );
  }
  const outdated = !revision.isLatest || revision.revisionStatus === "superseded";
  return (
    <aside
      className={`content-version-info ${compact ? "compact" : ""} ${
        outdated ? "outdated" : ""
      }`}
      aria-label="콘텐츠 버전 정보"
    >
      <div>
        <strong>기준일 {revision.contentDate}</strong>
        <span>버전 {revision.version}</span>
        <span>
          최신 검수일{" "}
          {revision.reviewedAt?.slice(0, 10) ?? "검수일 미등록"}
        </span>
      </div>
      <div>
        <span className={outdated ? "warning-label" : "badge"}>
          {outdated ? "구버전 · 최신 내용 확인 필요" : "최신 검수 버전"}
        </span>
        {revision.changeSummary ? <small>개정: {revision.changeSummary}</small> : null}
        <Link href={`/content-versions/${revision.id}`}>버전 상세</Link>
      </div>
    </aside>
  );
}
