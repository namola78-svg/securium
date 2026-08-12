import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { LoginPanel } from "@/components/login-panel";
import { AuthV2Card, AuthV2Shell, authV2Styles as styles } from "@/components/v2/auth-v2";
import { V2Button } from "@/components/v2/v2-button";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { buildSafeRedirectQuery, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "로그인 | SECURIUM", description: "SECURIUM에서 학습을 이어가세요." };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const error = firstParam(params.error);
  const notice = firstParam(params.notice);
  const user = await getOptionalCurrentAppUser();
  if (requestedReturnTo && requestedReturnTo !== returnTo) redirect(`/login?${buildSafeRedirectQuery({ return_to: returnTo, error, notice })}`);
  if (user) redirect(returnTo);
  return (
    <AuthV2Shell mode="login">
      {resolveAuthProvider() === "supabase" ? (
        <LoginPanel returnTo={returnTo} error={error} notice={notice} />
      ) : (
        <AuthV2Card
          description="학습을 이어서 시작하세요."
          eyebrow="계정 로그인"
          headingId="login-title"
          title="다시 만나서 반가워요"
        >
          <V2Button href={chatGPTSignInPath(returnTo)} size="lg" fullWidth>
            Google 계정으로 로그인
          </V2Button>
          <p className={styles.providerNote}>계정이 없으면 로그인 과정에서 새 계정을 만들 수 있습니다.</p>
          <p className={styles.switchCopy}>처음 방문하셨나요? <Link href={`/signup?return_to=${encodeURIComponent(returnTo)}`} className={styles.textLink}>회원가입 안내</Link></p>
        </AuthV2Card>
      )}
    </AuthV2Shell>
  );
}
function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
