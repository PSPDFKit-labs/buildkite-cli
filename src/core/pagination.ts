import type { Pagination } from "./types.js";

type LinkRelations = {
  readonly next: URL | null;
  readonly prev: URL | null;
  readonly first: URL | null;
  readonly last: URL | null;
};

function parseNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseLinkRelations(linkHeader: string | null): LinkRelations {
  if (linkHeader === null || linkHeader.trim().length === 0) {
    return {
      next: null,
      prev: null,
      first: null,
      last: null,
    };
  }

  const result: {
    next: URL | null;
    prev: URL | null;
    first: URL | null;
    last: URL | null;
  } = {
    next: null,
    prev: null,
    first: null,
    last: null,
  };

  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([a-z]+)"/i);
    if (!match) {
      continue;
    }

    const [, href, relation] = match;
    if (!href || !relation) {
      continue;
    }

    try {
      const parsedUrl = new URL(href);
      if (relation === "next") {
        result.next = parsedUrl;
      } else if (relation === "prev") {
        result.prev = parsedUrl;
      } else if (relation === "first") {
        result.first = parsedUrl;
      } else if (relation === "last") {
        result.last = parsedUrl;
      }
    } catch {
      // Ignore malformed URL in link relation.
    }
  }

  return result;
}

function readPageFromUrl(url: URL | null): number | null {
  if (url === null) {
    return null;
  }
  return parseNumber(url.searchParams.get("page"));
}

function readPerPageFromUrl(url: URL | null): number | null {
  if (url === null) {
    return null;
  }
  return parseNumber(url.searchParams.get("per_page"));
}

function deriveCurrentPage(options: {
  readonly fromHeader: number | null;
  readonly requestedPage: number | null;
  readonly nextPage: number | null;
  readonly prevPage: number | null;
  readonly firstPage: number | null;
}): number | null {
  if (options.fromHeader !== null) {
    return options.fromHeader;
  }
  if (options.requestedPage !== null) {
    return options.requestedPage;
  }
  if (options.prevPage !== null) {
    return options.prevPage + 1;
  }
  if (options.nextPage !== null && options.nextPage > 1) {
    return options.nextPage - 1;
  }
  if (options.firstPage !== null) {
    return options.firstPage;
  }
  if (options.nextPage !== null) {
    return 1;
  }
  return null;
}

function derivePerPage(options: {
  readonly fromHeader: number | null;
  readonly requestedPerPage: number | null;
  readonly links: LinkRelations;
}): number | null {
  if (options.fromHeader !== null) {
    return options.fromHeader;
  }
  if (options.requestedPerPage !== null) {
    return options.requestedPerPage;
  }

  const fromNext = readPerPageFromUrl(options.links.next);
  if (fromNext !== null) {
    return fromNext;
  }

  const fromPrev = readPerPageFromUrl(options.links.prev);
  if (fromPrev !== null) {
    return fromPrev;
  }

  const fromFirst = readPerPageFromUrl(options.links.first);
  if (fromFirst !== null) {
    return fromFirst;
  }

  return readPerPageFromUrl(options.links.last);
}

export function parsePagination(options: {
  readonly headers: Headers;
  readonly requestedPage: number | null;
  readonly requestedPerPage: number | null;
}): Pagination {
  const links = parseLinkRelations(options.headers.get("link"));

  const nextPage = parseNumber(options.headers.get("x-next-page")) ?? readPageFromUrl(links.next);
  const prevPage = parseNumber(options.headers.get("x-prev-page")) ?? readPageFromUrl(links.prev);
  const firstPage = readPageFromUrl(links.first);

  const page = deriveCurrentPage({
    fromHeader: parseNumber(options.headers.get("x-page")),
    requestedPage: options.requestedPage,
    nextPage,
    prevPage,
    firstPage,
  });

  const perPage = derivePerPage({
    fromHeader: parseNumber(options.headers.get("x-per-page")),
    requestedPerPage: options.requestedPerPage,
    links,
  });

  return {
    page,
    perPage,
    nextPage,
    prevPage,
    hasMore: nextPage !== null,
  };
}
