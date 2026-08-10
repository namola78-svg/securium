import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildSafeRedirectQuery } from "@/lib/auth-routing";

export const metadata: Metadata = {
  title: "이용약관 | SECURIUM",
  description: "SECURIUM 이용약관(레거시 라우팅 별칭).",
};

export default async function TermsAliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = buildSafeRedirectQuery(params);
  redirect(query.toString() ? `/legal/terms?${query}` : "/legal/terms");
}
