"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = void 0;exports.r = isSilentReplyText;exports.t = void 0;var _registryDWvId1YW = require("./registry-DWvId1YW.js");

//#region src/auto-reply/tokens.ts
const HEARTBEAT_TOKEN = exports.t = "HEARTBEAT_OK";
const SILENT_REPLY_TOKEN = exports.n = "NO_REPLY";
function isSilentReplyText(text, token = SILENT_REPLY_TOKEN) {
  if (!text) return false;
  const escaped = (0, _registryDWvId1YW.x)(token);
  if (new RegExp(`^\\s*${escaped}(?=$|\\W)`).test(text)) return true;
  return new RegExp(`\\b${escaped}\\b\\W*$`).test(text);
}

//#endregion /* v9-df148609b6bdc5e1 */
