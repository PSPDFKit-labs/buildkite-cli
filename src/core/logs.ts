export type LogTransformResult = {
  readonly content: string;
  readonly lineCount: number;
  readonly truncated: boolean;
};

function tailLines(value: string, count: number): string {
  if (count < 1) {
    return value;
  }
  const lines = value.split("\n");
  if (lines.length <= count) {
    return value;
  }
  return lines.slice(lines.length - count).join("\n");
}

function truncateToMaxBytes(value: string, maxBytes: number): { readonly content: string; readonly truncated: boolean } {
  if (maxBytes < 1) {
    return { content: value, truncated: false };
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes <= maxBytes) {
    return { content: value, truncated: false };
  }

  let content = value;
  while (Buffer.byteLength(content, "utf8") > maxBytes && content.length > 0) {
    content = content.slice(Math.floor(content.length / 2));
  }

  return { content, truncated: true };
}

export function stripAnsiAndControlSequences(value: string): string {
  return value
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b_[^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\r/g, "");
}

export function transformLogContent(options: {
  readonly rawContent: string;
  readonly maxBytes: number | null;
  readonly tailLineCount: number | null;
  readonly stripAnsi: boolean;
}): LogTransformResult {
  const sanitized = options.stripAnsi
    ? stripAnsiAndControlSequences(options.rawContent)
    : options.rawContent;

  const tailed = options.tailLineCount === null
    ? sanitized
    : tailLines(sanitized, options.tailLineCount);

  const truncated = options.maxBytes === null
    ? { content: tailed, truncated: false }
    : truncateToMaxBytes(tailed, options.maxBytes);

  return {
    content: truncated.content,
    lineCount: truncated.content.length === 0 ? 0 : truncated.content.split("\n").length,
    truncated: truncated.truncated,
  };
}
