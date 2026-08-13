import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { CommandPalette } from "@/components/command-palette";
import { LearnerAppShell } from "@/components/learner-app-shell";
import { SiteHeader } from "@/components/site-header";
import { FooterLegalLinks } from "@/components/footer-legal-links";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import "./globals.css";

function normalizeSiteUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  const candidate = value.startsWith("http") ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizeRequestHost(host: string | null): string | null {
  const value = host?.trim();
  if (!value || !/^[a-z0-9.-]+(?::\d+)?$/i.test(value)) return null;
  return value;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const configuredSiteUrl =
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeSiteUrl(process.env.VERCEL_URL);
  const requestHost =
    normalizeRequestHost(requestHeaders.get("x-forwarded-host")) ??
    normalizeRequestHost(requestHeaders.get("host"));
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const localRequest = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    requestHost ?? "",
  );
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : localRequest
        ? "http"
        : "https";
  const metadataBase =
    configuredSiteUrl ??
    new URL(`${protocol}://${requestHost ?? "securium.vercel.app"}`);
  const description = BRAND.shortDescription;

  return {
    metadataBase,
    title: {
      default: BRAND.officialName,
      template: `%s | ${BRAND.englishName}`,
    },
    description,
    applicationName: BRAND.englishName,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: BRAND.officialName,
      description,
      images: [new URL("/og.png", metadataBase).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: BRAND.officialName,
      description,
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalCurrentAppUser();
  const shellUser = user
    ? { displayName: user.displayName, roles: user.roles }
    : null;

  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <SiteHeader />
        <CommandPalette />
        <LearnerAppShell user={shellUser}>{children}</LearnerAppShell>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <strong>{BRAND.officialName}</strong>
            <span>{BRAND.shortDescription}</span>
            <Suspense fallback={null}>
              <FooterLegalLinks />
            </Suspense>
          </div>
        </footer>
      </body>
    </html>
  );
}
