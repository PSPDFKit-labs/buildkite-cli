import { globToRegex } from "../core/glob.js";
import { transformLogContent } from "../core/logs.js";
import { parsePagination } from "../core/pagination.js";
import type { Pagination } from "../core/types.js";
import type { ParsedCommand } from "./types.js";
import type { BuildkiteJsonResponse } from "../core/types.js";
import { writeArtifactToDisk } from "../shell/files.js";

type BuildkiteClient = {
  readonly requestJson: (options: {
    readonly path: string;
    readonly query?: Record<string, string | number | null>;
  }) => Promise<BuildkiteJsonResponse>;
  readonly requestBinary: (options: {
    readonly path: string;
    readonly query?: Record<string, string | number | null>;
  }) => Promise<{ readonly bytes: Uint8Array }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function mapBuild(build: unknown): Record<string, unknown> {
  if (!isObject(build)) {
    return {};
  }

  const pipeline = isObject(build.pipeline)
    ? {
        slug: asString(build.pipeline.slug),
      }
    : null;

  return {
    number: asNumber(build.number),
    state: asString(build.state),
    branch: asString(build.branch),
    message: asString(build.message),
    commit: asString(build.commit),
    pipeline,
    createdAt: asString(build.created_at),
    startedAt: asString(build.started_at),
    finishedAt: asString(build.finished_at),
    webUrl: asString(build.web_url),
  };
}

function getSummaryStates(builds: Array<Record<string, unknown>>): Record<string, number> {
  const states: Record<string, number> = {};
  for (const build of builds) {
    const state = typeof build.state === "string" ? build.state : "unknown";
    states[state] = (states[state] ?? 0) + 1;
  }
  return states;
}

function mapBuildJob(job: unknown): Record<string, unknown> {
  if (!isObject(job)) {
    return {};
  }

  return {
    id: asString(job.id),
    type: asString(job.type),
    name: asString(job.name),
    stepKey: asString(job.step_key),
    state: asString(job.state),
    exitStatus: asString(job.exit_status),
    webUrl: asString(job.web_url),
  };
}

function getJobCounts(jobs: Array<Record<string, unknown>>): Record<string, number> {
  const states: Record<string, number> = {
    passed: 0,
    failed: 0,
    running: 0,
    blocked: 0,
  };

  for (const job of jobs) {
    const state = typeof job.state === "string" ? job.state : "unknown";
    states[state] = (states[state] ?? 0) + 1;
  }

  return states;
}

function mapArtifact(artifact: unknown): Record<string, unknown> {
  if (!isObject(artifact)) {
    return {};
  }

  return {
    id: asString(artifact.id),
    jobId: asString(artifact.job_id),
    path: asString(artifact.path),
    downloadUrl: asString(artifact.download_url),
    fileSize: asNumber(artifact.file_size),
    sha1sum: asString(artifact.sha1sum),
  };
}

function mapAnnotation(annotation: unknown): Record<string, unknown> {
  if (!isObject(annotation)) {
    return {};
  }

  const body = asString(annotation.body_html) ?? asString(annotation.body_text) ?? asString(annotation.body);
  return {
    id: asString(annotation.id),
    context: asString(annotation.context),
    style: asString(annotation.style),
    body,
    createdAt: asString(annotation.created_at),
    updatedAt: asString(annotation.updated_at),
  };
}

function asStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) {
    return [];
  }

  const strings: Array<string> = [];
  for (const item of value) {
    if (typeof item === "string") {
      strings.push(item);
    }
  }

  return strings;
}

const REQUIRED_SCOPES: ReadonlyArray<string> = [
  "read_builds",
  "read_build_logs",
  "read_artifacts",
];

function mapAuthStatus(data: unknown): {
  readonly token: Record<string, unknown>;
  readonly user: Record<string, unknown> | null;
  readonly scopes: Array<string>;
} {
  const record = isObject(data) ? data : {};
  const scopes = asStringArray(record.scopes);
  const token = {
    uuid: asString(record.uuid),
    description: asString(record.description),
    createdAt: asString(record.created_at),
    scopes,
  };

  const user = isObject(record.user)
    ? {
        name: asString(record.user.name),
        email: asString(record.user.email),
      }
    : null;

  return {
    token,
    user,
    scopes,
  };
}

function getMissingRequiredScopes(scopes: ReadonlyArray<string>): Array<string> {
  return REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
}

function getPaginationOrNull(options: {
  readonly command: ParsedCommand;
  readonly headers: Headers;
}): Pagination | null {
  if (options.command.name === "builds.list") {
    return parsePagination({
      headers: options.headers,
      requestedPage: options.command.args.page,
      requestedPerPage: options.command.args.perPage,
    });
  }
  return null;
}

function getRequestForCommand(command: ParsedCommand): Record<string, unknown> {
  return { ...command.args };
}

function extractLogContent(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (isObject(data) && typeof data.content === "string") {
    return data.content;
  }
  return JSON.stringify(data, null, 2);
}

function getBuildsListPath(args: ParsedCommand["args"] & { readonly org: string; readonly pipeline: string | null }): string {
  if (args.pipeline !== null) {
    return `/v2/organizations/${args.org}/pipelines/${args.pipeline}/builds`;
  }
  return `/v2/organizations/${args.org}/builds`;
}

function getArtifactsListPath(args: {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly jobId: string | null;
}): string {
  if (args.jobId !== null) {
    return `/v2/organizations/${args.org}/pipelines/${args.pipeline}/builds/${args.buildNumber}/jobs/${args.jobId}/artifacts`;
  }
  return `/v2/organizations/${args.org}/pipelines/${args.pipeline}/builds/${args.buildNumber}/artifacts`;
}

function getDownloadCandidates(options: {
  readonly artifacts: Array<Record<string, unknown>>;
  readonly artifactIds: Array<string>;
  readonly glob: string | null;
}): {
  readonly selected: Array<Record<string, unknown>>;
  readonly failures: Array<Record<string, string>>;
} {
  const failures: Array<Record<string, string>> = [];

  const byId = new Map<string, Record<string, unknown>>();
  for (const artifact of options.artifacts) {
    const id = typeof artifact.id === "string" ? artifact.id : null;
    if (id !== null) {
      byId.set(id, artifact);
    }
  }

  const selectedById = new Map<string, Record<string, unknown>>();
  for (const artifactId of options.artifactIds) {
    const candidate = byId.get(artifactId) ?? null;
    if (candidate === null) {
      failures.push({ artifactId, reason: "artifact not found" });
      continue;
    }
    selectedById.set(artifactId, candidate);
  }

  if (options.glob !== null) {
    const matcher = globToRegex(options.glob);
    for (const artifact of options.artifacts) {
      const artifactPath = typeof artifact.path === "string" ? artifact.path : "";
      const artifactId = typeof artifact.id === "string" ? artifact.id : null;
      if (artifactId === null) {
        continue;
      }
      if (matcher.test(artifactPath)) {
        selectedById.set(artifactId, artifact);
      }
    }

    if (options.artifactIds.length === 0 && selectedById.size === 0) {
      failures.push({ artifactId: "glob", reason: "no artifacts matched glob" });
    }
  }

  return {
    selected: Array.from(selectedById.values()),
    failures,
  };
}

export async function executeCommand(options: {
  readonly command: ParsedCommand;
  readonly client: BuildkiteClient;
}): Promise<{
  readonly request: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly pagination: Pagination | null;
  readonly data: unknown;
}> {
  const request = getRequestForCommand(options.command);

  if (options.command.name === "auth.status") {
    const response = await options.client.requestJson({
      path: "/v2/access-token",
    });

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: response.data,
      };
    }

    const status = mapAuthStatus(response.data);
    const missingScopes = getMissingRequiredScopes(status.scopes);

    return {
      request,
      summary: {
        requiredScopes: [...REQUIRED_SCOPES],
        grantedScopes: status.scopes.length,
        missingScopes,
        ready: missingScopes.length === 0,
      },
      pagination: null,
      data: {
        token: status.token,
        user: status.user,
        requiredScopes: [...REQUIRED_SCOPES],
        missingScopes,
      },
    };
  }

  if (options.command.name === "builds.list") {
    const response = await options.client.requestJson({
      path: getBuildsListPath(options.command.args),
      query: {
        branch: options.command.args.branch,
        state: options.command.args.state,
        page: options.command.args.page,
        per_page: options.command.args.perPage,
      },
    });

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: getPaginationOrNull({ command: options.command, headers: response.headers }),
        data: response.data,
      };
    }

    const builds = asArray(response.data).map((item) => mapBuild(item));
    return {
      request,
      summary: {
        count: builds.length,
        states: getSummaryStates(builds),
      },
      pagination: getPaginationOrNull({ command: options.command, headers: response.headers }),
      data: builds,
    };
  }

  if (options.command.name === "builds.get") {
    const response = await options.client.requestJson({
      path: `/v2/organizations/${options.command.args.org}/pipelines/${options.command.args.pipeline}/builds/${options.command.args.buildNumber}`,
    });

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: response.data,
      };
    }

    const build = isObject(response.data) ? response.data : {};
    const jobsRaw = asArray(build.jobs);
    const jobs = jobsRaw.map((job) => mapBuildJob(job));

    return {
      request,
      summary: {
        jobCounts: getJobCounts(jobs),
        failedJobIds: jobs
          .filter((job) => job.state === "failed")
          .map((job) => (typeof job.id === "string" ? job.id : null))
          .filter((value) => value !== null),
      },
      pagination: null,
      data: {
        build: mapBuild(build),
        jobs,
      },
    };
  }

  if (options.command.name === "jobs.log.get") {
    const response = await options.client.requestJson({
      path: `/v2/organizations/${options.command.args.org}/pipelines/${options.command.args.pipeline}/builds/${options.command.args.buildNumber}/jobs/${options.command.args.jobId}/log`,
    });

    const rawContent = extractLogContent(response.data);

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: response.data,
      };
    }

    const log = transformLogContent({
      rawContent,
      maxBytes: options.command.args.maxBytes,
      tailLineCount: options.command.args.tailLines,
      stripAnsi: true,
    });

    return {
      request,
      summary: {
        lineCount: log.lineCount,
        truncated: log.truncated,
      },
      pagination: null,
      data: {
        jobId: options.command.args.jobId,
        encoding: "utf-8",
        lineCount: log.lineCount,
        truncated: log.truncated,
        content: log.content,
      },
    };
  }

  if (options.command.name === "artifacts.list") {
    const response = await options.client.requestJson({
      path: getArtifactsListPath(options.command.args),
    });

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: response.data,
      };
    }

    const artifacts = asArray(response.data).map((artifact) => mapArtifact(artifact));
    const totalBytes = artifacts.reduce((total, artifact) => {
      const fileSize = typeof artifact.fileSize === "number" ? artifact.fileSize : 0;
      return total + fileSize;
    }, 0);

    return {
      request,
      summary: {
        count: artifacts.length,
        totalBytes,
      },
      pagination: null,
      data: artifacts,
    };
  }

  if (options.command.name === "artifacts.download") {
    const listResponse = await options.client.requestJson({
      path: getArtifactsListPath(options.command.args),
    });

    const artifacts = asArray(listResponse.data).map((artifact) => mapArtifact(artifact));
    const selection = getDownloadCandidates({
      artifacts,
      artifactIds: options.command.args.artifactIds,
      glob: options.command.args.glob,
    });

    const downloadedFiles: Array<Record<string, unknown>> = [];
    const failures: Array<Record<string, string>> = [...selection.failures];

    for (const artifact of selection.selected) {
      const artifactId = typeof artifact.id === "string" ? artifact.id : null;
      const jobId = typeof artifact.jobId === "string" ? artifact.jobId : null;
      const artifactPath = typeof artifact.path === "string" ? artifact.path : null;

      if (artifactId === null || jobId === null) {
        failures.push({
          artifactId: artifactId ?? "unknown",
          reason: "artifact id or job id missing",
        });
        continue;
      }

      const downloadResponse = await options.client.requestBinary({
        path: `/v2/organizations/${options.command.args.org}/pipelines/${options.command.args.pipeline}/builds/${options.command.args.buildNumber}/jobs/${jobId}/artifacts/${artifactId}/download`,
      });

      const localPath = await writeArtifactToDisk({
        outputDir: options.command.args.outputDir,
        artifactPath: artifactPath ?? `${artifactId}.bin`,
        bytes: downloadResponse.bytes,
      });

      downloadedFiles.push({
        artifactId,
        path: localPath,
        bytes: downloadResponse.bytes.byteLength,
        sha1sum: typeof artifact.sha1sum === "string" ? artifact.sha1sum : null,
      });
    }

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: {
          artifacts: listResponse.data,
          files: downloadedFiles,
          failures,
        },
      };
    }

    const totalBytes = downloadedFiles.reduce((sum, file) => {
      const bytes = typeof file.bytes === "number" ? file.bytes : 0;
      return sum + bytes;
    }, 0);

    return {
      request,
      summary: {
        downloaded: downloadedFiles.length,
        failed: failures.length,
        totalBytes,
      },
      pagination: null,
      data: {
        files: downloadedFiles,
        failures,
      },
    };
  }

  if (options.command.name === "annotations.list") {
    const response = await options.client.requestJson({
      path: `/v2/organizations/${options.command.args.org}/pipelines/${options.command.args.pipeline}/builds/${options.command.args.buildNumber}/annotations`,
    });

    if (options.command.global.raw) {
      return {
        request,
        summary: {},
        pagination: null,
        data: response.data,
      };
    }

    const annotations = asArray(response.data).map((entry) => mapAnnotation(entry));
    return {
      request,
      summary: {
        count: annotations.length,
      },
      pagination: null,
      data: annotations,
    };
  }

  throw new Error(`unsupported command for executeCommand: ${options.command.name}`);
}
