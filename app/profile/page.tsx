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
          <p>
            로그인 계정과 플랫폼 권한 정보를 확인합니다. 민감한 인증 정보는
            화면에 표시하지 않습니다.
          </p>
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
              <dd>애플리케이션에서 저장하거나 표시하지 않습니다.</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
