/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  createSecurityHeaders,
  parseAllowedHttpsOrigins,
} from "../lib/security-headers";
import {
  isProductionEnvironment,
  validateRuntimeEnvironment,
} from "../lib/environment";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ENV?: string;
  DB_PROVIDER?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_IDLE_TIMEOUT_SECONDS?: string;
  POSTGRES_CONNECT_TIMEOUT_SECONDS?: string;
  POSTGRES_QUERY_TIMEOUT_MS?: string;
  POSTGRES_SSL_MODE?: string;
  DEV_AUTH_EMAIL?: string;
  AUDIT_IP_HASH_SALT?: string;
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  AUDIO_ALLOWED_HOSTS?: string;
  SECURITY_ALLOWED_AUDIO_ORIGINS?: string;
  SECURITY_ALLOWED_IMAGE_ORIGINS?: string;
  SECURITY_ALLOWED_FRAME_ORIGINS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const production = isProductionEnvironment(env);
    validateRuntimeEnvironment(env, production);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(imageResponse, request, env, production);
    }

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response, request, env, production);
  },
};

function withSecurityHeaders(
  response: Response,
  request: Request,
  env: Env,
  production: boolean,
) {
  const secured = new Response(response.body, response);
  const headers = createSecurityHeaders({
    production,
    https: new URL(request.url).protocol === "https:",
    audioHosts: [
      ...new Set([
        ...parseAllowedHttpsOrigins(env.AUDIO_ALLOWED_HOSTS),
        ...parseAllowedHttpsOrigins(env.SECURITY_ALLOWED_AUDIO_ORIGINS),
      ]),
    ],
    imageHosts: parseAllowedHttpsOrigins(
      env.SECURITY_ALLOWED_IMAGE_ORIGINS,
    ),
    frameOrigins: parseAllowedHttpsOrigins(
      env.SECURITY_ALLOWED_FRAME_ORIGINS,
    ),
  });
  for (const [name, value] of Object.entries(headers)) {
    secured.headers.set(name, value);
  }
  if (!secured.headers.has("x-request-id")) {
    secured.headers.set("x-request-id", crypto.randomUUID());
  }
  return secured;
}

export default worker;
