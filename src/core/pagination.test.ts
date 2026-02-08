import assert from "node:assert/strict";
import test from "node:test";

import { parsePagination } from "./pagination.js";

test("parsePagination derives values from Link header on first page", () => {
  const headers = new Headers({
    link: '<https://api.buildkite.com/v2/organizations/acme/pipelines/web/builds?page=2&per_page=3>; rel="next", <https://api.buildkite.com/v2/organizations/acme/pipelines/web/builds?page=42&per_page=3>; rel="last"',
  });

  const pagination = parsePagination({
    headers,
    requestedPage: null,
    requestedPerPage: 3,
  });

  assert.deepEqual(pagination, {
    page: 1,
    perPage: 3,
    nextPage: 2,
    prevPage: null,
    hasMore: true,
  });
});

test("parsePagination uses prev relation to infer current page", () => {
  const headers = new Headers({
    link: '<https://api.buildkite.com/v2/organizations/acme/pipelines/web/builds?page=2&per_page=10>; rel="prev", <https://api.buildkite.com/v2/organizations/acme/pipelines/web/builds?page=4&per_page=10>; rel="next"',
  });

  const pagination = parsePagination({
    headers,
    requestedPage: null,
    requestedPerPage: null,
  });

  assert.deepEqual(pagination, {
    page: 3,
    perPage: 10,
    nextPage: 4,
    prevPage: 2,
    hasMore: true,
  });
});

test("parsePagination honors explicit requested page when no headers exist", () => {
  const pagination = parsePagination({
    headers: new Headers(),
    requestedPage: 5,
    requestedPerPage: 25,
  });

  assert.deepEqual(pagination, {
    page: 5,
    perPage: 25,
    nextPage: null,
    prevPage: null,
    hasMore: false,
  });
});
