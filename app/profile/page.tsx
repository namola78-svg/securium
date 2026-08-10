import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "프로필",
  description: "SECURIUM 계정과 역할 정보를 확인합니다.",
};
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireCurrentAppUser("/profile");

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">내 프로필</p>
          <h1>프로필</h1>
          <p>계정과 플랫폼 권한 정보를 확인할 수 있습니다. 민감한 인증 정보는 표시하지 않습니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <dl className="profile-card">
            <div><dt>표시 이름</dt><dd>{user.displayName || "이름 미설정"}</dd></div>
            <div><dt>이메일</dt><dd>{user.email}</dd></div>
            <div><dt>역할</dt><dd>{formatRoles(user.roles)}</dd></div>
            <div><dt>비밀번호</dt><dd>인증 제공자에서 안전하게 관리됩니다.</dd></div>
          </dl>
          <div className="button-row">
            <ActionButton href="/settings" variant="dark">학습 설정</ActionButton>
            <ActionButton href="/dashboard" variant="ghost">대시보드 보기</ActionButton>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatRoles(roles: string[]) {
  if (!roles.length) return "일반 학습자";
  const labels: Record<string, string> = {
    ADMIN: "관리자",
    SUPER_ADMIN: "최고 관리자",
    CONTENT_REVIEWER: "콘텐츠 검수자",
    USER: "일반 학습자",
  };
  return roles.map((role) => labels[role] ?? "추가 권한").join(", ");
}
