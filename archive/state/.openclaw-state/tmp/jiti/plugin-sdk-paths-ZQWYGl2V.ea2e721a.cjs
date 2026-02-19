"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = resolveOAuthDir;exports.c = expandHomePrefix;exports.i = resolveGatewayPort;exports.l = resolveEffectiveHomeDir;exports.n = resolveConfigPath;exports.o = resolveOAuthPath;exports.r = resolveDefaultConfigCandidates;exports.s = resolveStateDir;exports.t = void 0;exports.u = resolveRequiredHomeDir;var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeOs = _interopRequireDefault(require("node:os"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/infra/home-dir.ts
function normalize(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function resolveEffectiveHomeDir(env = process.env, homedir = _nodeOs.default.homedir) {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? _nodePath.default.resolve(raw) : void 0;
}
function resolveRawHomeDir(env, homedir) {
  const explicitHome = normalize(env.OPENCLAW_HOME);
  if (explicitHome) {
    if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
      const fallbackHome = normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? normalizeSafe(homedir);
      if (fallbackHome) return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      return;
    }
    return explicitHome;
  }
  const envHome = normalize(env.HOME);
  if (envHome) return envHome;
  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) return userProfile;
  return normalizeSafe(homedir);
}
function normalizeSafe(homedir) {
  try {
    return normalize(homedir());
  } catch {
    return;
  }
}
function resolveRequiredHomeDir(env = process.env, homedir = _nodeOs.default.homedir) {
  return resolveEffectiveHomeDir(env, homedir) ?? _nodePath.default.resolve(process.cwd());
}
function expandHomePrefix(input, opts) {
  if (!input.startsWith("~")) return input;
  const home = normalize(opts?.home) ?? resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? _nodeOs.default.homedir);
  if (!home) return input;
  return input.replace(/^~(?=$|[\\/])/, home);
}

//#endregion
//#region src/config/paths.ts
/**
* Nix mode detection: When OPENCLAW_NIX_MODE=1, the gateway is running under Nix.
* In this mode:
* - No auto-install flows should be attempted
* - Missing dependencies should produce actionable Nix-specific error messages
* - Config is managed externally (read-only from Nix perspective)
*/
function resolveIsNixMode(env = process.env) {
  return env.OPENCLAW_NIX_MODE === "1";
}
const isNixMode = resolveIsNixMode();
const LEGACY_STATE_DIRNAMES = [
".clawdbot",
".moldbot",
".moltbot"];

const NEW_STATE_DIRNAME = ".openclaw";
const CONFIG_FILENAME = "openclaw.json";
const LEGACY_CONFIG_FILENAMES = [
"clawdbot.json",
"moldbot.json",
"moltbot.json"];

function resolveDefaultHomeDir() {
  return resolveRequiredHomeDir(process.env, _nodeOs.default.homedir);
}
/** Build a homedir thunk that respects OPENCLAW_HOME for the given env. */
function envHomedir(env) {
  return () => resolveRequiredHomeDir(env, _nodeOs.default.homedir);
}
function legacyStateDirs(homedir = resolveDefaultHomeDir) {
  return LEGACY_STATE_DIRNAMES.map((dir) => _nodePath.default.join(homedir(), dir));
}
function newStateDir(homedir = resolveDefaultHomeDir) {
  return _nodePath.default.join(homedir(), NEW_STATE_DIRNAME);
}
/**
* State directory for mutable data (sessions, logs, caches).
* Can be overridden via OPENCLAW_STATE_DIR.
* Default: ~/.openclaw
*/
function resolveStateDir(env = process.env, homedir = envHomedir(env)) {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, env, effectiveHomedir);
  const newDir = newStateDir(effectiveHomedir);
  const legacyDirs = legacyStateDirs(effectiveHomedir);
  if (_nodeFs.default.existsSync(newDir)) return newDir;
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return _nodeFs.default.existsSync(dir);
    } catch {
      return false;
    }
  });
  if (existingLegacy) return existingLegacy;
  return newDir;
}
function resolveUserPath(input, env = process.env, homedir = envHomedir(env)) {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = expandHomePrefix(trimmed, {
      home: resolveRequiredHomeDir(env, homedir),
      env,
      homedir
    });
    return _nodePath.default.resolve(expanded);
  }
  return _nodePath.default.resolve(trimmed);
}
const STATE_DIR = exports.t = resolveStateDir();
/**
* Config file path (JSON5).
* Can be overridden via OPENCLAW_CONFIG_PATH.
* Default: ~/.openclaw/openclaw.json (or $OPENCLAW_STATE_DIR/openclaw.json)
*/
function resolveCanonicalConfigPath(env = process.env, stateDir = resolveStateDir(env, envHomedir(env))) {
  const override = env.OPENCLAW_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override, env, envHomedir(env));
  return _nodePath.default.join(stateDir, CONFIG_FILENAME);
}
/**
* Resolve the active config path by preferring existing config candidates
* before falling back to the canonical path.
*/
function resolveConfigPathCandidate(env = process.env, homedir = envHomedir(env)) {
  const existing = resolveDefaultConfigCandidates(env, homedir).find((candidate) => {
    try {
      return _nodeFs.default.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}
/**
* Active config path (prefers existing config files).
*/
function resolveConfigPath(env = process.env, stateDir = resolveStateDir(env, envHomedir(env)), homedir = envHomedir(env)) {
  const override = env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override, env, homedir);
  const stateOverride = env.OPENCLAW_STATE_DIR?.trim();
  const existing = [_nodePath.default.join(stateDir, CONFIG_FILENAME), ...LEGACY_CONFIG_FILENAMES.map((name) => _nodePath.default.join(stateDir, name))].find((candidate) => {
    try {
      return _nodeFs.default.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  if (stateOverride) return _nodePath.default.join(stateDir, CONFIG_FILENAME);
  const defaultStateDir = resolveStateDir(env, homedir);
  if (_nodePath.default.resolve(stateDir) === _nodePath.default.resolve(defaultStateDir)) return resolveConfigPathCandidate(env, homedir);
  return _nodePath.default.join(stateDir, CONFIG_FILENAME);
}
const CONFIG_PATH = resolveConfigPathCandidate();
/**
* Resolve default config path candidates across default locations.
* Order: explicit config path → state-dir-derived paths → new default.
*/
function resolveDefaultConfigCandidates(env = process.env, homedir = envHomedir(env)) {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit, env, effectiveHomedir)];
  const candidates = [];
  const openclawStateDir = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (openclawStateDir) {
    const resolved = resolveUserPath(openclawStateDir, env, effectiveHomedir);
    candidates.push(_nodePath.default.join(resolved, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => _nodePath.default.join(resolved, name)));
  }
  const defaultDirs = [newStateDir(effectiveHomedir), ...legacyStateDirs(effectiveHomedir)];
  for (const dir of defaultDirs) {
    candidates.push(_nodePath.default.join(dir, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => _nodePath.default.join(dir, name)));
  }
  return candidates;
}
const DEFAULT_GATEWAY_PORT = 18789;
const OAUTH_FILENAME = "oauth.json";
/**
* OAuth credentials storage directory.
*
* Precedence:
* - `OPENCLAW_OAUTH_DIR` (explicit override)
* - `$*_STATE_DIR/credentials` (canonical server/default)
*/
function resolveOAuthDir(env = process.env, stateDir = resolveStateDir(env, envHomedir(env))) {
  const override = env.OPENCLAW_OAUTH_DIR?.trim();
  if (override) return resolveUserPath(override, env, envHomedir(env));
  return _nodePath.default.join(stateDir, "credentials");
}
function resolveOAuthPath(env = process.env, stateDir = resolveStateDir(env, envHomedir(env))) {
  return _nodePath.default.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}
function resolveGatewayPort(cfg, env = process.env) {
  const envRaw = env.OPENCLAW_GATEWAY_PORT?.trim() || env.CLAWDBOT_GATEWAY_PORT?.trim();
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) return configPort;
  }
  return DEFAULT_GATEWAY_PORT;
}

//#endregion /* v9-39e11463f39cc25e */
