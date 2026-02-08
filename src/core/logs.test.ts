import assert from "node:assert/strict";
import test from "node:test";

import { transformLogContent } from "./logs.js";

test("transformLogContent applies tail lines first", () => {
  const result = transformLogContent({
    rawContent: "line-1\nline-2\nline-3\nline-4",
    maxBytes: null,
    tailLineCount: 2,
    stripAnsi: false,
  });

  assert.equal(result.content, "line-3\nline-4");
  assert.equal(result.lineCount, 2);
  assert.equal(result.truncated, false);
});

test("transformLogContent truncates by bytes when maxBytes is set", () => {
  const result = transformLogContent({
    rawContent: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    maxBytes: 8,
    tailLineCount: null,
    stripAnsi: false,
  });

  assert.equal(Buffer.byteLength(result.content, "utf8") <= 8, true);
  assert.equal(result.truncated, true);
});

test("transformLogContent strips ansi and buildkite control sequences", () => {
  const raw =
    "\u001b_bk;t=1770510296903\u0007\u001b[38;5;48mINFO\u001b[0m hello\r\nnext-line\u001b[0m";

  const result = transformLogContent({
    rawContent: raw,
    maxBytes: null,
    tailLineCount: null,
    stripAnsi: true,
  });

  assert.equal(result.content.includes("\u001b"), false);
  assert.equal(result.content.includes("\r"), false);
  assert.equal(result.content.includes("INFO hello"), true);
});
