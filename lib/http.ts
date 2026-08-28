import { AppError, publicError } from "./errors";
import { emitRequestObservation } from "./observability/request-observability";

export function assertSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (matchesOrigin(origin, requestUrl.origin)) return;
  if (matchesOrigin(referer, requestUrl.origin)) return;

  throw new AppError("요청 출처를 확인할 수 없습니다.", 403, "CSRF_REJECTED");
}

function matchesOrigin(value: string | null, expectedOrigin: string) {
  if (!value) return false;
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function readRequestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export function safeReturnTo(value: string | undefined, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function successResponse(
  request: Request,
  data: unknown,
  returnTo?: string,
  status = 200,
) {
  emitRequestObservation(request, status);
  if (returnTo) {
    return Response.redirect(new URL(safeReturnTo(returnTo), request.url), 303);
  }
  return Response.json(data, { status });
}

export function errorResponse(error: unknown, request?: Request) {
  const supplied = request?.headers.get("x-request-id");
  const requestId =
    supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();
  const result = publicError(error, requestId);
  if (request) emitRequestObservation(request, result.status);
  return Response.json(result.body, {
    status: result.status,
    headers: {
      "x-request-id": requestId,
      "cache-control": "no-store",
    },
  });
}
