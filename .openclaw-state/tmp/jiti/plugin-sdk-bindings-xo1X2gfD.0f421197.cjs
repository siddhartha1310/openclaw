"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = listBoundAccountIds;exports.r = resolveDefaultAgentBoundAccountId;exports.t = listBindings;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _agentScopeBCNbpzc = require("./agent-scope-BCNbpzc0.js");

//#region src/routing/bindings.ts
function normalizeBindingChannelId(raw) {
  const normalized = (0, _registryDWvId1YW.o)(raw);
  if (normalized) return normalized;
  return (raw ?? "").trim().toLowerCase() || null;
}
function listBindings(cfg) {
  return Array.isArray(cfg.bindings) ? cfg.bindings : [];
}
function resolveNormalizedBindingMatch(binding) {
  if (!binding || typeof binding !== "object") return null;
  const match = binding.match;
  if (!match || typeof match !== "object") return null;
  const channelId = normalizeBindingChannelId(match.channel);
  if (!channelId) return null;
  const accountId = typeof match.accountId === "string" ? match.accountId.trim() : "";
  if (!accountId || accountId === "*") return null;
  return {
    agentId: (0, _sessionKeyOcCLUT.l)(binding.agentId),
    accountId: (0, _sessionKeyOcCLUT.c)(accountId),
    channelId
  };
}
function listBoundAccountIds(cfg, channelId) {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) return [];
  const ids = /* @__PURE__ */new Set();
  for (const binding of listBindings(cfg)) {
    const resolved = resolveNormalizedBindingMatch(binding);
    if (!resolved || resolved.channelId !== normalizedChannel) continue;
    ids.add(resolved.accountId);
  }
  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultAgentBoundAccountId(cfg, channelId) {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) return null;
  const defaultAgentId = (0, _sessionKeyOcCLUT.l)((0, _agentScopeBCNbpzc.c)(cfg));
  for (const binding of listBindings(cfg)) {
    const resolved = resolveNormalizedBindingMatch(binding);
    if (!resolved || resolved.channelId !== normalizedChannel || resolved.agentId !== defaultAgentId) continue;
    return resolved.accountId;
  }
  return null;
}

//#endregion /* v9-51830aca82f78e96 */
