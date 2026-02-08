import { CliHttpError } from "../core/errors.js";
import type {
  BuildkiteBinaryResponse,
  BuildkiteJsonResponse,
  BuildkiteRequestOptions,
} from "../core/types.js";

function buildUrl(baseUrl: string, options: BuildkiteRequestOptions): string {
  const url = new URL(options.path, baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function getRequestId(headers: Headers): string | null {
  return headers.get("x-request-id") ?? headers.get("request-id") ?? null;
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { raw: text };
  }
}

function extractErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = (body as Record<string, unknown>).code;
  return typeof candidate === "string" ? candidate : null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") {
    return fallback;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message;
  }
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error;
  }

  return fallback;
}

export function createBuildkiteClient(token: string): {
  readonly requestJson: (options: BuildkiteRequestOptions) => Promise<BuildkiteJsonResponse>;
  readonly requestBinary: (options: BuildkiteRequestOptions) => Promise<BuildkiteBinaryResponse>;
} {
  const baseUrl = "https://api.buildkite.com";

  async function requestJson(options: BuildkiteRequestOptions): Promise<BuildkiteJsonResponse> {
    const response = await fetch(buildUrl(baseUrl, options), {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });

    const requestId = getRequestId(response.headers);
    const bodyText = await response.text();
    const body = tryParseJson(bodyText);

    if (!response.ok) {
      throw new CliHttpError({
        message: extractErrorMessage(body, "buildkite api request failed"),
        status: response.status,
        code: extractErrorCode(body),
        requestId,
        details: {
          path: options.path,
          response: body,
        },
      });
    }

    return {
      status: response.status,
      headers: response.headers,
      requestId,
      data: body,
    };
  }

  async function requestBinary(options: BuildkiteRequestOptions): Promise<BuildkiteBinaryResponse> {
    const response = await fetch(buildUrl(baseUrl, options), {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      redirect: "follow",
    });

    const requestId = getRequestId(response.headers);
    if (!response.ok) {
      const text = await response.text();
      const body = tryParseJson(text);
      throw new CliHttpError({
        message: extractErrorMessage(body, "buildkite api request failed"),
        status: response.status,
        code: extractErrorCode(body),
        requestId,
        details: {
          path: options.path,
          response: body,
        },
      });
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      headers: response.headers,
      requestId,
      bytes,
    };
  }

  return {
    requestJson,
    requestBinary,
  };
}
