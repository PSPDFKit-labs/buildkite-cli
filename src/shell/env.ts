import { getAuthConfigPath, readTokenFromConfig } from "./auth-config.js";

export function getBuildkiteTokenFromEnv(): string {
  const tokenFromEnv =
    process.env.BUILDKITE_TOKEN ??
    process.env.BUILDKITE_API_TOKEN ??
    process.env.BK_TOKEN ??
    null;

  if (tokenFromEnv !== null && tokenFromEnv.trim().length > 0) {
    return tokenFromEnv.trim();
  }

  const tokenFromConfig = readTokenFromConfig();
  if (tokenFromConfig !== null) {
    return tokenFromConfig;
  }

  const configPath = getAuthConfigPath();
  throw new Error(
    `missing buildkite token. set BUILDKITE_TOKEN/BUILDKITE_API_TOKEN/BK_TOKEN or run 'bkci auth setup'. looked for config at ${configPath}. create a token at https://buildkite.com/user/api-access-tokens with scopes: read_builds, read_build_logs, read_artifacts (and write_builds if you want to use jobs retry)`
  );
}
