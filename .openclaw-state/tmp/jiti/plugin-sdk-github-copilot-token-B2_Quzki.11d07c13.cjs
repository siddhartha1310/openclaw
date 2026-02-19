"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = saveJsonFile;exports.i = loadJsonFile;exports.n = void 0;exports.r = resolveCopilotApiToken;exports.t = void 0;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/infra/json-file.ts
function loadJsonFile(pathname) {
  try {
    if (!_nodeFs.default.existsSync(pathname)) return;
    const raw = _nodeFs.default.readFileSync(pathname, "utf8");
    return JSON.parse(raw);
  } catch {
    return;
  }
}
function saveJsonFile(pathname, data) {
  const dir = _nodePath.default.dirname(pathname);
  if (!_nodeFs.default.existsSync(dir)) _nodeFs.default.mkdirSync(dir, {
    recursive: true,
    mode: 448
  });
  _nodeFs.default.writeFileSync(pathname, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  _nodeFs.default.chmodSync(pathname, 384);
}

//#endregion
//#region src/providers/github-copilot-token.ts
var github_copilot_token_exports = exports.n = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({
  DEFAULT_COPILOT_API_BASE_URL: () => DEFAULT_COPILOT_API_BASE_URL,
  deriveCopilotApiBaseUrlFromToken: () => deriveCopilotApiBaseUrlFromToken,
  resolveCopilotApiToken: () => resolveCopilotApiToken
});
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
function resolveCopilotTokenCachePath(env = process.env) {
  return _nodePath.default.join((0, _pathsZQWYGl2V.s)(env), "credentials", "github-copilot.token.json");
}
function isTokenUsable(cache, now = Date.now()) {
  return cache.expiresAt - now > 300 * 1e3;
}
function parseCopilotTokenResponse(value) {
  if (!value || typeof value !== "object") throw new Error("Unexpected response from GitHub Copilot token endpoint");
  const asRecord = value;
  const token = asRecord.token;
  const expiresAt = asRecord.expires_at;
  if (typeof token !== "string" || token.trim().length === 0) throw new Error("Copilot token response missing token");
  let expiresAtMs;
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) expiresAtMs = expiresAt > 1e10 ? expiresAt : expiresAt * 1e3;else
  if (typeof expiresAt === "string" && expiresAt.trim().length > 0) {
    const parsed = Number.parseInt(expiresAt, 10);
    if (!Number.isFinite(parsed)) throw new Error("Copilot token response has invalid expires_at");
    expiresAtMs = parsed > 1e10 ? parsed : parsed * 1e3;
  } else throw new Error("Copilot token response missing expires_at");
  return {
    token,
    expiresAt: expiresAtMs
  };
}
const DEFAULT_COPILOT_API_BASE_URL = exports.t = "https://api.individual.githubcopilot.com";
function deriveCopilotApiBaseUrlFromToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const proxyEp = trimmed.match(/(?:^|;)\s*proxy-ep=([^;\s]+)/i)?.[1]?.trim();
  if (!proxyEp) return null;
  const host = proxyEp.replace(/^https?:\/\//, "").replace(/^proxy\./i, "api.");
  if (!host) return null;
  return `https://${host}`;
}
async function resolveCopilotApiToken(params) {
  const env = params.env ?? process.env;
  const cachePath = params.cachePath?.trim() || resolveCopilotTokenCachePath(env);
  const loadJsonFileFn = params.loadJsonFileImpl ?? loadJsonFile;
  const saveJsonFileFn = params.saveJsonFileImpl ?? saveJsonFile;
  const cached = loadJsonFileFn(cachePath);
  if (cached && typeof cached.token === "string" && typeof cached.expiresAt === "number") {
    if (isTokenUsable(cached)) return {
      token: cached.token,
      expiresAt: cached.expiresAt,
      source: `cache:${cachePath}`,
      baseUrl: deriveCopilotApiBaseUrlFromToken(cached.token) ?? DEFAULT_COPILOT_API_BASE_URL
    };
  }
  const res = await (params.fetchImpl ?? fetch)(COPILOT_TOKEN_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${params.githubToken}`
    }
  });
  if (!res.ok) throw new Error(`Copilot token exchange failed: HTTP ${res.status}`);
  const json = parseCopilotTokenResponse(await res.json());
  const payload = {
    token: json.token,
    expiresAt: json.expiresAt,
    updatedAt: Date.now()
  };
  saveJsonFileFn(cachePath, payload);
  return {
    token: payload.token,
    expiresAt: payload.expiresAt,
    source: `fetched:${COPILOT_TOKEN_URL}`,
    baseUrl: deriveCopilotApiBaseUrlFromToken(payload.token) ?? DEFAULT_COPILOT_API_BASE_URL
  };
}

//#endregion /* v9-9be43e3eab42842e */
