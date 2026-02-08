import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getAuthConfigPath, readTokenFromConfig, setupAuthConfig } from "./auth-config.js";

test("setupAuthConfig writes auth.json with strict permissions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bkci-auth-"));
  const authPath = path.join(tempDir, "config", "buildkite-cli", "auth.json");
  const previousPath = process.env.BKCI_AUTH_PATH;

  try {
    process.env.BKCI_AUTH_PATH = authPath;

    const setupResult = await setupAuthConfig({ token: "token-123" });
    assert.equal(setupResult.path, authPath);
    assert.equal(setupResult.source, "argument");

    const content = await readFile(authPath, "utf8");
    const parsed = JSON.parse(content) as { token?: string };
    assert.equal(parsed.token, "token-123");
    assert.equal(readTokenFromConfig(), "token-123");
    assert.equal(getAuthConfigPath(), authPath);

    const fileInfo = await stat(authPath);
    const fileMode = fileInfo.mode & 0o777;
    assert.equal(fileMode, 0o600);

    const directoryInfo = await stat(path.dirname(authPath));
    const directoryMode = directoryInfo.mode & 0o777;
    assert.equal(directoryMode, 0o700);
  } finally {
    if (previousPath === undefined) {
      delete process.env.BKCI_AUTH_PATH;
    } else {
      process.env.BKCI_AUTH_PATH = previousPath;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
