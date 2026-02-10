export type ParsedGlobalOptions = {
  readonly raw: boolean;
};

export type AuthSetupArgs = {
  readonly token: string | null;
};

export type AuthStatusArgs = Record<string, never>;

export type BuildsListArgs = {
  readonly org: string;
  readonly pipeline: string | null;
  readonly branch: string | null;
  readonly state: string | null;
  readonly page: number | null;
  readonly perPage: number | null;
};

export type BuildsGetArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
};

export type JobsLogGetArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly jobId: string;
  readonly maxBytes: number | null;
  readonly tailLines: number | null;
};

export type JobsRetryArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly jobId: string;
};

export type ArtifactsListArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly jobId: string | null;
};

export type ArtifactsDownloadArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly jobId: string | null;
  readonly artifactIds: Array<string>;
  readonly glob: string | null;
  readonly outputDir: string;
};

export type AnnotationsListArgs = {
  readonly org: string;
  readonly pipeline: string;
  readonly buildNumber: number;
};

export type ParsedCommand =
  | { readonly name: "auth.setup"; readonly global: ParsedGlobalOptions; readonly args: AuthSetupArgs }
  | { readonly name: "auth.status"; readonly global: ParsedGlobalOptions; readonly args: AuthStatusArgs }
  | { readonly name: "builds.list"; readonly global: ParsedGlobalOptions; readonly args: BuildsListArgs }
  | { readonly name: "builds.get"; readonly global: ParsedGlobalOptions; readonly args: BuildsGetArgs }
  | { readonly name: "jobs.log.get"; readonly global: ParsedGlobalOptions; readonly args: JobsLogGetArgs }
  | { readonly name: "jobs.retry"; readonly global: ParsedGlobalOptions; readonly args: JobsRetryArgs }
  | { readonly name: "artifacts.list"; readonly global: ParsedGlobalOptions; readonly args: ArtifactsListArgs }
  | {
      readonly name: "artifacts.download";
      readonly global: ParsedGlobalOptions;
      readonly args: ArtifactsDownloadArgs;
    }
  | {
      readonly name: "annotations.list";
      readonly global: ParsedGlobalOptions;
      readonly args: AnnotationsListArgs;
    };
