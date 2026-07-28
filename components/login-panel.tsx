"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type LoginPanelProps = {
  returnTo: string;
  error?: string;
  notice?: string;
};

type FieldErrors = {
  email?: string;
  password?: string;
};

export function LoginPanel({ returnTo, error = "", notice = "" }: LoginPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState("");

  const serverMessage = useMemo(() => loginErrorMessage(error), [error]);
  const googleHref = `/api/auth/supabase/oauth/google?return_to=${encodeURIComponent(returnTo)}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextErrors: FieldErrors = {};

    if (!email) {
      nextErrors.email = "이메일을 입력해 주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "올바른 이메일 형식으로 입력해 주세요.";
    }

    if (!password) {
      nextErrors.password = "비밀번호를 입력해 주세요.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    setIsSubmitting(true);
    formRef.current?.submit();
  }

  return (
    <section className="auth-card auth-card-polished" aria-labelledby="login-title">
      <div className="auth-brand-lockup">
        <span className="auth-logo-mark" aria-hidden="true">
          S
        </span>
        <div>
          <strong>시큐리움 | SECURIUM</strong>
          <span>AI 통합 학습 플랫폼</span>
        </div>
      </div>

      <p className="eyebrow">SECURE SIGN IN</p>
      <h1 id="login-title">다시 만나서 반갑습니다</h1>
      <p className="auth-description">
        학습 진도, 오답노트, AI 튜터 기록을 이어서 확인하세요.
      </p>

      {serverMessage ? (
        <div className="notice notice-warning" role="alert">
          {serverMessage}
        </div>
      ) : null}
      {notice === "confirm_email" ? (
        <div className="notice" role="status">
          가입한 이메일에서 인증을 완료한 뒤 로그인해 주세요.
        </div>
      ) : null}

      <Link
        className={`google-auth-button ${isGoogleLoading ? "is-loading" : ""}`}
        href={googleHref}
        onClick={() => setIsGoogleLoading(true)}
        aria-busy={isGoogleLoading}
      >
        <GoogleIcon />
        {isGoogleLoading ? "Google로 이동하는 중" : "Google로 계속하기"}
      </Link>

      <div className="auth-divider" aria-hidden="true">
        <span>또는</span>
      </div>

      <form
        ref={formRef}
        className="form-stack login-form"
        action="/api/auth/supabase/login"
        method="post"
        noValidate
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="field-group">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p className="field-error" id="login-email-error">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="login-password">비밀번호</label>
            <button
              className="inline-text-button"
              type="button"
              onClick={() => {
                setForgotNotice(
                  "비밀번호 재설정은 운영 환경의 Supabase 메일 설정 연결 후 사용할 수 있습니다.",
                );
              }}
            >
              비밀번호 찾기
            </button>
          </div>
          <div className="password-field">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password || serverMessage || forgotNotice
                  ? "login-password-message"
                  : undefined
              }
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              {showPassword ? "숨기기" : "표시"}
            </button>
          </div>
          {fieldErrors.password || forgotNotice ? (
            <p
              className={fieldErrors.password ? "field-error" : "field-help"}
              id="login-password-message"
            >
              {fieldErrors.password || forgotNotice}
            </p>
          ) : null}
        </div>

        <button
          className="button button-dark full-width auth-submit-button"
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              로그인 중
            </>
          ) : (
            "로그인"
          )}
        </button>
      </form>

      <p className="auth-switch-copy">
        계정이 없으신가요?{" "}
        <Link href={`/signup?return_to=${encodeURIComponent(returnTo)}`}>
          무료 계정 만들기
        </Link>
      </p>
      <p className="auth-legal-copy">
        계속 진행하면 SECURIUM의 <span>이용약관</span> 및{" "}
        <span>개인정보처리방침</span>에 동의한 것으로 간주됩니다.
      </p>
    </section>
  );
}

function loginErrorMessage(error: string) {
  switch (error) {
    case "email_invalid":
      return "이메일 형식을 확인해 주세요.";
    case "password_invalid":
      return "비밀번호를 입력해 주세요.";
    case "credentials_invalid":
    case "signin_failed":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "oauth_provider_failed":
      return "Google 로그인 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    case "oauth_callback_failed":
    case "oauth_failed":
      return "Google 로그인 확인 중 문제가 발생했습니다. 다시 시도해 주세요.";
    case "oauth_cancelled":
      return "Google 로그인이 취소되었습니다.";
    case "network":
      return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    default:
      return "";
  }
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="google-icon"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
