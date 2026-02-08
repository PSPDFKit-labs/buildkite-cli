import assert from "node:assert/strict";
import test from "node:test";

import { globToRegex } from "./glob.js";

test("globToRegex supports simple star matching", () => {
  const regex = globToRegex("reports/*.xml");

  assert.equal(regex.test("reports/junit.xml"), true);
  assert.equal(regex.test("reports/nested/junit.xml"), false);
});

test("globToRegex supports double star matching", () => {
  const regex = globToRegex("playwright-report/**");

  assert.equal(regex.test("playwright-report/index.html"), true);
  assert.equal(regex.test("playwright-report/sub/trace.zip"), true);
  assert.equal(regex.test("other/index.html"), false);
});
