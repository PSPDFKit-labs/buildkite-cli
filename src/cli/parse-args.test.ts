import assert from "node:assert/strict";
import test from "node:test";

import { parseCliArgs } from "./parse-args.js";

test("parseCliArgs parses auth setup with token", () => {
  const parsed = parseCliArgs(["auth", "setup", "--token", "abc123"]);

  assert.equal(parsed.name, "auth.setup");
  assert.equal(parsed.global.raw, false);
  assert.deepEqual(parsed.args, {
    token: "abc123",
  });
});

test("parseCliArgs parses auth status", () => {
  const parsed = parseCliArgs(["auth", "status"]);

  assert.equal(parsed.name, "auth.status");
  assert.equal(parsed.global.raw, false);
  assert.deepEqual(parsed.args, {});
});

test("parseCliArgs parses builds list with global raw option", () => {
  const parsed = parseCliArgs([
    "--raw",
    "builds",
    "list",
    "--org",
    "acme",
    "--pipeline",
    "web",
    "--branch",
    "main",
    "--state",
    "failed",
    "--page",
    "2",
    "--per-page",
    "50",
  ]);

  assert.equal(parsed.name, "builds.list");
  assert.equal(parsed.global.raw, true);
  assert.deepEqual(parsed.args, {
    org: "acme",
    pipeline: "web",
    branch: "main",
    state: "failed",
    page: 2,
    perPage: 50,
  });
});

test("parseCliArgs parses artifacts download with multiple ids", () => {
  const parsed = parseCliArgs([
    "artifacts",
    "download",
    "--org",
    "acme",
    "--pipeline",
    "web",
    "--build",
    "17",
    "--artifact-id",
    "a1",
    "--artifact-ids",
    "a2,a3",
    "--out",
    "./tmp-artifacts",
  ]);

  assert.equal(parsed.name, "artifacts.download");
  assert.deepEqual(parsed.args, {
    org: "acme",
    pipeline: "web",
    buildNumber: 17,
    jobId: null,
    artifactIds: ["a1", "a2", "a3"],
    glob: null,
    outputDir: "./tmp-artifacts",
  });
});

test("parseCliArgs rejects artifacts download without selector", () => {
  assert.throws(
    () =>
      parseCliArgs([
        "artifacts",
        "download",
        "--org",
        "acme",
        "--pipeline",
        "web",
        "--build",
        "17",
      ]),
    /specify --artifact-id\/--artifact-ids or --glob/
  );
});
