import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpecializedOverview,
  listRiskMethods,
  listRiskRegister,
} from "@/db/specialized-repositories";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  RiskPractice,
  WrittenAnswerPractice,
} from "@/components/specialized-actions";

export const dynamic = "force-dynamic";

export default async function SpecializedCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/specialized/${courseSlug}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) notFound();
  const overview = await getSpecializedOverview(user.id, course.id);
  const [riskMethods, riskRegister] = overview.riskScenarios.length
    ? await Promise.all([listRiskMethods(), listRiskRegister(user.id)])
    : [[], []];

  return (
    <main className="page-main specialized-page">
      <header className="page-hero specialized-hero">
        <div className="shell">
          <p className="eyebrow">COURSE SPECIALIZATION</p>
          <h1>{course.name} 특화 학습</h1>
          <p>
            공통 커리큘럼과 문제풀이 흐름 위에 과정별 기준, 법령,
            사례, 서술형 또는 위험평가 데이터를 연결합니다.
          </p>
          <p className="sample-notice">
            아래 콘텐츠는 학습용으로 독립 작성한 자료이며 공식 기준·법령
            원문이나 기출문제가 아닙니다.
          </p>
        </div>
      </header>
      <div className="shell">
        <section className="feature-strip" aria-label="과정 특화 기능">
          {overview.features.map((feature) => (
            <article key={feature.id}>
              <strong>{feature.displayName}</strong>
              <p>{feature.description}</p>
            </article>
          ))}
        </section>

        {overview.standards.length ? (
          <ContentSection
            title="인증기준 탐색"
            description="기준 번호, 분류, 기준일과 버전을 DB에서 조회합니다."
          >
            {overview.standards.map((standard) => (
              <Link
                className="specialized-card"
                href={`/specialized/${courseSlug}/ISMS_STANDARD/${standard.id}`}
                key={standard.id}
              >
                <span className="badge">{standard.code}</span>
                <h3>{standard.title}</h3>
                <p>
                  {standard.majorCategory} · {standard.middleCategory}
                </p>
                <small>
                  버전 {standard.version} · 기준일 {standard.effectiveDate}
                </small>
              </Link>
            ))}
          </ContentSection>
        ) : null}

        {overview.defectCases.length ? (
          <ContentSection
            title="결함사례 학습"
            description="가상 상황에서 결함, 증적, 시정조치를 판단합니다."
          >
            {overview.defectCases.map((item) => (
              <Link
                className="specialized-card"
                href={`/specialized/${courseSlug}/ISMS_DEFECT_CASE/${item.id}`}
                key={item.id}
              >
                <span className="badge">학습 사례</span>
                <h3>{item.title}</h3>
                <p>{item.situation}</p>
                <small>사례 기준일 {item.sourceDate}</small>
              </Link>
            ))}
          </ContentSection>
        ) : null}

        {overview.legalArticles.length ? (
          <ContentSection
            title="법령·조문 비교 학습"
            description="관련 법령의 조문, 버전, 시행·개정 기준일을 비교합니다."
          >
            {overview.legalArticles.map((article) => (
              <Link
                className="specialized-card"
                href={`/specialized/${courseSlug}/LEGAL_ARTICLE/${article.id}`}
                key={article.id}
              >
                <span className="badge">{article.articleNumber}</span>
                <h3>{article.articleTitle}</h3>
                <p>{article.lawName}</p>
                <small>
                  시행 {article.effectiveDate} · 개정 {article.revisionDate} ·{" "}
                  {article.version}
                </small>
              </Link>
            ))}
          </ContentSection>
        ) : null}

        {overview.writtenQuestions.length ? (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">WRITTEN PRACTICE</p>
                <h2>서술형 참고용 보조채점</h2>
              </div>
            </div>
            <p className="sample-notice">
              공식 채점이 아니며 필수·선택 키워드 충족 여부를 학습
              참고용으로만 제공합니다.
            </p>
            <div className="specialized-grid">
              {overview.writtenQuestions.map((question) => (
                <WrittenAnswerPractice
                  key={question.questionId}
                  courseId={course.id}
                  questionId={question.questionId}
                  title={question.title}
                  maximumScore={question.maximumScore}
                />
              ))}
            </div>
          </section>
        ) : null}

        {overview.riskScenarios.length ? (
          <>
            <ContentSection
              title="위험 시나리오"
              description="자산·위협·취약점과 기존 통제를 연결해 위험도를 평가합니다."
            >
              {overview.riskScenarios.map((scenario) => (
                <Link
                  className="specialized-card"
                  href={`/specialized/${courseSlug}/RISK_SCENARIO/${scenario.id}`}
                  key={scenario.id}
                >
                  <span className="badge">{scenario.riskLevel}</span>
                  <h3>{scenario.title}</h3>
                  <p>
                    {scenario.asset} · {scenario.threat}
                  </p>
                  <small>
                    위험값 {scenario.riskValue} · 기준일 {scenario.referenceDate}
                  </small>
                </Link>
              ))}
            </ContentSection>
            <RiskPractice methods={riskMethods} scenarios={overview.riskScenarios} />
            <section className="admin-panel section-block">
              <h2>내 위험등록부 {riskRegister.length}건</h2>
              {riskRegister.length ? (
                riskRegister.map((item) => (
                  <div className="risk-register-row" key={item.id}>
                    <div>
                      <strong>{item.scenarioTitle}</strong>
                      <small>
                        {item.asset} · {item.owner}
                      </small>
                    </div>
                    <span>{item.riskValue}</span>
                    <span className="badge">{item.status}</span>
                  </div>
                ))
              ) : (
                <p>아직 작성한 위험등록부 항목이 없습니다.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ContentSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-block">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">SPECIALIZED CONTENT</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="specialized-grid">{children}</div>
    </section>
  );
}
