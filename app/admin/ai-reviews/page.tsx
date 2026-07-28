import { AdminAIReviewConsole } from "@/components/admin-ai-review-console";
import { listAdminSpecializedAIRecords } from "@/db/ai-specialized-repositories";
import { requireQuestionReviewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAIReviewsPage() {
  await requireQuestionReviewer("/admin/ai-reviews");
  const records = await listAdminSpecializedAIRecords(100);
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">AI REVIEW</p>
        <h1>과정 특화 AI 결과 검수</h1>
        <p>
          AI 원본은 유지하면서 관리자 수정본·반려·논리 삭제·검수 콘텐츠
          복사 이력을 별도로 관리합니다.
        </p>
      </header>
      <AdminAIReviewConsole initialRecords={records} />
    </>
  );
}
