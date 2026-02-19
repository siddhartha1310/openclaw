"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = void 0;exports.t = makeProxyFetch;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _fetchBu6Xem = require("./fetch-Bu6Xem03.js");
var _undici = require("undici");

//#region src/telegram/proxy.ts
var proxy_exports = exports.n = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({ makeProxyFetch: () => makeProxyFetch });
function makeProxyFetch(proxyUrl) {
  const agent = new _undici.ProxyAgent(proxyUrl);
  const fetcher = (input, init) => (0, _undici.fetch)(input, {
    ...init,
    dispatcher: agent
  });
  return (0, _fetchBu6Xem.n)(fetcher);
}

//#endregion /* v9-066aa8ab8aabd198 */
