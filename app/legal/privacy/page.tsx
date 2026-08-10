import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { authRedirectHref, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | SECURIUM",
  description: "SECURIUM이 학습 서비스 운영을 위해 개인정보를 처리하는 범위를 안내합니다.",
};

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(firstParam(params.return_to), "/legal/privacy");
  const signupHref = authRedirectHref("/signup", returnTo);
  const loginHref = authRedirectHref("/login", returnTo);
  const user = await getOptionalCurrentAppUser();

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell narrow">
          <Link href="/legal" className="breadcrumb">법적 안내</Link>
          <p className="eyebrow">개인정보 고지</p>
          <h1>개인정보 처리방침</h1>
          <p>최종 개정일: 2026-08-10</p>
          <section className="course-detail-section">
            <h2>1. 처리하는 정보</h2>
            <ul>
              <li>계정 운영을 위한 이메일과 표시 이름</li>
              <li>학습 진도, 문제풀이, 오답노트, 북마크와 학습 설정</li>
              <li>서비스 안정성과 보안을 위한 접속·오류 관련 정보</li>
            </ul>
          </section>
          <section className="course-detail-section">
            <h2>2. 이용 목적</h2>
            <p>수집된 정보는 로그인과 권한 확인, 학습 진도 관리, 복습 추천, 분석 제공, 서비스 보안과 운영 개선을 위해 필요한 범위에서 사용합니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>3. 보관과 삭제</h2>
            <p>정보는 이용 목적에 필요한 기간 동안 보관하며, 목적이 달성되거나 삭제 요청이 처리되면 관련 정책과 법적 의무에 따라 안전하게 삭제하거나 분리 보관합니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>4. 이용자의 권리와 요청</h2>
            <p>이용자는 자신의 개인정보에 대한 열람, 정정, 삭제, 처리 제한을 요청할 수 있습니다. 계정과 학습 기록에 관한 요청은 로그인 후 학습 설정에서 확인하고, 추가 문의는 서비스 소개에 안내된 운영 경로를 이용해주세요.</p>
          </section>
          <section className="course-detail-section">
            <p className="auth-note">개인정보 관련 문의와 요청은 로그인 후 <Link href="/settings" className="text-link">학습 설정</Link>을 확인하거나 운영 안내를 참고해주세요.</p>
          </section>
          <section className="course-detail-section">
            <h2>5. 다음 행동</h2>
            <div className="button-row">
              {user ? <ActionButton href="/settings" variant="dark">설정 확인</ActionButton> : <><ActionButton href={signupHref} variant="dark">회원가입으로 계속하기</ActionButton><ActionButton href={loginHref} variant="secondary">로그인하기</ActionButton></>}
              <Link href="/courses" className="text-link">학습 과정 보기</Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
