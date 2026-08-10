import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPracticalOverview } from "@/db/practical-specialization-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "실무 학습 | Securium",
  description: "사례 기반 보안 진단과 개인정보 영향평가를 연습합니다.",
};

export default async function PracticalOverviewPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await requireCurrentAppUser(`/practical/${courseSlug}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) notFound();
  const overview = await getPracticalOverview(user.id, course.id);
  const hasContent = overview.codeSamples.length > 0 || overview.privacyScenarios.length > 0;

  return (
    <main className="page-main practical-page">
      <header className="page-hero practical-hero">
        <div className="shell">
          <p className="eyebrow">PRACTICAL LAB</p>
          <h1>{course.name} 실무 학습</h1>
          <p>사례와 진단 과제를 통해 보안 코드 분석과 개인정보 영향평가를 직접 연습해 보세요.</p>
          <p className="sample-notice">
            실무 과제는 학습용 참고 자료입니다. 실제 업무 판단에는 최신 공식 기준과 조직 정책을 함께 확인하세요.
          </p>
        </div>
      </header>
      <div className="shell">
        {!hasContent ? (
          <div className="empty-state">
            <strong>아직 공개된 실무 과제가 없습니다.</strong>
            <p>먼저 과정의 기본 학습을 진행해 주세요. 실무 콘텐츠가 준비되면 이곳에서 바로 시작할 수 있습니다.</p>
            <Link className="button button-dark" href={`/learn/${course.slug}`}>
              학습 개요로 이동
            </Link>
          </div>
        ) : null}

        {overview.codeSamples.length ? (
          <section className="section-block" aria-labelledby="secure-code-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SECURE CODE REVIEW</p>
                <h2 id="secure-code-title">보안 코드 분석</h2>
                <p>취약점을 찾고 CWE를 연결한 뒤, 안전한 수정 방향까지 설명합니다.</p>
              </div>
            </div>
            <div className="practical-card-grid">
              {overview.codeSamples.map((sample) => (
                <Link className="specialized-card" href={`/practical/${courseSlug}/code/${sample.id}`} key={sample.id}>
                  <span className="badge">{sample.language} · {sample.risk}</span>
                  <h3>{sample.title}</h3>
                  <p>{sample.weaknessCode} · {sample.weaknessName}</p>
                  <small>{sample.cweCode} · 학습 사례 · 기준일 {sample.sourceDate}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {overview.privacyScenarios.length ? (
          <section className="section-block" aria-labelledby="privacy-scenario-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PRIVACY IMPACT ASSESSMENT</p>
                <h2 id="privacy-scenario-title">개인정보 영향평가 시나리오</h2>
                <p>조직과 시스템 상황을 읽고, 영향평가 판단과 개선 계획을 작성합니다.</p>
              </div>
            </div>
            <div className="practical-card-grid">
              {overview.privacyScenarios.map((scenario) => (
                <Link className="specialized-card" href={`/practical/${courseSlug}/privacy/${scenario.id}`} key={scenario.id}>
                  <span className="badge">{scenario.track === "EXAM_PREP" ? "시험 대비" : "실무 연습"}</span>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.description}</p>
                  <small>{scenario.organizationType} · {scenario.systemType} · 학습 사례</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
