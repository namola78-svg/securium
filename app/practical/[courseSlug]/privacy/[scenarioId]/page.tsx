import { notFound } from "next/navigation";

import { PrivacyAssessmentWorkbench } from "@/components/privacy-assessment-workbench";
import { PrivacyFlowDiagram } from "@/components/privacy-flow-diagram";
import { getPrivacyScenarioForUser } from "@/db/practical-specialization-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";

export default async function PrivacyAssessmentPage({
  params,
}: {
  params: Promise<{ courseSlug: string; scenarioId: string }>;
}) {
  const { courseSlug, scenarioId } = await params;
  const user = await requireCurrentAppUser(
    `/practical/${courseSlug}/privacy/${scenarioId}`,
  );
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();

  let data;
  try {
    data = await getPrivacyScenarioForUser(user.id, course.id, scenarioId);
  } catch (error) {
    if (
      error instanceof AppError &&
      ["PRACTICAL_CONTENT_NOT_FOUND", "PRIVACY_SCENARIO_NOT_FOUND"].includes(
        error.code,
      )
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="page-main practical-page">
      <header className="page-hero practical-hero">
        <div className="shell">
          <p className="eyebrow">
            {data.scenario.track === "EXAM_PREP"
              ? "ASSESSOR EXAM PREP"
              : "PIA PRACTICE"}
          </p>
          <h1>{publicCopy(data.scenario.title)}</h1>
          <p>{publicCopy(data.scenario.description)}</p>
          <p className="sample-notice">
            독립 작성한 학습 시나리오입니다. 운영 판단에는 최신 공식 기준 확인이 필요합니다.
          </p>
        </div>
      </header>
      <div className="shell privacy-scenario-layout">
        <section className="scenario-facts" aria-label="시나리오 기본 정보">
          <div>
            <span>기관 유형</span>
            <strong>{publicCopy(data.scenario.organizationType)}</strong>
          </div>
          <div>
            <span>시스템 유형</span>
            <strong>{publicCopy(data.scenario.systemType)}</strong>
          </div>
          <div>
            <span>정보주체</span>
            <strong>{publicCopy(data.scenario.dataSubjects)}</strong>
          </div>
          <div>
            <span>처리 목적</span>
            <strong>{publicCopy(data.scenario.processingPurpose)}</strong>
          </div>
          <div className="wide">
            <span>처리 개인정보</span>
            <strong>{publicCopy(data.scenario.processedData)}</strong>
          </div>
        </section>
        <PrivacyFlowDiagram nodes={data.nodes} edges={data.edges} />
        <PrivacyAssessmentWorkbench
          courseId={course.id}
          scenarioId={data.scenario.id}
          items={data.items}
          previousAnswer={data.previousAnswer}
        />
      </div>
    </main>
  );
}
