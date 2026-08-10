import type { MetadataRoute } from "next";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercelHost = process.env.VERCEL_URL?.trim();
  return `https://${vercelHost || "securium.vercel.app"}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const staticRoutes = [
    "/",
    "/courses",
    "/guide",
    "/about",
    "/practical",
    "/legal",
    "/legal/terms",
    "/legal/privacy",
  ];
  let courseRoutes: MetadataRoute.Sitemap = [];

  try {
    const courses = await listPublishedCoursesCached();
    courseRoutes = courses.map((course) => ({
      url: `${origin}/courses/${course.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    courseRoutes = [];
  }

  return [
    ...staticRoutes.map((route) => ({
      url: `${origin}${route}`,
      changeFrequency: route === "/" ? ("daily" as const) : ("weekly" as const),
      priority: route === "/" ? 1 : 0.6,
    })),
    ...courseRoutes,
  ];
}
