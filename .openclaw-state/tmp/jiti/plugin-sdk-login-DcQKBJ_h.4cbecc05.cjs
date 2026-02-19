"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = void 0;exports.t = loginWeb;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _configLDeTe_Qk = require("./config-lDeTe_Qk.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _commandFormatBwqjySih = require("./command-format-BwqjySih.js");
var _accountsTvnnV9c = require("./accounts-tvnnV9c4.js");
var _sessionE5Z8GD5J = require("./session-e5Z8GD5J.js");
var _baileys = require("@whiskeysockets/baileys");

//#region src/web/login.ts
var login_exports = exports.n = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({ loginWeb: () => loginWeb });
async function loginWeb(verbose, waitForConnection, runtime = _execEUUDM93d.d, accountId) {
  const wait = waitForConnection ?? _sessionE5Z8GD5J.i;
  const account = (0, _accountsTvnnV9c.r)({
    cfg: (0, _configLDeTe_Qk.n)(),
    accountId
  });
  const sock = await (0, _sessionE5Z8GD5J.t)(true, verbose, { authDir: account.authDir });
  (0, _execEUUDM93d.o)("Waiting for WhatsApp connection...", runtime);
  try {
    await wait(sock);
    console.log((0, _registryDWvId1YW.K)("✅ Linked! Credentials saved for future sends."));
  } catch (err) {
    const code = err?.error?.output?.statusCode ?? err?.output?.statusCode;
    if (code === 515) {
      console.log((0, _registryDWvId1YW.B)("WhatsApp asked for a restart after pairing (code 515); creds are saved. Restarting connection once…"));
      try {
        sock.ws?.close();
      } catch {}
      const retry = await (0, _sessionE5Z8GD5J.t)(false, verbose, { authDir: account.authDir });
      try {
        await wait(retry);
        console.log((0, _registryDWvId1YW.K)("✅ Linked after restart; web session ready."));
        return;
      } finally {
        setTimeout(() => retry.ws?.close(), 500);
      }
    }
    if (code === _baileys.DisconnectReason.loggedOut) {
      await (0, _accountsTvnnV9c.c)({
        authDir: account.authDir,
        isLegacyAuthDir: account.isLegacyAuthDir,
        runtime
      });
      console.error((0, _registryDWvId1YW.z)(`WhatsApp reported the session is logged out. Cleared cached web session; please rerun ${(0, _commandFormatBwqjySih.t)("openclaw channels login")} and scan the QR again.`));
      throw new Error("Session logged out; cache cleared. Re-run login.", { cause: err });
    }
    const formatted = (0, _sessionE5Z8GD5J.n)(err);
    console.error((0, _registryDWvId1YW.z)(`WhatsApp Web connection ended before fully opening. ${formatted}`));
    throw new Error(formatted, { cause: err });
  } finally {
    setTimeout(() => {
      try {
        sock.ws?.close();
      } catch {}
    }, 500);
  }
}

//#endregion /* v9-7a762340b14b8a63 */
