import Link from "next/link";
import type { ReactNode } from "react";
import { V2Foundation } from "./v2-foundation";
import styles from "./auth-v2.module.css";

type AuthMode = "login" | "signup";

const supportItems = [
  ["01", "공식 기준 기반", "자격 과정의 공식 범위와 연결된 학습 경로를 제공합니다."],
  ["02", "문제와 해설 연결", "핵심 이론부터 문제풀이와 검수된 해설까지 이어집니다."],
  ["03", "오답 중심 복습", "틀린 문제와 취약 개념을 다음 학습으로 연결합니다."],
] as const;

export function AuthV2Shell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: AuthMode;
}) {
  return (
    <V2Foundation className={styles.root} data-auth-v2={mode}>
      <main className={styles.page} aria-label={mode === "login" ? "로그인" : "회원가입"}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="SECURIUM 홈으로 이동">
            <span className={styles.brandMark} aria-hidden="true">S</span>
            <span>
              <strong>SECURIUM</strong>
              <small>정보보호 학습 플랫폼</small>
            </span>
          </Link>
          <Link className={styles.backLink} href="/courses">과정 둘러보기</Link>
        </header>

        <div className={styles.layout}>
          <aside className={styles.support} aria-labelledby="auth-v2-support-title">
            <p className={styles.eyebrow}>SECURIUM LEARNING</p>
            <h2 id="auth-v2-support-title">학습 기록은 다음 공부로 이어집니다</h2>
            <p className={styles.supportDescription}>
              과정 선택부터 이론, 문제풀이, 오답 복습까지 한 흐름으로 학습하세요.
            </p>
            <ol className={styles.supportList}>
              {supportItems.map(([number, title, description]) => (
                <li key={title}>
                  <span>{number}</span>
                  <div><strong>{title}</strong><p>{description}</p></div>
                </li>
              ))}
            </ol>
          </aside>
          <div className={styles.formColumn}>{children}</div>
        </div>
      </main>
    </V2Foundation>
  );
}

export function AuthV2Card({
  children,
  description,
  eyebrow,
  headingId,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  headingId: string;
  title: string;
}) {
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.cardHeading}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id={headingId}>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

export { styles as authV2Styles };
