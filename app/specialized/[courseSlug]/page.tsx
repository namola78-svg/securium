import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskPractice, WrittenAnswerPractice } from "@/components/specialized-actions";
import { getSpecializedOverview, listRiskMethods, listRiskRegister } from "@/db/specialized-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "특화 보안 학습 | Securium",
  description: "인증 기준, 법령, 사례와 위험평가를 과정별로 학습합니다.",
};

export default async function SpecializedCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/specialized/${courseSlug}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) notFound();
  const overview = await getSpecializedOverview(user.id, course.id);
  const [riskMethods, riskRegister] = overview.riskScenarios.length ? await Promise.all([listRiskMethods(), listRiskRegister(user.id)]) : [[], []];
  const hasContent = overview.standards.length || overview.defectCases.length || overview.legalArticles.length || overview.writtenQuestions.length || overview.riskScenarios.length;

  return <main className="page-main specialized-page">
    <header className="page-hero specialized-hero"><div className="shell">
      <p className="eyebrow">COURSE SPECIALIZATION</p>
      <h1>{course.name} 특화 학습</h1>
      <p>공통 커리큘럼 위에 인증 기준, 법령, 실무 사례와 위험평가를 연결해 학습합니다.</p>
      <p className="sample-notice">특화 콘텐츠는 학습 참고 자료입니다. 실제 인증·법률·위험 판단에는 최신 공식 원문과 조직 정책을 함께 확인하세요.</p>
    </div></header>
    <div className="shell">
      {overview.features.length ? <section className="feature-strip" aria-label="특화 학습 기능">{overview.features.map((feature) => <article key={feature.id}><strong>{feature.displayName}</strong><p>{feature.description}</p></article>)}</section> : null}
      {!hasContent ? <div className="empty-state"><strong>아직 공개된 특화 콘텐츠가 없습니다.</strong><p>공통 과정 학습을 먼저 진행해 주세요. 콘텐츠가 준비되면 이 화면에서 기준과 사례를 이어서 학습할 수 있습니다.</p><Link className="button button-dark" href={`/learn/${course.slug}`}>학습 개요로 이동</Link></div> : null}
      {overview.standards.length ? <ContentSection title="인증 기준" description="기준 번호와 분류를 확인하고 관련 학습 콘텐츠로 이동하세요.">{overview.standards.map((item) => <Link className="specialized-card" href={`/specialized/${courseSlug}/ISMS_STANDARD/${item.id}`} key={item.id}><span className="badge">{item.code}</span><h3>{item.title}</h3><p>{item.majorCategory} · {item.middleCategory}</p><small>버전 {item.version} · 기준일 {item.effectiveDate}</small></Link>)}</ContentSection> : null}
      {overview.defectCases.length ? <ContentSection title="결함 사례" description="상황과 증적, 시정 조치를 함께 읽으며 판단 기준을 연습하세요.">{overview.defectCases.map((item) => <Link className="specialized-card" href={`/specialized/${courseSlug}/ISMS_DEFECT_CASE/${item.id}`} key={item.id}><span className="badge">학습 사례</span><h3>{item.title}</h3><p>{item.situation}</p><small>사례 기준일 {item.sourceDate}</small></Link>)}</ContentSection> : null}
      {overview.legalArticles.length ? <ContentSection title="법령·조문" description="관련 법령의 조문과 시행·개정 기준일을 비교하세요.">{overview.legalArticles.map((item) => <Link className="specialized-card" href={`/specialized/${courseSlug}/LEGAL_ARTICLE/${item.id}`} key={item.id}><span className="badge">{item.articleNumber}</span><h3>{item.articleTitle}</h3><p>{item.lawName}</p><small>시행 {item.effectiveDate} · 개정 {item.revisionDate} · {item.version}</small></Link>)}</ContentSection> : null}
      {overview.writtenQuestions.length ? <section className="section-block"><div className="section-heading"><div><p className="eyebrow">WRITTEN PRACTICE</p><h2>서술형 답안 연습</h2><p>공식 채점이 아닌 학습 보조용 답안 평가를 통해 논리와 근거를 점검합니다.</p></div></div><div className="specialized-grid">{overview.writtenQuestions.map((question) => <WrittenAnswerPractice key={question.questionId} courseId={course.id} questionId={question.questionId} title={question.title} maximumScore={question.maximumScore} />)}</div></section> : null}
      {overview.riskScenarios.length ? <><ContentSection title="위험 시나리오" description="자산·위협·취약점을 연결해 위험을 평가하고 처리 방안을 선택합니다.">{overview.riskScenarios.map((scenario) => <Link className="specialized-card" href={`/specialized/${courseSlug}/RISK_SCENARIO/${scenario.id}`} key={scenario.id}><span className="badge">위험 등급 {scenario.riskLevel}</span><h3>{scenario.title}</h3><p>{scenario.asset} · {scenario.threat}</p><small>위험값 {scenario.riskValue} · 기준일 {scenario.referenceDate}</small></Link>)}</ContentSection><RiskPractice methods={riskMethods} scenarios={overview.riskScenarios} /><section className="specialized-info-panel section-block" aria-labelledby="risk-register-title"><h2 id="risk-register-title">내 위험 등록부 {riskRegister.length}건</h2>{riskRegister.length ? riskRegister.map((item) => <div className="risk-register-row" key={item.id}><div><strong>{item.scenarioTitle}</strong><small>{item.asset} · 담당 {item.owner}</small></div><span>{item.riskValue}</span><span className="badge">{item.status}</span></div>) : <p>아직 등록한 위험이 없습니다. 시나리오를 평가하면 이곳에 정리됩니다.</p>}</section></> : null}
    </div>
  </main>;
}

function ContentSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="section-block"><div className="section-heading compact"><div><p className="eyebrow">SPECIALIZED CONTENT</p><h2>{title}</h2><p>{description}</p></div></div><div className="specialized-grid">{children}</div></section>;
}
