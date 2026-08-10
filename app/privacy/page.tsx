import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildSafeRedirectQuery } from "@/lib/auth-routing";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | SECURIUM",
  description: "SECURIUM 개인정보 처리방침(레거시 라우팅 별칭).",
};

export default async function PrivacyAliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = buildSafeRedirectQuery(params);
  redirect(query.toString() ? `/legal/privacy?${query}` : "/legal/privacy");
}
