import type { Metadata } from "next";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = { title: "프로필" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireCurrentAppUser("/profile");

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">MY PROFILE</p>
          <h1>프로필</h1>
          <p>플랫폼 인증에서 확인한 최소 정보와 현재 역할을 표시합니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <dl className="profile-card">
            <div>
              <dt>표시 이름</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>역할</dt>
              <dd>{user.roles.join(", ") || "USER"}</dd>
            </div>
            <div>
              <dt>비밀번호</dt>
              <dd>애플리케이션에서 저장하지 않음</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
