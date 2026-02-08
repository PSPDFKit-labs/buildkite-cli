import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { setupAuthConfig } from "./auth-config.js";
import { getBuildkiteTokenFromEnv } from "./env.js";

function withEnv<T>(callback: () => Promise<T> | T): Promise<T> {
  const previous = {
    BUILDKITE_TOKEN: process.env.BUILDKITE_TOKEN,
    BUILDKITE_API_TOKEN: process.env.BUILDKITE_API_TOKEN,
    BK_TOKEN: process.env.BK_TOKEN,
    BKCI_AUTH_PATH: process.env.BKCI_AUTH_PATH,
  };

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous.BUILDKITE_TOKEN === undefined) delete process.env.BUILDKITE_TOKEN;
      else process.env.BUILDKITE_TOKEN = previous.BUILDKITE_TOKEN;

      if (previous.BUILDKITE_API_TOKEN === undefined) delete process.env.BUILDKITE_API_TOKEN;
      else process.env.BUILDKITE_API_TOKEN = previous.BUILDKITE_API_TOKEN;

      if (previous.BK_TOKEN === undefined) delete process.env.BK_TOKEN;
      else process.env.BK_TOKEN = previous.BK_TOKEN;

      if (previous.BKCI_AUTH_PATH === undefined) delete process.env.BKCI_AUTH_PATH;
      else process.env.BKCI_AUTH_PATH = previous.BKCI_AUTH_PATH;
    });
}

test("getBuildkiteTokenFromEnv prefers env token over config", async () => {
  await withEnv(async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "bkci-env-"));
    try {
      process.env.BKCI_AUTH_PATH = path.join(tempDir, "auth.json");
      await setupAuthConfig({ token: "config-token" });
      process.env.BUILDKITE_TOKEN = "env-token";

      const token = getBuildkiteTokenFromEnv();
      assert.equal(token, "env-token");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

test("getBuildkiteTokenFromEnv reads token from auth config", async () => {
  await withEnv(async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "bkci-env-"));
    try {
      process.env.BKCI_AUTH_PATH = path.join(tempDir, "auth.json");
      await setupAuthConfig({ token: "config-token" });
      delete process.env.BUILDKITE_TOKEN;
      delete process.env.BUILDKITE_API_TOKEN;
      delete process.env.BK_TOKEN;

      const token = getBuildkiteTokenFromEnv();
      assert.equal(token, "config-token");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

test("getBuildkiteTokenFromEnv returns actionable error when token is missing", async () => {
  await withEnv(async () => {
    delete process.env.BUILDKITE_TOKEN;
    delete process.env.BUILDKITE_API_TOKEN;
    delete process.env.BK_TOKEN;
    process.env.BKCI_AUTH_PATH = path.join(os.tmpdir(), "bkci-does-not-exist", "auth.json");

    assert.throws(
      () => getBuildkiteTokenFromEnv(),
      /bkci auth setup.*https:\/\/buildkite.com\/user\/api-access-tokens/
    );
  });
});
