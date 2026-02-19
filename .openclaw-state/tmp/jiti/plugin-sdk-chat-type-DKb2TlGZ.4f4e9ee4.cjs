"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = normalizeChatType; //#region src/channels/chat-type.ts
function normalizeChatType(raw) {
  const value = raw?.trim().toLowerCase();
  if (!value) return;
  if (value === "direct" || value === "dm") return "direct";
  if (value === "group") return "group";
  if (value === "channel") return "channel";
}

//#endregion /* v9-f7ecd6c48def1218 */
