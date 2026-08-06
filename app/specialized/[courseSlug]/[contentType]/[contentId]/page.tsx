import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SpecializedBookmarkButton } from "@/components/specialized-actions";
import { SpecializedAIReview } from "@/components/specialized-ai-review";
import { ContentVersionInfo } from "@/components/content-version-info";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getSpecializedContent } from "@/db/specialized-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const allowedTypes = [
  "ISMS_STANDARD",
  "ISMS_DEFECT_CASE",
  "LEGAL_ARTICLE",
  "RISK_SCENARIO",
] as const;

export default async function SpecializedContentPage({
  params,
}: {
  params: Promise<{
    courseSlug: string;
    contentType: string;
    contentId: string;
  }>;
}) {
  const { courseSlug, contentType, contentId } = await params;
  if (!allowedTypes.includes(contentType as (typeof allowedTypes)[number])) {
    notFound();
  }
  const user = await requireCurrentAppUser(
    `/specialized/${courseSlug}/${contentType}/${contentId}`,
  );
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let result;
  try {
    result = await getSpecializedContent(
      user.id,
      course.id,
      contentType,
      contentId,
    );
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "SPECIALIZED_CONTENT_NOT_FOUND"
    ) {
      notFound();
    }
    if (
      error instanceof AppError &&
      error.code === "SPECIALIZED_CONTENT_FORBIDDEN"
    ) {
      redirect(`/courses/${courseSlug}?notice=enrollment-required`);
    }
    throw error;
  }
  const content = result.content;
  const commonRevision =
    contentType === "ISMS_STANDARD" || contentType === "LEGAL_ARTICLE"
      ? await getLatestPublishedRevision(contentType, contentId)
      : null;
  const title = stringValue(content.title) || stringValue(content.articleTitle);
  const referenceDate =
    stringValue(content.effectiveDate) ||
    stringValue(content.sourceDate) ||
    stringValue(content.referenceDate);

  return (
    <main className="page-main specialized-page">
      <header className="page-hero specialized-detail-hero">
        <div className="shell">
          <p className="eyebrow">{contentType.replaceAll("_", " ")}</p>
          <h1>{title}</h1>
          <p className="sample-notice">
            학습용 콘텐츠 · 기준일 {referenceDate || "미설정"} · 공식 출처
            확인 필요
          </p>
          {contentType === "ISMS_STANDARD" ||
          contentType === "LEGAL_ARTICLE" ? (
            <ContentVersionInfo revision={commonRevision} compact />
          ) : null}
          <SpecializedBookmarkButton
            courseId={course.id}
            contentType={contentType as (typeof allowedTypes)[number]}
            contentId={contentId}
            initialBookmarked={result.bookmarked}
          />
        </div>
      </header>
      <div className="shell specialized-detail-layout">
        <article className="specialized-document">
          <DetailFields content={content} />
          {contentType === "RISK_SCENARIO" ? (
            <SpecializedAIReview
              request={{
                targetType: "RISK_SCENARIO",
                courseId: course.id,
                scenarioId: contentId,
              }}
            />
          ) : null}
        </article>
        <aside className="specialized-aside">
          <section className="specialized-info-panel">
            <h2>함께 학습할 과정</h2>
            {result.relatedCourses.map((related) => (
              <Link href={`/specialized/${related.slug}`} key={related.id}>
                {related.name}
              </Link>
            ))}
          </section>
          <section className="specialized-info-panel">
            <h2>관련 문제</h2>
            {result.relatedQuestions.length ? (
              result.relatedQuestions.map((question) => (
                <Link href={`/practice/${courseSlug}?count=10`} key={question.id}>
                  {question.title}
                </Link>
              ))
            ) : (
              <p>이 자료와 함께 풀 문제가 아직 없습니다.</p>
            )}
          </section>
          {result.relatedLegalArticles.length ? (
            <section className="specialized-info-panel">
              <h2>관련 법령</h2>
              {result.relatedLegalArticles.map((article) => (
                <Link
                  href={`/specialized/${courseSlug}/LEGAL_ARTICLE/${article.id}`}
                  key={article.id}
                >
                  {article.lawName} {article.articleNumber}
                </Link>
              ))}
            </section>
          ) : null}
        </aside>

        {result.cases.length ? (
          <section className="section-block wide-section">
            <h2>관련 결함사례</h2>
            <div className="specialized-grid">
              {result.cases.map((item) => (
                <article className="specialized-card" key={String(item.id)}>
                  <span className="badge">학습 사례</span>
                  <h3>{String(item.title)}</h3>
                  <p>{String(item.defectDescription)}</p>
                  <strong>시정조치</strong>
                  <p>{String(item.correctiveAction)}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {result.versions.length ? (
          <section className="specialized-info-panel wide-section">
            <h2>버전 이력</h2>
            {result.versions.map((version) => (
              <div className="version-row" key={String(version.id)}>
                <strong>{String(version.version)}</strong>
                <span>시행 {String(version.effectiveDate)}</span>
                <span>개정 {String(version.revisionDate)}</span>
                <small>{String(version.changeSummary)}</small>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function DetailFields({ content }: { content: Record<string, unknown> }) {
  const hidden = new Set(["id", "createdAt", "updatedAt", "active", "isSample"]);
  const labels: Record<string, string> = {
    code: "기준 번호",
    majorCategory: "대분류",
    middleCategory: "중분류",
    description: "설명",
    keyPoints: "확인사항·핵심 포인트",
    evidenceExamples: "주요 증적",
    defectExamples: "결함 예시",
    auditPoints: "심사 포인트",
    version: "버전",
    effectiveDate: "시행·기준일",
    sourceUrl: "출처 URL",
    situation: "상황",
    defectDescription: "결함 판단",
    evidence: "확인 증적",
    correctiveAction: "시정조치",
    source: "출처 구분",
    sourceDate: "사례 기준일",
    lawName: "법령명",
    articleNumber: "조문 번호",
    content: "학습 내용",
    revisionDate: "개정 기준일",
    asset: "자산",
    threat: "위협",
    vulnerability: "취약점",
    existingControls: "기존 통제",
    likelihood: "가능성",
    impact: "영향도",
    riskValue: "위험값",
    riskLevel: "위험등급",
    treatmentOption: "처리 방안",
    residualRisk: "잔여위험",
    referenceDate: "평가 기준일",
  };
  return (
    <dl className="content-facts">
      {Object.entries(content)
        .filter(([key, value]) => !hidden.has(key) && value !== null && value !== "")
        .map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key] ?? "추가 정보"}</dt>
            <dd>
              {typeof value === "boolean" ? (value ? "예" : "아니오") : String(value)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
