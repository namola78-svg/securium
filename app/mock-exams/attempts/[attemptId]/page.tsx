import { MockExamSession } from "@/components/mock-exam-session";
import { getMockExamAttempt } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MockExamAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireCurrentAppUser(
    `/mock-exams/attempts/${attemptId}`,
  );
  let attempt;
  try {
    attempt = await getMockExamAttempt(user.id, attemptId);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "EXAM_ATTEMPT_NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }
  return (
    <main className="page-main exam-page">
      <div className="shell">
        <MockExamSession attempt={attempt} />
      </div>
    </main>
  );
}
