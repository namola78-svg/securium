export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function publicError(error: unknown, requestId?: string) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code, requestId },
    };
  }

  return {
    status: 500,
    body: {
      error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      code: "INTERNAL_ERROR",
      requestId,
    },
  };
}
