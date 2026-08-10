"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ActionButton } from "@/components/design-system-primitives";
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
    <section className="auth-card auth-card-polished" aria-labelledby="login-title">
      <div className="auth-brand-lockup"><span className="auth-logo-mark" aria-hidden="true">S</span><div><strong>SECURIUM</strong><span>보안 학습 플랫폼</span></div></div>
      <p className="eyebrow">SECURE SIGN IN</p>
      <h1 id="login-title">로그인</h1>
      <p className="auth-description">학습 진도와 오답노트를 이어서 확인하세요.</p>
      {serverMessage ? <div className="notice notice-warning" role="alert">{serverMessage}</div> : null}
      {notice === "confirm_email" ? <div className="notice" role="status">이메일 인증을 완료한 뒤 로그인해주세요.</div> : null}
      <a className={`google-auth-button ${googleLoading ? "is-loading" : ""}`} href={googleHref} onClick={(event) => { if (submitting || googleLoading) event.preventDefault(); else setGoogleLoading(true); }} aria-busy={googleLoading}>
        <span aria-hidden="true">G</span>{googleLoading ? "Google 로그인 중..." : "Google로 로그인"}
      </a>
      <div className="auth-divider" aria-hidden="true"><span>또는</span></div>
      <form ref={formRef} className="form-stack login-form" action="/api/auth/supabase/login" method="post" noValidate onSubmit={submit}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="field-group"><label htmlFor="login-email">이메일</label><input id="login-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "login-email-error" : undefined} />{emailError ? <p id="login-email-error" className="field-error" role="alert">{emailError}</p> : null}</div>
        <div className="field-group"><label htmlFor="login-password">비밀번호</label><div className="password-field"><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} maxLength={128} required aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "login-password-error" : undefined} /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}>{showPassword ? "숨기기" : "보기"}</button></div>{passwordError ? <p id="login-password-error" className="field-error" role="alert">{passwordError}</p> : null}</div>
        <ActionButton type="submit" variant="dark" className="full-width auth-submit-button" disabled={submitting || googleLoading} aria-busy={submitting}>{submitting ? "로그인 중..." : "로그인"}</ActionButton>
      </form>
      <p className="auth-switch-copy">계정이 없으신가요? <Link href={signupHref} className="text-link">회원가입</Link></p>
      <p className="auth-legal-copy">로그인하면 <Link href={legalTermsHref(returnTo)} className="text-link">이용약관</Link>과 <Link href={legalPrivacyHref(returnTo)} className="text-link">개인정보 처리방침</Link>에 동의한 것으로 간주합니다.</p>
    </section>
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
