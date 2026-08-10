import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrivacyAssessmentWorkbench } from "@/components/privacy-assessment-workbench";
import { PrivacyFlowDiagram } from "@/components/privacy-flow-diagram";
import { getPrivacyScenarioForUser } from "@/db/practical-specialization-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "개인정보 영향평가 실습 | Securium", description: "개인정보 처리 시나리오를 분석하고 영향평가 판단 근거를 학습합니다." };

export default async function PrivacyAssessmentPage({ params }: { params: Promise<{ courseSlug: string; scenarioId: string }> }) {
  const { courseSlug, scenarioId } = await params; const user = await requireCurrentAppUser(`/practical/${courseSlug}/privacy/${scenarioId}`); const course = await getPublicCourseBySlug(courseSlug); if (!course) notFound(); let data;
  try { data = await getPrivacyScenarioForUser(user.id, course.id, scenarioId); } catch (error) { if (error instanceof AppError && ["PRACTICAL_CONTENT_NOT_FOUND", "PRIVACY_SCENARIO_NOT_FOUND"].includes(error.code)) notFound(); throw error; }
  const scenario = data.scenario;
  return <main className="page-main practical-page"><header className="page-hero practical-hero"><div className="shell"><Link className="breadcrumb" href={`/practical/${course.slug}`}>← 실무 학습 목록</Link><p className="eyebrow">{scenario.track === "EXAM_PREP" ? "ASSESSOR EXAM PREP" : "PIA PRACTICE"}</p><h1>{publicCopy(scenario.title)}</h1><p>{publicCopy(scenario.description)}</p><p className="sample-notice">학습용 영향평가 시나리오입니다. 실제 업무 판단에는 최신 공식 기준과 조직 내부 정책을 함께 확인해야 합니다.</p></div></header><div className="shell privacy-scenario-layout"><section className="scenario-facts" aria-label="시나리오 기본 정보"><div><span>기관 유형</span><strong>{publicCopy(scenario.organizationType)}</strong></div><div><span>시스템 유형</span><strong>{publicCopy(scenario.systemType)}</strong></div><div><span>정보주체</span><strong>{publicCopy(scenario.dataSubjects)}</strong></div><div><span>처리 목적</span><strong>{publicCopy(scenario.processingPurpose)}</strong></div><div className="wide"><span>처리 개인정보</span><strong>{publicCopy(scenario.processedData)}</strong></div></section><PrivacyFlowDiagram nodes={data.nodes} edges={data.edges} /><PrivacyAssessmentWorkbench courseId={course.id} scenarioId={scenario.id} items={data.items} previousAnswer={data.previousAnswer} /></div></main>;
}
