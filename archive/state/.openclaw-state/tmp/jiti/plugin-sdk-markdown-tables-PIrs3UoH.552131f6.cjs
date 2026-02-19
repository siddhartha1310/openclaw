"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = resolveMarkdownTableMode;exports.t = void 0;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _pluginsBFQak9Mg = require("./plugins-BFQak9Mg.js");

//#region src/config/markdown-tables.ts
var markdown_tables_exports = exports.t = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({ resolveMarkdownTableMode: () => resolveMarkdownTableMode });
const DEFAULT_TABLE_MODES = new Map([["signal", "bullets"], ["whatsapp", "bullets"]]);
const isMarkdownTableMode = (value) => value === "off" || value === "bullets" || value === "code";
function resolveMarkdownModeFromSection(section, accountId) {
  if (!section) return;
  const normalizedAccountId = (0, _sessionKeyOcCLUT.c)(accountId);
  const accounts = section.accounts;
  if (accounts && typeof accounts === "object") {
    const directMode = accounts[normalizedAccountId]?.markdown?.tables;
    if (isMarkdownTableMode(directMode)) return directMode;
    const matchKey = Object.keys(accounts).find((key) => key.toLowerCase() === normalizedAccountId.toLowerCase());
    const matchMode = (matchKey ? accounts[matchKey] : void 0)?.markdown?.tables;
    if (isMarkdownTableMode(matchMode)) return matchMode;
  }
  const sectionMode = section.markdown?.tables;
  return isMarkdownTableMode(sectionMode) ? sectionMode : void 0;
}
function resolveMarkdownTableMode(params) {
  const channel = (0, _pluginsBFQak9Mg.r)(params.channel);
  const defaultMode = channel ? DEFAULT_TABLE_MODES.get(channel) ?? "code" : "code";
  if (!channel || !params.cfg) return defaultMode;
  return resolveMarkdownModeFromSection(params.cfg.channels?.[channel] ?? params.cfg?.[channel], params.accountId) ?? defaultMode;
}

//#endregion /* v9-4abe70647ff7f81c */
