"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { safeAuthReturnPath } from "@/lib/auth-routing";
import { learnerPrimaryNavItems, learnerUtilityNavItems, publicNavItems } from "@/lib/ui-nav";

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePath = resolveActivePath(pathname, searchParams);
  const authReturnPath = resolveAuthReturnPath(pathname, searchParams);
  const navItems = signedIn ? [...publicNavItems, ...learnerPrimaryNavItems] : publicNavItems;
  const utilityNavItems = signedIn ? learnerUtilityNavItems : [];

  useEffect(() => {
    if (!signedIn || !authReturnPath) return;
    router.replace(authReturnPath);
  }, [authReturnPath, router, signedIn]);

  return (
    <nav className="main-nav" aria-label="주요 내비게이션">
      {navItems.map((item) => <NavLink key={item.href} href={item.href} label={item.label} active={isActivePath(activePath, item.href)} />)}
      {utilityNavItems.length ? (
        <div className="header-utility-nav" aria-label="보조 기능 메뉴">
          {utilityNavItems.map((item) => <NavLink key={item.href} href={item.href} label={item.label} active={isActivePath(activePath, item.href)} utility />)}
        </div>
      ) : null}
    </nav>
  );
}

function NavLink({ href, label, active, utility = false }: { href: string; label: string; active: boolean; utility?: boolean }) {
  return <Link aria-current={active ? "page" : undefined} className={utility ? `header-utility-link${active ? " active" : ""}` : active ? "active" : undefined} href={href} title={active ? `현재 위치: ${label}` : label}>{label}</Link>;
}

function resolveAuthReturnPath(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  if (pathname !== "/login" && pathname !== "/signup") return null;
  const returnTo = searchParams.get("return_to");
  if (!returnTo) return null;
  const safePath = safeAuthReturnPath(returnTo, "__invalid__");
  return safePath.startsWith("/") ? safePath : null;
}

function resolveActivePath(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  if (pathname !== "/login" && pathname !== "/signup") return pathname;
  const returnTo = searchParams.get("return_to");
  return returnTo ? safeAuthReturnPath(returnTo, pathname) : pathname;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
