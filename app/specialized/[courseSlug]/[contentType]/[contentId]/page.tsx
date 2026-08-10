import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SpecializedAIReview } from "@/components/specialized-ai-review";
import { SpecializedBookmarkButton } from "@/components/specialized-actions";
import { ContentVersionInfo } from "@/components/content-version-info";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getSpecializedContent } from "@/db/specialized-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "특화 콘텐츠 | Securium", description: "특화 보안 콘텐츠의 기준과 관련 사례를 확인합니다." };
const allowedTypes = ["ISMS_STANDARD", "ISMS_DEFECT_CASE", "LEGAL_ARTICLE", "RISK_SCENARIO"] as const;
const typeLabels: Record<(typeof allowedTypes)[number], string> = { ISMS_STANDARD: "인증 기준", ISMS_DEFECT_CASE: "결함 사례", LEGAL_ARTICLE: "법령·조문", RISK_SCENARIO: "위험 시나리오" };

export default async function SpecializedContentPage({ params }: { params: Promise<{ courseSlug: string; contentType: string; contentId: string }> }) {
  const { courseSlug, contentType, contentId } = await params;
  if (!allowedTypes.includes(contentType as (typeof allowedTypes)[number])) notFound();
  const user = await requireCurrentAppUser(`/specialized/${courseSlug}/${contentType}/${contentId}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let result;
  try { result = await getSpecializedContent(user.id, course.id, contentType, contentId); } catch (error) {
    if (error instanceof AppError && error.code === "SPECIALIZED_CONTENT_NOT_FOUND") notFound();
    if (error instanceof AppError && error.code === "SPECIALIZED_CONTENT_FORBIDDEN") redirect(`/courses/${courseSlug}?notice=enrollment-required`);
    throw error;
  }
  const content = result.content;
  const typedContentType = contentType as (typeof allowedTypes)[number];
  const commonRevision = contentType === "ISMS_STANDARD" || contentType === "LEGAL_ARTICLE" ? await getLatestPublishedRevision(contentType, contentId) : null;
  const title = publicCopy(stringValue(content.title) || stringValue(content.articleTitle));
  const referenceDate = stringValue(content.effectiveDate) || stringValue(content.sourceDate) || stringValue(content.referenceDate);

  return <main className="page-main specialized-page">
    <header className="page-hero specialized-detail-hero"><div className="shell">
      <Link className="breadcrumb" href={`/specialized/${course.slug}`}>특화 학습 목록</Link>
      <p className="eyebrow">{typeLabels[typedContentType]}</p>
      <h1>{title}</h1>
      <div className="content-trust-line"><span className="badge">공식 콘텐츠</span><span>기준일 {referenceDate || "확인 필요"}</span></div>
      <p className="sample-notice">학습 콘텐츠와 공식 근거를 함께 확인하세요. 법령·기준은 원문과 최신 개정 여부를 반드시 확인해야 합니다.</p>
      {commonRevision ? <ContentVersionInfo revision={commonRevision} compact /> : null}
      <SpecializedBookmarkButton courseId={course.id} contentType={typedContentType} contentId={contentId} initialBookmarked={result.bookmarked} />
    </div></header>
    <div className="shell specialized-detail-layout">
      <article className="specialized-document"><DetailFields content={content} />{contentType === "RISK_SCENARIO" ? <SpecializedAIReview request={{ targetType: "RISK_SCENARIO", courseId: course.id, scenarioId: contentId }} /> : null}</article>
      <aside className="specialized-aside"><RelatedPanel title="관련 과정" items={result.relatedCourses.map((item) => ({ id: item.id, label: item.name, href: `/specialized/${item.slug}` }))} empty="연결된 과정이 없습니다." /><RelatedPanel title="관련 문제" items={result.relatedQuestions.map((item) => ({ id: item.id, label: publicCopy(item.title), href: `/practice/${courseSlug}?count=10` }))} empty="연결된 문제가 없습니다." />{result.relatedLegalArticles.length ? <RelatedPanel title="관련 법령" items={result.relatedLegalArticles.map((item) => ({ id: item.id, label: `${item.lawName} ${item.articleNumber}`, href: `/specialized/${courseSlug}/LEGAL_ARTICLE/${item.id}` }))} empty="" /> : null}</aside>
      {result.cases.length ? <section className="section-block wide-section"><h2>관련 결함 사례</h2><div className="specialized-grid">{result.cases.map((item) => <article className="specialized-card" key={String(item.id)}><span className="badge">학습 사례</span><h3>{String(item.title)}</h3><p><strong>상황과 판단</strong><br />{String(item.defectDescription)}</p><p><strong>시정 조치</strong><br />{String(item.correctiveAction)}</p></article>)}</div></section> : null}
      {result.versions.length ? <section className="specialized-info-panel wide-section" aria-labelledby="version-history-title"><h2 id="version-history-title">버전 이력</h2>{result.versions.map((version) => <div className="version-row" key={String(version.id)}><strong>{String(version.version)}</strong><span>시행 {String(version.effectiveDate)}</span><span>개정 {String(version.revisionDate)}</span><small>{publicCopy(String(version.changeSummary))}</small></div>)}</section> : null}
    </div>
  </main>;
}

function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function RelatedPanel({ title, items, empty }: { title: string; items: Array<{ id: string; label: string; href: string }>; empty: string }) { return <section className="specialized-info-panel"><h2>{title}</h2>{items.length ? items.map((item) => <Link href={item.href} key={item.id}>{item.label}</Link>) : <p>{empty}</p>}</section>; }
function DetailFields({ content }: { content: Record<string, unknown> }) {
  const hidden = new Set(["id", "createdAt", "updatedAt", "active", "isSample"]);
  const labels: Record<string, string> = { code: "기준 번호", majorCategory: "대분류", middleCategory: "중분류", description: "설명", keyPoints: "핵심 포인트", evidenceExamples: "주요 증적", defectExamples: "결함 예시", auditPoints: "심사 포인트", version: "버전", effectiveDate: "시행·기준일", sourceUrl: "출처 URL", situation: "상황", defectDescription: "결함 판단", evidence: "확인 증적", correctiveAction: "시정 조치", source: "출처 구분", sourceDate: "사례 기준일", lawName: "법령명", articleNumber: "조문 번호", content: "학습 내용", revisionDate: "개정 기준일", asset: "자산", threat: "위협", vulnerability: "취약점", existingControls: "기존 통제", likelihood: "가능성", impact: "영향", riskValue: "위험값", riskLevel: "위험 등급", treatmentOption: "처리 방안", residualRisk: "잔여 위험", referenceDate: "참조 기준일" };
  return <dl className="content-facts">{Object.entries(content).filter(([key, value]) => !hidden.has(key) && value !== null && value !== "").map(([key, value]) => <div key={key}><dt>{labels[key] ?? "추가 정보"}</dt><dd>{typeof value === "boolean" ? (value ? "예" : "아니요") : publicCopy(String(value))}</dd></div>)}</dl>;
}
