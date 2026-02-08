import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executeCommand } from "./execute-command.js";
import { parseCliArgs } from "./parse-args.js";
import type { BuildkiteJsonResponse } from "../core/types.js";

type MockClient = {
  readonly requestJson: (options: {
    readonly path: string;
    readonly query?: Record<string, string | number | null>;
  }) => Promise<BuildkiteJsonResponse>;
  readonly requestBinary: (options: {
    readonly path: string;
    readonly query?: Record<string, string | number | null>;
  }) => Promise<{ readonly bytes: Uint8Array }>;
};

function createMockClient(options: {
  readonly jsonResponses: Array<BuildkiteJsonResponse>;
  readonly binaryByPath?: Record<string, Uint8Array>;
  readonly seenPaths?: Array<string>;
}): MockClient {
  const jsonQueue = [...options.jsonResponses];
  const binaryByPath = options.binaryByPath ?? {};
  const seenPaths = options.seenPaths ?? [];

  return {
    requestJson: async (request) => {
      seenPaths.push(request.path);
      const next = jsonQueue.shift() ?? null;
      if (next === null) {
        throw new Error("unexpected json request");
      }
      return next;
    },
    requestBinary: async (request) => {
      seenPaths.push(request.path);
      const bytes = binaryByPath[request.path] ?? null;
      if (bytes === null) {
        throw new Error(`unexpected binary request: ${request.path}`);
      }
      return { bytes };
    },
  };
}

test("executeCommand auth.status returns required scope diagnostics", async () => {
  const command = parseCliArgs(["auth", "status"]);

  const client = createMockClient({
    jsonResponses: [
      {
        status: 200,
        headers: new Headers(),
        requestId: "req-auth",
        data: {
          uuid: "token-1",
          description: "Agent token",
          scopes: ["read_builds", "read_build_logs"],
          created_at: "2026-02-08T20:00:00Z",
          user: {
            name: "Pat",
            email: "pat@example.com",
          },
        },
      },
    ],
  });

  const result = await executeCommand({ command, client });

  assert.deepEqual(result.summary, {
    requiredScopes: ["read_builds", "read_build_logs", "read_artifacts"],
    grantedScopes: 2,
    missingScopes: ["read_artifacts"],
    ready: false,
  });

  const data = result.data as Record<string, unknown>;
  assert.deepEqual(data.missingScopes, ["read_artifacts"]);
});

test("executeCommand builds.list normalizes data and pagination", async () => {
  const command = parseCliArgs(["builds", "list", "--org", "acme", "--pipeline", "web"]);
  const headers = new Headers({
    "x-page": "1",
    "x-per-page": "30",
    "x-next-page": "2",
    "x-prev-page": "",
  });

  const client = createMockClient({
    jsonResponses: [
      {
        status: 200,
        headers,
        requestId: "req-1",
        data: [
          {
            number: 10,
            state: "failed",
            branch: "main",
            message: "test",
            commit: "abc",
            pipeline: { slug: "web" },
            created_at: "2026-01-01T00:00:00Z",
            started_at: "2026-01-01T00:01:00Z",
            finished_at: "2026-01-01T00:02:00Z",
            web_url: "https://buildkite.com/acme/web/builds/10",
          },
          {
            number: 11,
            state: "passed",
            branch: "main",
            message: "test2",
            commit: "def",
            pipeline: { slug: "web" },
            created_at: "2026-01-01T01:00:00Z",
            started_at: "2026-01-01T01:01:00Z",
            finished_at: "2026-01-01T01:02:00Z",
            web_url: "https://buildkite.com/acme/web/builds/11",
          },
        ],
      },
    ],
  });

  const result = await executeCommand({ command, client });

  assert.deepEqual(result.summary, {
    count: 2,
    states: {
      failed: 1,
      passed: 1,
    },
  });
  assert.deepEqual(result.pagination, {
    page: 1,
    perPage: 30,
    nextPage: 2,
    prevPage: null,
    hasMore: true,
  });

  const data = result.data as Array<Record<string, unknown>>;
  assert.equal(data.length, 2);
  assert.equal(data[0]?.state, "failed");
  assert.equal(data[1]?.state, "passed");
});

test("executeCommand builds.get computes failed job ids", async () => {
  const command = parseCliArgs([
    "builds",
    "get",
    "--org",
    "acme",
    "--pipeline",
    "web",
    "--build",
    "77",
  ]);

  const client = createMockClient({
    jsonResponses: [
      {
        status: 200,
        headers: new Headers(),
        requestId: "req-2",
        data: {
          number: 77,
          state: "failed",
          branch: "main",
          jobs: [
            { id: "job-1", state: "failed", name: "tests", type: "script" },
            { id: "job-2", state: "passed", name: "lint", type: "script" },
          ],
        },
      },
    ],
  });

  const result = await executeCommand({ command, client });
  const summary = result.summary as Record<string, unknown>;
  assert.deepEqual(summary.failedJobIds, ["job-1"]);
});

test("executeCommand artifacts.download fetches and writes files", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "bkci-test-"));

  try {
    const command = parseCliArgs([
      "artifacts",
      "download",
      "--org",
      "acme",
      "--pipeline",
      "web",
      "--build",
      "42",
      "--artifact-id",
      "a1",
      "--out",
      outputDir,
    ]);

    const downloadPath = "/v2/organizations/acme/pipelines/web/builds/42/jobs/job-1/artifacts/a1/download";
    const fileContent = "artifact-content";
    const client = createMockClient({
      jsonResponses: [
        {
          status: 200,
          headers: new Headers(),
          requestId: "req-3",
          data: [
            {
              id: "a1",
              job_id: "job-1",
              path: "reports/result.txt",
              sha1sum: "abc123",
              file_size: 16,
            },
          ],
        },
      ],
      binaryByPath: {
        [downloadPath]: new TextEncoder().encode(fileContent),
      },
    });

    const result = await executeCommand({ command, client });

    const summary = result.summary as Record<string, unknown>;
    assert.equal(summary.downloaded, 1);
    assert.equal(summary.failed, 0);

    const savedPath = path.join(outputDir, "reports", "result.txt");
    const saved = await readFile(savedPath, "utf8");
    assert.equal(saved, fileContent);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
