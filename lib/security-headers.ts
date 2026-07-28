import { getAllowedVideoEmbedOrigins } from "./services/video-provider-service.ts";

export type SecurityHeaderOptions = {
  production: boolean;
  https: boolean;
  audioHosts?: readonly string[];
  imageHosts?: readonly string[];
  frameOrigins?: readonly string[];
  nonce?: string;
};

export function createSecurityHeaders(options: SecurityHeaderOptions) {
  const scriptSources = ["'self'"];
  if (options.nonce) {
    scriptSources.push(`'nonce-${options.nonce}'`);
  } else {
    // Vinext currently emits inline RSC bootstrap scripts. Keep this isolated
    // here so it can be replaced with a nonce when the runtime exposes one.
    scriptSources.push("'unsafe-inline'");
  }
  if (!options.production) scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob:${toSources(options.imageHosts)}`,
    `media-src 'self' blob:${toSources(options.audioHosts)}`,
    options.production
      ? "connect-src 'self'"
      : "connect-src 'self' http: https: ws: wss:",
    `frame-src 'self' ${[
      ...new Set([
        ...getAllowedVideoEmbedOrigins(),
        ...(options.frameOrigins ?? []),
      ]),
    ].join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(options.production ? ["upgrade-insecure-requests"] : []),
  ];

  const headers: Record<string, string> = {
    "Content-Security-Policy": directives.join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (options.production && options.https) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
  return headers;
}

export function parseAllowedHttpsOrigins(value: string | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .flatMap((item) => {
          try {
            const url = new URL(
              item.includes("://") ? item : `https://${item}`,
            );
            return url.protocol === "https:" &&
              !url.username &&
              !url.password &&
              url.pathname === "/" &&
              !url.search &&
              !url.hash
              ? [url.origin]
              : [];
          } catch {
            return [];
          }
        }),
    ),
  ];
}

function toSources(origins: readonly string[] | undefined) {
  return origins?.length ? ` ${origins.join(" ")}` : "";
}
