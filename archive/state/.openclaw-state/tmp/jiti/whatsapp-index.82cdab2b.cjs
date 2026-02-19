"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = void 0;
var _pluginSdk = require("openclaw/plugin-sdk");
var _channel = require("./src/channel.js");
var _runtime = require("./src/runtime.js");

const plugin = {
  id: "whatsapp",
  name: "WhatsApp",
  description: "WhatsApp channel plugin",
  configSchema: (0, _pluginSdk.emptyPluginConfigSchema)(),
  register(api) {
    (0, _runtime.setWhatsAppRuntime)(api.runtime);
    api.registerChannel({ plugin: _channel.whatsappPlugin });
  }
};var _default = exports.default =

plugin; /* v9-5e7a04df202edb77 */
