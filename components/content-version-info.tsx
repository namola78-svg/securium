import Link from "next/link";
import { publicCopy } from "@/lib/public-copy";

type VersionInfo = { id: string; contentDate: string; version: string; reviewedAt: string | null; revisionStatus: string; isLatest: boolean; changeSummary: string };

export function ContentVersionInfo({ revision, compact = false }: { revision: VersionInfo | null; compact?: boolean }) {
  if (!revision) return <aside className={`content-version-info ${compact ? "compact" : ""}`}><strong>공식 근거 정보가 없습니다.</strong><span>이 콘텐츠에는 아직 기준일과 검수 이력이 등록되지 않았습니다.</span></aside>;
  const outdated = !revision.isLatest || revision.revisionStatus === "superseded";
  const summary = publicCopy(revision.changeSummary);
  return <aside className={`content-version-info ${compact ? "compact" : ""} ${outdated ? "outdated" : ""}`} aria-label="콘텐츠 버전 정보"><div><strong>기준일 {revision.contentDate}</strong><span>버전 {revision.version}</span><span>최근 검수 {revision.reviewedAt?.slice(0, 10) ?? "확인 필요"}</span></div><div><span className={outdated ? "warning-label" : "badge"}>{outdated ? "개정됨 · 최신 내용 확인 필요" : "최신 검수 버전"}</span>{summary ? <small>개정 요약: {summary}</small> : null}<Link href={`/content-versions/${revision.id}`}>버전 상세 보기</Link></div></aside>;
}
