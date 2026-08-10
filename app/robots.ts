import type { MetadataRoute } from "next";

function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercelHost = process.env.VERCEL_URL?.trim();
  return `https://${vercelHost || "securium.vercel.app"}`;
}

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/ops/",
        "/dashboard",
        "/my-courses",
        "/my-learning",
        "/practice",
        "/questions",
        "/ai-tutor",
        "/bookmarks",
        "/wrong-notes",
        "/reviews",
        "/analytics",
        "/profile",
        "/settings",
        "/mock-exams",
        "/learn/",
        "/lectures/",
        "/terms",
        "/privacy",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
