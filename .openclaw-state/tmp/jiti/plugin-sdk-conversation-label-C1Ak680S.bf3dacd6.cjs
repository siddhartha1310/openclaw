"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = resolveConversationLabel;exports.t = void 0;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _chatTypeDKb2TlGZ = require("./chat-type-DKb2TlGZ.js");

//#region src/channels/conversation-label.ts
var conversation_label_exports = exports.t = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({ resolveConversationLabel: () => resolveConversationLabel });
function extractConversationId(from) {
  const trimmed = from?.trim();
  if (!trimmed) return;
  const parts = trimmed.split(":").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}
function shouldAppendId(id) {
  if (/^[0-9]+$/.test(id)) return true;
  if (id.includes("@g.us")) return true;
  return false;
}
function resolveConversationLabel(ctx) {
  const explicit = ctx.ConversationLabel?.trim();
  if (explicit) return explicit;
  const threadLabel = ctx.ThreadLabel?.trim();
  if (threadLabel) return threadLabel;
  if ((0, _chatTypeDKb2TlGZ.t)(ctx.ChatType) === "direct") return ctx.SenderName?.trim() || ctx.From?.trim() || void 0;
  const base = ctx.GroupChannel?.trim() || ctx.GroupSubject?.trim() || ctx.GroupSpace?.trim() || ctx.From?.trim() || "";
  if (!base) return;
  const id = extractConversationId(ctx.From);
  if (!id) return base;
  if (!shouldAppendId(id)) return base;
  if (base === id) return base;
  if (base.includes(id)) return base;
  if (base.toLowerCase().includes(" id:")) return base;
  if (base.startsWith("#") || base.startsWith("@")) return base;
  return `${base} id:${id}`;
}

//#endregion /* v9-4207b6c21ee4170b */
