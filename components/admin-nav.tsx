import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="관리자 메뉴">
      <Link href="/admin">개요</Link>
      <Link href="/admin/course-groups">과정군</Link>
      <Link href="/admin/courses">과정</Link>
      <Link href="/admin/curriculum">커리큘럼</Link>
      <Link href="/admin/shared-content">공통 콘텐츠</Link>
      <Link href="/admin/lessons">이론 레슨</Link>
      <Link href="/admin/content-revisions">기준일·버전</Link>
      <Link href="/admin/levels">단계</Link>
      <Link href="/admin/questions">문제은행</Link>
      <Link href="/admin/reviews">문제 검수</Link>
      <Link href="/admin/ai-reviews">AI 검수</Link>
      <Link href="/admin/ai-explainability">AI Trace</Link>
      <Link href="/admin/mock-exams">모의고사</Link>
      <Link href="/admin/analytics">학습 통계</Link>
      <Link href="/admin/specialized">특화 콘텐츠</Link>
      <Link href="/admin/practical-specializations">실무형 콘텐츠</Link>
      <Link href="/admin/question-reports">문제 신고</Link>
      <Link href="/admin/audit-logs">감사로그</Link>
    </nav>
  );
}
