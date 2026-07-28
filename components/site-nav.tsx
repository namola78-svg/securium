"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const publicNavItems = [{ href: "/courses", label: "과정" }];

const userNavItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/my-courses", label: "내 과정" },
  { href: "/wrong-notes", label: "오답노트" },
  { href: "/reviews", label: "오늘의 복습" },
  { href: "/mock-exams", label: "모의고사" },
  { href: "/analytics", label: "학습분석" },
  { href: "/bookmarks", label: "즐겨찾기" },
  { href: "/profile", label: "프로필" },
];

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const activePath = resolveActivePath(pathname, searchParams);
  const navItems = signedIn
    ? [...publicNavItems, ...userNavItems]
    : publicNavItems;

  return (
    <nav className="main-nav" aria-label="주요 메뉴">
      {navItems.map((item) => {
        const active = isActivePath(activePath, item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "active" : undefined}
            href={item.href}
            key={item.href}
            title={active ? `현재 위치: ${item.label}` : item.label}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function resolveActivePath(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  if (pathname !== "/login" && pathname !== "/signup") return pathname;

  const returnTo = searchParams.get("return_to");
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) return pathname;

  try {
    return new URL(returnTo, "https://app.local").pathname;
  } catch {
    return pathname;
  }
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
