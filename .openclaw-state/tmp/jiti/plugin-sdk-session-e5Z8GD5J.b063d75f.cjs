"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = waitForWaConnection;exports.n = formatError;exports.r = getStatusCode;exports.t = createWaSocket;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _configLDeTe_Qk = require("./config-lDeTe_Qk.js");
var _commandFormatBwqjySih = require("./command-format-BwqjySih.js");
var _accountsTvnnV9c = require("./accounts-tvnnV9c4.js");
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeCrypto = require("node:crypto");
var _baileys = require("@whiskeysockets/baileys");
var _qrcodeTerminal = _interopRequireDefault(require("qrcode-terminal"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/web/session.ts
let credsSaveQueue = Promise.resolve();
function enqueueSaveCreds(authDir, saveCreds, logger) {
  credsSaveQueue = credsSaveQueue.then(() => safeSaveCreds(authDir, saveCreds, logger)).catch((err) => {
    logger.warn({ error: String(err) }, "WhatsApp creds save queue error");
  });
}
async function safeSaveCreds(authDir, saveCreds, logger) {
  try {
    const credsPath = (0, _accountsTvnnV9c.h)(authDir);
    const backupPath = (0, _accountsTvnnV9c.m)(authDir);
    const raw = (0, _accountsTvnnV9c.d)(credsPath);
    if (raw) try {
      JSON.parse(raw);
      _nodeFs.default.copyFileSync(credsPath, backupPath);
      try {
        _nodeFs.default.chmodSync(backupPath, 384);
      } catch {}
    } catch {}
  } catch {}
  try {
    await Promise.resolve(saveCreds());
    try {
      _nodeFs.default.chmodSync((0, _accountsTvnnV9c.h)(authDir), 384);
    } catch {}
  } catch (err) {
    logger.warn({ error: String(err) }, "failed saving WhatsApp creds");
  }
}
/**
* Create a Baileys socket backed by the multi-file auth store we keep on disk.
* Consumers can opt into QR printing for interactive login flows.
*/
async function createWaSocket(printQr, verbose, opts = {}) {
  const logger = (0, _registryDWvId1YW.tt)((0, _registryDWvId1YW.Z)({ module: "baileys" }, { level: verbose ? "info" : "silent" }), verbose ? "info" : "silent");
  const authDir = (0, _registryDWvId1YW.j)(opts.authDir ?? (0, _accountsTvnnV9c.p)());
  await (0, _registryDWvId1YW.b)(authDir);
  const sessionLogger = (0, _registryDWvId1YW.Z)({ module: "web-session" });
  (0, _accountsTvnnV9c.l)(authDir);
  const { state, saveCreds } = await (0, _baileys.useMultiFileAuthState)(authDir);
  const { version } = await (0, _baileys.fetchLatestBaileysVersion)();
  const sock = (0, _baileys.makeWASocket)({
    auth: {
      creds: state.creds,
      keys: (0, _baileys.makeCacheableSignalKeyStore)(state.keys, logger)
    },
    version,
    logger,
    printQRInTerminal: false,
    browser: [
    "openclaw",
    "cli",
    _configLDeTe_Qk.v],

    syncFullHistory: false,
    markOnlineOnConnect: false
  });
  sock.ev.on("creds.update", () => enqueueSaveCreds(authDir, saveCreds, sessionLogger));
  sock.ev.on("connection.update", (update) => {
    try {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        opts.onQr?.(qr);
        if (printQr) {
          console.log("Scan this QR in WhatsApp (Linked Devices):");
          _qrcodeTerminal.default.generate(qr, { small: true });
        }
      }
      if (connection === "close") {
        if (getStatusCode(lastDisconnect?.error) === _baileys.DisconnectReason.loggedOut) console.error((0, _registryDWvId1YW.z)(`WhatsApp session logged out. Run: ${(0, _commandFormatBwqjySih.t)("openclaw channels login")}`));
      }
      if (connection === "open" && verbose) console.log((0, _registryDWvId1YW.K)("WhatsApp Web connected."));
    } catch (err) {
      sessionLogger.error({ error: String(err) }, "connection.update handler error");
    }
  });
  if (sock.ws && typeof sock.ws.on === "function") sock.ws.on("error", (err) => {
    sessionLogger.error({ error: String(err) }, "WebSocket error");
  });
  return sock;
}
async function waitForWaConnection(sock) {
  return new Promise((resolve, reject) => {
    const evWithOff = sock.ev;
    const handler = (...args) => {
      const update = args[0] ?? {};
      if (update.connection === "open") {
        evWithOff.off?.("connection.update", handler);
        resolve();
      }
      if (update.connection === "close") {
        evWithOff.off?.("connection.update", handler);
        reject(update.lastDisconnect ?? /* @__PURE__ */new Error("Connection closed"));
      }
    };
    sock.ev.on("connection.update", handler);
  });
}
function getStatusCode(err) {
  return err?.output?.statusCode ?? err?.status;
}
function safeStringify(value, limit = 800) {
  try {
    const seen = /* @__PURE__ */new WeakSet();
    const raw = JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "function") {
        const maybeName = v.name;
        return `[Function ${typeof maybeName === "string" && maybeName.length > 0 ? maybeName : "anonymous"}]`;
      }
      if (typeof v === "object" && v) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    }, 2);
    if (!raw) return String(value);
    return raw.length > limit ? `${raw.slice(0, limit)}…` : raw;
  } catch {
    return String(value);
  }
}
function extractBoomDetails(err) {
  if (!err || typeof err !== "object") return null;
  const output = err?.output;
  if (!output || typeof output !== "object") return null;
  const payload = output.payload;
  const statusCode = typeof output.statusCode === "number" ? output.statusCode : typeof payload?.statusCode === "number" ? payload.statusCode : void 0;
  const error = typeof payload?.error === "string" ? payload.error : void 0;
  const message = typeof payload?.message === "string" ? payload.message : void 0;
  if (!statusCode && !error && !message) return null;
  return {
    statusCode,
    error,
    message
  };
}
function formatError(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (!err || typeof err !== "object") return String(err);
  const boom = extractBoomDetails(err) ?? extractBoomDetails(err?.error) ?? extractBoomDetails(err?.lastDisconnect?.error);
  const status = boom?.statusCode ?? getStatusCode(err);
  const code = err?.code;
  const codeText = typeof code === "string" || typeof code === "number" ? String(code) : void 0;
  const message = [
  boom?.message,
  typeof err?.message === "string" ? err.message : void 0,
  typeof err?.error?.message === "string" ? err.error?.message : void 0].
  filter((v) => Boolean(v && v.trim().length > 0))[0];
  const pieces = [];
  if (typeof status === "number") pieces.push(`status=${status}`);
  if (boom?.error) pieces.push(boom.error);
  if (message) pieces.push(message);
  if (codeText) pieces.push(`code=${codeText}`);
  if (pieces.length > 0) return pieces.join(" ");
  return safeStringify(err);
}

//#endregion /* v9-e12b7f5833420f03 */
