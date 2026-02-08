import os from "node:os";
import path from "node:path";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

type AuthConfig = {
  readonly token: string;
};

function normalizeToken(token: string): string {
  return token.trim();
}

function getConfigRoot(): string {
  const explicitConfigPath = process.env.BKCI_AUTH_PATH ?? null;
  if (explicitConfigPath !== null && explicitConfigPath.trim().length > 0) {
    return path.dirname(explicitConfigPath);
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? null;
  if (xdgConfigHome !== null && xdgConfigHome.trim().length > 0) {
    return xdgConfigHome;
  }

  return path.join(os.homedir(), ".config");
}

export function getAuthConfigPath(): string {
  const explicitConfigPath = process.env.BKCI_AUTH_PATH ?? null;
  if (explicitConfigPath !== null && explicitConfigPath.trim().length > 0) {
    return explicitConfigPath;
  }

  return path.join(getConfigRoot(), "buildkite-cli", "auth.json");
}

export function readTokenFromConfig(): string | null {
  const filePath = getAuthConfigPath();

  try {
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<AuthConfig>;
    const token = typeof parsed.token === "string" ? normalizeToken(parsed.token) : "";
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function promptForTokenHidden(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("no token provided. pass --token in non-interactive environments");
  }

  return await new Promise<string>((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = typeof input.isRaw === "boolean" ? input.isRaw : false;

    output.write("Buildkite token: ");

    let collected = "";

    const cleanup = () => {
      input.off("data", onData);
      if (!wasRaw) {
        input.setRawMode?.(false);
      }
      input.pause();
    };

    const onData = (chunk: Buffer | string) => {
      const value = typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (value === "\u0003") {
        output.write("\n");
        cleanup();
        reject(new Error("cancelled"));
        return;
      }

      if (value === "\r" || value === "\n" || value === "\r\n") {
        output.write("\n");
        cleanup();
        resolve(normalizeToken(collected));
        return;
      }

      if (value === "\u007f") {
        collected = collected.slice(0, -1);
        return;
      }

      collected += value;
    };

    if (!wasRaw) {
      input.setRawMode?.(true);
    }
    input.resume();
    input.on("data", onData);
  });
}

export async function setupAuthConfig(options: {
  readonly token: string | null;
}): Promise<{
  readonly path: string;
  readonly source: "argument" | "prompt";
}> {
  const fromArgument = options.token !== null ? normalizeToken(options.token) : "";
  let token = fromArgument;
  let source: "argument" | "prompt" = "argument";

  if (token.length === 0) {
    token = await promptForTokenHidden();
    source = "prompt";
  }

  if (token.length === 0) {
    throw new Error("token cannot be empty");
  }

  const filePath = getAuthConfigPath();
  const directoryPath = path.dirname(filePath);

  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  await chmod(directoryPath, 0o700).catch(() => undefined);

  const payload: AuthConfig = { token };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  await chmod(filePath, 0o600);

  return {
    path: filePath,
    source,
  };
}
