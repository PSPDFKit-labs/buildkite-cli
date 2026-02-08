#!/usr/bin/env node

import { executeCommand } from "./cli/execute-command.js";
import { parseCliArgs, USAGE_TEXT } from "./cli/parse-args.js";
import type { ParsedCommand } from "./cli/types.js";
import { failureEnvelope, successEnvelope } from "./core/envelope.js";
import { toApiError } from "./core/errors.js";
import { createBuildkiteClient } from "./shell/buildkite-client.js";
import { getBuildkiteTokenFromEnv } from "./shell/env.js";
import { setupAuthConfig } from "./shell/auth-config.js";

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function shouldShowHelp(argv: Array<string>): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function getSafeRequest(command: ParsedCommand): Record<string, unknown> {
  if (command.name === "auth.setup") {
    return {
      tokenProvided: command.args.token !== null,
    };
  }

  return { ...command.args };
}

async function main(argv: Array<string>): Promise<number> {
  if (argv.length === 0 || shouldShowHelp(argv)) {
    process.stdout.write(`${USAGE_TEXT}\n`);
    return 0;
  }

  let parsed: ParsedCommand;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid arguments";
    process.stderr.write(`error: ${message}\n\n${USAGE_TEXT}\n`);
    return 1;
  }

  if (parsed.name === "auth.setup") {
    try {
      const result = await setupAuthConfig({
        token: parsed.args.token,
      });

      const output = successEnvelope({
        command: parsed.name,
        request: getSafeRequest(parsed),
        summary: {
          configured: true,
          source: result.source,
        },
        pagination: null,
        data: {
          path: result.path,
        },
      });
      printJson(output);
      return 0;
    } catch (error) {
      const output = failureEnvelope({
        command: parsed.name,
        request: getSafeRequest(parsed),
        error: toApiError(error),
      });
      printJson(output);
      return 1;
    }
  }

  try {
    const token = getBuildkiteTokenFromEnv();
    const client = createBuildkiteClient(token);
    const result = await executeCommand({
      command: parsed,
      client,
    });

    const output = successEnvelope({
      command: parsed.name,
      request: result.request,
      summary: result.summary,
      pagination: result.pagination,
      data: result.data,
    });

    printJson(output);
    return 0;
  } catch (error) {
    const output = failureEnvelope({
      command: parsed.name,
      request: getSafeRequest(parsed),
      error: toApiError(error),
    });
    printJson(output);
    return 1;
  }
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : "unexpected error";
    process.stderr.write(`fatal: ${message}\n`);
    process.exitCode = 1;
  });
