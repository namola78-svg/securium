"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useRef, useState } from "react";
import { AuthV2Card, authV2Styles as styles } from "@/components/v2/auth-v2";
import { V2Button } from "@/components/v2/v2-button";
import { authApiRedirectHref, authRedirectHref, legalPrivacyHref, legalTermsHref } from "@/lib/auth-routing";

type Props = { returnTo: string; error?: string; children?: ReactNode };

export function SignupPanel({ returnTo, error = "", children }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleHref = authApiRedirectHref("/api/auth/supabase/oauth/google", returnTo);
  const loginHref = authRedirectHref("/login", returnTo);
  const serverMessage = signupErrorMessage(error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const nextErrors: Record<string, string> = {};
    if (!displayName) nextErrors.displayName = "이름을 입력해주세요.";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "올바른 이메일 형식을 입력해주세요.";
    if (password.length < 8 || password.length > 128) nextErrors.password = "비밀번호는 8~128자 사이로 입력해주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    formRef.current?.submit();
  }

  return (
    <AuthV2Card
      description="정보보호 학습 기록을 만들고 진도와 복습을 이어갈 수 있습니다."
      eyebrow="계정 만들기"
      headingId="signup-title"
      title="학습을 시작해보세요"
    >
      {serverMessage ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{serverMessage}<p><Link href={loginHref} className={styles.textLink}>로그인으로 이동</Link></p></div> : null}
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
        {googleLoading ? "Google 이동 중..." : "Google로 가입"}
      </a>
      <div className={styles.divider} aria-hidden="true"><span>또는</span></div>
      <form ref={formRef} className={styles.form} action="/api/auth/supabase/signup" method="post" noValidate onSubmit={submit}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className={styles.field}>
          <label htmlFor="signup-display-name">이름</label>
          <input id="signup-display-name" name="displayName" type="text" autoComplete="name" maxLength={80} required aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "signup-display-name-error" : undefined} />
          {errors.displayName ? <p id="signup-display-name-error" className={styles.fieldError} role="alert">{errors.displayName}</p> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-email">이메일</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "signup-email-error" : undefined} />
          {errors.email ? <p id="signup-email-error" className={styles.fieldError} role="alert">{errors.email}</p> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">비밀번호</label>
          <div className={styles.passwordField}>
            <input id="signup-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "signup-password-hint signup-password-error" : "signup-password-hint"} />
            <button className={styles.passwordToggle} type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨기기" : "보기"}</button>
          </div>
          <p id="signup-password-hint" className={styles.fieldHint}>8~128자의 비밀번호를 사용하세요.</p>
          {errors.password ? <p id="signup-password-error" className={styles.fieldError} role="alert">{errors.password}</p> : null}
        </div>
        <V2Button type="submit" size="lg" fullWidth className={styles.submit} disabled={submitting || googleLoading} aria-busy={submitting}>
          {submitting ? "가입 처리 중..." : "회원가입"}
        </V2Button>
      </form>
      {children ? <p className={styles.switchCopy}>{children}</p> : <p className={styles.switchCopy}>이미 계정이 있나요? <Link href={loginHref} className={styles.textLink}>로그인</Link></p>}
      <p className={styles.legalCopy}>가입하면 <Link href={legalTermsHref(returnTo)} className={styles.textLink}>이용약관</Link>과 <Link href={legalPrivacyHref(returnTo)} className={styles.textLink}>개인정보 처리방침</Link>에 동의한 것으로 간주합니다.</p>
    </AuthV2Card>
  );
}

function signupErrorMessage(error: string) {
  const messages: Record<string, string> = {
    email_invalid: "이메일 형식을 확인해주세요.",
    weak_password: "비밀번호는 8~128자 사이로 입력해주세요.",
    signup_disabled: "현재 회원가입이 일시적으로 비활성화되어 있습니다.",
    already_registered: "이미 등록된 이메일입니다.",
    display_name_invalid: "이름은 1~80자 사이로 입력해주세요.",
    network: "네트워크 연결을 확인해주세요.",
    signup_failed: "회원가입 처리 중 문제가 발생했습니다.",
  };
  return messages[error] ?? "";
}
