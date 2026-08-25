"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { V2Button } from "./v2-button";
import styles from "./public-landing.module.css";

const navigation = [
  { href: "/courses", label: "과정" },
  { href: "/guide", label: "학습 방식" },
  { href: "/about", label: "서비스 소개" },
] as const;

export function PublicLandingHeader() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    }, 0);

    function closeAndRestoreFocus() {
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className={styles.header} data-v2-public-header="">
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="SECURIUM 홈으로 이동">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span className={styles.brandText}>
            <strong>SECURIUM</strong>
            <small>정보보호 학습 플랫폼</small>
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="공개 사이트 주요 메뉴">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <V2Button className={styles.desktopLogin} href="/login" variant="ghost">
            로그인
          </V2Button>
          <V2Button className={styles.desktopSignup} href="/signup">
            회원가입
          </V2Button>
          <V2Button className={styles.mobileSignup} href="/signup">
            시작하기
          </V2Button>
          <button
            aria-controls="public-v2-mobile-menu"
            aria-expanded={open}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            className={styles.menuButton}
            onClick={() => setOpen((value) => !value)}
            ref={triggerRef}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            aria-label="메뉴 바깥 영역 닫기"
            className={styles.menuBackdrop}
            onClick={closeMenu}
            type="button"
          />
          <div
            aria-label="모바일 메뉴"
            className={styles.mobileMenu}
            id="public-v2-mobile-menu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.mobileMenuHeading}>
              <div>
                <span>SECURIUM</span>
                <strong>학습을 시작해 보세요</strong>
              </div>
              <button
                aria-label="메뉴 닫기"
                className={styles.menuClose}
                onClick={() => {
                  closeMenu();
                  window.requestAnimationFrame(() => triggerRef.current?.focus());
                }}
                type="button"
              >
                ×
              </button>
            </div>
            <nav className={styles.mobileNav} aria-label="모바일 공개 메뉴">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href} onClick={closeMenu}>
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
            <div className={styles.mobileAuthActions}>
              <V2Button fullWidth href="/signup" onClick={closeMenu}>무료로 시작하기</V2Button>
              <V2Button fullWidth href="/login" onClick={closeMenu} variant="secondary">로그인</V2Button>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
