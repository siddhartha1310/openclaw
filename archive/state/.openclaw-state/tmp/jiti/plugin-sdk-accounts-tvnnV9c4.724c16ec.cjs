"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = void 0;exports.c = logoutWeb;exports.d = readCredsJsonRaw;exports.f = readWebSelfId;exports.g = webAuthExists;exports.h = resolveWebCredsPath;exports.i = resolveWhatsAppAuthDir;exports.l = maybeRestoreCredsFromBackup;exports.m = resolveWebCredsBackupPath;exports.n = resolveDefaultWhatsAppAccountId;exports.o = getWebAuthAgeMs;exports.p = resolveDefaultWebAuthDir;exports.r = resolveWhatsAppAccount;exports.s = logWebSelfId;exports.t = listWhatsAppAccountIds;exports.u = pickWebChannel;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _commandFormatBwqjySih = require("./command-format-BwqjySih.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _promises = _interopRequireDefault(require("node:fs/promises"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/web/auth-store.ts
function resolveDefaultWebAuthDir() {
  return _nodePath.default.join((0, _pathsZQWYGl2V.a)(), "whatsapp", _sessionKeyOcCLUT.t);
}
const WA_WEB_AUTH_DIR = exports.a = resolveDefaultWebAuthDir();
function resolveWebCredsPath(authDir) {
  return _nodePath.default.join(authDir, "creds.json");
}
function resolveWebCredsBackupPath(authDir) {
  return _nodePath.default.join(authDir, "creds.json.bak");
}
function readCredsJsonRaw(filePath) {
  try {
    if (!_nodeFs.default.existsSync(filePath)) return null;
    const stats = _nodeFs.default.statSync(filePath);
    if (!stats.isFile() || stats.size <= 1) return null;
    return _nodeFs.default.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function maybeRestoreCredsFromBackup(authDir) {
  const logger = (0, _registryDWvId1YW.Z)({ module: "web-session" });
  try {
    const credsPath = resolveWebCredsPath(authDir);
    const backupPath = resolveWebCredsBackupPath(authDir);
    const raw = readCredsJsonRaw(credsPath);
    if (raw) {
      JSON.parse(raw);
      return;
    }
    const backupRaw = readCredsJsonRaw(backupPath);
    if (!backupRaw) return;
    JSON.parse(backupRaw);
    _nodeFs.default.copyFileSync(backupPath, credsPath);
    try {
      _nodeFs.default.chmodSync(credsPath, 384);
    } catch {}
    logger.warn({ credsPath }, "restored corrupted WhatsApp creds.json from backup");
  } catch {}
}
async function webAuthExists(authDir = resolveDefaultWebAuthDir()) {
  const resolvedAuthDir = (0, _registryDWvId1YW.j)(authDir);
  maybeRestoreCredsFromBackup(resolvedAuthDir);
  const credsPath = resolveWebCredsPath(resolvedAuthDir);
  try {
    await _promises.default.access(resolvedAuthDir);
  } catch {
    return false;
  }
  try {
    const stats = await _promises.default.stat(credsPath);
    if (!stats.isFile() || stats.size <= 1) return false;
    const raw = await _promises.default.readFile(credsPath, "utf-8");
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}
async function clearLegacyBaileysAuthState(authDir) {
  const entries = await _promises.default.readdir(authDir, { withFileTypes: true });
  const shouldDelete = (name) => {
    if (name === "oauth.json") return false;
    if (name === "creds.json" || name === "creds.json.bak") return true;
    if (!name.endsWith(".json")) return false;
    return /^(app-state-sync|session|sender-key|pre-key)-/.test(name);
  };
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) return;
    if (!shouldDelete(entry.name)) return;
    await _promises.default.rm(_nodePath.default.join(authDir, entry.name), { force: true });
  }));
}
async function logoutWeb(params) {
  const runtime = params.runtime ?? _execEUUDM93d.d;
  const resolvedAuthDir = (0, _registryDWvId1YW.j)(params.authDir ?? resolveDefaultWebAuthDir());
  if (!(await webAuthExists(resolvedAuthDir))) {
    runtime.log((0, _registryDWvId1YW.B)("No WhatsApp Web session found; nothing to delete."));
    return false;
  }
  if (params.isLegacyAuthDir) await clearLegacyBaileysAuthState(resolvedAuthDir);else
  await _promises.default.rm(resolvedAuthDir, {
    recursive: true,
    force: true
  });
  runtime.log((0, _registryDWvId1YW.K)("Cleared WhatsApp Web credentials."));
  return true;
}
function readWebSelfId(authDir = resolveDefaultWebAuthDir()) {
  try {
    const credsPath = resolveWebCredsPath((0, _registryDWvId1YW.j)(authDir));
    if (!_nodeFs.default.existsSync(credsPath)) return {
      e164: null,
      jid: null
    };
    const raw = _nodeFs.default.readFileSync(credsPath, "utf-8");
    const jid = JSON.parse(raw)?.me?.id ?? null;
    return {
      e164: jid ? (0, _registryDWvId1YW.E)(jid, { authDir }) : null,
      jid
    };
  } catch {
    return {
      e164: null,
      jid: null
    };
  }
}
/**
* Return the age (in milliseconds) of the cached WhatsApp web auth state, or null when missing.
* Helpful for heartbeats/observability to spot stale credentials.
*/
function getWebAuthAgeMs(authDir = resolveDefaultWebAuthDir()) {
  try {
    const stats = _nodeFs.default.statSync(resolveWebCredsPath((0, _registryDWvId1YW.j)(authDir)));
    return Date.now() - stats.mtimeMs;
  } catch {
    return null;
  }
}
function logWebSelfId(authDir = resolveDefaultWebAuthDir(), runtime = _execEUUDM93d.d, includeChannelPrefix = false) {
  const { e164, jid } = readWebSelfId(authDir);
  const details = e164 || jid ? `${e164 ?? "unknown"}${jid ? ` (jid ${jid})` : ""}` : "unknown";
  const prefix = includeChannelPrefix ? "Web Channel: " : "";
  runtime.log((0, _registryDWvId1YW.B)(`${prefix}${details}`));
}
async function pickWebChannel(pref, authDir = resolveDefaultWebAuthDir()) {
  const choice = pref === "auto" ? "web" : pref;
  if (!(await webAuthExists(authDir))) throw new Error(`No WhatsApp Web session found. Run \`${(0, _commandFormatBwqjySih.t)("openclaw channels login --channel whatsapp --verbose")}\` to link.`);
  return choice;
}

//#endregion
//#region src/web/accounts.ts
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.whatsapp?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}
function listWhatsAppAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [_sessionKeyOcCLUT.t];
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultWhatsAppAccountId(cfg) {
  const ids = listWhatsAppAccountIds(cfg);
  if (ids.includes(_sessionKeyOcCLUT.t)) return _sessionKeyOcCLUT.t;
  return ids[0] ?? _sessionKeyOcCLUT.t;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.whatsapp?.accounts;
  if (!accounts || typeof accounts !== "object") return;
  return accounts[accountId];
}
function resolveDefaultAuthDir(accountId) {
  return _nodePath.default.join((0, _pathsZQWYGl2V.a)(), "whatsapp", (0, _sessionKeyOcCLUT.c)(accountId));
}
function resolveLegacyAuthDir() {
  return (0, _pathsZQWYGl2V.a)();
}
function legacyAuthExists(authDir) {
  try {
    return _nodeFs.default.existsSync(_nodePath.default.join(authDir, "creds.json"));
  } catch {
    return false;
  }
}
function resolveWhatsAppAuthDir(params) {
  const accountId = params.accountId.trim() || _sessionKeyOcCLUT.t;
  const configured = resolveAccountConfig(params.cfg, accountId)?.authDir?.trim();
  if (configured) return {
    authDir: (0, _registryDWvId1YW.j)(configured),
    isLegacy: false
  };
  const defaultDir = resolveDefaultAuthDir(accountId);
  if (accountId === _sessionKeyOcCLUT.t) {
    const legacyDir = resolveLegacyAuthDir();
    if (legacyAuthExists(legacyDir) && !legacyAuthExists(defaultDir)) return {
      authDir: legacyDir,
      isLegacy: true
    };
  }
  return {
    authDir: defaultDir,
    isLegacy: false
  };
}
function resolveWhatsAppAccount(params) {
  const rootCfg = params.cfg.channels?.whatsapp;
  const accountId = params.accountId?.trim() || resolveDefaultWhatsAppAccountId(params.cfg);
  const accountCfg = resolveAccountConfig(params.cfg, accountId);
  const enabled = accountCfg?.enabled !== false;
  const { authDir, isLegacy } = resolveWhatsAppAuthDir({
    cfg: params.cfg,
    accountId
  });
  return {
    accountId,
    name: accountCfg?.name?.trim() || void 0,
    enabled,
    sendReadReceipts: accountCfg?.sendReadReceipts ?? rootCfg?.sendReadReceipts ?? true,
    messagePrefix: accountCfg?.messagePrefix ?? rootCfg?.messagePrefix ?? params.cfg.messages?.messagePrefix,
    authDir,
    isLegacyAuthDir: isLegacy,
    selfChatMode: accountCfg?.selfChatMode ?? rootCfg?.selfChatMode,
    dmPolicy: accountCfg?.dmPolicy ?? rootCfg?.dmPolicy,
    allowFrom: accountCfg?.allowFrom ?? rootCfg?.allowFrom,
    groupAllowFrom: accountCfg?.groupAllowFrom ?? rootCfg?.groupAllowFrom,
    groupPolicy: accountCfg?.groupPolicy ?? rootCfg?.groupPolicy,
    textChunkLimit: accountCfg?.textChunkLimit ?? rootCfg?.textChunkLimit,
    chunkMode: accountCfg?.chunkMode ?? rootCfg?.chunkMode,
    mediaMaxMb: accountCfg?.mediaMaxMb ?? rootCfg?.mediaMaxMb,
    blockStreaming: accountCfg?.blockStreaming ?? rootCfg?.blockStreaming,
    ackReaction: accountCfg?.ackReaction ?? rootCfg?.ackReaction,
    groups: accountCfg?.groups ?? rootCfg?.groups,
    debounceMs: accountCfg?.debounceMs ?? rootCfg?.debounceMs
  };
}

//#endregion /* v9-5e5d0baf66950801 */
