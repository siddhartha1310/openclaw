"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = syncSkillsToWorkspace;exports.c = assertSandboxPath;exports.d = resolveSandboxedMediaSource;exports.f = applySkillEnvOverrides;exports.i = resolveSkillsPromptForRun;exports.l = resolveSandboxInputPath;exports.m = safeEqualSecret;exports.n = buildWorkspaceSkillSnapshot;exports.o = resolvePluginSkillDirs;exports.p = applySkillEnvOverridesFromSnapshot;exports.r = loadWorkspaceSkillEntries;exports.s = assertMediaNotDataUrl;exports.t = buildWorkspaceSkillCommandSpecs;exports.u = resolveSandboxPath;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _agentScopeBCNbpzc = require("./agent-scope-BCNbpzc0.js");
var _execEUUDM93d = require("./exec-eUUDM93d.js");
var _env7LNI1cfd = require("./env-7LNI1cfd.js");
var _manifestRegistryCs432sAr = require("./manifest-registry-Cs432sAr.js");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeOs = _interopRequireDefault(require("node:os"));
var _json = _interopRequireDefault(require("json5"));
var _promises = _interopRequireDefault(require("node:fs/promises"));
var _nodeUrl = require("node:url");
var _nodeCrypto = require("node:crypto");
var _piCodingAgent = require("@mariozechner/pi-coding-agent");
var _yaml = _interopRequireDefault(require("yaml"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/security/secret-equal.ts
function safeEqualSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return (0, _nodeCrypto.timingSafeEqual)(providedBuffer, expectedBuffer);
}

//#endregion
//#region src/shared/config-eval.ts
function isTruthy(value) {
  if (value === void 0 || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}
function resolveConfigPath(config, pathStr) {
  const parts = pathStr.split(".").filter(Boolean);
  let current = config;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return;
    current = current[part];
  }
  return current;
}
function isConfigPathTruthyWithDefaults(config, pathStr, defaults) {
  const value = resolveConfigPath(config, pathStr);
  if (value === void 0 && pathStr in defaults) return defaults[pathStr] ?? false;
  return isTruthy(value);
}
function resolveRuntimePlatform() {
  return process.platform;
}
function windowsPathExtensions() {
  const raw = process.env.PATHEXT;
  return ["", ...(raw !== void 0 ? raw.split(";").map((v) => v.trim()) : [
  ".EXE",
  ".CMD",
  ".BAT",
  ".COM"]).
  filter(Boolean)];
}
let cachedHasBinaryPath;
let cachedHasBinaryPathExt;
const hasBinaryCache = /* @__PURE__ */new Map();
function hasBinary(bin) {
  const pathEnv = process.env.PATH ?? "";
  const pathExt = process.platform === "win32" ? process.env.PATHEXT ?? "" : "";
  if (cachedHasBinaryPath !== pathEnv || cachedHasBinaryPathExt !== pathExt) {
    cachedHasBinaryPath = pathEnv;
    cachedHasBinaryPathExt = pathExt;
    hasBinaryCache.clear();
  }
  if (hasBinaryCache.has(bin)) return hasBinaryCache.get(bin);
  const parts = pathEnv.split(_nodePath.default.delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? windowsPathExtensions() : [""];
  for (const part of parts) for (const ext of extensions) {
    const candidate = _nodePath.default.join(part, bin + ext);
    try {
      _nodeFs.default.accessSync(candidate, _nodeFs.default.constants.X_OK);
      hasBinaryCache.set(bin, true);
      return true;
    } catch {}
  }
  hasBinaryCache.set(bin, false);
  return false;
}

//#endregion
//#region src/markdown/frontmatter.ts
function stripQuotes(value) {
  if (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}
function coerceFrontmatterValue(value) {
  if (value === null || value === void 0) return;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") try {
    return JSON.stringify(value);
  } catch {
    return;
  }
}
function parseYamlFrontmatter(block) {
  try {
    const parsed = _yaml.default.parse(block);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result = {};
    for (const [rawKey, value] of Object.entries(parsed)) {
      const key = rawKey.trim();
      if (!key) continue;
      const coerced = coerceFrontmatterValue(value);
      if (coerced === void 0) continue;
      result[key] = coerced;
    }
    return result;
  } catch {
    return null;
  }
}
function extractMultiLineValue(lines, startIndex) {
  const match = lines[startIndex].match(/^([\w-]+):\s*(.*)$/);
  if (!match) return {
    value: "",
    linesConsumed: 1
  };
  const inlineValue = match[2].trim();
  if (inlineValue) return {
    value: inlineValue,
    linesConsumed: 1
  };
  const valueLines = [];
  let i = startIndex + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("	")) break;
    valueLines.push(line);
    i++;
  }
  return {
    value: valueLines.join("\n").trim(),
    linesConsumed: i - startIndex
  };
}
function parseLineFrontmatter(block) {
  const frontmatter = {};
  const lines = block.split("\n");
  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!match) {
      i++;
      continue;
    }
    const key = match[1];
    const inlineValue = match[2].trim();
    if (!key) {
      i++;
      continue;
    }
    if (!inlineValue && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.startsWith(" ") || nextLine.startsWith("	")) {
        const { value, linesConsumed } = extractMultiLineValue(lines, i);
        if (value) frontmatter[key] = value;
        i += linesConsumed;
        continue;
      }
    }
    const value = stripQuotes(inlineValue);
    if (value) frontmatter[key] = value;
    i++;
  }
  return frontmatter;
}
function parseFrontmatterBlock(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.startsWith("---")) return {};
  const endIndex = normalized.indexOf("\n---", 3);
  if (endIndex === -1) return {};
  const block = normalized.slice(4, endIndex);
  const lineParsed = parseLineFrontmatter(block);
  const yamlParsed = parseYamlFrontmatter(block);
  if (yamlParsed === null) return lineParsed;
  const merged = { ...yamlParsed };
  for (const [key, value] of Object.entries(lineParsed)) if (value.startsWith("{") || value.startsWith("[")) merged[key] = value;
  return merged;
}

//#endregion
//#region src/shared/frontmatter.ts
function normalizeStringList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((value) => String(value).trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((value) => value.trim()).filter(Boolean);
  return [];
}
function getFrontmatterString(frontmatter, key) {
  const raw = frontmatter[key];
  return typeof raw === "string" ? raw : void 0;
}
function parseFrontmatterBool(value, fallback) {
  const parsed = (0, _env7LNI1cfd.n)(value);
  return parsed === void 0 ? fallback : parsed;
}
function resolveOpenClawManifestBlock(params) {
  const raw = getFrontmatterString(params.frontmatter, params.key ?? "metadata");
  if (!raw) return;
  try {
    const parsed = _json.default.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const manifestKeys = [_manifestRegistryCs432sAr.i, ..._manifestRegistryCs432sAr.r];
    for (const key of manifestKeys) {
      const candidate = parsed[key];
      if (candidate && typeof candidate === "object") return candidate;
    }
    return;
  } catch {
    return;
  }
}
function resolveOpenClawManifestRequires(metadataObj) {
  const requiresRaw = typeof metadataObj.requires === "object" && metadataObj.requires !== null ? metadataObj.requires : void 0;
  if (!requiresRaw) return;
  return {
    bins: normalizeStringList(requiresRaw.bins),
    anyBins: normalizeStringList(requiresRaw.anyBins),
    env: normalizeStringList(requiresRaw.env),
    config: normalizeStringList(requiresRaw.config)
  };
}
function resolveOpenClawManifestInstall(metadataObj, parseInstallSpec) {
  return (Array.isArray(metadataObj.install) ? metadataObj.install : []).map((entry) => parseInstallSpec(entry)).filter((entry) => Boolean(entry));
}
function resolveOpenClawManifestOs(metadataObj) {
  return normalizeStringList(metadataObj.os);
}

//#endregion
//#region src/agents/skills/frontmatter.ts
function parseFrontmatter(content) {
  return parseFrontmatterBlock(content);
}
function parseInstallSpec(input) {
  if (!input || typeof input !== "object") return;
  const raw = input;
  const kind = (typeof raw.kind === "string" ? raw.kind : typeof raw.type === "string" ? raw.type : "").trim().toLowerCase();
  if (kind !== "brew" && kind !== "node" && kind !== "go" && kind !== "uv" && kind !== "download") return;
  const spec = { kind };
  if (typeof raw.id === "string") spec.id = raw.id;
  if (typeof raw.label === "string") spec.label = raw.label;
  const bins = normalizeStringList(raw.bins);
  if (bins.length > 0) spec.bins = bins;
  const osList = normalizeStringList(raw.os);
  if (osList.length > 0) spec.os = osList;
  if (typeof raw.formula === "string") spec.formula = raw.formula;
  if (typeof raw.package === "string") spec.package = raw.package;
  if (typeof raw.module === "string") spec.module = raw.module;
  if (typeof raw.url === "string") spec.url = raw.url;
  if (typeof raw.archive === "string") spec.archive = raw.archive;
  if (typeof raw.extract === "boolean") spec.extract = raw.extract;
  if (typeof raw.stripComponents === "number") spec.stripComponents = raw.stripComponents;
  if (typeof raw.targetDir === "string") spec.targetDir = raw.targetDir;
  return spec;
}
function resolveOpenClawMetadata(frontmatter) {
  const metadataObj = resolveOpenClawManifestBlock({ frontmatter });
  if (!metadataObj) return;
  const requires = resolveOpenClawManifestRequires(metadataObj);
  const install = resolveOpenClawManifestInstall(metadataObj, parseInstallSpec);
  const osRaw = resolveOpenClawManifestOs(metadataObj);
  return {
    always: typeof metadataObj.always === "boolean" ? metadataObj.always : void 0,
    emoji: typeof metadataObj.emoji === "string" ? metadataObj.emoji : void 0,
    homepage: typeof metadataObj.homepage === "string" ? metadataObj.homepage : void 0,
    skillKey: typeof metadataObj.skillKey === "string" ? metadataObj.skillKey : void 0,
    primaryEnv: typeof metadataObj.primaryEnv === "string" ? metadataObj.primaryEnv : void 0,
    os: osRaw.length > 0 ? osRaw : void 0,
    requires,
    install: install.length > 0 ? install : void 0
  };
}
function resolveSkillInvocationPolicy(frontmatter) {
  return {
    userInvocable: parseFrontmatterBool(getFrontmatterString(frontmatter, "user-invocable"), true),
    disableModelInvocation: parseFrontmatterBool(getFrontmatterString(frontmatter, "disable-model-invocation"), false)
  };
}
function resolveSkillKey(skill, entry) {
  return entry?.metadata?.skillKey ?? skill.name;
}

//#endregion
//#region src/agents/skills/config.ts
const DEFAULT_CONFIG_VALUES = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true
};
function isConfigPathTruthy(config, pathStr) {
  return isConfigPathTruthyWithDefaults(config, pathStr, DEFAULT_CONFIG_VALUES);
}
function resolveSkillConfig(config, skillKey) {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== "object") return;
  const entry = skills[skillKey];
  if (!entry || typeof entry !== "object") return;
  return entry;
}
function normalizeAllowlist(input) {
  if (!input) return;
  if (!Array.isArray(input)) return;
  const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : void 0;
}
const BUNDLED_SOURCES = new Set(["openclaw-bundled"]);
function isBundledSkill(entry) {
  return BUNDLED_SOURCES.has(entry.skill.source);
}
function isBundledSkillAllowed(entry, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  if (!isBundledSkill(entry)) return true;
  const key = resolveSkillKey(entry.skill, entry);
  return allowlist.includes(key) || allowlist.includes(entry.skill.name);
}
function shouldIncludeSkill(params) {
  const { entry, config, eligibility } = params;
  const skillConfig = resolveSkillConfig(config, resolveSkillKey(entry.skill, entry));
  const allowBundled = normalizeAllowlist(config?.skills?.allowBundled);
  const osList = entry.metadata?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];
  if (skillConfig?.enabled === false) return false;
  if (!isBundledSkillAllowed(entry, allowBundled)) return false;
  if (osList.length > 0 && !osList.includes(resolveRuntimePlatform()) && !remotePlatforms.some((platform) => osList.includes(platform))) return false;
  if (entry.metadata?.always === true) return true;
  const requiredBins = entry.metadata?.requires?.bins ?? [];
  if (requiredBins.length > 0) for (const bin of requiredBins) {
    if (hasBinary(bin)) continue;
    if (eligibility?.remote?.hasBin?.(bin)) continue;
    return false;
  }
  const requiredAnyBins = entry.metadata?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    if (!(requiredAnyBins.some((bin) => hasBinary(bin)) || eligibility?.remote?.hasAnyBin?.(requiredAnyBins))) return false;
  }
  const requiredEnv = entry.metadata?.requires?.env ?? [];
  if (requiredEnv.length > 0) for (const envName of requiredEnv) {
    if (process.env[envName]) continue;
    if (skillConfig?.env?.[envName]) continue;
    if (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName) continue;
    return false;
  }
  const requiredConfig = entry.metadata?.requires?.config ?? [];
  if (requiredConfig.length > 0) {
    for (const configPath of requiredConfig) if (!isConfigPathTruthy(config, configPath)) return false;
  }
  return true;
}

//#endregion
//#region src/agents/skills/env-overrides.ts
function applySkillConfigEnvOverrides(params) {
  const { updates, skillConfig, primaryEnv } = params;
  if (skillConfig.env) for (const [envKey, envValue] of Object.entries(skillConfig.env)) {
    if (!envValue || process.env[envKey]) continue;
    updates.push({
      key: envKey,
      prev: process.env[envKey]
    });
    process.env[envKey] = envValue;
  }
  if (primaryEnv && skillConfig.apiKey && !process.env[primaryEnv]) {
    updates.push({
      key: primaryEnv,
      prev: process.env[primaryEnv]
    });
    process.env[primaryEnv] = skillConfig.apiKey;
  }
}
function createEnvReverter(updates) {
  return () => {
    for (const update of updates) if (update.prev === void 0) delete process.env[update.key];else
    process.env[update.key] = update.prev;
  };
}
function applySkillEnvOverrides(params) {
  const { skills, config } = params;
  const updates = [];
  for (const entry of skills) {
    const skillConfig = resolveSkillConfig(config, resolveSkillKey(entry.skill, entry));
    if (!skillConfig) continue;
    applySkillConfigEnvOverrides({
      updates,
      skillConfig,
      primaryEnv: entry.metadata?.primaryEnv
    });
  }
  return createEnvReverter(updates);
}
function applySkillEnvOverridesFromSnapshot(params) {
  const { snapshot, config } = params;
  if (!snapshot) return () => {};
  const updates = [];
  for (const skill of snapshot.skills) {
    const skillConfig = resolveSkillConfig(config, skill.name);
    if (!skillConfig) continue;
    applySkillConfigEnvOverrides({
      updates,
      skillConfig,
      primaryEnv: skill.primaryEnv
    });
  }
  return createEnvReverter(updates);
}

//#endregion
//#region src/agents/sandbox-paths.ts
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const HTTP_URL_RE = /^https?:\/\//i;
const DATA_URL_RE = /^data:/i;
function normalizeUnicodeSpaces(str) {
  return str.replace(UNICODE_SPACES, " ");
}
function expandPath(filePath) {
  const normalized = normalizeUnicodeSpaces(filePath);
  if (normalized === "~") return _nodeOs.default.homedir();
  if (normalized.startsWith("~/")) return _nodeOs.default.homedir() + normalized.slice(1);
  return normalized;
}
function resolveToCwd(filePath, cwd) {
  const expanded = expandPath(filePath);
  if (_nodePath.default.isAbsolute(expanded)) return expanded;
  return _nodePath.default.resolve(cwd, expanded);
}
function resolveSandboxInputPath(filePath, cwd) {
  return resolveToCwd(filePath, cwd);
}
function resolveSandboxPath(params) {
  const resolved = resolveSandboxInputPath(params.filePath, params.cwd);
  const rootResolved = _nodePath.default.resolve(params.root);
  const relative = _nodePath.default.relative(rootResolved, resolved);
  if (!relative || relative === "") return {
    resolved,
    relative: ""
  };
  if (relative.startsWith("..") || _nodePath.default.isAbsolute(relative)) throw new Error(`Path escapes sandbox root (${shortPath(rootResolved)}): ${params.filePath}`);
  return {
    resolved,
    relative
  };
}
async function assertSandboxPath(params) {
  const resolved = resolveSandboxPath(params);
  await assertNoSymlinkEscape(resolved.relative, _nodePath.default.resolve(params.root), { allowFinalSymlink: params.allowFinalSymlink });
  return resolved;
}
function assertMediaNotDataUrl(media) {
  const raw = media.trim();
  if (DATA_URL_RE.test(raw)) throw new Error("data: URLs are not supported for media. Use buffer instead.");
}
async function resolveSandboxedMediaSource(params) {
  const raw = params.media.trim();
  if (!raw) return raw;
  if (HTTP_URL_RE.test(raw)) return raw;
  let candidate = raw;
  if (/^file:\/\//i.test(candidate)) try {
    candidate = (0, _nodeUrl.fileURLToPath)(candidate);
  } catch {
    throw new Error(`Invalid file:// URL for sandboxed media: ${raw}`);
  }
  return (await assertSandboxPath({
    filePath: candidate,
    cwd: params.sandboxRoot,
    root: params.sandboxRoot
  })).resolved;
}
async function assertNoSymlinkEscape(relative, root, options) {
  if (!relative) return;
  const rootReal = await tryRealpath(root);
  const parts = relative.split(_nodePath.default.sep).filter(Boolean);
  let current = root;
  for (let idx = 0; idx < parts.length; idx += 1) {
    const part = parts[idx];
    const isLast = idx === parts.length - 1;
    current = _nodePath.default.join(current, part);
    try {
      if ((await _promises.default.lstat(current)).isSymbolicLink()) {
        if (options?.allowFinalSymlink && isLast) return;
        const target = await tryRealpath(current);
        if (!isPathInside(rootReal, target)) throw new Error(`Symlink escapes sandbox root (${shortPath(rootReal)}): ${shortPath(current)}`);
        current = target;
      }
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
  }
}
async function tryRealpath(value) {
  try {
    return await _promises.default.realpath(value);
  } catch {
    return _nodePath.default.resolve(value);
  }
}
function isPathInside(root, target) {
  const relative = _nodePath.default.relative(root, target);
  if (!relative || relative === "") return true;
  return !(relative.startsWith("..") || _nodePath.default.isAbsolute(relative));
}
function shortPath(value) {
  if (value.startsWith(_nodeOs.default.homedir())) return `~${value.slice(_nodeOs.default.homedir().length)}`;
  return value;
}

//#endregion
//#region src/agents/skills/bundled-dir.ts
function looksLikeSkillsDir(dir) {
  try {
    const entries = _nodeFs.default.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = _nodePath.default.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) return true;
      if (entry.isDirectory()) {
        if (_nodeFs.default.existsSync(_nodePath.default.join(fullPath, "SKILL.md"))) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
function resolveBundledSkillsDir(opts = {}) {
  const override = process.env.OPENCLAW_BUNDLED_SKILLS_DIR?.trim();
  if (override) return override;
  try {
    const execPath = opts.execPath ?? process.execPath;
    const execDir = _nodePath.default.dirname(execPath);
    const sibling = _nodePath.default.join(execDir, "skills");
    if (_nodeFs.default.existsSync(sibling)) return sibling;
  } catch {}
  try {
    const moduleUrl = opts.moduleUrl ?? "file:///D:/workspace/appDev/openclaw/dist/dist/plugin-sdk/skills-DMoEBaVr.js";
    const moduleDir = _nodePath.default.dirname((0, _nodeUrl.fileURLToPath)(moduleUrl));
    const packageRoot = (0, _agentScopeBCNbpzc.C)({
      argv1: opts.argv1 ?? process.argv[1],
      moduleUrl,
      cwd: opts.cwd ?? process.cwd()
    });
    if (packageRoot) {
      const candidate = _nodePath.default.join(packageRoot, "skills");
      if (looksLikeSkillsDir(candidate)) return candidate;
    }
    let current = moduleDir;
    for (let depth = 0; depth < 6; depth += 1) {
      const candidate = _nodePath.default.join(current, "skills");
      if (looksLikeSkillsDir(candidate)) return candidate;
      const next = _nodePath.default.dirname(current);
      if (next === current) break;
      current = next;
    }
  } catch {}
}

//#endregion
//#region src/agents/skills/plugin-skills.ts
const log = (0, _execEUUDM93d.c)("skills");
function resolvePluginSkillDirs(params) {
  const workspaceDir = params.workspaceDir.trim();
  if (!workspaceDir) return [];
  const registry = (0, _manifestRegistryCs432sAr.t)({
    workspaceDir,
    config: params.config
  });
  if (registry.plugins.length === 0) return [];
  const normalizedPlugins = (0, _manifestRegistryCs432sAr.o)(params.config?.plugins);
  const memorySlot = normalizedPlugins.slots.memory;
  let selectedMemoryPluginId = null;
  const seen = /* @__PURE__ */new Set();
  const resolved = [];
  for (const record of registry.plugins) {
    if (!record.skills || record.skills.length === 0) continue;
    if (!(0, _manifestRegistryCs432sAr.s)(record.id, record.origin, normalizedPlugins).enabled) continue;
    const memoryDecision = (0, _manifestRegistryCs432sAr.c)({
      id: record.id,
      kind: record.kind,
      slot: memorySlot,
      selectedId: selectedMemoryPluginId
    });
    if (!memoryDecision.enabled) continue;
    if (memoryDecision.selected && record.kind === "memory") selectedMemoryPluginId = record.id;
    for (const raw of record.skills) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const candidate = _nodePath.default.resolve(record.rootDir, trimmed);
      if (!_nodeFs.default.existsSync(candidate)) {
        log.warn(`plugin skill path not found (${record.id}): ${candidate}`);
        continue;
      }
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      resolved.push(candidate);
    }
  }
  return resolved;
}

//#endregion
//#region src/agents/skills/serialize.ts
const SKILLS_SYNC_QUEUE = /* @__PURE__ */new Map();
async function serializeByKey(key, task) {
  const next = (SKILLS_SYNC_QUEUE.get(key) ?? Promise.resolve()).then(task, task);
  SKILLS_SYNC_QUEUE.set(key, next);
  try {
    return await next;
  } finally {
    if (SKILLS_SYNC_QUEUE.get(key) === next) SKILLS_SYNC_QUEUE.delete(key);
  }
}

//#endregion
//#region src/agents/skills/workspace.ts
const fsp = _nodeFs.default.promises;
const skillsLogger = (0, _execEUUDM93d.c)("skills");
const skillCommandDebugOnce = /* @__PURE__ */new Set();
function debugSkillCommandOnce(messageKey, message, meta) {
  if (skillCommandDebugOnce.has(messageKey)) return;
  skillCommandDebugOnce.add(messageKey);
  skillsLogger.debug(message, meta);
}
function filterSkillEntries(entries, config, skillFilter, eligibility) {
  let filtered = entries.filter((entry) => shouldIncludeSkill({
    entry,
    config,
    eligibility
  }));
  if (skillFilter !== void 0) {
    const normalized = (0, _agentScopeBCNbpzc.w)(skillFilter) ?? [];
    const label = normalized.length > 0 ? normalized.join(", ") : "(none)";
    skillsLogger.debug(`Applying skill filter: ${label}`);
    filtered = normalized.length > 0 ? filtered.filter((entry) => normalized.includes(entry.skill.name)) : [];
    skillsLogger.debug(`After skill filter: ${filtered.map((entry) => entry.skill.name).join(", ") || "(none)"}`);
  }
  return filtered;
}
const SKILL_COMMAND_MAX_LENGTH = 32;
const SKILL_COMMAND_FALLBACK = "skill";
const SKILL_COMMAND_DESCRIPTION_MAX_LENGTH = 100;
function sanitizeSkillCommandName(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, SKILL_COMMAND_MAX_LENGTH) || SKILL_COMMAND_FALLBACK;
}
function resolveUniqueSkillCommandName(base, used) {
  const normalizedBase = base.toLowerCase();
  if (!used.has(normalizedBase)) return base;
  for (let index = 2; index < 1e3; index += 1) {
    const suffix = `_${index}`;
    const maxBaseLength = Math.max(1, SKILL_COMMAND_MAX_LENGTH - suffix.length);
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    const candidateKey = candidate.toLowerCase();
    if (!used.has(candidateKey)) return candidate;
  }
  return `${base.slice(0, Math.max(1, SKILL_COMMAND_MAX_LENGTH - 2))}_x`;
}
function loadSkillEntries(workspaceDir, opts) {
  const loadSkills = (params) => {
    const loaded = (0, _piCodingAgent.loadSkillsFromDir)(params);
    if (Array.isArray(loaded)) return loaded;
    if (loaded && typeof loaded === "object" && "skills" in loaded && Array.isArray(loaded.skills)) return loaded.skills;
    return [];
  };
  const managedSkillsDir = opts?.managedSkillsDir ?? _nodePath.default.join(_registryDWvId1YW.g, "skills");
  const workspaceSkillsDir = _nodePath.default.resolve(workspaceDir, "skills");
  const bundledSkillsDir = opts?.bundledSkillsDir ?? resolveBundledSkillsDir();
  const extraDirs = (opts?.config?.skills?.load?.extraDirs ?? []).map((d) => typeof d === "string" ? d.trim() : "").filter(Boolean);
  const pluginSkillDirs = resolvePluginSkillDirs({
    workspaceDir,
    config: opts?.config
  });
  const mergedExtraDirs = [...extraDirs, ...pluginSkillDirs];
  const bundledSkills = bundledSkillsDir ? loadSkills({
    dir: bundledSkillsDir,
    source: "openclaw-bundled"
  }) : [];
  const extraSkills = mergedExtraDirs.flatMap((dir) => {
    return loadSkills({
      dir: (0, _registryDWvId1YW.j)(dir),
      source: "openclaw-extra"
    });
  });
  const managedSkills = loadSkills({
    dir: managedSkillsDir,
    source: "openclaw-managed"
  });
  const personalAgentsSkills = loadSkills({
    dir: _nodePath.default.resolve(_nodeOs.default.homedir(), ".agents", "skills"),
    source: "agents-skills-personal"
  });
  const projectAgentsSkills = loadSkills({
    dir: _nodePath.default.resolve(workspaceDir, ".agents", "skills"),
    source: "agents-skills-project"
  });
  const workspaceSkills = loadSkills({
    dir: workspaceSkillsDir,
    source: "openclaw-workspace"
  });
  const merged = /* @__PURE__ */new Map();
  for (const skill of extraSkills) merged.set(skill.name, skill);
  for (const skill of bundledSkills) merged.set(skill.name, skill);
  for (const skill of managedSkills) merged.set(skill.name, skill);
  for (const skill of personalAgentsSkills) merged.set(skill.name, skill);
  for (const skill of projectAgentsSkills) merged.set(skill.name, skill);
  for (const skill of workspaceSkills) merged.set(skill.name, skill);
  return Array.from(merged.values()).map((skill) => {
    let frontmatter = {};
    try {
      frontmatter = parseFrontmatter(_nodeFs.default.readFileSync(skill.filePath, "utf-8"));
    } catch {}
    return {
      skill,
      frontmatter,
      metadata: resolveOpenClawMetadata(frontmatter),
      invocation: resolveSkillInvocationPolicy(frontmatter)
    };
  });
}
function buildWorkspaceSkillSnapshot(workspaceDir, opts) {
  const eligible = filterSkillEntries(opts?.entries ?? loadSkillEntries(workspaceDir, opts), opts?.config, opts?.skillFilter, opts?.eligibility);
  const resolvedSkills = eligible.filter((entry) => entry.invocation?.disableModelInvocation !== true).map((entry) => entry.skill);
  const prompt = [opts?.eligibility?.remote?.note?.trim(), (0, _piCodingAgent.formatSkillsForPrompt)(resolvedSkills)].filter(Boolean).join("\n");
  const skillFilter = (0, _agentScopeBCNbpzc.w)(opts?.skillFilter);
  return {
    prompt,
    skills: eligible.map((entry) => ({
      name: entry.skill.name,
      primaryEnv: entry.metadata?.primaryEnv
    })),
    ...(skillFilter === void 0 ? {} : { skillFilter }),
    resolvedSkills,
    version: opts?.snapshotVersion
  };
}
function buildWorkspaceSkillsPrompt(workspaceDir, opts) {
  const promptEntries = filterSkillEntries(opts?.entries ?? loadSkillEntries(workspaceDir, opts), opts?.config, opts?.skillFilter, opts?.eligibility).filter((entry) => entry.invocation?.disableModelInvocation !== true);
  return [opts?.eligibility?.remote?.note?.trim(), (0, _piCodingAgent.formatSkillsForPrompt)(promptEntries.map((entry) => entry.skill))].filter(Boolean).join("\n");
}
function resolveSkillsPromptForRun(params) {
  const snapshotPrompt = params.skillsSnapshot?.prompt?.trim();
  if (snapshotPrompt) return snapshotPrompt;
  if (params.entries && params.entries.length > 0) {
    const prompt = buildWorkspaceSkillsPrompt(params.workspaceDir, {
      entries: params.entries,
      config: params.config
    });
    return prompt.trim() ? prompt : "";
  }
  return "";
}
function loadWorkspaceSkillEntries(workspaceDir, opts) {
  return loadSkillEntries(workspaceDir, opts);
}
function resolveUniqueSyncedSkillDirName(base, used) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let index = 2; index < 1e4; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let fallbackIndex = 1e4;
  let fallback = `${base}-${fallbackIndex}`;
  while (used.has(fallback)) {
    fallbackIndex += 1;
    fallback = `${base}-${fallbackIndex}`;
  }
  used.add(fallback);
  return fallback;
}
function resolveSyncedSkillDestinationPath(params) {
  const sourceDirName = _nodePath.default.basename(params.entry.skill.baseDir).trim();
  if (!sourceDirName || sourceDirName === "." || sourceDirName === "..") return null;
  return resolveSandboxPath({
    filePath: resolveUniqueSyncedSkillDirName(sourceDirName, params.usedDirNames),
    cwd: params.targetSkillsDir,
    root: params.targetSkillsDir
  }).resolved;
}
async function syncSkillsToWorkspace(params) {
  const sourceDir = (0, _registryDWvId1YW.j)(params.sourceWorkspaceDir);
  const targetDir = (0, _registryDWvId1YW.j)(params.targetWorkspaceDir);
  if (sourceDir === targetDir) return;
  await serializeByKey(`syncSkills:${targetDir}`, async () => {
    const targetSkillsDir = _nodePath.default.join(targetDir, "skills");
    const entries = loadSkillEntries(sourceDir, {
      config: params.config,
      managedSkillsDir: params.managedSkillsDir,
      bundledSkillsDir: params.bundledSkillsDir
    });
    await fsp.rm(targetSkillsDir, {
      recursive: true,
      force: true
    });
    await fsp.mkdir(targetSkillsDir, { recursive: true });
    const usedDirNames = /* @__PURE__ */new Set();
    for (const entry of entries) {
      let dest = null;
      try {
        dest = resolveSyncedSkillDestinationPath({
          targetSkillsDir,
          entry,
          usedDirNames
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(`[skills] Failed to resolve safe destination for ${entry.skill.name}: ${message}`);
        continue;
      }
      if (!dest) {
        console.warn(`[skills] Failed to resolve safe destination for ${entry.skill.name}: invalid source directory name`);
        continue;
      }
      try {
        await fsp.cp(entry.skill.baseDir, dest, {
          recursive: true,
          force: true
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(`[skills] Failed to copy ${entry.skill.name} to sandbox: ${message}`);
      }
    }
  });
}
function buildWorkspaceSkillCommandSpecs(workspaceDir, opts) {
  const userInvocable = filterSkillEntries(opts?.entries ?? loadSkillEntries(workspaceDir, opts), opts?.config, opts?.skillFilter, opts?.eligibility).filter((entry) => entry.invocation?.userInvocable !== false);
  const used = /* @__PURE__ */new Set();
  for (const reserved of opts?.reservedNames ?? []) used.add(reserved.toLowerCase());
  const specs = [];
  for (const entry of userInvocable) {
    const rawName = entry.skill.name;
    const base = sanitizeSkillCommandName(rawName);
    if (base !== rawName) debugSkillCommandOnce(`sanitize:${rawName}:${base}`, `Sanitized skill command name "${rawName}" to "/${base}".`, {
      rawName,
      sanitized: `/${base}`
    });
    const unique = resolveUniqueSkillCommandName(base, used);
    if (unique !== base) debugSkillCommandOnce(`dedupe:${rawName}:${unique}`, `De-duplicated skill command name for "${rawName}" to "/${unique}".`, {
      rawName,
      deduped: `/${unique}`
    });
    used.add(unique.toLowerCase());
    const rawDescription = entry.skill.description?.trim() || rawName;
    const description = rawDescription.length > SKILL_COMMAND_DESCRIPTION_MAX_LENGTH ? rawDescription.slice(0, SKILL_COMMAND_DESCRIPTION_MAX_LENGTH - 1) + "…" : rawDescription;
    const dispatch = (() => {
      const kindRaw = (entry.frontmatter?.["command-dispatch"] ?? entry.frontmatter?.["command_dispatch"] ?? "").trim().toLowerCase();
      if (!kindRaw) return;
      if (kindRaw !== "tool") return;
      const toolName = (entry.frontmatter?.["command-tool"] ?? entry.frontmatter?.["command_tool"] ?? "").trim();
      if (!toolName) {
        debugSkillCommandOnce(`dispatch:missingTool:${rawName}`, `Skill command "/${unique}" requested tool dispatch but did not provide command-tool. Ignoring dispatch.`, {
          skillName: rawName,
          command: unique
        });
        return;
      }
      const argModeRaw = (entry.frontmatter?.["command-arg-mode"] ?? entry.frontmatter?.["command_arg_mode"] ?? "").trim().toLowerCase();
      if (!(!argModeRaw || argModeRaw === "raw" ? "raw" : null)) debugSkillCommandOnce(`dispatch:badArgMode:${rawName}:${argModeRaw}`, `Skill command "/${unique}" requested tool dispatch but has unknown command-arg-mode. Falling back to raw.`, {
        skillName: rawName,
        command: unique,
        argMode: argModeRaw
      });
      return {
        kind: "tool",
        toolName,
        argMode: "raw"
      };
    })();
    specs.push({
      name: unique,
      skillName: rawName,
      description,
      ...(dispatch ? { dispatch } : {})
    });
  }
  return specs;
}

//#endregion /* v9-fe8105fccb8cd7ac */
