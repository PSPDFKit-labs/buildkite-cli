import type {
  ApiError,
  CommandName,
  EnvelopeFailure,
  EnvelopeSuccess,
  Pagination,
} from "./types.js";

export function successEnvelope<TData>(options: {
  readonly command: CommandName;
  readonly request: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly pagination: Pagination | null;
  readonly data: TData;
}): EnvelopeSuccess<TData> {
  return {
    ok: true,
    apiVersion: "v1",
    command: options.command,
    request: options.request,
    summary: options.summary,
    pagination: options.pagination,
    data: options.data,
    error: null,
  };
}

export function failureEnvelope(options: {
  readonly command: CommandName;
  readonly request: Record<string, unknown>;
  readonly error: ApiError;
}): EnvelopeFailure {
  return {
    ok: false,
    apiVersion: "v1",
    command: options.command,
    request: options.request,
    summary: {},
    pagination: null,
    data: null,
    error: options.error,
  };
}
