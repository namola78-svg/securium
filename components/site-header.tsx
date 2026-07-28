import Link from "next/link";
import { Suspense } from "react";
import { HeaderControls } from "@/components/header-controls";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export async function SiteHeader() {
  const user = await getOptionalCurrentAppUser();

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label={`${BRAND.koreanName} 홈으로 이동`}>
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>{BRAND.englishName}</strong>
            <small>{BRAND.systemLabel}</small>
          </span>
        </Link>
        <Suspense fallback={<div className="header-controls-placeholder" />}>
          <HeaderControls
            user={
              user
                ? {
                    displayName: user.displayName,
                    roles: user.roles,
                  }
                : null
            }
          />
        </Suspense>
      </div>
    </header>
  );
}
