"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = isErrno;exports.n = formatErrorMessage;exports.r = formatUncaughtError;exports.t = extractErrorCode;var _redactDLALByE = require("./redact-DLALByE6.js");

//#region src/infra/errors.ts
function extractErrorCode(err) {
  if (!err || typeof err !== "object") return;
  const code = err.code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
}
/**
* Type guard for NodeJS.ErrnoException (any error with a `code` property).
*/
function isErrno(err) {
  return Boolean(err && typeof err === "object" && "code" in err);
}
function formatErrorMessage(err) {
  let formatted;
  if (err instanceof Error) formatted = err.message || err.name || "Error";else
  if (typeof err === "string") formatted = err;else
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") formatted = String(err);else
  try {
    formatted = JSON.stringify(err);
  } catch {
    formatted = Object.prototype.toString.call(err);
  }
  return (0, _redactDLALByE.t)(formatted);
}
function formatUncaughtError(err) {
  if (extractErrorCode(err) === "INVALID_CONFIG") return formatErrorMessage(err);
  if (err instanceof Error) return (0, _redactDLALByE.t)(err.stack ?? err.message ?? err.name);
  return formatErrorMessage(err);
}

//#endregion /* v9-cb1f5d1aabb4e030 */
