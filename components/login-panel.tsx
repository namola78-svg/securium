"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { AuthV2Card, authV2Styles as styles } from "@/components/v2/auth-v2";
import { V2Button } from "@/components/v2/v2-button";
import { authApiRedirectHref, authRedirectHref, legalPrivacyHref, legalTermsHref } from "@/lib/auth-routing";

type Props = { returnTo: string; error?: string; notice?: string };

export function LoginPanel({ returnTo, error = "", notice = "" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleHref = authApiRedirectHref("/api/auth/supabase/oauth/google", returnTo);
  const signupHref = authRedirectHref("/signup", returnTo);
  const serverMessage = loginErrorMessage(error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const nextEmailError = !email ? "이메일을 입력해주세요." : !/^\S+@\S+\.\S+$/.test(email) ? "올바른 이메일 형식을 입력해주세요." : "";
    const nextPasswordError = !password ? "비밀번호를 입력해주세요." : password.length < 8 || password.length > 128 ? "비밀번호는 8~128자 사이로 입력해주세요." : "";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;
    setSubmitting(true);
    formRef.current?.submit();
  }

  return (
    <AuthV2Card
      description="학습을 이어서 시작하세요."
      eyebrow="계정 로그인"
      headingId="login-title"
      title="다시 만나서 반가워요"
    >
      {serverMessage ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{serverMessage}</div> : null}
      {notice === "confirm_email" ? <div className={styles.notice} role="status">이메일 인증을 완료한 뒤 로그인해주세요.</div> : null}
      <a
        className={styles.oauthButton}
        href={googleHref}
        onClick={(event) => {
          if (submitting || googleLoading) event.preventDefault();
          else setGoogleLoading(true);
        }}
        aria-busy={googleLoading}
      >
        <span className={styles.oauthMark} aria-hidden="true">G</span>
        {googleLoading ? "Google 로그인 중..." : "Google로 로그인"}
      </a>
      <div className={styles.divider} aria-hidden="true"><span>또는</span></div>
      <form ref={formRef} className={styles.form} action="/api/auth/supabase/login" method="post" noValidate onSubmit={submit}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className={styles.field}>
          <label htmlFor="login-email">이메일</label>
          <input id="login-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "login-email-error" : undefined} />
          {emailError ? <p id="login-email-error" className={styles.fieldError} role="alert">{emailError}</p> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">비밀번호</label>
          <div className={styles.passwordField}>
            <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} maxLength={128} required aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "login-password-error" : undefined} />
            <button className={styles.passwordToggle} type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨기기" : "보기"}</button>
          </div>
          {passwordError ? <p id="login-password-error" className={styles.fieldError} role="alert">{passwordError}</p> : null}
        </div>
        <V2Button type="submit" size="lg" fullWidth className={styles.submit} disabled={submitting || googleLoading} aria-busy={submitting}>
          {submitting ? "로그인 중..." : "로그인"}
        </V2Button>
      </form>
      <p className={styles.switchCopy}>아직 계정이 없나요? <Link href={signupHref} className={styles.textLink}>회원가입</Link></p>
      <p className={styles.legalCopy}>로그인하면 <Link href={legalTermsHref(returnTo)} className={styles.textLink}>이용약관</Link>과 <Link href={legalPrivacyHref(returnTo)} className={styles.textLink}>개인정보 처리방침</Link>에 동의한 것으로 간주합니다.</p>
    </AuthV2Card>
  );
}

function loginErrorMessage(error: string) {
  const messages: Record<string, string> = {
    email_invalid: "이메일 형식을 확인해주세요.",
    password_invalid: "비밀번호가 올바르지 않습니다.",
    credentials_invalid: "이메일 또는 비밀번호가 올바르지 않습니다.",
    signin_failed: "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
    oauth_provider_failed: "Google 로그인 시작에 실패했습니다.",
    oauth_callback_failed: "Google 인증 중 문제가 발생했습니다.",
    oauth_failed: "Google 인증 중 문제가 발생했습니다.",
    oauth_cancelled: "Google 인증을 취소했습니다.",
    network: "네트워크 연결을 확인해주세요.",
  };
  return messages[error] ?? "";
}
