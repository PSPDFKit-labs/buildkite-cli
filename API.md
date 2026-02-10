# Buildkite CLI API contract

This document defines the JSON output contract for a local Buildkite CLI.

The CLI can call Buildkite REST endpoints directly, but every command should wrap the response in a stable envelope so downstream tools and LLMs can parse output consistently.

## Design goals

- Return one JSON object per command.
- Keep top-level keys stable across all commands.
- Preserve enough raw context for debugging.
- Keep logs and artifacts safe for automation (large payload controls).

## Top-level envelope

Every command returns this shape.

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "builds.list",
  "request": {},
  "summary": {},
  "pagination": null,
  "data": null,
  "error": null
}
```

### Field definitions

- `ok`: `true` for success, `false` for failure.
- `apiVersion`: CLI contract version, not Buildkite API version.
- `command`: canonical command name.
- `request`: normalized input used by the command.
- `summary`: small computed facts for quick understanding.
- `pagination`: pagination metadata for list commands. Otherwise `null`.
- `data`: command-specific payload.
- `error`: populated when `ok=false`, otherwise `null`.

## Error contract

When `ok=false`, return:

```json
{
  "ok": false,
  "apiVersion": "v1",
  "command": "jobs.log.get",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942,
    "jobId": "0197..."
  },
  "summary": {},
  "pagination": null,
  "data": null,
  "error": {
    "type": "auth_error",
    "message": "invalid token",
    "httpStatus": 401,
    "code": "unauthorized",
    "retryable": false,
    "requestId": "9f3e...",
    "details": {}
  }
}
```

### Error types

- `auth_error`
- `permission_error`
- `not_found`
- `validation_error`
- `rate_limited`
- `network_error`
- `server_error`
- `internal_error`

## Pagination contract

List commands must fill `pagination`.

```json
{
  "page": 1,
  "perPage": 30,
  "nextPage": 2,
  "prevPage": null,
  "hasMore": true
}
```

Buildkite pagination details come from response headers, primarily the `Link` header.
If a value is unavailable, set it to `null`.

## Raw mode

`--raw` returns Buildkite payloads with no field renaming.

Behavior:

- Keep the top-level envelope unchanged.
- Put exact Buildkite JSON in `data`.
- Skip CLI-level summaries when they cannot be computed safely.

This keeps automation predictable while allowing full passthrough.

## MVP commands

## `auth.setup`

Store a token in `~/.config/buildkite-cli/auth.json` with strict permissions.

- config directory mode: `0700`
- auth file mode: `0600`

If `--token` is not provided, `bkci` prompts interactively for a token.

### Request

```json
{
  "tokenProvided": false
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "auth.setup",
  "request": {
    "tokenProvided": false
  },
  "summary": {
    "configured": true,
    "source": "prompt"
  },
  "pagination": null,
  "data": {
    "path": "/Users/example/.config/buildkite-cli/auth.json"
  },
  "error": null
}
```

## `auth.status`

Read the token details and report whether required scopes are present.

Required scopes for this CLI:

- `read_builds`
- `read_build_logs`
- `read_artifacts`

Optional capability scopes:

- `write_builds` (needed for `jobs.retry`)

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "auth.status",
  "request": {},
  "summary": {
    "requiredScopes": [
      "read_builds",
      "read_build_logs",
      "read_artifacts"
    ],
    "grantedScopes": 3,
    "missingScopes": [],
    "ready": true,
    "warnings": []
  },
  "pagination": null,
  "data": {
    "token": {
      "uuid": "019c...",
      "description": "local cli token",
      "createdAt": "2026-02-08T20:15:32Z",
      "scopes": [
        "read_builds",
        "read_build_logs",
        "read_artifacts"
      ]
    },
    "user": {
      "name": "Pat Example",
      "email": "pat@example.com"
    },
    "requiredScopes": [
      "read_builds",
      "read_build_logs",
      "read_artifacts"
    ],
    "missingScopes": [],
    "capabilities": {
      "jobsRetry": {
        "requiredScopes": [
          "write_builds"
        ],
        "missingScopes": [],
        "ready": true
      }
    }
  },
  "error": null
}
```

## `builds.list`

List builds globally, by organization, or by pipeline.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "branch": "main",
  "state": "failed",
  "page": 1,
  "perPage": 30
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "builds.list",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "branch": "main",
    "state": "failed",
    "page": 1,
    "perPage": 30
  },
  "summary": {
    "count": 2,
    "states": {
      "failed": 2
    }
  },
  "pagination": {
    "page": 1,
    "perPage": 30,
    "nextPage": null,
    "prevPage": null,
    "hasMore": false
  },
  "data": [
    {
      "number": 942,
      "state": "failed",
      "branch": "main",
      "message": "fix flaky test",
      "commit": "a1b2c3d",
      "pipeline": {
        "slug": "web"
      },
      "createdAt": "2026-02-08T19:14:03Z",
      "startedAt": "2026-02-08T19:14:08Z",
      "finishedAt": "2026-02-08T19:17:52Z",
      "webUrl": "https://buildkite.com/acme/web/builds/942"
    }
  ],
  "error": null
}
```

## `builds.get`

Get one build and include a flattened job summary.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "builds.get",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942
  },
  "summary": {
    "jobCounts": {
      "passed": 11,
      "failed": 1,
      "running": 0,
      "blocked": 0
    },
    "failedJobIds": [
      "0197abcd"
    ]
  },
  "pagination": null,
  "data": {
    "build": {
      "number": 942,
      "state": "failed",
      "branch": "main",
      "commit": "a1b2c3d",
      "message": "fix flaky test",
      "webUrl": "https://buildkite.com/acme/web/builds/942"
    },
    "jobs": [
      {
        "id": "0197abcd",
        "type": "script",
        "name": "Playwright tests",
        "stepKey": "e2e",
        "state": "failed",
        "exitStatus": "1",
        "webUrl": "https://buildkite.com/acme/web/builds/942#job-0197abcd"
      }
    ]
  },
  "error": null
}
```

## `jobs.log.get`

Fetch one job log.

In normalized mode, `data.content` has ANSI and Buildkite control sequences removed.
Use `--raw` to keep exact Buildkite payloads.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942,
  "jobId": "0197abcd",
  "maxBytes": 250000,
  "tailLines": 400
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "jobs.log.get",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942,
    "jobId": "0197abcd",
    "maxBytes": 250000,
    "tailLines": 400
  },
  "summary": {
    "lineCount": 214,
    "truncated": false
  },
  "pagination": null,
  "data": {
    "jobId": "0197abcd",
    "encoding": "utf-8",
    "lineCount": 214,
    "truncated": false,
    "content": "...log text..."
  },
  "error": null
}
```

## `jobs.retry`

Retry a failed/timed-out job.

Requires `write_builds` scope.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942,
  "jobId": "0197abcd"
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "jobs.retry",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942,
    "jobId": "0197abcd"
  },
  "summary": {
    "retried": true,
    "jobId": "0197efgh",
    "state": "scheduled"
  },
  "pagination": null,
  "data": {
    "job": {
      "id": "0197efgh",
      "type": "script",
      "name": "Playwright tests",
      "stepKey": "e2e",
      "state": "scheduled",
      "exitStatus": null,
      "webUrl": "https://buildkite.com/acme/web/builds/942#job-0197efgh"
    }
  },
  "error": null
}
```

## `artifacts.list`

List artifacts for a build, optionally filtered by job.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942,
  "jobId": null
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "artifacts.list",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942,
    "jobId": null
  },
  "summary": {
    "count": 3,
    "totalBytes": 1834201
  },
  "pagination": null,
  "data": [
    {
      "id": "8f2d",
      "jobId": "0197abcd",
      "path": "playwright-report/index.html",
      "downloadUrl": "https://api.buildkite.com/.../download",
      "fileSize": 640120,
      "sha1sum": "d5e8..."
    }
  ],
  "error": null
}
```

## `artifacts.download`

Download one or many artifacts to local files.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942,
  "jobId": null,
  "artifactIds": [
    "8f2d"
  ],
  "glob": "playwright-report/**",
  "outputDir": "./.bk-artifacts"
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "artifacts.download",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942,
    "jobId": null,
    "artifactIds": [
      "8f2d"
    ],
    "glob": "playwright-report/**",
    "outputDir": "./.bk-artifacts"
  },
  "summary": {
    "downloaded": 1,
    "failed": 0,
    "totalBytes": 640120
  },
  "pagination": null,
  "data": {
    "files": [
      {
        "artifactId": "8f2d",
        "path": "./.bk-artifacts/playwright-report/index.html",
        "bytes": 640120,
        "sha1sum": "d5e8..."
      }
    ],
    "failures": []
  },
  "error": null
}
```

## `annotations.list`

List build annotations.

### Request

```json
{
  "org": "acme",
  "pipeline": "web",
  "buildNumber": 942
}
```

### Success response

```json
{
  "ok": true,
  "apiVersion": "v1",
  "command": "annotations.list",
  "request": {
    "org": "acme",
    "pipeline": "web",
    "buildNumber": 942
  },
  "summary": {
    "count": 1
  },
  "pagination": null,
  "data": [
    {
      "id": "5a7c",
      "context": "tests",
      "style": "error",
      "body": "3 Playwright tests failed",
      "createdAt": "2026-02-08T19:18:01Z",
      "updatedAt": "2026-02-08T19:18:01Z"
    }
  ],
  "error": null
}
```

## Mapping to Buildkite REST endpoints

- `auth.setup` -> local filesystem write (`~/.config/buildkite-cli/auth.json`)
- `auth.status` -> `GET /v2/access-token`
- `builds.list` -> `GET /v2/builds` or `GET /v2/organizations/{org}/builds` or `GET /v2/organizations/{org}/pipelines/{pipeline}/builds`
- `builds.get` -> `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}`
- `jobs.log.get` -> `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/jobs/{job.id}/log`
- `jobs.retry` -> `PUT /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/jobs/{job.id}/retry`
- `artifacts.list` -> `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/artifacts` or `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/jobs/{job.id}/artifacts`
- `artifacts.download` -> `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/jobs/{job.id}/artifacts/{id}/download`
- `annotations.list` -> `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/annotations`

## Future commands

These are strong candidates for the next version:

- `builds.create`
- `builds.rebuild`
- `builds.cancel`
- `jobs.unblock`
- `jobs.env.get`
- `pipelines.list`
