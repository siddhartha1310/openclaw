"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = parseBooleanValue;exports.t = isTruthyEnvValue;var _execEUUDM93d = require("./exec-eUUDM93d.js");

//#region src/utils/boolean.ts
const DEFAULT_TRUTHY = [
"true",
"1",
"yes",
"on"];

const DEFAULT_FALSY = [
"false",
"0",
"no",
"off"];

const DEFAULT_TRUTHY_SET = new Set(DEFAULT_TRUTHY);
const DEFAULT_FALSY_SET = new Set(DEFAULT_FALSY);
function parseBooleanValue(value, options = {}) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return;
  const truthy = options.truthy ?? DEFAULT_TRUTHY;
  const falsy = options.falsy ?? DEFAULT_FALSY;
  const truthySet = truthy === DEFAULT_TRUTHY ? DEFAULT_TRUTHY_SET : new Set(truthy);
  const falsySet = falsy === DEFAULT_FALSY ? DEFAULT_FALSY_SET : new Set(falsy);
  if (truthySet.has(normalized)) return true;
  if (falsySet.has(normalized)) return false;
}

//#endregion
//#region src/infra/env.ts
const log = (0, _execEUUDM93d.c)("env");
function isTruthyEnvValue(value) {
  return parseBooleanValue(value) === true;
}

//#endregion /* v9-a497c33fb721d951 */
