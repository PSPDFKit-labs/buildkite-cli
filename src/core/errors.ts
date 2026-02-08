import type { ApiError, ApiErrorType } from "./types.js";

export class CliHttpError extends Error {
  public readonly status: number;
  public readonly code: string | null;
  public readonly requestId: string | null;
  public readonly details: Record<string, unknown>;

  constructor(options: {
    readonly message: string;
    readonly status: number;
    readonly code?: string | null;
    readonly requestId?: string | null;
    readonly details?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = "CliHttpError";
    this.status = options.status;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? {};
  }
}

function getErrorTypeFromStatus(status: number): ApiErrorType {
  if (status === 401) {
    return "auth_error";
  }
  if (status === 403) {
    return "permission_error";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 422 || status === 400) {
    return "validation_error";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status >= 500) {
    return "server_error";
  }
  return "internal_error";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unexpected error";
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof CliHttpError) {
    const type = getErrorTypeFromStatus(error.status);
    return {
      type,
      message: error.message,
      httpStatus: error.status,
      code: error.code,
      retryable: error.status === 429 || error.status >= 500,
      requestId: error.requestId,
      details: error.details,
    };
  }

  if (error instanceof TypeError) {
    return {
      type: "network_error",
      message: error.message,
      httpStatus: null,
      code: null,
      retryable: true,
      requestId: null,
      details: {},
    };
  }

  const message = getMessageFromUnknown(error);
  const details = isObject(error) ? error : {};
  return {
    type: "internal_error",
    message,
    httpStatus: null,
    code: null,
    retryable: false,
    requestId: null,
    details,
  };
}
