import type { NextConfig } from "next";
import {
  createSecurityHeaders,
  parseAllowedHttpsOrigins,
} from "./lib/security-headers.ts";

const isProduction =
  process.env.APP_ENV?.trim().toLowerCase() === "production" ||
  process.env.VERCEL_ENV === "production";
const isCloudflareBuild = process.env.APP_BUILD_TARGET === "cloudflare";
const securityHeaders = createSecurityHeaders({
  production: isProduction,
  https: process.env.VERCEL === "1",
  audioHosts: [
    ...new Set([
      ...parseAllowedHttpsOrigins(process.env.AUDIO_ALLOWED_HOSTS),
      ...parseAllowedHttpsOrigins(
        process.env.SECURITY_ALLOWED_AUDIO_ORIGINS,
      ),
    ]),
  ],
  imageHosts: parseAllowedHttpsOrigins(
    process.env.SECURITY_ALLOWED_IMAGE_ORIGINS,
  ),
  frameOrigins: parseAllowedHttpsOrigins(
    process.env.SECURITY_ALLOWED_FRAME_ORIGINS,
  ),
});

const nextConfig: NextConfig = {
  ...(isCloudflareBuild
    ? {}
    : {
        output: "standalone" as const,
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: Object.entries(securityHeaders).map(([key, value]) => ({
                key,
                value,
              })),
            },
          ];
        },
        turbopack: {
          root: process.cwd(),
          resolveAlias: {
            "cloudflare:workers":
              "./lib/runtime/cloudflare-workers-node.ts",
          },
        },
      }),
};

export default nextConfig;
