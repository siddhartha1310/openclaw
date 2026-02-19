"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = getRemoteSkillEligibility;exports.c = generatePairingToken;exports.d = createAsyncLock;exports.f = readJsonFile;exports.i = void 0;exports.l = pruneExpiredPending;exports.n = listSkillCommandsForWorkspace;exports.o = ensureSkillsWatcher;exports.p = writeJsonAtomic;exports.r = resolveSkillCommandInvocation;exports.s = getSkillsSnapshotVersion;exports.t = listSkillCommandsForAgents;exports.u = resolvePairingPaths;var _rolldownRuntimeCbj13DAv = require("./rolldown-runtime-Cbj13DAv.js");
var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _agentScopeBCNbpzc = require("./agent-scope-BCNbpzc0.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _skillsDMoEBaVr = require("./skills-DMoEBaVr.js");
var _commandsRegistryBZkDBGj = require("./commands-registry-BZkDBGj8.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeOs = _interopRequireDefault(require("node:os"));
var _promises = _interopRequireDefault(require("node:fs/promises"));
var _nodeCrypto = require("node:crypto");
var _chokidar = _interopRequireDefault(require("chokidar"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/infra/json-files.ts
async function readJsonFile(filePath) {
  try {
    const raw = await _promises.default.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writeJsonAtomic(filePath, value, options) {
  const mode = options?.mode ?? 384;
  const dir = _nodePath.default.dirname(filePath);
  await _promises.default.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${(0, _nodeCrypto.randomUUID)()}.tmp`;
  await _promises.default.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  try {
    await _promises.default.chmod(tmp, mode);
  } catch {}
  await _promises.default.rename(tmp, filePath);
  try {
    await _promises.default.chmod(filePath, mode);
  } catch {}
}
function createAsyncLock() {
  let lock = Promise.resolve();
  return async function withLock(fn) {
    const prev = lock;
    let release;
    lock = new Promise((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release?.();
    }
  };
}

//#endregion
//#region src/infra/pairing-files.ts
function resolvePairingPaths(baseDir, subdir) {
  const root = baseDir ?? (0, _pathsZQWYGl2V.s)();
  const dir = _nodePath.default.join(root, subdir);
  return {
    dir,
    pendingPath: _nodePath.default.join(dir, "pending.json"),
    pairedPath: _nodePath.default.join(dir, "paired.json")
  };
}
function pruneExpiredPending(pendingById, nowMs, ttlMs) {
  for (const [id, req] of Object.entries(pendingById)) if (nowMs - req.ts > ttlMs) delete pendingById[id];
}

//#endregion
//#region src/infra/pairing-token.ts
const PAIRING_TOKEN_BYTES = 32;
function generatePairingToken() {
  return (0, _nodeCrypto.randomBytes)(PAIRING_TOKEN_BYTES).toString("base64url");
}

//#endregion
//#region src/agents/skills/refresh.ts
const log$1 = (0, _execEUUDM93d.c)("gateway/skills");
const listeners = /* @__PURE__ */new Set();
const workspaceVersions = /* @__PURE__ */new Map();
const watchers = /* @__PURE__ */new Map();
let globalVersion = 0;
const DEFAULT_SKILLS_WATCH_IGNORED = [
/(^|[\\/])\.git([\\/]|$)/,
/(^|[\\/])node_modules([\\/]|$)/,
/(^|[\\/])dist([\\/]|$)/,
/(^|[\\/])\.venv([\\/]|$)/,
/(^|[\\/])venv([\\/]|$)/,
/(^|[\\/])__pycache__([\\/]|$)/,
/(^|[\\/])\.mypy_cache([\\/]|$)/,
/(^|[\\/])\.pytest_cache([\\/]|$)/,
/(^|[\\/])build([\\/]|$)/,
/(^|[\\/])\.cache([\\/]|$)/];

function bumpVersion(current) {
  const now = Date.now();
  return now <= current ? current + 1 : now;
}
function emit(event) {
  for (const listener of listeners) try {
    listener(event);
  } catch (err) {
    log$1.warn(`skills change listener failed: ${String(err)}`);
  }
}
function resolveWatchPaths(workspaceDir, config) {
  const paths = [];
  if (workspaceDir.trim()) {
    paths.push(_nodePath.default.join(workspaceDir, "skills"));
    paths.push(_nodePath.default.join(workspaceDir, ".agents", "skills"));
  }
  paths.push(_nodePath.default.join(_registryDWvId1YW.g, "skills"));
  paths.push(_nodePath.default.join(_nodeOs.default.homedir(), ".agents", "skills"));
  const extraDirs = (config?.skills?.load?.extraDirs ?? []).map((d) => typeof d === "string" ? d.trim() : "").filter(Boolean).map((dir) => (0, _registryDWvId1YW.j)(dir));
  paths.push(...extraDirs);
  const pluginSkillDirs = (0, _skillsDMoEBaVr.o)({
    workspaceDir,
    config
  });
  paths.push(...pluginSkillDirs);
  return paths;
}
function toWatchGlobRoot(raw) {
  return raw.replaceAll("\\", "/").replace(/\/+$/, "");
}
function resolveWatchTargets(workspaceDir, config) {
  const targets = /* @__PURE__ */new Set();
  for (const root of resolveWatchPaths(workspaceDir, config)) {
    const globRoot = toWatchGlobRoot(root);
    targets.add(`${globRoot}/SKILL.md`);
    targets.add(`${globRoot}/*/SKILL.md`);
  }
  return Array.from(targets).toSorted();
}
function bumpSkillsSnapshotVersion(params) {
  const reason = params?.reason ?? "manual";
  const changedPath = params?.changedPath;
  if (params?.workspaceDir) {
    const next = bumpVersion(workspaceVersions.get(params.workspaceDir) ?? 0);
    workspaceVersions.set(params.workspaceDir, next);
    emit({
      workspaceDir: params.workspaceDir,
      reason,
      changedPath
    });
    return next;
  }
  globalVersion = bumpVersion(globalVersion);
  emit({
    reason,
    changedPath
  });
  return globalVersion;
}
function getSkillsSnapshotVersion(workspaceDir) {
  if (!workspaceDir) return globalVersion;
  const local = workspaceVersions.get(workspaceDir) ?? 0;
  return Math.max(globalVersion, local);
}
function ensureSkillsWatcher(params) {
  const workspaceDir = params.workspaceDir.trim();
  if (!workspaceDir) return;
  const watchEnabled = params.config?.skills?.load?.watch !== false;
  const debounceMsRaw = params.config?.skills?.load?.watchDebounceMs;
  const debounceMs = typeof debounceMsRaw === "number" && Number.isFinite(debounceMsRaw) ? Math.max(0, debounceMsRaw) : 250;
  const existing = watchers.get(workspaceDir);
  if (!watchEnabled) {
    if (existing) {
      watchers.delete(workspaceDir);
      if (existing.timer) clearTimeout(existing.timer);
      existing.watcher.close().catch(() => {});
    }
    return;
  }
  const watchTargets = resolveWatchTargets(workspaceDir, params.config);
  const pathsKey = watchTargets.join("|");
  if (existing && existing.pathsKey === pathsKey && existing.debounceMs === debounceMs) return;
  if (existing) {
    watchers.delete(workspaceDir);
    if (existing.timer) clearTimeout(existing.timer);
    existing.watcher.close().catch(() => {});
  }
  const watcher = _chokidar.default.watch(watchTargets, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceMs,
      pollInterval: 100
    },
    ignored: DEFAULT_SKILLS_WATCH_IGNORED
  });
  const state = {
    watcher,
    pathsKey,
    debounceMs
  };
  const schedule = (changedPath) => {
    state.pendingPath = changedPath ?? state.pendingPath;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      const pendingPath = state.pendingPath;
      state.pendingPath = void 0;
      state.timer = void 0;
      bumpSkillsSnapshotVersion({
        workspaceDir,
        reason: "watch",
        changedPath: pendingPath
      });
    }, debounceMs);
  };
  watcher.on("add", (p) => schedule(p));
  watcher.on("change", (p) => schedule(p));
  watcher.on("unlink", (p) => schedule(p));
  watcher.on("error", (err) => {
    log$1.warn(`skills watcher error (${workspaceDir}): ${String(err)}`);
  });
  watchers.set(workspaceDir, state);
}

//#endregion
//#region src/infra/node-pairing.ts
const PENDING_TTL_MS = 300 * 1e3;
const withLock = createAsyncLock();

//#endregion
//#region src/infra/skills-remote.ts
const log = (0, _execEUUDM93d.c)("gateway/skills-remote");
const remoteNodes = /* @__PURE__ */new Map();
function isMacPlatform(platform, deviceFamily) {
  const platformNorm = String(platform ?? "").trim().toLowerCase();
  const familyNorm = String(deviceFamily ?? "").trim().toLowerCase();
  if (platformNorm.includes("mac")) return true;
  if (platformNorm.includes("darwin")) return true;
  if (familyNorm === "mac") return true;
  return false;
}
function supportsSystemRun(commands) {
  return Array.isArray(commands) && commands.includes("system.run");
}
function getRemoteSkillEligibility() {
  const macNodes = [...remoteNodes.values()].filter((node) => isMacPlatform(node.platform, node.deviceFamily) && supportsSystemRun(node.commands));
  if (macNodes.length === 0) return;
  const bins = /* @__PURE__ */new Set();
  for (const node of macNodes) for (const bin of node.bins) bins.add(bin);
  const labels = macNodes.map((node) => node.displayName ?? node.nodeId).filter(Boolean);
  return {
    platforms: ["darwin"],
    hasBin: (bin) => bins.has(bin),
    hasAnyBin: (required) => required.some((bin) => bins.has(bin)),
    note: labels.length > 0 ? `Remote macOS node available (${labels.join(", ")}). Run macOS-only skills via nodes.run on that node.` : "Remote macOS node available. Run macOS-only skills via nodes.run on that node."
  };
}

//#endregion
//#region src/auto-reply/skill-commands.ts
var skill_commands_exports = exports.i = /* @__PURE__ */(0, _rolldownRuntimeCbj13DAv.t)({
  listSkillCommandsForAgents: () => listSkillCommandsForAgents,
  listSkillCommandsForWorkspace: () => listSkillCommandsForWorkspace,
  resolveSkillCommandInvocation: () => resolveSkillCommandInvocation
});
function resolveReservedCommandNames() {
  const reserved = /* @__PURE__ */new Set();
  for (const command of (0, _commandsRegistryBZkDBGj.i)()) {
    if (command.nativeName) reserved.add(command.nativeName.toLowerCase());
    for (const alias of command.textAliases) {
      const trimmed = alias.trim();
      if (!trimmed.startsWith("/")) continue;
      reserved.add(trimmed.slice(1).toLowerCase());
    }
  }
  return reserved;
}
function listSkillCommandsForWorkspace(params) {
  return (0, _skillsDMoEBaVr.t)(params.workspaceDir, {
    config: params.cfg,
    skillFilter: params.skillFilter,
    eligibility: { remote: getRemoteSkillEligibility() },
    reservedNames: resolveReservedCommandNames()
  });
}
function listSkillCommandsForAgents(params) {
  const used = resolveReservedCommandNames();
  const entries = [];
  const agentIds = params.agentIds ?? (0, _agentScopeBCNbpzc.t)(params.cfg);
  const visitedDirs = /* @__PURE__ */new Set();
  for (const agentId of agentIds) {
    const workspaceDir = (0, _agentScopeBCNbpzc.s)(params.cfg, agentId);
    if (!_nodeFs.default.existsSync(workspaceDir)) continue;
    const canonicalDir = _nodeFs.default.realpathSync(workspaceDir);
    if (visitedDirs.has(canonicalDir)) continue;
    visitedDirs.add(canonicalDir);
    const commands = (0, _skillsDMoEBaVr.t)(workspaceDir, {
      config: params.cfg,
      eligibility: { remote: getRemoteSkillEligibility() },
      reservedNames: used
    });
    for (const command of commands) {
      used.add(command.name.toLowerCase());
      entries.push(command);
    }
  }
  return entries;
}
function normalizeSkillCommandLookup(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function findSkillCommand(skillCommands, rawName) {
  const trimmed = rawName.trim();
  if (!trimmed) return;
  const lowered = trimmed.toLowerCase();
  const normalized = normalizeSkillCommandLookup(trimmed);
  return skillCommands.find((entry) => {
    if (entry.name.toLowerCase() === lowered) return true;
    if (entry.skillName.toLowerCase() === lowered) return true;
    return normalizeSkillCommandLookup(entry.name) === normalized || normalizeSkillCommandLookup(entry.skillName) === normalized;
  });
}
function resolveSkillCommandInvocation(params) {
  const trimmed = params.commandBodyNormalized.trim();
  if (!trimmed.startsWith("/")) return null;
  const match = trimmed.match(/^\/([^\s]+)(?:\s+([\s\S]+))?$/);
  if (!match) return null;
  const commandName = match[1]?.trim().toLowerCase();
  if (!commandName) return null;
  if (commandName === "skill") {
    const remainder = match[2]?.trim();
    if (!remainder) return null;
    const skillMatch = remainder.match(/^([^\s]+)(?:\s+([\s\S]+))?$/);
    if (!skillMatch) return null;
    const skillCommand = findSkillCommand(params.skillCommands, skillMatch[1] ?? "");
    if (!skillCommand) return null;
    return {
      command: skillCommand,
      args: skillMatch[2]?.trim() || void 0
    };
  }
  const command = params.skillCommands.find((entry) => entry.name.toLowerCase() === commandName);
  if (!command) return null;
  return {
    command,
    args: match[2]?.trim() || void 0
  };
}

//#endregion /* v9-43b328dbd6bcba1e */
