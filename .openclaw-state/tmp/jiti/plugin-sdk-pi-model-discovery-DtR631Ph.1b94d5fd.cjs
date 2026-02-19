"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = discoverModels;exports.r = void 0;exports.t = discoverAuthStorage;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _piCodingAgent = require("@mariozechner/pi-coding-agent");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/agents/pi-model-discovery.ts
var pi_model_discovery_exports = exports.r = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({
  AuthStorage: () => _piCodingAgent.AuthStorage,
  ModelRegistry: () => _piCodingAgent.ModelRegistry,
  discoverAuthStorage: () => discoverAuthStorage,
  discoverModels: () => discoverModels
});
function discoverAuthStorage(agentDir) {
  return new _piCodingAgent.AuthStorage(_nodePath.default.join(agentDir, "auth.json"));
}
function discoverModels(authStorage, agentDir) {
  return new _piCodingAgent.ModelRegistry(authStorage, _nodePath.default.join(agentDir, "models.json"));
}

//#endregion /* v9-c420bf5fffca19a6 */
