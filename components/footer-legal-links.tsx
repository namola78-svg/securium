"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { legalPrivacyHref, legalTermsHref, safeAuthReturnPath } from "@/lib/auth-routing";

export function FooterLegalLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preferredReturnTo = searchParams?.get("return_to") ?? pathname ?? "/";
  const returnTo = safeAuthReturnPath(preferredReturnTo, "/");
  return (
    <nav className="footer-legal-links" aria-label="법적 안내 링크">
      <Link href={legalTermsHref(returnTo)}>이용약관</Link>
      <span aria-hidden="true">/</span>
      <Link href={legalPrivacyHref(returnTo)}>개인정보 처리방침</Link>
      <span aria-hidden="true">/</span>
      <Link href="/about">서비스 소개</Link>
    </nav>
  );
}
