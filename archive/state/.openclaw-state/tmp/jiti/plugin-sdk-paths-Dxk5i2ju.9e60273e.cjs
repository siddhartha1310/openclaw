"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = resolveSessionTranscriptPathInDir;exports.i = resolveSessionTranscriptPath;exports.n = resolveSessionFilePath;exports.o = resolveSessionTranscriptsDirForAgent;exports.r = resolveSessionFilePathOptions;exports.s = resolveStorePath;exports.t = resolveDefaultSessionStorePath;var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeOs = _interopRequireDefault(require("node:os"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/config/sessions/paths.ts
function resolveAgentSessionsDir(agentId, env = process.env, homedir = () => (0, _pathsZQWYGl2V.u)(env, _nodeOs.default.homedir)) {
  const root = (0, _pathsZQWYGl2V.s)(env, homedir);
  const id = (0, _sessionKeyOcCLUT.l)(agentId ?? _sessionKeyOcCLUT.n);
  return _nodePath.default.join(root, "agents", id, "sessions");
}
function resolveSessionTranscriptsDirForAgent(agentId, env = process.env, homedir = () => (0, _pathsZQWYGl2V.u)(env, _nodeOs.default.homedir)) {
  return resolveAgentSessionsDir(agentId, env, homedir);
}
function resolveDefaultSessionStorePath(agentId) {
  return _nodePath.default.join(resolveAgentSessionsDir(agentId), "sessions.json");
}
function resolveSessionFilePathOptions(params) {
  const agentId = params.agentId?.trim();
  const storePath = params.storePath?.trim();
  if (storePath) {
    const sessionsDir = _nodePath.default.dirname(_nodePath.default.resolve(storePath));
    return agentId ? {
      sessionsDir,
      agentId
    } : { sessionsDir };
  }
  if (agentId) return { agentId };
}
const SAFE_SESSION_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
function validateSessionId(sessionId) {
  const trimmed = sessionId.trim();
  if (!SAFE_SESSION_ID_RE.test(trimmed)) throw new Error(`Invalid session ID: ${sessionId}`);
  return trimmed;
}
function resolveSessionsDir(opts) {
  const sessionsDir = opts?.sessionsDir?.trim();
  if (sessionsDir) return _nodePath.default.resolve(sessionsDir);
  return resolveAgentSessionsDir(opts?.agentId);
}
function resolvePathFromAgentSessionsDir(agentSessionsDir, candidateAbsPath) {
  const agentBase = _nodePath.default.resolve(agentSessionsDir);
  const relative = _nodePath.default.relative(agentBase, candidateAbsPath);
  if (!relative || relative.startsWith("..") || _nodePath.default.isAbsolute(relative)) return;
  return _nodePath.default.resolve(agentBase, relative);
}
function resolveSiblingAgentSessionsDir(baseSessionsDir, agentId) {
  const resolvedBase = _nodePath.default.resolve(baseSessionsDir);
  if (_nodePath.default.basename(resolvedBase) !== "sessions") return;
  const baseAgentDir = _nodePath.default.dirname(resolvedBase);
  const baseAgentsDir = _nodePath.default.dirname(baseAgentDir);
  if (_nodePath.default.basename(baseAgentsDir) !== "agents") return;
  const rootDir = _nodePath.default.dirname(baseAgentsDir);
  return _nodePath.default.join(rootDir, "agents", (0, _sessionKeyOcCLUT.l)(agentId), "sessions");
}
function extractAgentIdFromAbsoluteSessionPath(candidateAbsPath) {
  const parts = _nodePath.default.normalize(_nodePath.default.resolve(candidateAbsPath)).split(_nodePath.default.sep).filter(Boolean);
  const sessionsIndex = parts.lastIndexOf("sessions");
  if (sessionsIndex < 2 || parts[sessionsIndex - 2] !== "agents") return;
  return parts[sessionsIndex - 1] || void 0;
}
function resolvePathWithinSessionsDir(sessionsDir, candidate, opts) {
  const trimmed = candidate.trim();
  if (!trimmed) throw new Error("Session file path must not be empty");
  const resolvedBase = _nodePath.default.resolve(sessionsDir);
  const normalized = _nodePath.default.isAbsolute(trimmed) ? _nodePath.default.relative(resolvedBase, trimmed) : trimmed;
  if (normalized.startsWith("..") && _nodePath.default.isAbsolute(trimmed)) {
    const tryAgentFallback = (agentId) => {
      const normalizedAgentId = (0, _sessionKeyOcCLUT.l)(agentId);
      const siblingSessionsDir = resolveSiblingAgentSessionsDir(resolvedBase, normalizedAgentId);
      if (siblingSessionsDir) {
        const siblingResolved = resolvePathFromAgentSessionsDir(siblingSessionsDir, trimmed);
        if (siblingResolved) return siblingResolved;
      }
      return resolvePathFromAgentSessionsDir(resolveAgentSessionsDir(normalizedAgentId), trimmed);
    };
    const explicitAgentId = opts?.agentId?.trim();
    if (explicitAgentId) {
      const resolvedFromAgent = tryAgentFallback(explicitAgentId);
      if (resolvedFromAgent) return resolvedFromAgent;
    }
    const extractedAgentId = extractAgentIdFromAbsoluteSessionPath(trimmed);
    if (extractedAgentId) {
      const resolvedFromPath = tryAgentFallback(extractedAgentId);
      if (resolvedFromPath) return resolvedFromPath;
    }
  }
  if (!normalized || normalized.startsWith("..") || _nodePath.default.isAbsolute(normalized)) throw new Error("Session file path must be within sessions directory");
  return _nodePath.default.resolve(resolvedBase, normalized);
}
function resolveSessionTranscriptPathInDir(sessionId, sessionsDir, topicId) {
  const safeSessionId = validateSessionId(sessionId);
  const safeTopicId = typeof topicId === "string" ? encodeURIComponent(topicId) : typeof topicId === "number" ? String(topicId) : void 0;
  return resolvePathWithinSessionsDir(sessionsDir, safeTopicId !== void 0 ? `${safeSessionId}-topic-${safeTopicId}.jsonl` : `${safeSessionId}.jsonl`);
}
function resolveSessionTranscriptPath(sessionId, agentId, topicId) {
  return resolveSessionTranscriptPathInDir(sessionId, resolveAgentSessionsDir(agentId), topicId);
}
function resolveSessionFilePath(sessionId, entry, opts) {
  const sessionsDir = resolveSessionsDir(opts);
  const candidate = entry?.sessionFile?.trim();
  if (candidate) return resolvePathWithinSessionsDir(sessionsDir, candidate, { agentId: opts?.agentId });
  return resolveSessionTranscriptPathInDir(sessionId, sessionsDir);
}
function resolveStorePath(store, opts) {
  const agentId = (0, _sessionKeyOcCLUT.l)(opts?.agentId ?? _sessionKeyOcCLUT.n);
  if (!store) return resolveDefaultSessionStorePath(agentId);
  if (store.includes("{agentId}")) {
    const expanded = store.replaceAll("{agentId}", agentId);
    if (expanded.startsWith("~")) return _nodePath.default.resolve((0, _pathsZQWYGl2V.c)(expanded, {
      home: (0, _pathsZQWYGl2V.u)(process.env, _nodeOs.default.homedir),
      env: process.env,
      homedir: _nodeOs.default.homedir
    }));
    return _nodePath.default.resolve(expanded);
  }
  if (store.startsWith("~")) return _nodePath.default.resolve((0, _pathsZQWYGl2V.c)(store, {
    home: (0, _pathsZQWYGl2V.u)(process.env, _nodeOs.default.homedir),
    env: process.env,
    homedir: _nodeOs.default.homedir
  }));
  return _nodePath.default.resolve(store);
}

//#endregion /* v9-565f5e18f004a4a6 */
