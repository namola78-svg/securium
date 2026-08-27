import Link from "next/link";
import { Suspense } from "react";
import { HeaderControls } from "@/components/header-controls";
import { BRAND } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="site-header v2-public-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label={`${BRAND.englishName} 홈으로 이동`}>
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>
            <strong>{BRAND.englishName}</strong>
            <small>{BRAND.systemLabel}</small>
          </span>
        </Link>
        <Suspense fallback={<div className="header-controls-placeholder" />}>
          <HeaderControls />
        </Suspense>
      </div>
    </header>
  );
}
