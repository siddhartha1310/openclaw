"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = markdownToWhatsApp;exports.n = sendMessageWhatsApp;exports.r = sendReactionWhatsApp;exports.t = void 0;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _configLDeTe_Qk = require("./config-lDeTe_Qk.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _activeListenerCQwMrN_Y = require("./active-listener-CQwMrN_Y.js");
var _irCG62dJAO = require("./ir-CG62dJAO.js");
var _markdownTablesPIrs3UoH = require("./markdown-tables-PIrs3UoH.js");
var _nodeCrypto = require("node:crypto");

//#region src/markdown/whatsapp.ts
/**
* Convert standard Markdown formatting to WhatsApp-compatible markup.
*
* WhatsApp uses its own formatting syntax:
*   bold:          *text*
*   italic:        _text_
*   strikethrough: ~text~
*   monospace:     ```text```
*
* Standard Markdown uses:
*   bold:          **text** or __text__
*   italic:        *text* or _text_
*   strikethrough: ~~text~~
*   code:          `text` (inline) or ```text``` (block)
*
* The conversion preserves fenced code blocks and inline code,
* then converts bold and strikethrough markers.
*/
/** Placeholder tokens used during conversion to protect code spans. */
const FENCE_PLACEHOLDER = "\0FENCE";
const INLINE_CODE_PLACEHOLDER = "\0CODE";
/**
* Convert standard Markdown bold/italic/strikethrough to WhatsApp formatting.
*
* Order of operations matters:
* 1. Protect fenced code blocks (```...```) — already WhatsApp-compatible
* 2. Protect inline code (`...`) — leave as-is
* 3. Convert **bold** → *bold* and __bold__ → *bold*
* 4. Convert ~~strike~~ → ~strike~
* 5. Restore protected spans
*
* Italic *text* and _text_ are left alone since WhatsApp uses _text_ for italic
* and single * is already WhatsApp bold — no conversion needed for single markers.
*/
function markdownToWhatsApp(text) {
  if (!text) return text;
  const fences = [];
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
    fences.push(match);
    return `${FENCE_PLACEHOLDER}${fences.length - 1}`;
  });
  const inlineCodes = [];
  result = result.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `${INLINE_CODE_PLACEHOLDER}${inlineCodes.length - 1}`;
  });
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");
  result = result.replace(/__(.+?)__/g, "*$1*");
  result = result.replace(/~~(.+?)~~/g, "~$1~");
  result = result.replace(new RegExp(`${(0, _registryDWvId1YW.x)(INLINE_CODE_PLACEHOLDER)}(\\d+)`, "g"), (_, idx) => inlineCodes[Number(idx)] ?? "");
  result = result.replace(new RegExp(`${(0, _registryDWvId1YW.x)(FENCE_PLACEHOLDER)}(\\d+)`, "g"), (_, idx) => fences[Number(idx)] ?? "");
  return result;
}

//#endregion
//#region src/web/outbound.ts
var outbound_exports = exports.t = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({
  sendMessageWhatsApp: () => sendMessageWhatsApp,
  sendPollWhatsApp: () => sendPollWhatsApp,
  sendReactionWhatsApp: () => sendReactionWhatsApp
});
const outboundLog = (0, _execEUUDM93d.c)("gateway/channels/whatsapp").child("outbound");
async function sendMessageWhatsApp(to, body, options) {
  let text = body;
  const correlationId = (0, _nodeCrypto.randomUUID)();
  const startedAt = Date.now();
  const { listener: active, accountId: resolvedAccountId } = (0, _activeListenerCQwMrN_Y.n)(options.accountId);
  const tableMode = (0, _markdownTablesPIrs3UoH.n)({
    cfg: (0, _configLDeTe_Qk.n)(),
    channel: "whatsapp",
    accountId: resolvedAccountId ?? options.accountId
  });
  text = (0, _activeListenerCQwMrN_Y.i)(text ?? "", tableMode);
  text = markdownToWhatsApp(text);
  const logger = (0, _registryDWvId1YW.Z)({
    module: "web-outbound",
    correlationId,
    to
  });
  try {
    const jid = (0, _registryDWvId1YW.L)(to);
    let mediaBuffer;
    let mediaType;
    let documentFileName;
    if (options.mediaUrl) {
      const media = await (0, _irCG62dJAO.a)(options.mediaUrl, { localRoots: options.mediaLocalRoots });
      const caption = text || void 0;
      mediaBuffer = media.buffer;
      mediaType = media.contentType;
      if (media.kind === "audio") mediaType = media.contentType === "audio/ogg" ? "audio/ogg; codecs=opus" : media.contentType ?? "application/octet-stream";else
      if (media.kind === "video") text = caption ?? "";else
      if (media.kind === "image") text = caption ?? "";else
      {
        text = caption ?? "";
        documentFileName = media.fileName;
      }
    }
    outboundLog.info(`Sending message -> ${jid}${options.mediaUrl ? " (media)" : ""}`);
    logger.info({
      jid,
      hasMedia: Boolean(options.mediaUrl)
    }, "sending message");
    await active.sendComposingTo(to);
    const accountId = Boolean(options.accountId?.trim()) ? resolvedAccountId : void 0;
    const sendOptions = options.gifPlayback || accountId || documentFileName ? {
      ...(options.gifPlayback ? { gifPlayback: true } : {}),
      ...(documentFileName ? { fileName: documentFileName } : {}),
      accountId
    } : void 0;
    const messageId = (sendOptions ? await active.sendMessage(to, text, mediaBuffer, mediaType, sendOptions) : await active.sendMessage(to, text, mediaBuffer, mediaType))?.messageId ?? "unknown";
    const durationMs = Date.now() - startedAt;
    outboundLog.info(`Sent message ${messageId} -> ${jid}${options.mediaUrl ? " (media)" : ""} (${durationMs}ms)`);
    logger.info({
      jid,
      messageId
    }, "sent message");
    return {
      messageId,
      toJid: jid
    };
  } catch (err) {
    logger.error({
      err: String(err),
      to,
      hasMedia: Boolean(options.mediaUrl)
    }, "failed to send via web session");
    throw err;
  }
}
async function sendReactionWhatsApp(chatJid, messageId, emoji, options) {
  const correlationId = (0, _nodeCrypto.randomUUID)();
  const { listener: active } = (0, _activeListenerCQwMrN_Y.n)(options.accountId);
  const logger = (0, _registryDWvId1YW.Z)({
    module: "web-outbound",
    correlationId,
    chatJid,
    messageId
  });
  try {
    const jid = (0, _registryDWvId1YW.L)(chatJid);
    outboundLog.info(`Sending reaction "${emoji}" -> message ${messageId}`);
    logger.info({
      chatJid: jid,
      messageId,
      emoji
    }, "sending reaction");
    await active.sendReaction(chatJid, messageId, emoji, options.fromMe ?? false, options.participant);
    outboundLog.info(`Sent reaction "${emoji}" -> message ${messageId}`);
    logger.info({
      chatJid: jid,
      messageId,
      emoji
    }, "sent reaction");
  } catch (err) {
    logger.error({
      err: String(err),
      chatJid,
      messageId,
      emoji
    }, "failed to send reaction via web session");
    throw err;
  }
}
async function sendPollWhatsApp(to, poll, options) {
  const correlationId = (0, _nodeCrypto.randomUUID)();
  const startedAt = Date.now();
  const { listener: active } = (0, _activeListenerCQwMrN_Y.n)(options.accountId);
  const logger = (0, _registryDWvId1YW.Z)({
    module: "web-outbound",
    correlationId,
    to
  });
  try {
    const jid = (0, _registryDWvId1YW.L)(to);
    const normalized = (0, _activeListenerCQwMrN_Y.o)(poll, { maxOptions: 12 });
    outboundLog.info(`Sending poll -> ${jid}: "${normalized.question}"`);
    logger.info({
      jid,
      question: normalized.question,
      optionCount: normalized.options.length,
      maxSelections: normalized.maxSelections
    }, "sending poll");
    const messageId = (await active.sendPoll(to, normalized))?.messageId ?? "unknown";
    const durationMs = Date.now() - startedAt;
    outboundLog.info(`Sent poll ${messageId} -> ${jid} (${durationMs}ms)`);
    logger.info({
      jid,
      messageId
    }, "sent poll");
    return {
      messageId,
      toJid: jid
    };
  } catch (err) {
    logger.error({
      err: String(err),
      to,
      question: poll.question
    }, "failed to send poll via web session");
    throw err;
  }
}

//#endregion /* v9-553eaae4a57d9c3a */
