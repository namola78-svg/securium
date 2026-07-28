import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const description =
    "정보보호와 개인정보보호 전문 과정을 한곳에서 수강하고 과정별 진도를 관리하세요.";

  return {
    metadataBase,
    title: {
      default: "Shield Academy | 정보보호 통합 학습",
      template: "%s | Shield Academy",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: "Shield Academy",
      description,
      images: [new URL("/og.png", metadataBase).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "Shield Academy",
      description,
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="shell footer-inner">
            <strong>Shield Academy</strong>
            <span>정보보호·개인정보보호 통합 학습 플랫폼</span>
              <span>Phase 2 MVP · 샘플 콘텐츠는 학습 자료가 아닙니다.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
