# buildkite-cli

A local CLI that queries Buildkite REST APIs and returns LLM-friendly JSON envelopes.

## Features

- List builds.
- Get one build with job summary.
- Fetch job logs.
- Retry failed/timed-out jobs.
- List artifacts.
- Download artifacts.
- List annotations.

Output format is documented in [API.md](./API.md).

## Install

For now, install from a local checkout:

```bash
git clone https://github.com/PSPDFKit-labs/buildkite-cli <buildkite-cli-dir>
cd <buildkite-cli-dir>
pnpm install
pnpm run build
npm link
bkci --help
```

After pulling new changes, rebuild:

```bash
pnpm run build
```

Local development:

```bash
pnpm run test
```

Run directly without linking:

```bash
node dist/index.js <command>
# or
pnpm exec tsx src/index.ts <command>
```

## Authentication

Set one of these environment variables:

- `BUILDKITE_TOKEN`
- `BUILDKITE_API_TOKEN`
- `BK_TOKEN`

Or run interactive setup to store a token in:

- `~/.config/buildkite-cli/auth.json`

```bash
bkci auth setup
```

## Commands

```bash
bkci auth setup [--token TOKEN]
bkci auth status
bkci builds list --org ORG [--pipeline PIPELINE] [--branch BRANCH] [--state STATE]
bkci builds get --org ORG --pipeline PIPELINE --build BUILD_NUMBER
bkci jobs log get --org ORG --pipeline PIPELINE --build BUILD_NUMBER --job JOB_ID
bkci jobs retry --org ORG --pipeline PIPELINE --build BUILD_NUMBER --job JOB_ID
bkci artifacts list --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--job JOB_ID]
bkci artifacts download --org ORG --pipeline PIPELINE --build BUILD_NUMBER [--job JOB_ID] [--artifact-id ID ...] [--glob GLOB] [--out DIR]
bkci annotations list --org ORG --pipeline PIPELINE --build BUILD_NUMBER
```

## Required token scopes

Baseline scopes:

- `read_builds`
- `read_build_logs`
- `read_artifacts`

Additional scope for retrying jobs:

- `write_builds`

## Retry jobs examples

Retry a job:

```bash
bkci jobs retry --org acme --pipeline web --build 942 --job 0197abcd
```

If your token is missing `write_builds`, `bkci` returns a clear error envelope (and does not retry):

```json
{
  "ok": false,
  "command": "jobs.retry",
  "error": {
    "type": "permission_error",
    "message": "failed to retry job: token missing required scope(s): write_builds",
    "code": "missing_scope"
  }
}
```

## Notes

- Use `--raw` on any command to return raw Buildkite payloads inside the envelope.
- `bkci auth status` checks token scopes, reports missing required scopes, and warns when optional capability scopes (for example `jobs.retry`) are missing.
- `jobs log get` strips ANSI/control sequences in normalized mode for cleaner LLM output.
- Pagination metadata is parsed from Buildkite `Link` headers for list endpoints.

## License

MIT. See [LICENSE](./LICENSE).
