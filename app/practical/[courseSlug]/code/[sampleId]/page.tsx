import { notFound } from "next/navigation";
import { CodeAnalysisWorkbench } from "@/components/code-analysis-workbench";
import { getCodeSampleForUser } from "@/db/practical-specialization-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function CodeAnalysisPage({
  params,
}: {
  params: Promise<{ courseSlug: string; sampleId: string }>;
}) {
  const { courseSlug, sampleId } = await params;
  const user = await requireCurrentAppUser(
    `/practical/${courseSlug}/code/${sampleId}`,
  );
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let data;
  try {
    data = await getCodeSampleForUser(user.id, course.id, sampleId);
  } catch (error) {
    if (
      error instanceof AppError &&
      ["PRACTICAL_CONTENT_NOT_FOUND", "CODE_SAMPLE_NOT_FOUND"].includes(
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
          <p className="eyebrow">SAFE STATIC ANALYSIS</p>
          <h1>{course.name} 코드 진단</h1>
          <p>줄 선택, 약점·CWE 매핑, 정탐·오탐 판단과 조치방안을 함께 연습합니다.</p>
          <p className="sample-notice">사용자 입력 코드와 샘플 코드는 서버에서 실행하지 않습니다.</p>
        </div>
      </header>
      <div className="shell">
        <CodeAnalysisWorkbench
          courseId={course.id}
          sample={data.sample}
          weaknesses={data.weaknesses}
        />
      </div>
    </main>
  );
}
