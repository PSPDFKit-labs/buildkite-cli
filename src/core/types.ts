export type CommandName =
  | "auth.setup"
  | "auth.status"
  | "builds.list"
  | "builds.get"
  | "jobs.log.get"
  | "artifacts.list"
  | "artifacts.download"
  | "annotations.list";

export type Pagination = {
  readonly page: number | null;
  readonly perPage: number | null;
  readonly nextPage: number | null;
  readonly prevPage: number | null;
  readonly hasMore: boolean;
};

export type ApiErrorType =
  | "auth_error"
  | "permission_error"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "network_error"
  | "server_error"
  | "internal_error";

export type ApiError = {
  readonly type: ApiErrorType;
  readonly message: string;
  readonly httpStatus: number | null;
  readonly code: string | null;
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly details: Record<string, unknown>;
};

export type EnvelopeSuccess<TData> = {
  readonly ok: true;
  readonly apiVersion: "v1";
  readonly command: CommandName;
  readonly request: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly pagination: Pagination | null;
  readonly data: TData;
  readonly error: null;
};

export type EnvelopeFailure = {
  readonly ok: false;
  readonly apiVersion: "v1";
  readonly command: CommandName;
  readonly request: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly pagination: null;
  readonly data: null;
  readonly error: ApiError;
};

export type Envelope<TData> = EnvelopeSuccess<TData> | EnvelopeFailure;

export type BuildkiteRequestOptions = {
  readonly path: string;
  readonly query?: Record<string, string | number | null>;
};

export type BuildkiteJsonResponse = {
  readonly status: number;
  readonly headers: Headers;
  readonly requestId: string | null;
  readonly data: unknown;
};

export type BuildkiteBinaryResponse = {
  readonly status: number;
  readonly headers: Headers;
  readonly requestId: string | null;
  readonly bytes: Uint8Array;
};
