"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getWhatsAppRuntime = getWhatsAppRuntime;exports.setWhatsAppRuntime = setWhatsAppRuntime;

let runtime = null;

function setWhatsAppRuntime(next) {
  runtime = next;
}

function getWhatsAppRuntime() {
  if (!runtime) {
    throw new Error("WhatsApp runtime not initialized");
  }
  return runtime;
} /* v9-dde103a07a6351e0 */
