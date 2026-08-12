import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { SignupPanel } from "@/components/signup-panel";
import { AuthV2Card, AuthV2Shell, authV2Styles as styles } from "@/components/v2/auth-v2";
import { V2Button } from "@/components/v2/v2-button";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { buildSafeRedirectQuery, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "회원가입 | SECURIUM", description: "SECURIUM 학습을 시작하세요." };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const error = firstParam(params.error);
  const user = await getOptionalCurrentAppUser();
  if (requestedReturnTo && requestedReturnTo !== returnTo) redirect(`/signup?${buildSafeRedirectQuery({ return_to: returnTo, error })}`);
  if (user) redirect(returnTo);
  return (
    <AuthV2Shell mode="signup">
      {resolveAuthProvider() === "supabase" ? (
        <SignupPanel returnTo={returnTo} error={error}>
          이미 계정이 있나요? <Link href={`/login?return_to=${encodeURIComponent(returnTo)}`} className={styles.textLink}>로그인</Link>
        </SignupPanel>
      ) : (
        <AuthV2Card
          description="정보보호 학습 기록을 만들고 진도와 복습을 이어갈 수 있습니다."
          eyebrow="계정 만들기"
          headingId="signup-title"
          title="학습을 시작해보세요"
        >
          <V2Button href={chatGPTSignInPath(returnTo)} size="lg" fullWidth>
            Google 계정으로 시작하기
          </V2Button>
          <p className={styles.providerNote}>현재 환경에서는 Google 계정으로 안전하게 학습 프로필을 만들 수 있습니다.</p>
          <p className={styles.switchCopy}>이미 계정이 있나요? <Link href={`/login?return_to=${encodeURIComponent(returnTo)}`} className={styles.textLink}>로그인</Link></p>
        </AuthV2Card>
      )}
    </AuthV2Shell>
  );
}
function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
