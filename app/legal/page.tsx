import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/design-system-primitives";
import {
  legalPrivacyHref,
  legalTermsHref,
  authRedirectHref,
  safeAuthReturnPath,
} from "@/lib/auth-routing";
import { getOptionalCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "법적 안내 | SECURIUM",
  description: "SECURIUM의 법적 고지문(이용약관, 개인정보처리방침) 관련 페이지입니다.",
};

export default async function LegalIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(firstParam(params.return_to), "/legal");
  const user = await getOptionalCurrentAppUser();
  const signupHref = authRedirectHref("/signup", returnTo);
  const loginHref = authRedirectHref("/login", returnTo);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <Link href="/" className="breadcrumb">홈으로 돌아가기</Link>
          <p className="eyebrow">법적 안내</p>
          <h1>법적 고지 및 안내</h1>
          <p>
            SECURIUM 이용 규정 및 개인정보 처리방침에 대한 중요 내용을 한곳에서 확인하세요.
          </p>
          <p className="auth-note">서비스 이용 전 약관을, 계정과 학습 기록을 이용할 때는 개인정보 처리방침을 확인해주세요.</p>
          <div className="button-row">
            <ActionButton href={legalTermsHref(returnTo)} variant="dark">
              이용약관 보기
            </ActionButton>
            <ActionButton href={legalPrivacyHref(returnTo)} variant="secondary">
              개인정보 처리방침 보기
            </ActionButton>
            {user ? (
              <ActionButton href="/dashboard" variant="dark">
                학습 계속하기
              </ActionButton>
            ) : (
              <>
                <ActionButton href={signupHref} variant="dark">
                  회원가입
                </ActionButton>
                <ActionButton href={loginHref} variant="secondary">
                  로그인
                </ActionButton>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
