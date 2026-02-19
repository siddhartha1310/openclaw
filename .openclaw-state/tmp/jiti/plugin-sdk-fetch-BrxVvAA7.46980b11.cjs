"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = fetchWithSsrFGuard;exports.n = fetchRemoteMedia;exports.r = readResponseWithLimit;exports.t = void 0;var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _fetchTimeoutC8BIXLt = require("./fetch-timeout-C8BI-XLt.js");
var _imageOpsBnWrVu = require("./image-ops-BnWrVu47.js");
var _nodePath = _interopRequireDefault(require("node:path"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/infra/net/fetch-guard.ts
const DEFAULT_MAX_REDIRECTS = 3;
function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
function buildAbortSignal(params) {
  const { timeoutMs, signal } = params;
  if (!timeoutMs && !signal) return {
    signal: void 0,
    cleanup: () => {}
  };
  if (!timeoutMs) return {
    signal,
    cleanup: () => {}
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(controller.abort.bind(controller), timeoutMs);
  const onAbort = (0, _fetchTimeoutC8BIXLt.t)(controller);
  if (signal) if (signal.aborted) controller.abort();else
  signal.addEventListener("abort", onAbort, { once: true });
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onAbort);
  };
  return {
    signal: controller.signal,
    cleanup
  };
}
async function fetchWithSsrFGuard(params) {
  const fetcher = params.fetchImpl ?? globalThis.fetch;
  if (!fetcher) throw new Error("fetch is not available");
  const maxRedirects = typeof params.maxRedirects === "number" && Number.isFinite(params.maxRedirects) ? Math.max(0, Math.floor(params.maxRedirects)) : DEFAULT_MAX_REDIRECTS;
  const { signal, cleanup } = buildAbortSignal({
    timeoutMs: params.timeoutMs,
    signal: params.signal
  });
  let released = false;
  const release = async (dispatcher) => {
    if (released) return;
    released = true;
    cleanup();
    await (0, _imageOpsBnWrVu.v)(dispatcher ?? void 0);
  };
  const visited = /* @__PURE__ */new Set();
  let currentUrl = params.url;
  let redirectCount = 0;
  while (true) {
    let parsedUrl;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      await release();
      throw new Error("Invalid URL: must be http or https");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      await release();
      throw new Error("Invalid URL: must be http or https");
    }
    let dispatcher = null;
    try {
      const pinned = await (0, _imageOpsBnWrVu.S)(parsedUrl.hostname, {
        lookupFn: params.lookupFn,
        policy: params.policy
      });
      if (params.pinDns !== false) dispatcher = (0, _imageOpsBnWrVu.y)(pinned);
      const init = {
        ...(params.init ? { ...params.init } : {}),
        redirect: "manual",
        ...(dispatcher ? { dispatcher } : {}),
        ...(signal ? { signal } : {})
      };
      const response = await fetcher(parsedUrl.toString(), init);
      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          await release(dispatcher);
          throw new Error(`Redirect missing location header (${response.status})`);
        }
        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          await release(dispatcher);
          throw new Error(`Too many redirects (limit: ${maxRedirects})`);
        }
        const nextUrl = new URL(location, parsedUrl).toString();
        if (visited.has(nextUrl)) {
          await release(dispatcher);
          throw new Error("Redirect loop detected");
        }
        visited.add(nextUrl);
        response.body?.cancel();
        await (0, _imageOpsBnWrVu.v)(dispatcher);
        currentUrl = nextUrl;
        continue;
      }
      return {
        response,
        finalUrl: currentUrl,
        release: async () => release(dispatcher)
      };
    } catch (err) {
      if (err instanceof _imageOpsBnWrVu._) (0, _execEUUDM93d.s)(`security: blocked URL fetch (${params.auditContext ?? "url-fetch"}) target=${parsedUrl.origin}${parsedUrl.pathname} reason=${err.message}`);
      await release(dispatcher);
      throw err;
    }
  }
}

//#endregion
//#region src/media/read-response-with-limit.ts
async function readResponseWithLimit(res, maxBytes, opts) {
  const onOverflow = opts?.onOverflow ?? ((params) => /* @__PURE__ */new Error(`Content too large: ${params.size} bytes (limit: ${params.maxBytes} bytes)`));
  const body = res.body;
  if (!body || typeof body.getReader !== "function") {
    const fallback = Buffer.from(await res.arrayBuffer());
    if (fallback.length > maxBytes) throw onOverflow({
      size: fallback.length,
      maxBytes,
      res
    });
    return fallback;
  }
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        total += value.length;
        if (total > maxBytes) {
          try {
            await reader.cancel();
          } catch {}
          throw onOverflow({
            size: total,
            maxBytes,
            res
          });
        }
        chunks.push(value);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

//#endregion
//#region src/media/fetch.ts
var MediaFetchError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "MediaFetchError";
  }
};exports.t = MediaFetchError;
function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, "");
}
function parseContentDispositionFileName(header) {
  if (!header) return;
  const starMatch = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (starMatch?.[1]) {
    const cleaned = stripQuotes(starMatch[1].trim());
    const encoded = cleaned.split("''").slice(1).join("''") || cleaned;
    try {
      return _nodePath.default.basename(decodeURIComponent(encoded));
    } catch {
      return _nodePath.default.basename(encoded);
    }
  }
  const match = /filename\s*=\s*([^;]+)/i.exec(header);
  if (match?.[1]) return _nodePath.default.basename(stripQuotes(match[1].trim()));
}
async function readErrorBodySnippet(res, maxChars = 200) {
  try {
    const text = await res.text();
    if (!text) return;
    const collapsed = text.replace(/\s+/g, " ").trim();
    if (!collapsed) return;
    if (collapsed.length <= maxChars) return collapsed;
    return `${collapsed.slice(0, maxChars)}…`;
  } catch {
    return;
  }
}
async function fetchRemoteMedia(options) {
  const { url, fetchImpl, filePathHint, maxBytes, maxRedirects, ssrfPolicy, lookupFn } = options;
  let res;
  let finalUrl = url;
  let release = null;
  try {
    const result = await fetchWithSsrFGuard({
      url,
      fetchImpl,
      maxRedirects,
      policy: ssrfPolicy,
      lookupFn
    });
    res = result.response;
    finalUrl = result.finalUrl;
    release = result.release;
  } catch (err) {
    throw new MediaFetchError("fetch_failed", `Failed to fetch media from ${url}: ${String(err)}`);
  }
  try {
    if (!res.ok) {
      const statusText = res.statusText ? ` ${res.statusText}` : "";
      const redirected = finalUrl !== url ? ` (redirected to ${finalUrl})` : "";
      let detail = `HTTP ${res.status}${statusText}`;
      if (!res.body) detail = `HTTP ${res.status}${statusText}; empty response body`;else
      {
        const snippet = await readErrorBodySnippet(res);
        if (snippet) detail += `; body: ${snippet}`;
      }
      throw new MediaFetchError("http_error", `Failed to fetch media from ${url}${redirected}: ${detail}`);
    }
    const contentLength = res.headers.get("content-length");
    if (maxBytes && contentLength) {
      const length = Number(contentLength);
      if (Number.isFinite(length) && length > maxBytes) throw new MediaFetchError("max_bytes", `Failed to fetch media from ${url}: content length ${length} exceeds maxBytes ${maxBytes}`);
    }
    const buffer = maxBytes ? await readResponseWithLimit(res, maxBytes, { onOverflow: ({ maxBytes, res }) => new MediaFetchError("max_bytes", `Failed to fetch media from ${res.url || url}: payload exceeds maxBytes ${maxBytes}`) }) : Buffer.from(await res.arrayBuffer());
    let fileNameFromUrl;
    try {
      const parsed = new URL(finalUrl);
      fileNameFromUrl = _nodePath.default.basename(parsed.pathname) || void 0;
    } catch {}
    const headerFileName = parseContentDispositionFileName(res.headers.get("content-disposition"));
    let fileName = headerFileName || fileNameFromUrl || (filePathHint ? _nodePath.default.basename(filePathHint) : void 0);
    const filePathForMime = headerFileName && _nodePath.default.extname(headerFileName) ? headerFileName : filePathHint ?? finalUrl;
    const contentType = await (0, _imageOpsBnWrVu.o)({
      buffer,
      headerMime: res.headers.get("content-type"),
      filePath: filePathForMime
    });
    if (fileName && !_nodePath.default.extname(fileName) && contentType) {
      const ext = (0, _imageOpsBnWrVu.s)(contentType);
      if (ext) fileName = `${fileName}${ext}`;
    }
    return {
      buffer,
      contentType: contentType ?? void 0,
      fileName
    };
  } finally {
    if (release) await release();
  }
}

//#endregion /* v9-c4895a18bbdf9297 */
