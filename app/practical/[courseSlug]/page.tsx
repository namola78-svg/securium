import Link from "next/link";
import { notFound } from "next/navigation";
import { getPracticalOverview } from "@/db/practical-specialization-repositories";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
  if (!overview.codeSamples.length && !overview.privacyScenarios.length) {
    notFound();
  }
  return (
    <main className="page-main practical-page">
      <header className="page-hero practical-hero">
        <div className="shell">
          <p className="eyebrow">PRACTICAL LAB</p>
          <h1>{course.name} 실무형 학습</h1>
          <p>공통 수강·문제은행·오답노트·복습 기록과 연결되는 과정별 실무 연습입니다.</p>
          <p className="sample-notice">모든 사례와 코드는 독립 작성한 개발용 샘플이며 공식 문제나 실제 평가 결과가 아닙니다.</p>
        </div>
      </header>
      <div className="shell">
        {overview.codeSamples.length ? (
          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">SECURE CODE REVIEW</p><h2>보안약점 코드 분석</h2></div></div>
            <div className="practical-card-grid">
              {overview.codeSamples.map((sample) => (
                <Link className="specialized-card" href={`/practical/${courseSlug}/code/${sample.id}`} key={sample.id}>
                  <span className="badge">{sample.language} · {sample.risk}</span>
                  <h3>{sample.title}</h3>
                  <p>{sample.weaknessCode} · {sample.weaknessName}</p>
                  <small>{sample.cweCode} · 개발용 샘플 · 기준일 {sample.sourceDate}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {overview.privacyScenarios.length ? (
          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">PRIVACY IMPACT ASSESSMENT</p><h2>영향평가 사례 분석</h2></div></div>
            <div className="practical-card-grid">
              {overview.privacyScenarios.map((scenario) => (
                <Link className="specialized-card" href={`/practical/${courseSlug}/privacy/${scenario.id}`} key={scenario.id}>
                  <span className="badge">{scenario.track === "EXAM_PREP" ? "평가자 시험 대비" : "영향평가 실무"}</span>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.description}</p>
                  <small>{scenario.organizationType} · {scenario.systemType} · 개발용 샘플</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
