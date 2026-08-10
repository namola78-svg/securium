import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeAnalysisWorkbench } from "@/components/code-analysis-workbench";
import { getCodeSampleForUser } from "@/db/practical-specialization-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "보안 코드 분석 | Securium", description: "취약한 코드에서 문제를 찾고 수정 방향을 연습합니다." };

export default async function CodeAnalysisPage({ params }: { params: Promise<{ courseSlug: string; sampleId: string }> }) {
  const { courseSlug, sampleId } = await params;
  const user = await requireCurrentAppUser(`/practical/${courseSlug}/code/${sampleId}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let data;
  try {
    data = await getCodeSampleForUser(user.id, course.id, sampleId);
  } catch (error) {
    if (error instanceof AppError && ["PRACTICAL_CONTENT_NOT_FOUND", "CODE_SAMPLE_NOT_FOUND"].includes(error.code)) notFound();
    throw error;
  }
  return (
    <main className="page-main practical-page">
      <header className="page-hero practical-hero"><div className="shell">
        <Link className="breadcrumb" href={`/practical/${course.slug}`}>실무 학습 목록</Link>
        <p className="eyebrow">SAFE STATIC ANALYSIS</p>
        <h1>{course.name} 코드 진단</h1>
        <p>취약한 줄을 선택하고 CWE와 판단 근거, 안전한 수정 방향을 작성해 보세요.</p>
        <p className="sample-notice">입력 코드는 서버에서 실행하지 않습니다. 이 과제는 정적 분석 학습용이며 실제 운영 코드 검토를 대신하지 않습니다.</p>
      </div></header>
      <div className="shell"><CodeAnalysisWorkbench courseId={course.id} sample={data.sample} weaknesses={data.weaknesses} /></div>
    </main>
  );
}
