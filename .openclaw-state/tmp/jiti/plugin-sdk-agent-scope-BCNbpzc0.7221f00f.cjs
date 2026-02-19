"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.C = resolveOpenClawPackageRootSync;exports.S = resolveOpenClawPackageRoot;exports._ = void 0;exports.a = resolveAgentModelPrimary;exports.b = filterBootstrapFilesForSession;exports.c = resolveDefaultAgentId;exports.h = exports.g = exports.f = exports.d = void 0;exports.i = resolveAgentModelFallbacksOverride;exports.l = resolveSessionAgentId;exports.m = void 0;exports.n = resolveAgentConfig;exports.o = resolveAgentSkillsFilter;exports.p = void 0;exports.r = resolveAgentDir;exports.s = resolveAgentWorkspaceDir;exports.t = listAgentIds;exports.u = resolveSessionAgentIds;exports.v = void 0;exports.w = normalizeSkillFilter;exports.x = loadWorkspaceBootstrapFiles;exports.y = ensureAgentWorkspace;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeOs = _interopRequireDefault(require("node:os"));
var _promises = _interopRequireDefault(require("node:fs/promises"));
var _nodeUrl = require("node:url");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/agents/skills/filter.ts
function normalizeSkillFilter(skillFilter) {
  if (skillFilter === void 0) return;
  return skillFilter.map((entry) => String(entry).trim()).filter(Boolean);
}

//#endregion
//#region src/infra/openclaw-root.ts
const CORE_PACKAGE_NAMES = new Set(["openclaw"]);
async function readPackageName(dir) {
  try {
    const raw = await _promises.default.readFile(_nodePath.default.join(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}
function readPackageNameSync(dir) {
  try {
    const raw = _nodeFs.default.readFileSync(_nodePath.default.join(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}
async function findPackageRoot(startDir, maxDepth = 12) {
  let current = _nodePath.default.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const name = await readPackageName(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) return current;
    const parent = _nodePath.default.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
function findPackageRootSync(startDir, maxDepth = 12) {
  let current = _nodePath.default.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const name = readPackageNameSync(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) return current;
    const parent = _nodePath.default.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
function candidateDirsFromArgv1(argv1) {
  const normalized = _nodePath.default.resolve(argv1);
  const candidates = [_nodePath.default.dirname(normalized)];
  try {
    const resolved = _nodeFs.default.realpathSync(normalized);
    if (resolved !== normalized) candidates.push(_nodePath.default.dirname(resolved));
  } catch {}
  const parts = normalized.split(_nodePath.default.sep);
  const binIndex = parts.lastIndexOf(".bin");
  if (binIndex > 0 && parts[binIndex - 1] === "node_modules") {
    const binName = _nodePath.default.basename(normalized);
    const nodeModulesDir = parts.slice(0, binIndex).join(_nodePath.default.sep);
    candidates.push(_nodePath.default.join(nodeModulesDir, binName));
  }
  return candidates;
}
async function resolveOpenClawPackageRoot(opts) {
  for (const candidate of buildCandidates(opts)) {
    const found = await findPackageRoot(candidate);
    if (found) return found;
  }
  return null;
}
function resolveOpenClawPackageRootSync(opts) {
  for (const candidate of buildCandidates(opts)) {
    const found = findPackageRootSync(candidate);
    if (found) return found;
  }
  return null;
}
function buildCandidates(opts) {
  const candidates = [];
  if (opts.moduleUrl) candidates.push(_nodePath.default.dirname((0, _nodeUrl.fileURLToPath)(opts.moduleUrl)));
  if (opts.argv1) candidates.push(...candidateDirsFromArgv1(opts.argv1));
  if (opts.cwd) candidates.push(opts.cwd);
  return candidates;
}

//#endregion
//#region src/agents/workspace-templates.ts
const FALLBACK_TEMPLATE_DIR = _nodePath.default.resolve(_nodePath.default.dirname((0, _nodeUrl.fileURLToPath)("file:///D:/workspace/appDev/openclaw/dist/dist/plugin-sdk/agent-scope-BCNbpzc0.js")), "../../docs/reference/templates");
let cachedTemplateDir;
let resolvingTemplateDir;
async function resolveWorkspaceTemplateDir(opts) {
  if (cachedTemplateDir) return cachedTemplateDir;
  if (resolvingTemplateDir) return resolvingTemplateDir;
  resolvingTemplateDir = (async () => {
    const moduleUrl = opts?.moduleUrl ?? "file:///D:/workspace/appDev/openclaw/dist/dist/plugin-sdk/agent-scope-BCNbpzc0.js";
    const argv1 = opts?.argv1 ?? process.argv[1];
    const cwd = opts?.cwd ?? process.cwd();
    const packageRoot = await resolveOpenClawPackageRoot({
      moduleUrl,
      argv1,
      cwd
    });
    const candidates = [
    packageRoot ? _nodePath.default.join(packageRoot, "docs", "reference", "templates") : null,
    cwd ? _nodePath.default.resolve(cwd, "docs", "reference", "templates") : null,
    FALLBACK_TEMPLATE_DIR].
    filter(Boolean);
    for (const candidate of candidates) if (await (0, _registryDWvId1YW.O)(candidate)) {
      cachedTemplateDir = candidate;
      return candidate;
    }
    cachedTemplateDir = candidates[0] ?? FALLBACK_TEMPLATE_DIR;
    return cachedTemplateDir;
  })();
  try {
    return await resolvingTemplateDir;
  } finally {
    resolvingTemplateDir = void 0;
  }
}

//#endregion
//#region src/agents/workspace.ts
function resolveDefaultAgentWorkspaceDir(env = process.env, homedir = _nodeOs.default.homedir) {
  const home = (0, _pathsZQWYGl2V.u)(env, homedir);
  const profile = env.OPENCLAW_PROFILE?.trim();
  if (profile && profile.toLowerCase() !== "default") return _nodePath.default.join(home, ".openclaw", `workspace-${profile}`);
  return _nodePath.default.join(home, ".openclaw", "workspace");
}
const DEFAULT_AGENT_WORKSPACE_DIR = exports.f = resolveDefaultAgentWorkspaceDir();
const DEFAULT_AGENTS_FILENAME = exports.d = "AGENTS.md";
const DEFAULT_SOUL_FILENAME = exports.g = "SOUL.md";
const DEFAULT_TOOLS_FILENAME = exports._ = "TOOLS.md";
const DEFAULT_IDENTITY_FILENAME = exports.h = "IDENTITY.md";
const DEFAULT_USER_FILENAME = exports.v = "USER.md";
const DEFAULT_HEARTBEAT_FILENAME = exports.m = "HEARTBEAT.md";
const DEFAULT_BOOTSTRAP_FILENAME = exports.p = "BOOTSTRAP.md";
const DEFAULT_MEMORY_FILENAME = "MEMORY.md";
const DEFAULT_MEMORY_ALT_FILENAME = "memory.md";
const WORKSPACE_STATE_DIRNAME = ".openclaw";
const WORKSPACE_STATE_FILENAME = "workspace-state.json";
const WORKSPACE_STATE_VERSION = 1;
const workspaceTemplateCache = /* @__PURE__ */new Map();
let gitAvailabilityPromise = null;
function stripFrontMatter(content) {
  if (!content.startsWith("---")) return content;
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return content;
  const start = endIndex + 4;
  let trimmed = content.slice(start);
  trimmed = trimmed.replace(/^\s+/, "");
  return trimmed;
}
async function loadTemplate(name) {
  const cached = workspaceTemplateCache.get(name);
  if (cached) return cached;
  const pending = (async () => {
    const templateDir = await resolveWorkspaceTemplateDir();
    const templatePath = _nodePath.default.join(templateDir, name);
    try {
      return stripFrontMatter(await _promises.default.readFile(templatePath, "utf-8"));
    } catch {
      throw new Error(`Missing workspace template: ${name} (${templatePath}). Ensure docs/reference/templates are packaged.`);
    }
  })();
  workspaceTemplateCache.set(name, pending);
  try {
    return await pending;
  } catch (error) {
    workspaceTemplateCache.delete(name);
    throw error;
  }
}
async function writeFileIfMissing(filePath, content) {
  try {
    await _promises.default.writeFile(filePath, content, {
      encoding: "utf-8",
      flag: "wx"
    });
    return true;
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    return false;
  }
}
async function fileExists(filePath) {
  try {
    await _promises.default.access(filePath);
    return true;
  } catch {
    return false;
  }
}
function resolveWorkspaceStatePath(dir) {
  return _nodePath.default.join(dir, WORKSPACE_STATE_DIRNAME, WORKSPACE_STATE_FILENAME);
}
function parseWorkspaceOnboardingState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      version: WORKSPACE_STATE_VERSION,
      bootstrapSeededAt: typeof parsed.bootstrapSeededAt === "string" ? parsed.bootstrapSeededAt : void 0,
      onboardingCompletedAt: typeof parsed.onboardingCompletedAt === "string" ? parsed.onboardingCompletedAt : void 0
    };
  } catch {
    return null;
  }
}
async function readWorkspaceOnboardingState(statePath) {
  try {
    return parseWorkspaceOnboardingState(await _promises.default.readFile(statePath, "utf-8")) ?? { version: WORKSPACE_STATE_VERSION };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    return { version: WORKSPACE_STATE_VERSION };
  }
}
async function writeWorkspaceOnboardingState(statePath, state) {
  await _promises.default.mkdir(_nodePath.default.dirname(statePath), { recursive: true });
  const payload = `${JSON.stringify(state, null, 2)}\n`;
  const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now().toString(36)}`;
  try {
    await _promises.default.writeFile(tmpPath, payload, { encoding: "utf-8" });
    await _promises.default.rename(tmpPath, statePath);
  } catch (err) {
    await _promises.default.unlink(tmpPath).catch(() => {});
    throw err;
  }
}
async function hasGitRepo(dir) {
  try {
    await _promises.default.stat(_nodePath.default.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}
async function isGitAvailable() {
  if (gitAvailabilityPromise) return gitAvailabilityPromise;
  gitAvailabilityPromise = (async () => {
    try {
      return (await (0, _execEUUDM93d.t)(["git", "--version"], { timeoutMs: 2e3 })).code === 0;
    } catch {
      return false;
    }
  })();
  return gitAvailabilityPromise;
}
async function ensureGitRepo(dir, isBrandNewWorkspace) {
  if (!isBrandNewWorkspace) return;
  if (await hasGitRepo(dir)) return;
  if (!(await isGitAvailable())) return;
  try {
    await (0, _execEUUDM93d.t)(["git", "init"], {
      cwd: dir,
      timeoutMs: 1e4
    });
  } catch {}
}
async function ensureAgentWorkspace(params) {
  const dir = (0, _registryDWvId1YW.j)(params?.dir?.trim() ? params.dir.trim() : DEFAULT_AGENT_WORKSPACE_DIR);
  await _promises.default.mkdir(dir, { recursive: true });
  if (!params?.ensureBootstrapFiles) return { dir };
  const agentsPath = _nodePath.default.join(dir, DEFAULT_AGENTS_FILENAME);
  const soulPath = _nodePath.default.join(dir, DEFAULT_SOUL_FILENAME);
  const toolsPath = _nodePath.default.join(dir, DEFAULT_TOOLS_FILENAME);
  const identityPath = _nodePath.default.join(dir, DEFAULT_IDENTITY_FILENAME);
  const userPath = _nodePath.default.join(dir, DEFAULT_USER_FILENAME);
  const heartbeatPath = _nodePath.default.join(dir, DEFAULT_HEARTBEAT_FILENAME);
  const bootstrapPath = _nodePath.default.join(dir, DEFAULT_BOOTSTRAP_FILENAME);
  const statePath = resolveWorkspaceStatePath(dir);
  const isBrandNewWorkspace = await (async () => {
    const paths = [
    agentsPath,
    soulPath,
    toolsPath,
    identityPath,
    userPath,
    heartbeatPath];

    return (await Promise.all(paths.map(async (p) => {
      try {
        await _promises.default.access(p);
        return true;
      } catch {
        return false;
      }
    }))).every((v) => !v);
  })();
  const agentsTemplate = await loadTemplate(DEFAULT_AGENTS_FILENAME);
  const soulTemplate = await loadTemplate(DEFAULT_SOUL_FILENAME);
  const toolsTemplate = await loadTemplate(DEFAULT_TOOLS_FILENAME);
  const identityTemplate = await loadTemplate(DEFAULT_IDENTITY_FILENAME);
  const userTemplate = await loadTemplate(DEFAULT_USER_FILENAME);
  const heartbeatTemplate = await loadTemplate(DEFAULT_HEARTBEAT_FILENAME);
  await writeFileIfMissing(agentsPath, agentsTemplate);
  await writeFileIfMissing(soulPath, soulTemplate);
  await writeFileIfMissing(toolsPath, toolsTemplate);
  await writeFileIfMissing(identityPath, identityTemplate);
  await writeFileIfMissing(userPath, userTemplate);
  await writeFileIfMissing(heartbeatPath, heartbeatTemplate);
  let state = await readWorkspaceOnboardingState(statePath);
  let stateDirty = false;
  const markState = (next) => {
    state = {
      ...state,
      ...next
    };
    stateDirty = true;
  };
  const nowIso = () => (/* @__PURE__ */new Date()).toISOString();
  let bootstrapExists = await fileExists(bootstrapPath);
  if (!state.bootstrapSeededAt && bootstrapExists) markState({ bootstrapSeededAt: nowIso() });
  if (!state.onboardingCompletedAt && state.bootstrapSeededAt && !bootstrapExists) markState({ onboardingCompletedAt: nowIso() });
  if (!state.bootstrapSeededAt && !state.onboardingCompletedAt && !bootstrapExists) {
    const [identityContent, userContent] = await Promise.all([_promises.default.readFile(identityPath, "utf-8"), _promises.default.readFile(userPath, "utf-8")]);
    if (identityContent !== identityTemplate || userContent !== userTemplate) markState({ onboardingCompletedAt: nowIso() });else
    {
      if (!(await writeFileIfMissing(bootstrapPath, await loadTemplate(DEFAULT_BOOTSTRAP_FILENAME)))) bootstrapExists = await fileExists(bootstrapPath);else
      bootstrapExists = true;
      if (bootstrapExists && !state.bootstrapSeededAt) markState({ bootstrapSeededAt: nowIso() });
    }
  }
  if (stateDirty) await writeWorkspaceOnboardingState(statePath, state);
  await ensureGitRepo(dir, isBrandNewWorkspace);
  return {
    dir,
    agentsPath,
    soulPath,
    toolsPath,
    identityPath,
    userPath,
    heartbeatPath,
    bootstrapPath
  };
}
async function resolveMemoryBootstrapEntries(resolvedDir) {
  const candidates = [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME];
  const entries = [];
  for (const name of candidates) {
    const filePath = _nodePath.default.join(resolvedDir, name);
    try {
      await _promises.default.access(filePath);
      entries.push({
        name,
        filePath
      });
    } catch {}
  }
  if (entries.length <= 1) return entries;
  const seen = /* @__PURE__ */new Set();
  const deduped = [];
  for (const entry of entries) {
    let key = entry.filePath;
    try {
      key = await _promises.default.realpath(entry.filePath);
    } catch {}
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}
async function loadWorkspaceBootstrapFiles(dir) {
  const resolvedDir = (0, _registryDWvId1YW.j)(dir);
  const entries = [
  {
    name: DEFAULT_AGENTS_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_AGENTS_FILENAME)
  },
  {
    name: DEFAULT_SOUL_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_SOUL_FILENAME)
  },
  {
    name: DEFAULT_TOOLS_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_TOOLS_FILENAME)
  },
  {
    name: DEFAULT_IDENTITY_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_IDENTITY_FILENAME)
  },
  {
    name: DEFAULT_USER_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_USER_FILENAME)
  },
  {
    name: DEFAULT_HEARTBEAT_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_HEARTBEAT_FILENAME)
  },
  {
    name: DEFAULT_BOOTSTRAP_FILENAME,
    filePath: _nodePath.default.join(resolvedDir, DEFAULT_BOOTSTRAP_FILENAME)
  }];

  entries.push(...(await resolveMemoryBootstrapEntries(resolvedDir)));
  const result = [];
  for (const entry of entries) try {
    const content = await _promises.default.readFile(entry.filePath, "utf-8");
    result.push({
      name: entry.name,
      path: entry.filePath,
      content,
      missing: false
    });
  } catch {
    result.push({
      name: entry.name,
      path: entry.filePath,
      missing: true
    });
  }
  return result;
}
const MINIMAL_BOOTSTRAP_ALLOWLIST = new Set([DEFAULT_AGENTS_FILENAME, DEFAULT_TOOLS_FILENAME]);
function filterBootstrapFilesForSession(files, sessionKey) {
  if (!sessionKey || !(0, _sessionKeyOcCLUT._)(sessionKey) && !(0, _sessionKeyOcCLUT.g)(sessionKey)) return files;
  return files.filter((file) => MINIMAL_BOOTSTRAP_ALLOWLIST.has(file.name));
}

//#endregion
//#region src/agents/agent-scope.ts
let defaultAgentWarned = false;
function listAgents(cfg) {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) return [];
  return list.filter((entry) => Boolean(entry && typeof entry === "object"));
}
function listAgentIds(cfg) {
  const agents = listAgents(cfg);
  if (agents.length === 0) return [_sessionKeyOcCLUT.n];
  const seen = /* @__PURE__ */new Set();
  const ids = [];
  for (const entry of agents) {
    const id = (0, _sessionKeyOcCLUT.l)(entry?.id);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [_sessionKeyOcCLUT.n];
}
function resolveDefaultAgentId(cfg) {
  const agents = listAgents(cfg);
  if (agents.length === 0) return _sessionKeyOcCLUT.n;
  const defaults = agents.filter((agent) => agent?.default);
  if (defaults.length > 1 && !defaultAgentWarned) {
    defaultAgentWarned = true;
    console.warn("Multiple agents marked default=true; using the first entry as default.");
  }
  const chosen = (defaults[0] ?? agents[0])?.id?.trim();
  return (0, _sessionKeyOcCLUT.l)(chosen || _sessionKeyOcCLUT.n);
}
function resolveSessionAgentIds(params) {
  const defaultAgentId = resolveDefaultAgentId(params.config ?? {});
  const sessionKey = params.sessionKey?.trim();
  const normalizedSessionKey = sessionKey ? sessionKey.toLowerCase() : void 0;
  const parsed = normalizedSessionKey ? (0, _sessionKeyOcCLUT.v)(normalizedSessionKey) : null;
  return {
    defaultAgentId,
    sessionAgentId: parsed?.agentId ? (0, _sessionKeyOcCLUT.l)(parsed.agentId) : defaultAgentId
  };
}
function resolveSessionAgentId(params) {
  return resolveSessionAgentIds(params).sessionAgentId;
}
function resolveAgentEntry(cfg, agentId) {
  const id = (0, _sessionKeyOcCLUT.l)(agentId);
  return listAgents(cfg).find((entry) => (0, _sessionKeyOcCLUT.l)(entry.id) === id);
}
function resolveAgentConfig(cfg, agentId) {
  const entry = resolveAgentEntry(cfg, (0, _sessionKeyOcCLUT.l)(agentId));
  if (!entry) return;
  return {
    name: typeof entry.name === "string" ? entry.name : void 0,
    workspace: typeof entry.workspace === "string" ? entry.workspace : void 0,
    agentDir: typeof entry.agentDir === "string" ? entry.agentDir : void 0,
    model: typeof entry.model === "string" || entry.model && typeof entry.model === "object" ? entry.model : void 0,
    skills: Array.isArray(entry.skills) ? entry.skills : void 0,
    memorySearch: entry.memorySearch,
    humanDelay: entry.humanDelay,
    heartbeat: entry.heartbeat,
    identity: entry.identity,
    groupChat: entry.groupChat,
    subagents: typeof entry.subagents === "object" && entry.subagents ? entry.subagents : void 0,
    sandbox: entry.sandbox,
    tools: entry.tools
  };
}
function resolveAgentSkillsFilter(cfg, agentId) {
  return normalizeSkillFilter(resolveAgentConfig(cfg, agentId)?.skills);
}
function resolveAgentModelPrimary(cfg, agentId) {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw) return;
  if (typeof raw === "string") return raw.trim() || void 0;
  return raw.primary?.trim() || void 0;
}
function resolveAgentModelFallbacksOverride(cfg, agentId) {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw || typeof raw === "string") return;
  if (!Object.hasOwn(raw, "fallbacks")) return;
  return Array.isArray(raw.fallbacks) ? raw.fallbacks : void 0;
}
function resolveAgentWorkspaceDir(cfg, agentId) {
  const id = (0, _sessionKeyOcCLUT.l)(agentId);
  const configured = resolveAgentConfig(cfg, id)?.workspace?.trim();
  if (configured) return (0, _registryDWvId1YW.j)(configured);
  if (id === resolveDefaultAgentId(cfg)) {
    const fallback = cfg.agents?.defaults?.workspace?.trim();
    if (fallback) return (0, _registryDWvId1YW.j)(fallback);
    return resolveDefaultAgentWorkspaceDir(process.env);
  }
  const stateDir = (0, _pathsZQWYGl2V.s)(process.env);
  return _nodePath.default.join(stateDir, `workspace-${id}`);
}
function resolveAgentDir(cfg, agentId) {
  const id = (0, _sessionKeyOcCLUT.l)(agentId);
  const configured = resolveAgentConfig(cfg, id)?.agentDir?.trim();
  if (configured) return (0, _registryDWvId1YW.j)(configured);
  const root = (0, _pathsZQWYGl2V.s)(process.env);
  return _nodePath.default.join(root, "agents", id, "agent");
}

//#endregion /* v9-4272dbc95fef47f3 */
