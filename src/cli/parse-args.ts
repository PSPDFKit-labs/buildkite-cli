import type {
  AnnotationsListArgs,
  ArtifactsDownloadArgs,
  ArtifactsListArgs,
  AuthSetupArgs,
  AuthStatusArgs,
  BuildsGetArgs,
  BuildsListArgs,
  JobsLogGetArgs,
  JobsRetryArgs,
  ParsedCommand,
  ParsedGlobalOptions,
} from "./types.js";

function parseIntegerOption(label: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  return parsed;
}

function parsePositiveIntegerOption(label: string, value: string): number {
  const parsed = parseIntegerOption(label, value);
  if (parsed < 1) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  return parsed;
}

function normalizeValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readOptionValue(tokens: Array<string>, index: number, option: string): { readonly value: string; readonly nextIndex: number } {
  const value = tokens[index + 1] ?? null;
  if (value === null || value.startsWith("--")) {
    throw new Error(`missing value for ${option}`);
  }
  return { value, nextIndex: index + 2 };
}

function parseGlobalOptions(tokens: Array<string>): { readonly global: ParsedGlobalOptions; readonly remaining: Array<string> } {
  const remaining: Array<string> = [];
  let raw = false;

  for (const token of tokens) {
    if (token === "--raw") {
      raw = true;
      continue;
    }
    remaining.push(token);
  }

  return {
    global: { raw },
    remaining,
  };
}

function parseAuthSetup(tokens: Array<string>): AuthSetupArgs {
  let token: string | null = null;
  let index = 0;

  while (index < tokens.length) {
    const current = tokens[index] ?? "";
    if (current === "--token") {
      const next = readOptionValue(tokens, index, current);
      token = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }

    throw new Error(`unknown argument for auth setup: ${current}`);
  }

  return { token };
}

function parseAuthStatus(tokens: Array<string>): AuthStatusArgs {
  if (tokens.length > 0) {
    throw new Error(`unknown argument for auth status: ${tokens[0] ?? ""}`);
  }
  return {};
}

function parseBuildsList(tokens: Array<string>): BuildsListArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let branch: string | null = null;
  let state: string | null = null;
  let page: number | null = null;
  let perPage: number | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--branch") {
      const next = readOptionValue(tokens, index, token);
      branch = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--state") {
      const next = readOptionValue(tokens, index, token);
      state = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--page") {
      const next = readOptionValue(tokens, index, token);
      page = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--per-page") {
      const next = readOptionValue(tokens, index, token);
      perPage = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for builds list: ${token}`);
  }

  if (org === null) {
    throw new Error("missing required option: --org");
  }

  return {
    org,
    pipeline,
    branch,
    state,
    page,
    perPage,
  };
}

function parseBuildsGet(tokens: Array<string>): BuildsGetArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for builds get: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null) {
    throw new Error("missing required options: --org --pipeline --build");
  }

  return { org, pipeline, buildNumber };
}

function parseJobsLogGet(tokens: Array<string>): JobsLogGetArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;
  let jobId: string | null = null;
  let maxBytes: number | null = null;
  let tailLines: number | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--job") {
      const next = readOptionValue(tokens, index, token);
      jobId = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--max-bytes") {
      const next = readOptionValue(tokens, index, token);
      maxBytes = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--tail-lines") {
      const next = readOptionValue(tokens, index, token);
      tailLines = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for jobs log get: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null || jobId === null) {
    throw new Error("missing required options: --org --pipeline --build --job");
  }

  return {
    org,
    pipeline,
    buildNumber,
    jobId,
    maxBytes,
    tailLines,
  };
}

function parseJobsRetry(tokens: Array<string>): JobsRetryArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;
  let jobId: string | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--job") {
      const next = readOptionValue(tokens, index, token);
      jobId = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for jobs retry: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null || jobId === null) {
    throw new Error("missing required options: --org --pipeline --build --job");
  }

  return {
    org,
    pipeline,
    buildNumber,
    jobId,
  };
}

function parseArtifactsList(tokens: Array<string>): ArtifactsListArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;
  let jobId: string | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--job") {
      const next = readOptionValue(tokens, index, token);
      jobId = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for artifacts list: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null) {
    throw new Error("missing required options: --org --pipeline --build");
  }

  return { org, pipeline, buildNumber, jobId };
}

function parseArtifactsDownload(tokens: Array<string>): ArtifactsDownloadArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;
  let jobId: string | null = null;
  let glob: string | null = null;
  let outputDir = "./.bk-artifacts";
  const artifactIds: Array<string> = [];

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--job") {
      const next = readOptionValue(tokens, index, token);
      jobId = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--artifact-id") {
      const next = readOptionValue(tokens, index, token);
      const normalized = normalizeValue(next.value);
      if (normalized !== null) {
        artifactIds.push(normalized);
      }
      index = next.nextIndex;
      continue;
    }
    if (token === "--artifact-ids") {
      const next = readOptionValue(tokens, index, token);
      const values = next.value
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      artifactIds.push(...values);
      index = next.nextIndex;
      continue;
    }
    if (token === "--glob") {
      const next = readOptionValue(tokens, index, token);
      glob = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--out") {
      const next = readOptionValue(tokens, index, token);
      const normalized = normalizeValue(next.value);
      if (normalized === null) {
        throw new Error("missing value for --out");
      }
      outputDir = normalized;
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for artifacts download: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null) {
    throw new Error("missing required options: --org --pipeline --build");
  }

  if (artifactIds.length === 0 && glob === null) {
    throw new Error("specify --artifact-id/--artifact-ids or --glob for artifacts download");
  }

  return {
    org,
    pipeline,
    buildNumber,
    jobId,
    artifactIds,
    glob,
    outputDir,
  };
}

function parseAnnotationsList(tokens: Array<string>): AnnotationsListArgs {
  let org: string | null = null;
  let pipeline: string | null = null;
  let buildNumber: number | null = null;

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--org") {
      const next = readOptionValue(tokens, index, token);
      org = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--pipeline") {
      const next = readOptionValue(tokens, index, token);
      pipeline = normalizeValue(next.value);
      index = next.nextIndex;
      continue;
    }
    if (token === "--build") {
      const next = readOptionValue(tokens, index, token);
      buildNumber = parsePositiveIntegerOption(token, next.value);
      index = next.nextIndex;
      continue;
    }
    throw new Error(`unknown argument for annotations list: ${token}`);
  }

  if (org === null || pipeline === null || buildNumber === null) {
    throw new Error("missing required options: --org --pipeline --build");
  }

  return { org, pipeline, buildNumber };
}

export function parseCliArgs(argv: Array<string>): ParsedCommand {
  const globalParsed = parseGlobalOptions(argv);
  const tokens = globalParsed.remaining;

  if (tokens.length < 2) {
    throw new Error("missing command");
  }

  const [group, action, ...rest] = tokens;

  if (group === "auth" && action === "setup") {
    return {
      name: "auth.setup",
      global: globalParsed.global,
      args: parseAuthSetup(rest),
    };
  }

  if (group === "auth" && action === "status") {
    return {
      name: "auth.status",
      global: globalParsed.global,
      args: parseAuthStatus(rest),
    };
  }

  if (group === "builds" && action === "list") {
    return {
      name: "builds.list",
      global: globalParsed.global,
      args: parseBuildsList(rest),
    };
  }

  if (group === "builds" && action === "get") {
    return {
      name: "builds.get",
      global: globalParsed.global,
      args: parseBuildsGet(rest),
    };
  }

  if (group === "jobs" && action === "log") {
    if ((rest[0] ?? "") !== "get") {
      throw new Error("unknown command: expected 'jobs log get'");
    }
    return {
      name: "jobs.log.get",
      global: globalParsed.global,
      args: parseJobsLogGet(rest.slice(1)),
    };
  }

  if (group === "jobs" && action === "retry") {
    return {
      name: "jobs.retry",
      global: globalParsed.global,
      args: parseJobsRetry(rest),
    };
  }

  if (group === "artifacts" && action === "list") {
    return {
      name: "artifacts.list",
      global: globalParsed.global,
      args: parseArtifactsList(rest),
    };
  }

  if (group === "artifacts" && action === "download") {
    return {
      name: "artifacts.download",
      global: globalParsed.global,
      args: parseArtifactsDownload(rest),
    };
  }

  if (group === "annotations" && action === "list") {
    return {
      name: "annotations.list",
      global: globalParsed.global,
      args: parseAnnotationsList(rest),
    };
  }

  throw new Error(`unknown command: ${tokens.join(" ")}`);
}

export const USAGE_TEXT = `Usage:
  bkci auth setup [--token TOKEN]
  bkci auth status [--raw]
  bkci builds list --org ORG [--pipeline PIPELINE] [--branch BRANCH] [--state STATE] [--page N] [--per-page N] [--raw]
  bkci builds get --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--raw]
  bkci jobs log get --org ORG --pipeline PIPELINE --build BUILD_NUMBER --job JOB_ID [--max-bytes N] [--tail-lines N] [--raw]
  bkci jobs retry --org ORG --pipeline PIPELINE --build BUILD_NUMBER --job JOB_ID [--raw]
  bkci artifacts list --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--job JOB_ID] [--raw]
  bkci artifacts download --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--job JOB_ID] (--artifact-id ID... | --artifact-ids A,B | --glob GLOB) [--out DIR] [--raw]
  bkci annotations list --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--raw]

Auth env vars:
  BUILDKITE_TOKEN, BUILDKITE_API_TOKEN, BK_TOKEN`;
