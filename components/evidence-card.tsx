import Link from "next/link";

export type EvidenceItem = { title: string; kind: string; reference?: string | null; date?: string | null; href?: string };

export function EvidenceCard({ evidence, compact = false }: { evidence: EvidenceItem; compact?: boolean }) {
  return <aside className={`evidence-card ${compact ? "compact" : ""}`} aria-label="공식 근거"><div className="evidence-card-heading"><span className="badge">공식 근거</span><span className="evidence-kind">{evidence.kind}</span></div><strong>{evidence.title}</strong>{evidence.reference ? <span>참조: {evidence.reference}</span> : null}<div className="evidence-card-meta">{evidence.date ? <span>기준일 {evidence.date}</span> : <span>기준일 확인 필요</span>}{evidence.href ? <Link href={evidence.href}>원문·상세 보기</Link> : null}</div></aside>;
}
