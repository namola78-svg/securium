import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { authRedirectHref, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = {
  title: "이용약관 | SECURIUM",
  description: "SECURIUM 서비스 이용 조건과 책임을 안내합니다.",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(firstParam(params.return_to), "/legal/terms");
  const signupHref = authRedirectHref("/signup", returnTo);
  const loginHref = authRedirectHref("/login", returnTo);
  const user = await getOptionalCurrentAppUser();

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell narrow">
          <Link href="/legal" className="breadcrumb">법적 안내</Link>
          <p className="eyebrow">법적 고지</p>
          <h1>이용약관</h1>
          <p>최종 개정일: 2026-08-10</p>
          <section className="course-detail-section">
            <h2>1. 목적과 적용</h2>
            <p>이 약관은 SECURIUM의 학습 과정, 문제풀이, 복습, 분석과 관련된 서비스 이용 조건과 이용자의 기본 책임을 안내합니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>2. 계정과 보안</h2>
            <p>이용자는 본인 인증 정보를 안전하게 관리해야 하며, 계정의 무단 사용이 의심되면 즉시 서비스 운영 채널에 알려야 합니다. SECURIUM은 서비스 보안을 위해 필요한 범위에서 접근 권한을 관리합니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>3. 학습 콘텐츠와 AI 설명</h2>
            <p>문제, 해설, 커리큘럼과 학습 분석은 학습 지원을 위한 콘텐츠입니다. AI 설명은 참고용이며 공식 채점 결과나 최신 법령·기준을 대신하지 않으므로 중요한 판단에는 공식 자료를 함께 확인해야 합니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>4. 서비스 변경과 안내</h2>
            <p>콘텐츠와 기능은 품질 개선, 보안, 운영 사정에 따라 변경될 수 있습니다. 중요한 정책 변경은 서비스 내 공지와 관련 안내를 통해 알립니다.</p>
          </section>
          <section className="course-detail-section">
            <h2>5. 학습 자료의 이용 범위</h2>
            <p>SECURIUM의 문제, 해설, 분석과 추천은 학습을 돕기 위한 자료입니다. 공식 시험의 출제·채점 결과, 법률 자문, 보안 진단 결과를 보장하지 않으며 콘텐츠를 무단으로 복제하거나 재배포해서는 안 됩니다.</p>
          </section>
          <section className="course-detail-section">
            <p className="auth-note">정책에 관한 문의나 계정 관련 도움이 필요하면 <Link href="/about" className="text-link">서비스 소개</Link>를 확인해주세요.</p>
          </section>
          <section className="course-detail-section">
            <h2>6. 다음 행동</h2>
            <div className="button-row">
              {user ? <ActionButton href="/dashboard" variant="dark">대시보드로 이동</ActionButton> : <><ActionButton href={signupHref} variant="dark">회원가입으로 계속하기</ActionButton><ActionButton href={loginHref} variant="secondary">로그인하기</ActionButton></>}
              <Link href="/" className="text-link">홈으로 이동</Link>
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
