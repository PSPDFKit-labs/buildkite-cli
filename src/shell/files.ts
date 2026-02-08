import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export async function writeArtifactToDisk(options: {
  readonly outputDir: string;
  readonly artifactPath: string;
  readonly bytes: Uint8Array;
}): Promise<string> {
  const targetPath = path.resolve(options.outputDir, options.artifactPath);
  const targetDir = path.dirname(targetPath);
  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, options.bytes);
  return targetPath;
}
