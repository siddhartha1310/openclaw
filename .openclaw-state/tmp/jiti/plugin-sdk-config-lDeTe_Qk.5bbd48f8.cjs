"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.A = void 0;exports.B = isSafeExecutableValue;exports.T = exports.S = exports.R = exports.P = exports.O = exports.N = exports.M = exports.L = exports.I = exports.H = exports.F = exports.E = exports.D = exports.C = void 0;exports.U = normalizeTelegramCommandName;exports.V = parseDurationMs;exports.W = resolveTelegramCustomCommands;exports._ = resolveAgentMaxConcurrent;exports.a = writeConfigFile;exports.b = void 0;exports.c = validateJsonSchemaValue;exports.d = setConfigOverride;exports.f = unsetConfigOverride;exports.g = unsetConfigValueAtPath;exports.h = setConfigValueAtPath;exports.i = resolveConfigSnapshotHash;exports.k = exports.j = void 0;exports.l = getConfigOverrides;exports.m = parseConfigPath;exports.n = loadConfig;exports.o = validateConfigObjectWithPlugins;exports.p = getConfigValueAtPath;exports.r = readConfigFileSnapshot;exports.s = parseByteSize;exports.t = createConfigIO;exports.u = resetConfigOverrides;exports.z = exports.y = exports.x = exports.w = exports.v = void 0;var _registryDWvId1YW = require("./registry-DWvId1YW.js");
var _pathsZQWYGl2V = require("./paths-ZQWYGl2V.js");
var _modelSelectionCfNkGvWD = require("./model-selection-CfNkGvWD.js");
var _sessionKeyOcCLUT = require("./session-key-OcC-lU-t.js");
var _agentScopeBCNbpzc = require("./agent-scope-BCNbpzc0.js");
var _manifestRegistryCs432sAr = require("./manifest-registry-Cs432sAr.js");
var _nodeModule = require("node:module");
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodeOs = _interopRequireDefault(require("node:os"));
var _json = _interopRequireDefault(require("json5"));
var _zod = require("zod");
var _nodeUtil = require("node:util");
var _nodeCrypto = _interopRequireDefault(require("node:crypto"));
var _dotenv = _interopRequireDefault(require("dotenv"));
var _ajv = _interopRequireDefault(require("ajv"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

//#region src/config/telegram-custom-commands.ts
const TELEGRAM_COMMAND_NAME_PATTERN = exports.H = /^[a-z0-9_]{1,32}$/;
function normalizeTelegramCommandName(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return (trimmed.startsWith("/") ? trimmed.slice(1) : trimmed).trim().toLowerCase();
}
function normalizeTelegramCommandDescription(value) {
  return value.trim();
}
function resolveTelegramCustomCommands(params) {
  const entries = Array.isArray(params.commands) ? params.commands : [];
  const reserved = params.reservedCommands ?? /* @__PURE__ */new Set();
  const checkReserved = params.checkReserved !== false;
  const checkDuplicates = params.checkDuplicates !== false;
  const seen = /* @__PURE__ */new Set();
  const resolved = [];
  const issues = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const normalized = normalizeTelegramCommandName(String(entry?.command ?? ""));
    if (!normalized) {
      issues.push({
        index,
        field: "command",
        message: "Telegram custom command is missing a command name."
      });
      continue;
    }
    if (!TELEGRAM_COMMAND_NAME_PATTERN.test(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `Telegram custom command "/${normalized}" is invalid (use a-z, 0-9, underscore; max 32 chars).`
      });
      continue;
    }
    if (checkReserved && reserved.has(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `Telegram custom command "/${normalized}" conflicts with a native command.`
      });
      continue;
    }
    if (checkDuplicates && seen.has(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `Telegram custom command "/${normalized}" is duplicated.`
      });
      continue;
    }
    const description = normalizeTelegramCommandDescription(String(entry?.description ?? ""));
    if (!description) {
      issues.push({
        index,
        field: "description",
        message: `Telegram custom command "/${normalized}" is missing a description.`
      });
      continue;
    }
    if (checkDuplicates) seen.add(normalized);
    resolved.push({
      command: normalized,
      description
    });
  }
  return {
    commands: resolved,
    issues
  };
}

//#endregion
//#region src/cli/parse-duration.ts
function parseDurationMs(raw, opts) {
  const trimmed = String(raw ?? "").trim().toLowerCase();
  if (!trimmed) throw new Error("invalid duration (empty)");
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(trimmed);
  if (!m) throw new Error(`invalid duration: ${raw}`);
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid duration: ${raw}`);
  const unit = m[2] ?? opts?.defaultUnit ?? "ms";
  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1e3 : unit === "m" ? 6e4 : unit === "h" ? 36e5 : 864e5;
  const ms = Math.round(value * multiplier);
  if (!Number.isFinite(ms)) throw new Error(`invalid duration: ${raw}`);
  return ms;
}

//#endregion
//#region src/config/zod-schema.agent-model.ts
const AgentModelSchema = _zod.z.union([_zod.z.string(), _zod.z.object({
  primary: _zod.z.string().optional(),
  fallbacks: _zod.z.array(_zod.z.string()).optional()
}).strict()]);

//#endregion
//#region src/infra/exec-safety.ts
const SHELL_METACHARS = /[;&|`$<>]/;
const CONTROL_CHARS = /[\r\n]/;
const QUOTE_CHARS = /["']/;
const BARE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;
function isLikelyPath(value) {
  if (value.startsWith(".") || value.startsWith("~")) return true;
  if (value.includes("/") || value.includes("\\")) return true;
  return /^[A-Za-z]:[\\/]/.test(value);
}
function isSafeExecutableValue(value) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("\0")) return false;
  if (CONTROL_CHARS.test(trimmed)) return false;
  if (SHELL_METACHARS.test(trimmed)) return false;
  if (QUOTE_CHARS.test(trimmed)) return false;
  if (isLikelyPath(trimmed)) return true;
  if (trimmed.startsWith("-")) return false;
  return BARE_NAME_PATTERN.test(trimmed);
}

//#endregion
//#region src/config/zod-schema.allowdeny.ts
const AllowDenyActionSchema = _zod.z.union([_zod.z.literal("allow"), _zod.z.literal("deny")]);
const AllowDenyChatTypeSchema = _zod.z.union([
_zod.z.literal("direct"),
_zod.z.literal("group"),
_zod.z.literal("channel"),
_zod.z.literal("dm")]
).optional();
function createAllowDenyChannelRulesSchema() {
  return _zod.z.object({
    default: AllowDenyActionSchema.optional(),
    rules: _zod.z.array(_zod.z.object({
      action: AllowDenyActionSchema,
      match: _zod.z.object({
        channel: _zod.z.string().optional(),
        chatType: AllowDenyChatTypeSchema,
        keyPrefix: _zod.z.string().optional(),
        rawKeyPrefix: _zod.z.string().optional()
      }).strict().optional()
    }).strict()).optional()
  }).strict().optional();
}

//#endregion
//#region src/config/zod-schema.sensitive.ts
const sensitive = _zod.z.registry();

//#endregion
//#region src/config/zod-schema.core.ts
const ModelApiSchema = _zod.z.union([
_zod.z.literal("openai-completions"),
_zod.z.literal("openai-responses"),
_zod.z.literal("anthropic-messages"),
_zod.z.literal("google-generative-ai"),
_zod.z.literal("github-copilot"),
_zod.z.literal("bedrock-converse-stream"),
_zod.z.literal("ollama")]
);
const ModelCompatSchema = _zod.z.object({
  supportsStore: _zod.z.boolean().optional(),
  supportsDeveloperRole: _zod.z.boolean().optional(),
  supportsReasoningEffort: _zod.z.boolean().optional(),
  supportsUsageInStreaming: _zod.z.boolean().optional(),
  supportsStrictMode: _zod.z.boolean().optional(),
  maxTokensField: _zod.z.union([_zod.z.literal("max_completion_tokens"), _zod.z.literal("max_tokens")]).optional(),
  thinkingFormat: _zod.z.union([
  _zod.z.literal("openai"),
  _zod.z.literal("zai"),
  _zod.z.literal("qwen")]
  ).optional(),
  requiresToolResultName: _zod.z.boolean().optional(),
  requiresAssistantAfterToolResult: _zod.z.boolean().optional(),
  requiresThinkingAsText: _zod.z.boolean().optional(),
  requiresMistralToolIds: _zod.z.boolean().optional()
}).strict().optional();
const ModelDefinitionSchema = _zod.z.object({
  id: _zod.z.string().min(1),
  name: _zod.z.string().min(1),
  api: ModelApiSchema.optional(),
  reasoning: _zod.z.boolean().optional(),
  input: _zod.z.array(_zod.z.union([_zod.z.literal("text"), _zod.z.literal("image")])).optional(),
  cost: _zod.z.object({
    input: _zod.z.number().optional(),
    output: _zod.z.number().optional(),
    cacheRead: _zod.z.number().optional(),
    cacheWrite: _zod.z.number().optional()
  }).strict().optional(),
  contextWindow: _zod.z.number().positive().optional(),
  maxTokens: _zod.z.number().positive().optional(),
  headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  compat: ModelCompatSchema
}).strict();
const ModelProviderSchema = _zod.z.object({
  baseUrl: _zod.z.string().min(1),
  apiKey: _zod.z.string().optional().register(sensitive),
  auth: _zod.z.union([
  _zod.z.literal("api-key"),
  _zod.z.literal("aws-sdk"),
  _zod.z.literal("oauth"),
  _zod.z.literal("token")]
  ).optional(),
  api: ModelApiSchema.optional(),
  headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  authHeader: _zod.z.boolean().optional(),
  models: _zod.z.array(ModelDefinitionSchema)
}).strict();
const BedrockDiscoverySchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  region: _zod.z.string().optional(),
  providerFilter: _zod.z.array(_zod.z.string()).optional(),
  refreshInterval: _zod.z.number().int().nonnegative().optional(),
  defaultContextWindow: _zod.z.number().int().positive().optional(),
  defaultMaxTokens: _zod.z.number().int().positive().optional()
}).strict().optional();
const ModelsConfigSchema = _zod.z.object({
  mode: _zod.z.union([_zod.z.literal("merge"), _zod.z.literal("replace")]).optional(),
  providers: _zod.z.record(_zod.z.string(), ModelProviderSchema).optional(),
  bedrockDiscovery: BedrockDiscoverySchema
}).strict().optional();
const GroupChatSchema = _zod.z.object({
  mentionPatterns: _zod.z.array(_zod.z.string()).optional(),
  historyLimit: _zod.z.number().int().positive().optional()
}).strict().optional();
const DmConfigSchema = exports.k = _zod.z.object({ historyLimit: _zod.z.number().int().min(0).optional() }).strict();
const IdentitySchema = _zod.z.object({
  name: _zod.z.string().optional(),
  theme: _zod.z.string().optional(),
  emoji: _zod.z.string().optional(),
  avatar: _zod.z.string().optional()
}).strict().optional();
const QueueModeSchema = _zod.z.union([
_zod.z.literal("steer"),
_zod.z.literal("followup"),
_zod.z.literal("collect"),
_zod.z.literal("steer-backlog"),
_zod.z.literal("steer+backlog"),
_zod.z.literal("queue"),
_zod.z.literal("interrupt")]
);
const QueueDropSchema = _zod.z.union([
_zod.z.literal("old"),
_zod.z.literal("new"),
_zod.z.literal("summarize")]
);
const ReplyToModeSchema = _zod.z.union([
_zod.z.literal("off"),
_zod.z.literal("first"),
_zod.z.literal("all")]
);
const GroupPolicySchema = exports.j = _zod.z.enum([
"open",
"disabled",
"allowlist"]
);
const DmPolicySchema = exports.A = _zod.z.enum([
"pairing",
"allowlist",
"open",
"disabled"]
);
const BlockStreamingCoalesceSchema = exports.O = _zod.z.object({
  minChars: _zod.z.number().int().positive().optional(),
  maxChars: _zod.z.number().int().positive().optional(),
  idleMs: _zod.z.number().int().nonnegative().optional()
}).strict();
const BlockStreamingChunkSchema = _zod.z.object({
  minChars: _zod.z.number().int().positive().optional(),
  maxChars: _zod.z.number().int().positive().optional(),
  breakPreference: _zod.z.union([
  _zod.z.literal("paragraph"),
  _zod.z.literal("newline"),
  _zod.z.literal("sentence")]
  ).optional()
}).strict();
const MarkdownTableModeSchema = exports.N = _zod.z.enum([
"off",
"bullets",
"code"]
);
const MarkdownConfigSchema = exports.M = _zod.z.object({ tables: MarkdownTableModeSchema.optional() }).strict().optional();
const TtsProviderSchema = exports.L = _zod.z.enum([
"elevenlabs",
"openai",
"edge"]
);
const TtsModeSchema = exports.I = _zod.z.enum(["final", "all"]);
const TtsAutoSchema = exports.P = _zod.z.enum([
"off",
"always",
"inbound",
"tagged"]
);
const TtsConfigSchema = exports.F = _zod.z.object({
  auto: TtsAutoSchema.optional(),
  enabled: _zod.z.boolean().optional(),
  mode: TtsModeSchema.optional(),
  provider: TtsProviderSchema.optional(),
  summaryModel: _zod.z.string().optional(),
  modelOverrides: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allowText: _zod.z.boolean().optional(),
    allowProvider: _zod.z.boolean().optional(),
    allowVoice: _zod.z.boolean().optional(),
    allowModelId: _zod.z.boolean().optional(),
    allowVoiceSettings: _zod.z.boolean().optional(),
    allowNormalization: _zod.z.boolean().optional(),
    allowSeed: _zod.z.boolean().optional()
  }).strict().optional(),
  elevenlabs: _zod.z.object({
    apiKey: _zod.z.string().optional().register(sensitive),
    baseUrl: _zod.z.string().optional(),
    voiceId: _zod.z.string().optional(),
    modelId: _zod.z.string().optional(),
    seed: _zod.z.number().int().min(0).max(4294967295).optional(),
    applyTextNormalization: _zod.z.enum([
    "auto",
    "on",
    "off"]
    ).optional(),
    languageCode: _zod.z.string().optional(),
    voiceSettings: _zod.z.object({
      stability: _zod.z.number().min(0).max(1).optional(),
      similarityBoost: _zod.z.number().min(0).max(1).optional(),
      style: _zod.z.number().min(0).max(1).optional(),
      useSpeakerBoost: _zod.z.boolean().optional(),
      speed: _zod.z.number().min(.5).max(2).optional()
    }).strict().optional()
  }).strict().optional(),
  openai: _zod.z.object({
    apiKey: _zod.z.string().optional().register(sensitive),
    model: _zod.z.string().optional(),
    voice: _zod.z.string().optional()
  }).strict().optional(),
  edge: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    voice: _zod.z.string().optional(),
    lang: _zod.z.string().optional(),
    outputFormat: _zod.z.string().optional(),
    pitch: _zod.z.string().optional(),
    rate: _zod.z.string().optional(),
    volume: _zod.z.string().optional(),
    saveSubtitles: _zod.z.boolean().optional(),
    proxy: _zod.z.string().optional(),
    timeoutMs: _zod.z.number().int().min(1e3).max(12e4).optional()
  }).strict().optional(),
  prefsPath: _zod.z.string().optional(),
  maxTextLength: _zod.z.number().int().min(1).optional(),
  timeoutMs: _zod.z.number().int().min(1e3).max(12e4).optional()
}).strict().optional();
const HumanDelaySchema = _zod.z.object({
  mode: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("natural"),
  _zod.z.literal("custom")]
  ).optional(),
  minMs: _zod.z.number().int().nonnegative().optional(),
  maxMs: _zod.z.number().int().nonnegative().optional()
}).strict();
const CliBackendSchema = _zod.z.object({
  command: _zod.z.string(),
  args: _zod.z.array(_zod.z.string()).optional(),
  output: _zod.z.union([
  _zod.z.literal("json"),
  _zod.z.literal("text"),
  _zod.z.literal("jsonl")]
  ).optional(),
  resumeOutput: _zod.z.union([
  _zod.z.literal("json"),
  _zod.z.literal("text"),
  _zod.z.literal("jsonl")]
  ).optional(),
  input: _zod.z.union([_zod.z.literal("arg"), _zod.z.literal("stdin")]).optional(),
  maxPromptArgChars: _zod.z.number().int().positive().optional(),
  env: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  clearEnv: _zod.z.array(_zod.z.string()).optional(),
  modelArg: _zod.z.string().optional(),
  modelAliases: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  sessionArg: _zod.z.string().optional(),
  sessionArgs: _zod.z.array(_zod.z.string()).optional(),
  resumeArgs: _zod.z.array(_zod.z.string()).optional(),
  sessionMode: _zod.z.union([
  _zod.z.literal("always"),
  _zod.z.literal("existing"),
  _zod.z.literal("none")]
  ).optional(),
  sessionIdFields: _zod.z.array(_zod.z.string()).optional(),
  systemPromptArg: _zod.z.string().optional(),
  systemPromptMode: _zod.z.union([_zod.z.literal("append"), _zod.z.literal("replace")]).optional(),
  systemPromptWhen: _zod.z.union([
  _zod.z.literal("first"),
  _zod.z.literal("always"),
  _zod.z.literal("never")]
  ).optional(),
  imageArg: _zod.z.string().optional(),
  imageMode: _zod.z.union([_zod.z.literal("repeat"), _zod.z.literal("list")]).optional(),
  serialize: _zod.z.boolean().optional(),
  reliability: _zod.z.object({ watchdog: _zod.z.object({
      fresh: _zod.z.object({
        noOutputTimeoutMs: _zod.z.number().int().min(1e3).optional(),
        noOutputTimeoutRatio: _zod.z.number().min(.05).max(.95).optional(),
        minMs: _zod.z.number().int().min(1e3).optional(),
        maxMs: _zod.z.number().int().min(1e3).optional()
      }).strict().optional(),
      resume: _zod.z.object({
        noOutputTimeoutMs: _zod.z.number().int().min(1e3).optional(),
        noOutputTimeoutRatio: _zod.z.number().min(.05).max(.95).optional(),
        minMs: _zod.z.number().int().min(1e3).optional(),
        maxMs: _zod.z.number().int().min(1e3).optional()
      }).strict().optional()
    }).strict().optional() }).strict().optional()
}).strict();
const normalizeAllowFrom = (values) => (values ?? []).map((v) => String(v).trim()).filter(Boolean);exports.R = normalizeAllowFrom;
const requireOpenAllowFrom = (params) => {
  if (params.policy !== "open") return;
  if (normalizeAllowFrom(params.allowFrom).includes("*")) return;
  params.ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: params.path,
    message: params.message
  });
};exports.z = requireOpenAllowFrom;
const MSTeamsReplyStyleSchema = _zod.z.enum(["thread", "top-level"]);
const RetryConfigSchema = _zod.z.object({
  attempts: _zod.z.number().int().min(1).optional(),
  minDelayMs: _zod.z.number().int().min(0).optional(),
  maxDelayMs: _zod.z.number().int().min(0).optional(),
  jitter: _zod.z.number().min(0).max(1).optional()
}).strict().optional();
const QueueModeBySurfaceSchema = _zod.z.object({
  whatsapp: QueueModeSchema.optional(),
  telegram: QueueModeSchema.optional(),
  discord: QueueModeSchema.optional(),
  irc: QueueModeSchema.optional(),
  slack: QueueModeSchema.optional(),
  mattermost: QueueModeSchema.optional(),
  signal: QueueModeSchema.optional(),
  imessage: QueueModeSchema.optional(),
  msteams: QueueModeSchema.optional(),
  webchat: QueueModeSchema.optional()
}).strict().optional();
const DebounceMsBySurfaceSchema = _zod.z.record(_zod.z.string(), _zod.z.number().int().nonnegative()).optional();
const QueueSchema = _zod.z.object({
  mode: QueueModeSchema.optional(),
  byChannel: QueueModeBySurfaceSchema,
  debounceMs: _zod.z.number().int().nonnegative().optional(),
  debounceMsByChannel: DebounceMsBySurfaceSchema,
  cap: _zod.z.number().int().positive().optional(),
  drop: QueueDropSchema.optional()
}).strict().optional();
const InboundDebounceSchema = _zod.z.object({
  debounceMs: _zod.z.number().int().nonnegative().optional(),
  byChannel: DebounceMsBySurfaceSchema
}).strict().optional();
const TranscribeAudioSchema = _zod.z.object({
  command: _zod.z.array(_zod.z.string()).superRefine((value, ctx) => {
    const executable = value[0];
    if (!isSafeExecutableValue(executable)) ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      path: [0],
      message: "expected safe executable name or path"
    });
  }),
  timeoutSeconds: _zod.z.number().int().positive().optional()
}).strict().optional();
const HexColorSchema = _zod.z.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected hex color (RRGGBB)");
const ExecutableTokenSchema = _zod.z.string().refine(isSafeExecutableValue, "expected safe executable name or path");
const MediaUnderstandingScopeSchema = createAllowDenyChannelRulesSchema();
const MediaUnderstandingCapabilitiesSchema = _zod.z.array(_zod.z.union([
_zod.z.literal("image"),
_zod.z.literal("audio"),
_zod.z.literal("video")]
)).optional();
const MediaUnderstandingAttachmentsSchema = _zod.z.object({
  mode: _zod.z.union([_zod.z.literal("first"), _zod.z.literal("all")]).optional(),
  maxAttachments: _zod.z.number().int().positive().optional(),
  prefer: _zod.z.union([
  _zod.z.literal("first"),
  _zod.z.literal("last"),
  _zod.z.literal("path"),
  _zod.z.literal("url")]
  ).optional()
}).strict().optional();
const DeepgramAudioSchema = _zod.z.object({
  detectLanguage: _zod.z.boolean().optional(),
  punctuate: _zod.z.boolean().optional(),
  smartFormat: _zod.z.boolean().optional()
}).strict().optional();
const ProviderOptionValueSchema = _zod.z.union([
_zod.z.string(),
_zod.z.number(),
_zod.z.boolean()]
);
const ProviderOptionsSchema = _zod.z.record(_zod.z.string(), _zod.z.record(_zod.z.string(), ProviderOptionValueSchema)).optional();
const MediaUnderstandingModelSchema = _zod.z.object({
  provider: _zod.z.string().optional(),
  model: _zod.z.string().optional(),
  capabilities: MediaUnderstandingCapabilitiesSchema,
  type: _zod.z.union([_zod.z.literal("provider"), _zod.z.literal("cli")]).optional(),
  command: _zod.z.string().optional(),
  args: _zod.z.array(_zod.z.string()).optional(),
  prompt: _zod.z.string().optional(),
  maxChars: _zod.z.number().int().positive().optional(),
  maxBytes: _zod.z.number().int().positive().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  language: _zod.z.string().optional(),
  providerOptions: ProviderOptionsSchema,
  deepgram: DeepgramAudioSchema,
  baseUrl: _zod.z.string().optional(),
  headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  profile: _zod.z.string().optional(),
  preferredProfile: _zod.z.string().optional()
}).strict().optional();
const ToolsMediaUnderstandingSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxBytes: _zod.z.number().int().positive().optional(),
  maxChars: _zod.z.number().int().positive().optional(),
  prompt: _zod.z.string().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  language: _zod.z.string().optional(),
  providerOptions: ProviderOptionsSchema,
  deepgram: DeepgramAudioSchema,
  baseUrl: _zod.z.string().optional(),
  headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  attachments: MediaUnderstandingAttachmentsSchema,
  models: _zod.z.array(MediaUnderstandingModelSchema).optional()
}).strict().optional();
const ToolsMediaSchema = _zod.z.object({
  models: _zod.z.array(MediaUnderstandingModelSchema).optional(),
  concurrency: _zod.z.number().int().positive().optional(),
  image: ToolsMediaUnderstandingSchema.optional(),
  audio: ToolsMediaUnderstandingSchema.optional(),
  video: ToolsMediaUnderstandingSchema.optional()
}).strict().optional();
const LinkModelSchema = _zod.z.object({
  type: _zod.z.literal("cli").optional(),
  command: _zod.z.string().min(1),
  args: _zod.z.array(_zod.z.string()).optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional()
}).strict();
const ToolsLinksSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxLinks: _zod.z.number().int().positive().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  models: _zod.z.array(LinkModelSchema).optional()
}).strict().optional();
const NativeCommandsSettingSchema = _zod.z.union([_zod.z.boolean(), _zod.z.literal("auto")]);
const ProviderCommandsSchema = _zod.z.object({
  native: NativeCommandsSettingSchema.optional(),
  nativeSkills: NativeCommandsSettingSchema.optional()
}).strict().optional();

//#endregion
//#region src/config/zod-schema.agent-runtime.ts
const HeartbeatSchema = _zod.z.object({
  every: _zod.z.string().optional(),
  activeHours: _zod.z.object({
    start: _zod.z.string().optional(),
    end: _zod.z.string().optional(),
    timezone: _zod.z.string().optional()
  }).strict().optional(),
  model: _zod.z.string().optional(),
  session: _zod.z.string().optional(),
  includeReasoning: _zod.z.boolean().optional(),
  target: _zod.z.string().optional(),
  to: _zod.z.string().optional(),
  accountId: _zod.z.string().optional(),
  prompt: _zod.z.string().optional(),
  ackMaxChars: _zod.z.number().int().nonnegative().optional()
}).strict().superRefine((val, ctx) => {
  if (!val.every) return;
  try {
    parseDurationMs(val.every, { defaultUnit: "m" });
  } catch {
    ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      path: ["every"],
      message: "invalid duration (use ms, s, m, h)"
    });
  }
  const active = val.activeHours;
  if (!active) return;
  const timePattern = /^([01]\d|2[0-3]|24):([0-5]\d)$/;
  const validateTime = (raw, opts, path) => {
    if (!raw) return;
    if (!timePattern.test(raw)) {
      ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: ["activeHours", path],
        message: "invalid time (use \"HH:MM\" 24h format)"
      });
      return;
    }
    const [hourStr, minuteStr] = raw.split(":");
    const hour = Number(hourStr);
    if (hour === 24 && Number(minuteStr) !== 0) {
      ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: ["activeHours", path],
        message: "invalid time (24:00 is the only allowed 24:xx value)"
      });
      return;
    }
    if (hour === 24 && !opts.allow24) ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      path: ["activeHours", path],
      message: "invalid time (start cannot be 24:00)"
    });
  };
  validateTime(active.start, { allow24: false }, "start");
  validateTime(active.end, { allow24: true }, "end");
}).optional();
const SandboxDockerSchema = _zod.z.object({
  image: _zod.z.string().optional(),
  containerPrefix: _zod.z.string().optional(),
  workdir: _zod.z.string().optional(),
  readOnlyRoot: _zod.z.boolean().optional(),
  tmpfs: _zod.z.array(_zod.z.string()).optional(),
  network: _zod.z.string().optional(),
  user: _zod.z.string().optional(),
  capDrop: _zod.z.array(_zod.z.string()).optional(),
  env: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
  setupCommand: _zod.z.string().optional(),
  pidsLimit: _zod.z.number().int().positive().optional(),
  memory: _zod.z.union([_zod.z.string(), _zod.z.number()]).optional(),
  memorySwap: _zod.z.union([_zod.z.string(), _zod.z.number()]).optional(),
  cpus: _zod.z.number().positive().optional(),
  ulimits: _zod.z.record(_zod.z.string(), _zod.z.union([
  _zod.z.string(),
  _zod.z.number(),
  _zod.z.object({
    soft: _zod.z.number().int().nonnegative().optional(),
    hard: _zod.z.number().int().nonnegative().optional()
  }).strict()]
  )).optional(),
  seccompProfile: _zod.z.string().optional(),
  apparmorProfile: _zod.z.string().optional(),
  dns: _zod.z.array(_zod.z.string()).optional(),
  extraHosts: _zod.z.array(_zod.z.string()).optional(),
  binds: _zod.z.array(_zod.z.string()).optional()
}).strict().superRefine((data, ctx) => {
  if (data.binds) for (let i = 0; i < data.binds.length; i += 1) {
    const bind = data.binds[i]?.trim() ?? "";
    if (!bind) {
      ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: ["binds", i],
        message: "Sandbox security: bind mount entry must be a non-empty string."
      });
      continue;
    }
    const firstColon = bind.indexOf(":");
    const source = (firstColon <= 0 ? bind : bind.slice(0, firstColon)).trim();
    if (!source.startsWith("/")) ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      path: ["binds", i],
      message: `Sandbox security: bind mount "${bind}" uses a non-absolute source path "${source}". Only absolute POSIX paths are supported for sandbox binds.`
    });
  }
  if (data.network?.trim().toLowerCase() === "host") ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: ["network"],
    message: "Sandbox security: network mode \"host\" is blocked. Use \"bridge\" or \"none\" instead."
  });
  if (data.seccompProfile?.trim().toLowerCase() === "unconfined") ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: ["seccompProfile"],
    message: "Sandbox security: seccomp profile \"unconfined\" is blocked. Use a custom seccomp profile file or omit this setting."
  });
  if (data.apparmorProfile?.trim().toLowerCase() === "unconfined") ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: ["apparmorProfile"],
    message: "Sandbox security: apparmor profile \"unconfined\" is blocked. Use a named AppArmor profile or omit this setting."
  });
}).optional();
const SandboxBrowserSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  image: _zod.z.string().optional(),
  containerPrefix: _zod.z.string().optional(),
  cdpPort: _zod.z.number().int().positive().optional(),
  vncPort: _zod.z.number().int().positive().optional(),
  noVncPort: _zod.z.number().int().positive().optional(),
  headless: _zod.z.boolean().optional(),
  enableNoVnc: _zod.z.boolean().optional(),
  allowHostControl: _zod.z.boolean().optional(),
  autoStart: _zod.z.boolean().optional(),
  autoStartTimeoutMs: _zod.z.number().int().positive().optional(),
  binds: _zod.z.array(_zod.z.string()).optional()
}).strict().optional();
const SandboxPruneSchema = _zod.z.object({
  idleHours: _zod.z.number().int().nonnegative().optional(),
  maxAgeDays: _zod.z.number().int().nonnegative().optional()
}).strict().optional();
const ToolPolicyBaseSchema = _zod.z.object({
  allow: _zod.z.array(_zod.z.string()).optional(),
  alsoAllow: _zod.z.array(_zod.z.string()).optional(),
  deny: _zod.z.array(_zod.z.string()).optional()
}).strict();
const ToolPolicySchema = exports.D = ToolPolicyBaseSchema.superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "tools policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  });
}).optional();
const ToolsWebSearchSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  provider: _zod.z.union([
  _zod.z.literal("brave"),
  _zod.z.literal("perplexity"),
  _zod.z.literal("grok")]
  ).optional(),
  apiKey: _zod.z.string().optional().register(sensitive),
  maxResults: _zod.z.number().int().positive().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  cacheTtlMinutes: _zod.z.number().nonnegative().optional(),
  perplexity: _zod.z.object({
    apiKey: _zod.z.string().optional().register(sensitive),
    baseUrl: _zod.z.string().optional(),
    model: _zod.z.string().optional()
  }).strict().optional(),
  grok: _zod.z.object({
    apiKey: _zod.z.string().optional().register(sensitive),
    model: _zod.z.string().optional(),
    inlineCitations: _zod.z.boolean().optional()
  }).strict().optional()
}).strict().optional();
const ToolsWebFetchSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  maxChars: _zod.z.number().int().positive().optional(),
  maxCharsCap: _zod.z.number().int().positive().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  cacheTtlMinutes: _zod.z.number().nonnegative().optional(),
  maxRedirects: _zod.z.number().int().nonnegative().optional(),
  userAgent: _zod.z.string().optional()
}).strict().optional();
const ToolsWebSchema = _zod.z.object({
  search: ToolsWebSearchSchema,
  fetch: ToolsWebFetchSchema
}).strict().optional();
const ToolProfileSchema = _zod.z.union([
_zod.z.literal("minimal"),
_zod.z.literal("coding"),
_zod.z.literal("messaging"),
_zod.z.literal("full")]
).optional();
const ToolPolicyWithProfileSchema = _zod.z.object({
  allow: _zod.z.array(_zod.z.string()).optional(),
  alsoAllow: _zod.z.array(_zod.z.string()).optional(),
  deny: _zod.z.array(_zod.z.string()).optional(),
  profile: ToolProfileSchema
}).strict().superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "tools.byProvider policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  });
});
const ElevatedAllowFromSchema = _zod.z.record(_zod.z.string(), _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()]))).optional();
const ToolExecApplyPatchSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  workspaceOnly: _zod.z.boolean().optional(),
  allowModels: _zod.z.array(_zod.z.string()).optional()
}).strict().optional();
const ToolExecBaseShape = {
  host: _zod.z.enum([
  "sandbox",
  "gateway",
  "node"]
  ).optional(),
  security: _zod.z.enum([
  "deny",
  "allowlist",
  "full"]
  ).optional(),
  ask: _zod.z.enum([
  "off",
  "on-miss",
  "always"]
  ).optional(),
  node: _zod.z.string().optional(),
  pathPrepend: _zod.z.array(_zod.z.string()).optional(),
  safeBins: _zod.z.array(_zod.z.string()).optional(),
  backgroundMs: _zod.z.number().int().positive().optional(),
  timeoutSec: _zod.z.number().int().positive().optional(),
  cleanupMs: _zod.z.number().int().positive().optional(),
  notifyOnExit: _zod.z.boolean().optional(),
  notifyOnExitEmptySuccess: _zod.z.boolean().optional(),
  applyPatch: ToolExecApplyPatchSchema
};
const AgentToolExecSchema = _zod.z.object({
  ...ToolExecBaseShape,
  approvalRunningNoticeMs: _zod.z.number().int().nonnegative().optional()
}).strict().optional();
const ToolExecSchema = _zod.z.object(ToolExecBaseShape).strict().optional();
const ToolFsSchema = _zod.z.object({ workspaceOnly: _zod.z.boolean().optional() }).strict().optional();
const AgentSandboxSchema = _zod.z.object({
  mode: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("non-main"),
  _zod.z.literal("all")]
  ).optional(),
  workspaceAccess: _zod.z.union([
  _zod.z.literal("none"),
  _zod.z.literal("ro"),
  _zod.z.literal("rw")]
  ).optional(),
  sessionToolsVisibility: _zod.z.union([_zod.z.literal("spawned"), _zod.z.literal("all")]).optional(),
  scope: _zod.z.union([
  _zod.z.literal("session"),
  _zod.z.literal("agent"),
  _zod.z.literal("shared")]
  ).optional(),
  perSession: _zod.z.boolean().optional(),
  workspaceRoot: _zod.z.string().optional(),
  docker: SandboxDockerSchema,
  browser: SandboxBrowserSchema,
  prune: SandboxPruneSchema
}).strict().optional();
const AgentToolsSchema = _zod.z.object({
  profile: ToolProfileSchema,
  allow: _zod.z.array(_zod.z.string()).optional(),
  alsoAllow: _zod.z.array(_zod.z.string()).optional(),
  deny: _zod.z.array(_zod.z.string()).optional(),
  byProvider: _zod.z.record(_zod.z.string(), ToolPolicyWithProfileSchema).optional(),
  elevated: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: AgentToolExecSchema,
  fs: ToolFsSchema,
  sandbox: _zod.z.object({ tools: ToolPolicySchema }).strict().optional()
}).strict().superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "agent tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  });
}).optional();
const MemorySearchSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  sources: _zod.z.array(_zod.z.union([_zod.z.literal("memory"), _zod.z.literal("sessions")])).optional(),
  extraPaths: _zod.z.array(_zod.z.string()).optional(),
  experimental: _zod.z.object({ sessionMemory: _zod.z.boolean().optional() }).strict().optional(),
  provider: _zod.z.union([
  _zod.z.literal("openai"),
  _zod.z.literal("local"),
  _zod.z.literal("gemini"),
  _zod.z.literal("voyage")]
  ).optional(),
  remote: _zod.z.object({
    baseUrl: _zod.z.string().optional(),
    apiKey: _zod.z.string().optional().register(sensitive),
    headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
    batch: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      wait: _zod.z.boolean().optional(),
      concurrency: _zod.z.number().int().positive().optional(),
      pollIntervalMs: _zod.z.number().int().nonnegative().optional(),
      timeoutMinutes: _zod.z.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  fallback: _zod.z.union([
  _zod.z.literal("openai"),
  _zod.z.literal("gemini"),
  _zod.z.literal("local"),
  _zod.z.literal("voyage"),
  _zod.z.literal("none")]
  ).optional(),
  model: _zod.z.string().optional(),
  local: _zod.z.object({
    modelPath: _zod.z.string().optional(),
    modelCacheDir: _zod.z.string().optional()
  }).strict().optional(),
  store: _zod.z.object({
    driver: _zod.z.literal("sqlite").optional(),
    path: _zod.z.string().optional(),
    vector: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      extensionPath: _zod.z.string().optional()
    }).strict().optional()
  }).strict().optional(),
  chunking: _zod.z.object({
    tokens: _zod.z.number().int().positive().optional(),
    overlap: _zod.z.number().int().nonnegative().optional()
  }).strict().optional(),
  sync: _zod.z.object({
    onSessionStart: _zod.z.boolean().optional(),
    onSearch: _zod.z.boolean().optional(),
    watch: _zod.z.boolean().optional(),
    watchDebounceMs: _zod.z.number().int().nonnegative().optional(),
    intervalMinutes: _zod.z.number().int().nonnegative().optional(),
    sessions: _zod.z.object({
      deltaBytes: _zod.z.number().int().nonnegative().optional(),
      deltaMessages: _zod.z.number().int().nonnegative().optional()
    }).strict().optional()
  }).strict().optional(),
  query: _zod.z.object({
    maxResults: _zod.z.number().int().positive().optional(),
    minScore: _zod.z.number().min(0).max(1).optional(),
    hybrid: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      vectorWeight: _zod.z.number().min(0).max(1).optional(),
      textWeight: _zod.z.number().min(0).max(1).optional(),
      candidateMultiplier: _zod.z.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  cache: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    maxEntries: _zod.z.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
const AgentEntrySchema = _zod.z.object({
  id: _zod.z.string(),
  default: _zod.z.boolean().optional(),
  name: _zod.z.string().optional(),
  workspace: _zod.z.string().optional(),
  agentDir: _zod.z.string().optional(),
  model: AgentModelSchema.optional(),
  skills: _zod.z.array(_zod.z.string()).optional(),
  memorySearch: MemorySearchSchema,
  humanDelay: HumanDelaySchema.optional(),
  heartbeat: HeartbeatSchema,
  identity: IdentitySchema,
  groupChat: GroupChatSchema,
  subagents: _zod.z.object({
    allowAgents: _zod.z.array(_zod.z.string()).optional(),
    model: _zod.z.union([_zod.z.string(), _zod.z.object({
      primary: _zod.z.string().optional(),
      fallbacks: _zod.z.array(_zod.z.string()).optional()
    }).strict()]).optional(),
    thinking: _zod.z.string().optional()
  }).strict().optional(),
  sandbox: AgentSandboxSchema,
  tools: AgentToolsSchema
}).strict();
const ToolsSchema = _zod.z.object({
  profile: ToolProfileSchema,
  allow: _zod.z.array(_zod.z.string()).optional(),
  alsoAllow: _zod.z.array(_zod.z.string()).optional(),
  deny: _zod.z.array(_zod.z.string()).optional(),
  byProvider: _zod.z.record(_zod.z.string(), ToolPolicyWithProfileSchema).optional(),
  web: ToolsWebSchema,
  media: ToolsMediaSchema,
  links: ToolsLinksSchema,
  sessions: _zod.z.object({ visibility: _zod.z.enum([
    "self",
    "tree",
    "agent",
    "all"]
    ).optional() }).strict().optional(),
  message: _zod.z.object({
    allowCrossContextSend: _zod.z.boolean().optional(),
    crossContext: _zod.z.object({
      allowWithinProvider: _zod.z.boolean().optional(),
      allowAcrossProviders: _zod.z.boolean().optional(),
      marker: _zod.z.object({
        enabled: _zod.z.boolean().optional(),
        prefix: _zod.z.string().optional(),
        suffix: _zod.z.string().optional()
      }).strict().optional()
    }).strict().optional(),
    broadcast: _zod.z.object({ enabled: _zod.z.boolean().optional() }).strict().optional()
  }).strict().optional(),
  agentToAgent: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allow: _zod.z.array(_zod.z.string()).optional()
  }).strict().optional(),
  elevated: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: ToolExecSchema,
  fs: ToolFsSchema,
  subagents: _zod.z.object({ tools: ToolPolicySchema }).strict().optional(),
  sandbox: _zod.z.object({ tools: ToolPolicySchema }).strict().optional()
}).strict().superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  });
}).optional();

//#endregion
//#region src/config/zod-schema.channels.ts
const ChannelHeartbeatVisibilitySchema = _zod.z.object({
  showOk: _zod.z.boolean().optional(),
  showAlerts: _zod.z.boolean().optional(),
  useIndicator: _zod.z.boolean().optional()
}).strict().optional();

//#endregion
//#region src/config/zod-schema.providers-core.ts
const ToolPolicyBySenderSchema$1 = _zod.z.record(_zod.z.string(), ToolPolicySchema).optional();
const TelegramInlineButtonsScopeSchema = _zod.z.enum([
"off",
"dm",
"group",
"all",
"allowlist"]
);
const TelegramCapabilitiesSchema = _zod.z.union([_zod.z.array(_zod.z.string()), _zod.z.object({ inlineButtons: TelegramInlineButtonsScopeSchema.optional() }).strict()]);
const TelegramTopicSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional(),
  skills: _zod.z.array(_zod.z.string()).optional(),
  enabled: _zod.z.boolean().optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  systemPrompt: _zod.z.string().optional()
}).strict();
const TelegramGroupSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  skills: _zod.z.array(_zod.z.string()).optional(),
  enabled: _zod.z.boolean().optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  systemPrompt: _zod.z.string().optional(),
  topics: _zod.z.record(_zod.z.string(), TelegramTopicSchema.optional()).optional()
}).strict();
const TelegramCustomCommandSchema = _zod.z.object({
  command: _zod.z.string().transform(normalizeTelegramCommandName),
  description: _zod.z.string().transform(normalizeTelegramCommandDescription)
}).strict();
const validateTelegramCustomCommands = (value, ctx) => {
  if (!value.customCommands || value.customCommands.length === 0) return;
  const { issues } = resolveTelegramCustomCommands({
    commands: value.customCommands,
    checkReserved: false,
    checkDuplicates: false
  });
  for (const issue of issues) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: [
    "customCommands",
    issue.index,
    issue.field],

    message: issue.message
  });
};
const TelegramAccountSchemaBase = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: TelegramCapabilitiesSchema.optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  commands: ProviderCommandsSchema,
  customCommands: _zod.z.array(TelegramCustomCommandSchema).optional(),
  configWrites: _zod.z.boolean().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  botToken: _zod.z.string().optional().register(sensitive),
  tokenFile: _zod.z.string().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  groups: _zod.z.record(_zod.z.string(), TelegramGroupSchema.optional()).optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  draftChunk: BlockStreamingChunkSchema.optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  streamMode: _zod.z.enum([
  "off",
  "partial",
  "block"]
  ).optional().default("partial"),
  mediaMaxMb: _zod.z.number().positive().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  retry: RetryConfigSchema,
  network: _zod.z.object({ autoSelectFamily: _zod.z.boolean().optional() }).strict().optional(),
  proxy: _zod.z.string().optional(),
  webhookUrl: _zod.z.string().optional(),
  webhookSecret: _zod.z.string().optional().register(sensitive),
  webhookPath: _zod.z.string().optional(),
  webhookHost: _zod.z.string().optional(),
  actions: _zod.z.object({
    reactions: _zod.z.boolean().optional(),
    sendMessage: _zod.z.boolean().optional(),
    deleteMessage: _zod.z.boolean().optional(),
    sticker: _zod.z.boolean().optional()
  }).strict().optional(),
  reactionNotifications: _zod.z.enum([
  "off",
  "own",
  "all"]
  ).optional(),
  reactionLevel: _zod.z.enum([
  "off",
  "ack",
  "minimal",
  "extensive"]
  ).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  linkPreview: _zod.z.boolean().optional(),
  responsePrefix: _zod.z.string().optional(),
  ackReaction: _zod.z.string().optional()
}).strict();
const TelegramAccountSchema = TelegramAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.telegram.dmPolicy=\"open\" requires channels.telegram.allowFrom to include \"*\""
  });
  validateTelegramCustomCommands(value, ctx);
});
const TelegramConfigSchema = exports.E = TelegramAccountSchemaBase.extend({ accounts: _zod.z.record(_zod.z.string(), TelegramAccountSchema.optional()).optional() }).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.telegram.dmPolicy=\"open\" requires channels.telegram.allowFrom to include \"*\""
  });
  validateTelegramCustomCommands(value, ctx);
  const baseWebhookUrl = typeof value.webhookUrl === "string" ? value.webhookUrl.trim() : "";
  const baseWebhookSecret = typeof value.webhookSecret === "string" ? value.webhookSecret.trim() : "";
  if (baseWebhookUrl && !baseWebhookSecret) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "channels.telegram.webhookUrl requires channels.telegram.webhookSecret",
    path: ["webhookSecret"]
  });
  if (!value.accounts) return;
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) continue;
    if (account.enabled === false) continue;
    if (!(typeof account.webhookUrl === "string" ? account.webhookUrl.trim() : "")) continue;
    if (!(typeof account.webhookSecret === "string" ? account.webhookSecret.trim() : "") && !baseWebhookSecret) ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      message: "channels.telegram.accounts.*.webhookUrl requires channels.telegram.webhookSecret or channels.telegram.accounts.*.webhookSecret",
      path: [
      "accounts",
      accountId,
      "webhookSecret"]

    });
  }
});
const DiscordDmSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  policy: DmPolicySchema.optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupEnabled: _zod.z.boolean().optional(),
  groupChannels: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional()
}).strict();
const DiscordGuildChannelSchema = _zod.z.object({
  allow: _zod.z.boolean().optional(),
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  skills: _zod.z.array(_zod.z.string()).optional(),
  enabled: _zod.z.boolean().optional(),
  users: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  roles: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  systemPrompt: _zod.z.string().optional(),
  includeThreadStarter: _zod.z.boolean().optional(),
  autoThread: _zod.z.boolean().optional()
}).strict();
const DiscordGuildSchema = _zod.z.object({
  slug: _zod.z.string().optional(),
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  reactionNotifications: _zod.z.enum([
  "off",
  "own",
  "all",
  "allowlist"]
  ).optional(),
  users: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  roles: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  channels: _zod.z.record(_zod.z.string(), DiscordGuildChannelSchema.optional()).optional()
}).strict();
const DiscordUiSchema = _zod.z.object({ components: _zod.z.object({ accentColor: HexColorSchema.optional() }).strict().optional() }).strict().optional();
const DiscordAccountSchema = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  commands: ProviderCommandsSchema,
  configWrites: _zod.z.boolean().optional(),
  token: _zod.z.string().optional().register(sensitive),
  proxy: _zod.z.string().optional(),
  allowBots: _zod.z.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  maxLinesPerMessage: _zod.z.number().int().positive().optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  retry: RetryConfigSchema,
  actions: _zod.z.object({
    reactions: _zod.z.boolean().optional(),
    stickers: _zod.z.boolean().optional(),
    emojiUploads: _zod.z.boolean().optional(),
    stickerUploads: _zod.z.boolean().optional(),
    polls: _zod.z.boolean().optional(),
    permissions: _zod.z.boolean().optional(),
    messages: _zod.z.boolean().optional(),
    threads: _zod.z.boolean().optional(),
    pins: _zod.z.boolean().optional(),
    search: _zod.z.boolean().optional(),
    memberInfo: _zod.z.boolean().optional(),
    roleInfo: _zod.z.boolean().optional(),
    roles: _zod.z.boolean().optional(),
    channelInfo: _zod.z.boolean().optional(),
    voiceStatus: _zod.z.boolean().optional(),
    events: _zod.z.boolean().optional(),
    moderation: _zod.z.boolean().optional(),
    channels: _zod.z.boolean().optional(),
    presence: _zod.z.boolean().optional()
  }).strict().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  dmPolicy: DmPolicySchema.optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  dm: DiscordDmSchema.optional(),
  guilds: _zod.z.record(_zod.z.string(), DiscordGuildSchema.optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  execApprovals: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    approvers: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
    agentFilter: _zod.z.array(_zod.z.string()).optional(),
    sessionFilter: _zod.z.array(_zod.z.string()).optional(),
    cleanupAfterResolve: _zod.z.boolean().optional(),
    target: _zod.z.enum([
    "dm",
    "channel",
    "both"]
    ).optional()
  }).strict().optional(),
  ui: DiscordUiSchema,
  intents: _zod.z.object({
    presence: _zod.z.boolean().optional(),
    guildMembers: _zod.z.boolean().optional()
  }).strict().optional(),
  pluralkit: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    token: _zod.z.string().optional().register(sensitive)
  }).strict().optional(),
  responsePrefix: _zod.z.string().optional(),
  ackReaction: _zod.z.string().optional(),
  activity: _zod.z.string().optional(),
  status: _zod.z.enum([
  "online",
  "dnd",
  "idle",
  "invisible"]
  ).optional(),
  activityType: _zod.z.union([
  _zod.z.literal(0),
  _zod.z.literal(1),
  _zod.z.literal(2),
  _zod.z.literal(3),
  _zod.z.literal(4),
  _zod.z.literal(5)]
  ).optional(),
  activityUrl: _zod.z.string().url().optional()
}).strict().superRefine((value, ctx) => {
  const activityText = typeof value.activity === "string" ? value.activity.trim() : "";
  const hasActivity = Boolean(activityText);
  const hasActivityType = value.activityType !== void 0;
  const activityUrl = typeof value.activityUrl === "string" ? value.activityUrl.trim() : "";
  const hasActivityUrl = Boolean(activityUrl);
  if ((hasActivityType || hasActivityUrl) && !hasActivity) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "channels.discord.activity is required when activityType or activityUrl is set",
    path: ["activity"]
  });
  if (value.activityType === 1 && !hasActivityUrl) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "channels.discord.activityUrl is required when activityType is 1 (Streaming)",
    path: ["activityUrl"]
  });
  if (hasActivityUrl && value.activityType !== 1) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "channels.discord.activityType must be 1 (Streaming) when activityUrl is set",
    path: ["activityType"]
  });
  requireOpenAllowFrom({
    policy: value.dmPolicy ?? value.dm?.policy ?? "pairing",
    allowFrom: value.allowFrom ?? value.dm?.allowFrom,
    ctx,
    path: [...(value.allowFrom !== void 0 ? ["allowFrom"] : ["dm", "allowFrom"])],
    message: "channels.discord.dmPolicy=\"open\" requires channels.discord.allowFrom (or channels.discord.dm.allowFrom) to include \"*\""
  });
});
const DiscordConfigSchema = exports.b = DiscordAccountSchema.extend({ accounts: _zod.z.record(_zod.z.string(), DiscordAccountSchema.optional()).optional() });
const GoogleChatDmSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  policy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional()
}).strict().superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.policy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.googlechat.dm.policy=\"open\" requires channels.googlechat.dm.allowFrom to include \"*\""
  });
});
const GoogleChatGroupSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  allow: _zod.z.boolean().optional(),
  requireMention: _zod.z.boolean().optional(),
  users: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  systemPrompt: _zod.z.string().optional()
}).strict();
const GoogleChatAccountSchema = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  enabled: _zod.z.boolean().optional(),
  configWrites: _zod.z.boolean().optional(),
  allowBots: _zod.z.boolean().optional(),
  requireMention: _zod.z.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  groupAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groups: _zod.z.record(_zod.z.string(), GoogleChatGroupSchema.optional()).optional(),
  serviceAccount: _zod.z.union([_zod.z.string(), _zod.z.record(_zod.z.string(), _zod.z.unknown())]).optional(),
  serviceAccountFile: _zod.z.string().optional(),
  audienceType: _zod.z.enum(["app-url", "project-number"]).optional(),
  audience: _zod.z.string().optional(),
  webhookPath: _zod.z.string().optional(),
  webhookUrl: _zod.z.string().optional(),
  botUser: _zod.z.string().optional(),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  actions: _zod.z.object({ reactions: _zod.z.boolean().optional() }).strict().optional(),
  dm: GoogleChatDmSchema.optional(),
  typingIndicator: _zod.z.enum([
  "none",
  "message",
  "reaction"]
  ).optional(),
  responsePrefix: _zod.z.string().optional()
}).strict();
const GoogleChatConfigSchema = exports.x = GoogleChatAccountSchema.extend({
  accounts: _zod.z.record(_zod.z.string(), GoogleChatAccountSchema.optional()).optional(),
  defaultAccount: _zod.z.string().optional()
});
const SlackDmSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  policy: DmPolicySchema.optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupEnabled: _zod.z.boolean().optional(),
  groupChannels: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  replyToMode: ReplyToModeSchema.optional()
}).strict();
const SlackChannelSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  allow: _zod.z.boolean().optional(),
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  allowBots: _zod.z.boolean().optional(),
  users: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  skills: _zod.z.array(_zod.z.string()).optional(),
  systemPrompt: _zod.z.string().optional()
}).strict();
const SlackThreadSchema = _zod.z.object({
  historyScope: _zod.z.enum(["thread", "channel"]).optional(),
  inheritParent: _zod.z.boolean().optional(),
  initialHistoryLimit: _zod.z.number().int().min(0).optional()
}).strict();
const SlackReplyToModeByChatTypeSchema = _zod.z.object({
  direct: ReplyToModeSchema.optional(),
  group: ReplyToModeSchema.optional(),
  channel: ReplyToModeSchema.optional()
}).strict();
const SlackAccountSchema = _zod.z.object({
  name: _zod.z.string().optional(),
  mode: _zod.z.enum(["socket", "http"]).optional(),
  signingSecret: _zod.z.string().optional().register(sensitive),
  webhookPath: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  commands: ProviderCommandsSchema,
  configWrites: _zod.z.boolean().optional(),
  botToken: _zod.z.string().optional().register(sensitive),
  appToken: _zod.z.string().optional().register(sensitive),
  userToken: _zod.z.string().optional().register(sensitive),
  userTokenReadOnly: _zod.z.boolean().optional().default(true),
  allowBots: _zod.z.boolean().optional(),
  requireMention: _zod.z.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  reactionNotifications: _zod.z.enum([
  "off",
  "own",
  "all",
  "allowlist"]
  ).optional(),
  reactionAllowlist: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  replyToMode: ReplyToModeSchema.optional(),
  replyToModeByChatType: SlackReplyToModeByChatTypeSchema.optional(),
  thread: SlackThreadSchema.optional(),
  actions: _zod.z.object({
    reactions: _zod.z.boolean().optional(),
    messages: _zod.z.boolean().optional(),
    pins: _zod.z.boolean().optional(),
    search: _zod.z.boolean().optional(),
    permissions: _zod.z.boolean().optional(),
    memberInfo: _zod.z.boolean().optional(),
    channelInfo: _zod.z.boolean().optional(),
    emojiList: _zod.z.boolean().optional()
  }).strict().optional(),
  slashCommand: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    name: _zod.z.string().optional(),
    sessionPrefix: _zod.z.string().optional(),
    ephemeral: _zod.z.boolean().optional()
  }).strict().optional(),
  dmPolicy: DmPolicySchema.optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  dm: SlackDmSchema.optional(),
  channels: _zod.z.record(_zod.z.string(), SlackChannelSchema.optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional(),
  ackReaction: _zod.z.string().optional()
}).strict().superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy ?? value.dm?.policy ?? "pairing",
    allowFrom: value.allowFrom ?? value.dm?.allowFrom,
    ctx,
    path: [...(value.allowFrom !== void 0 ? ["allowFrom"] : ["dm", "allowFrom"])],
    message: "channels.slack.dmPolicy=\"open\" requires channels.slack.allowFrom (or channels.slack.dm.allowFrom) to include \"*\""
  });
});
const SlackConfigSchema = exports.T = SlackAccountSchema.safeExtend({
  mode: _zod.z.enum(["socket", "http"]).optional().default("socket"),
  signingSecret: _zod.z.string().optional().register(sensitive),
  webhookPath: _zod.z.string().optional().default("/slack/events"),
  accounts: _zod.z.record(_zod.z.string(), SlackAccountSchema.optional()).optional()
}).superRefine((value, ctx) => {
  const baseMode = value.mode ?? "socket";
  if (baseMode === "http" && !value.signingSecret) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    message: "channels.slack.mode=\"http\" requires channels.slack.signingSecret",
    path: ["signingSecret"]
  });
  if (!value.accounts) return;
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) continue;
    if (account.enabled === false) continue;
    if ((account.mode ?? baseMode) !== "http") continue;
    if (!(account.signingSecret ?? value.signingSecret)) ctx.addIssue({
      code: _zod.z.ZodIssueCode.custom,
      message: "channels.slack.accounts.*.mode=\"http\" requires channels.slack.signingSecret or channels.slack.accounts.*.signingSecret",
      path: [
      "accounts",
      accountId,
      "signingSecret"]

    });
  }
});
const SignalAccountSchemaBase = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  configWrites: _zod.z.boolean().optional(),
  account: _zod.z.string().optional(),
  httpUrl: _zod.z.string().optional(),
  httpHost: _zod.z.string().optional(),
  httpPort: _zod.z.number().int().positive().optional(),
  cliPath: ExecutableTokenSchema.optional(),
  autoStart: _zod.z.boolean().optional(),
  startupTimeoutMs: _zod.z.number().int().min(1e3).max(12e4).optional(),
  receiveMode: _zod.z.union([_zod.z.literal("on-start"), _zod.z.literal("manual")]).optional(),
  ignoreAttachments: _zod.z.boolean().optional(),
  ignoreStories: _zod.z.boolean().optional(),
  sendReadReceipts: _zod.z.boolean().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: _zod.z.number().int().positive().optional(),
  reactionNotifications: _zod.z.enum([
  "off",
  "own",
  "all",
  "allowlist"]
  ).optional(),
  reactionAllowlist: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  actions: _zod.z.object({ reactions: _zod.z.boolean().optional() }).strict().optional(),
  reactionLevel: _zod.z.enum([
  "off",
  "ack",
  "minimal",
  "extensive"]
  ).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional()
}).strict();
const SignalAccountSchema = SignalAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.signal.dmPolicy=\"open\" requires channels.signal.allowFrom to include \"*\""
  });
});
const SignalConfigSchema = exports.w = SignalAccountSchemaBase.extend({ accounts: _zod.z.record(_zod.z.string(), SignalAccountSchema.optional()).optional() }).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.signal.dmPolicy=\"open\" requires channels.signal.allowFrom to include \"*\""
  });
});
const IrcGroupSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  skills: _zod.z.array(_zod.z.string()).optional(),
  enabled: _zod.z.boolean().optional(),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  systemPrompt: _zod.z.string().optional()
}).strict();
const IrcNickServSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  service: _zod.z.string().optional(),
  password: _zod.z.string().optional().register(sensitive),
  passwordFile: _zod.z.string().optional(),
  register: _zod.z.boolean().optional(),
  registerEmail: _zod.z.string().optional()
}).strict();
const IrcAccountSchemaBase = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  configWrites: _zod.z.boolean().optional(),
  host: _zod.z.string().optional(),
  port: _zod.z.number().int().min(1).max(65535).optional(),
  tls: _zod.z.boolean().optional(),
  nick: _zod.z.string().optional(),
  username: _zod.z.string().optional(),
  realname: _zod.z.string().optional(),
  password: _zod.z.string().optional().register(sensitive),
  passwordFile: _zod.z.string().optional(),
  nickserv: IrcNickServSchema.optional(),
  channels: _zod.z.array(_zod.z.string()).optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  groups: _zod.z.record(_zod.z.string(), IrcGroupSchema.optional()).optional(),
  mentionPatterns: _zod.z.array(_zod.z.string()).optional(),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional()
}).strict();
function refineIrcAllowFromAndNickserv(value, ctx) {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.irc.dmPolicy=\"open\" requires channels.irc.allowFrom to include \"*\""
  });
  if (value.nickserv?.register && !value.nickserv.registerEmail?.trim()) ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: ["nickserv", "registerEmail"],
    message: "channels.irc.nickserv.register=true requires channels.irc.nickserv.registerEmail"
  });
}
const IrcAccountSchema = IrcAccountSchemaBase.superRefine((value, ctx) => {
  refineIrcAllowFromAndNickserv(value, ctx);
});
const IrcConfigSchema = IrcAccountSchemaBase.extend({ accounts: _zod.z.record(_zod.z.string(), IrcAccountSchema.optional()).optional() }).superRefine((value, ctx) => {
  refineIrcAllowFromAndNickserv(value, ctx);
});
const IMessageAccountSchemaBase = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: _zod.z.boolean().optional(),
  configWrites: _zod.z.boolean().optional(),
  cliPath: ExecutableTokenSchema.optional(),
  dbPath: _zod.z.string().optional(),
  remoteHost: _zod.z.string().optional(),
  service: _zod.z.union([
  _zod.z.literal("imessage"),
  _zod.z.literal("sms"),
  _zod.z.literal("auto")]
  ).optional(),
  region: _zod.z.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  includeAttachments: _zod.z.boolean().optional(),
  mediaMaxMb: _zod.z.number().int().positive().optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  groups: _zod.z.record(_zod.z.string(), _zod.z.object({
    requireMention: _zod.z.boolean().optional(),
    tools: ToolPolicySchema,
    toolsBySender: ToolPolicyBySenderSchema$1
  }).strict().optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional()
}).strict();
const IMessageAccountSchema = IMessageAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.imessage.dmPolicy=\"open\" requires channels.imessage.allowFrom to include \"*\""
  });
});
const IMessageConfigSchema = exports.S = IMessageAccountSchemaBase.extend({ accounts: _zod.z.record(_zod.z.string(), IMessageAccountSchema.optional()).optional() }).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.imessage.dmPolicy=\"open\" requires channels.imessage.allowFrom to include \"*\""
  });
});
const BlueBubblesAllowFromEntry = _zod.z.union([_zod.z.string(), _zod.z.number()]);
const BlueBubblesActionSchema = _zod.z.object({
  reactions: _zod.z.boolean().optional(),
  edit: _zod.z.boolean().optional(),
  unsend: _zod.z.boolean().optional(),
  reply: _zod.z.boolean().optional(),
  sendWithEffect: _zod.z.boolean().optional(),
  renameGroup: _zod.z.boolean().optional(),
  setGroupIcon: _zod.z.boolean().optional(),
  addParticipant: _zod.z.boolean().optional(),
  removeParticipant: _zod.z.boolean().optional(),
  leaveGroup: _zod.z.boolean().optional(),
  sendAttachment: _zod.z.boolean().optional()
}).strict().optional();
const BlueBubblesGroupConfigSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1
}).strict();
const BlueBubblesAccountSchemaBase = _zod.z.object({
  name: _zod.z.string().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  configWrites: _zod.z.boolean().optional(),
  enabled: _zod.z.boolean().optional(),
  serverUrl: _zod.z.string().optional(),
  password: _zod.z.string().optional().register(sensitive),
  webhookPath: _zod.z.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(BlueBubblesAllowFromEntry).optional(),
  groupAllowFrom: _zod.z.array(BlueBubblesAllowFromEntry).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  mediaMaxMb: _zod.z.number().int().positive().optional(),
  mediaLocalRoots: _zod.z.array(_zod.z.string()).optional(),
  sendReadReceipts: _zod.z.boolean().optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  groups: _zod.z.record(_zod.z.string(), BlueBubblesGroupConfigSchema.optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional()
}).strict();
const BlueBubblesAccountSchema = BlueBubblesAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.bluebubbles.accounts.*.dmPolicy=\"open\" requires allowFrom to include \"*\""
  });
});
const BlueBubblesConfigSchema = BlueBubblesAccountSchemaBase.extend({
  accounts: _zod.z.record(_zod.z.string(), BlueBubblesAccountSchema.optional()).optional(),
  actions: BlueBubblesActionSchema
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.bluebubbles.dmPolicy=\"open\" requires channels.bluebubbles.allowFrom to include \"*\""
  });
});
const MSTeamsChannelSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  replyStyle: MSTeamsReplyStyleSchema.optional()
}).strict();
const MSTeamsTeamSchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema$1,
  replyStyle: MSTeamsReplyStyleSchema.optional(),
  channels: _zod.z.record(_zod.z.string(), MSTeamsChannelSchema.optional()).optional()
}).strict();
const MSTeamsConfigSchema = exports.C = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  configWrites: _zod.z.boolean().optional(),
  appId: _zod.z.string().optional(),
  appPassword: _zod.z.string().optional().register(sensitive),
  tenantId: _zod.z.string().optional(),
  webhook: _zod.z.object({
    port: _zod.z.number().int().positive().optional(),
    path: _zod.z.string().optional()
  }).strict().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: _zod.z.array(_zod.z.string()).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.string()).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaAllowHosts: _zod.z.array(_zod.z.string()).optional(),
  mediaAuthAllowHosts: _zod.z.array(_zod.z.string()).optional(),
  requireMention: _zod.z.boolean().optional(),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  replyStyle: MSTeamsReplyStyleSchema.optional(),
  teams: _zod.z.record(_zod.z.string(), MSTeamsTeamSchema.optional()).optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  sharePointSiteId: _zod.z.string().optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  responsePrefix: _zod.z.string().optional()
}).strict().superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: "channels.msteams.dmPolicy=\"open\" requires channels.msteams.allowFrom to include \"*\""
  });
});

//#endregion
//#region src/config/zod-schema.providers-whatsapp.ts
const ToolPolicyBySenderSchema = _zod.z.record(_zod.z.string(), ToolPolicySchema).optional();
const WhatsAppGroupEntrySchema = _zod.z.object({
  requireMention: _zod.z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema
}).strict().optional();
const WhatsAppGroupsSchema = _zod.z.record(_zod.z.string(), WhatsAppGroupEntrySchema).optional();
const WhatsAppAckReactionSchema = _zod.z.object({
  emoji: _zod.z.string().optional(),
  direct: _zod.z.boolean().optional().default(true),
  group: _zod.z.enum([
  "always",
  "mentions",
  "never"]
  ).optional().default("mentions")
}).strict().optional();
const WhatsAppSharedSchema = _zod.z.object({
  capabilities: _zod.z.array(_zod.z.string()).optional(),
  markdown: MarkdownConfigSchema,
  configWrites: _zod.z.boolean().optional(),
  sendReadReceipts: _zod.z.boolean().optional(),
  messagePrefix: _zod.z.string().optional(),
  responsePrefix: _zod.z.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  selfChatMode: _zod.z.boolean().optional(),
  allowFrom: _zod.z.array(_zod.z.string()).optional(),
  groupAllowFrom: _zod.z.array(_zod.z.string()).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  historyLimit: _zod.z.number().int().min(0).optional(),
  dmHistoryLimit: _zod.z.number().int().min(0).optional(),
  dms: _zod.z.record(_zod.z.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: _zod.z.number().int().positive().optional(),
  chunkMode: _zod.z.enum(["length", "newline"]).optional(),
  blockStreaming: _zod.z.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  groups: WhatsAppGroupsSchema,
  ackReaction: WhatsAppAckReactionSchema,
  debounceMs: _zod.z.number().int().nonnegative().optional().default(0),
  heartbeat: ChannelHeartbeatVisibilitySchema
});
function enforceOpenDmPolicyAllowFromStar(params) {
  if (params.dmPolicy !== "open") return;
  if ((Array.isArray(params.allowFrom) ? params.allowFrom : []).map((v) => String(v).trim()).filter(Boolean).includes("*")) return;
  params.ctx.addIssue({
    code: _zod.z.ZodIssueCode.custom,
    path: ["allowFrom"],
    message: params.message
  });
}
const WhatsAppAccountSchema = WhatsAppSharedSchema.extend({
  name: _zod.z.string().optional(),
  enabled: _zod.z.boolean().optional(),
  authDir: _zod.z.string().optional(),
  mediaMaxMb: _zod.z.number().int().positive().optional()
}).strict().superRefine((value, ctx) => {
  enforceOpenDmPolicyAllowFromStar({
    dmPolicy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    message: "channels.whatsapp.accounts.*.dmPolicy=\"open\" requires allowFrom to include \"*\""
  });
});
const WhatsAppConfigSchema = exports.y = WhatsAppSharedSchema.extend({
  accounts: _zod.z.record(_zod.z.string(), WhatsAppAccountSchema.optional()).optional(),
  mediaMaxMb: _zod.z.number().int().positive().optional().default(50),
  actions: _zod.z.object({
    reactions: _zod.z.boolean().optional(),
    sendMessage: _zod.z.boolean().optional(),
    polls: _zod.z.boolean().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  enforceOpenDmPolicyAllowFromStar({
    dmPolicy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    message: "channels.whatsapp.dmPolicy=\"open\" requires channels.whatsapp.allowFrom to include \"*\""
  });
});

//#endregion
//#region src/infra/dotenv.ts
function loadDotEnv(opts) {
  const quiet = opts?.quiet ?? true;
  _dotenv.default.config({ quiet });
  const globalEnvPath = _nodePath.default.join((0, _registryDWvId1YW.k)(process.env), ".env");
  if (!_nodeFs.default.existsSync(globalEnvPath)) return;
  _dotenv.default.config({
    quiet,
    path: globalEnvPath,
    override: false
  });
}

//#endregion
//#region src/version.ts
const CORE_PACKAGE_NAME = "openclaw";
const PACKAGE_JSON_CANDIDATES = [
"../package.json",
"../../package.json",
"../../../package.json",
"./package.json"];

const BUILD_INFO_CANDIDATES = [
"../build-info.json",
"../../build-info.json",
"./build-info.json"];

function readVersionFromJsonCandidates(moduleUrl, candidates, opts = {}) {
  try {
    const require = (0, _nodeModule.createRequire)(moduleUrl);
    for (const candidate of candidates) try {
      const parsed = require(candidate);
      const version = parsed.version?.trim();
      if (!version) continue;
      if (opts.requirePackageName && parsed.name !== CORE_PACKAGE_NAME) continue;
      return version;
    } catch {}
    return null;
  } catch {
    return null;
  }
}
function readVersionFromPackageJsonForModuleUrl(moduleUrl) {
  return readVersionFromJsonCandidates(moduleUrl, PACKAGE_JSON_CANDIDATES, { requirePackageName: true });
}
function readVersionFromBuildInfoForModuleUrl(moduleUrl) {
  return readVersionFromJsonCandidates(moduleUrl, BUILD_INFO_CANDIDATES);
}
function resolveVersionFromModuleUrl(moduleUrl) {
  return readVersionFromPackageJsonForModuleUrl(moduleUrl) || readVersionFromBuildInfoForModuleUrl(moduleUrl);
}
const VERSION = exports.v = typeof __OPENCLAW_VERSION__ === "string" && __OPENCLAW_VERSION__ || process.env.OPENCLAW_BUNDLED_VERSION || resolveVersionFromModuleUrl("file:///D:/workspace/appDev/openclaw/dist/dist/plugin-sdk/config-lDeTe_Qk.js") || "0.0.0";

//#endregion
//#region src/config/agent-dirs.ts
var DuplicateAgentDirError = class extends Error {
  constructor(duplicates) {
    super(formatDuplicateAgentDirError(duplicates));
    this.name = "DuplicateAgentDirError";
    this.duplicates = duplicates;
  }
};
function canonicalizeAgentDir(agentDir) {
  const resolved = _nodePath.default.resolve(agentDir);
  if (process.platform === "darwin" || process.platform === "win32") return resolved.toLowerCase();
  return resolved;
}
function collectReferencedAgentIds(cfg) {
  const ids = /* @__PURE__ */new Set();
  const agents = Array.isArray(cfg.agents?.list) ? cfg.agents?.list : [];
  const defaultAgentId = agents.find((agent) => agent?.default)?.id ?? agents[0]?.id ?? _sessionKeyOcCLUT.n;
  ids.add((0, _sessionKeyOcCLUT.l)(defaultAgentId));
  for (const entry of agents) if (entry?.id) ids.add((0, _sessionKeyOcCLUT.l)(entry.id));
  const bindings = cfg.bindings;
  if (Array.isArray(bindings)) for (const binding of bindings) {
    const id = binding?.agentId;
    if (typeof id === "string" && id.trim()) ids.add((0, _sessionKeyOcCLUT.l)(id));
  }
  return [...ids];
}
function resolveEffectiveAgentDir(cfg, agentId, deps) {
  const id = (0, _sessionKeyOcCLUT.l)(agentId);
  const trimmed = (Array.isArray(cfg.agents?.list) ? cfg.agents?.list.find((agent) => (0, _sessionKeyOcCLUT.l)(agent.id) === id)?.agentDir : void 0)?.trim();
  if (trimmed) return (0, _registryDWvId1YW.j)(trimmed);
  const env = deps?.env ?? process.env;
  const root = (0, _pathsZQWYGl2V.s)(env, deps?.homedir ?? (() => (0, _pathsZQWYGl2V.u)(env, _nodeOs.default.homedir)));
  return _nodePath.default.join(root, "agents", id, "agent");
}
function findDuplicateAgentDirs(cfg, deps) {
  const byDir = /* @__PURE__ */new Map();
  for (const agentId of collectReferencedAgentIds(cfg)) {
    const agentDir = resolveEffectiveAgentDir(cfg, agentId, deps);
    const key = canonicalizeAgentDir(agentDir);
    const entry = byDir.get(key);
    if (entry) entry.agentIds.push(agentId);else
    byDir.set(key, {
      agentDir,
      agentIds: [agentId]
    });
  }
  return [...byDir.values()].filter((v) => v.agentIds.length > 1);
}
function formatDuplicateAgentDirError(dups) {
  return [
  "Duplicate agentDir detected (multi-agent config).",
  "Each agent must have a unique agentDir; sharing it causes auth/session state collisions and token invalidation.",
  "",
  "Conflicts:",
  ...dups.map((d) => `- ${d.agentDir}: ${d.agentIds.map((id) => `"${id}"`).join(", ")}`),
  "",
  "Fix: remove the shared agents.list[].agentDir override (or give each agent its own directory).",
  "If you want to share credentials, copy auth-profiles.json instead of sharing the entire agentDir."].
  join("\n");
}

//#endregion
//#region src/config/backup-rotation.ts
const CONFIG_BACKUP_COUNT = 5;
async function rotateConfigBackups(configPath, ioFs) {
  if (CONFIG_BACKUP_COUNT <= 1) return;
  const backupBase = `${configPath}.bak`;
  const maxIndex = CONFIG_BACKUP_COUNT - 1;
  await ioFs.unlink(`${backupBase}.${maxIndex}`).catch(() => {});
  for (let index = maxIndex - 1; index >= 1; index -= 1) await ioFs.rename(`${backupBase}.${index}`, `${backupBase}.${index + 1}`).catch(() => {});
  await ioFs.rename(backupBase, `${backupBase}.1`).catch(() => {});
}

//#endregion
//#region src/config/agent-limits.ts
const DEFAULT_AGENT_MAX_CONCURRENT = 4;
const DEFAULT_SUBAGENT_MAX_CONCURRENT = 8;
function resolveAgentMaxConcurrent(cfg) {
  const raw = cfg?.agents?.defaults?.maxConcurrent;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(1, Math.floor(raw));
  return DEFAULT_AGENT_MAX_CONCURRENT;
}

//#endregion
//#region src/config/talk.ts
function readTalkApiKeyFromProfile(deps = {}) {
  const fsImpl = deps.fs ?? _nodeFs.default;
  const osImpl = deps.os ?? _nodeOs.default;
  const pathImpl = deps.path ?? _nodePath.default;
  const home = osImpl.homedir();
  const candidates = [
  ".profile",
  ".zprofile",
  ".zshrc",
  ".bashrc"].
  map((name) => pathImpl.join(home, name));
  for (const candidate of candidates) {
    if (!fsImpl.existsSync(candidate)) continue;
    try {
      const value = fsImpl.readFileSync(candidate, "utf-8").match(/(?:^|\n)\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^\n"']+)["']?/)?.[1]?.trim();
      if (value) return value;
    } catch {}
  }
  return null;
}
function resolveTalkApiKey(env = process.env, deps = {}) {
  const envValue = (env.ELEVENLABS_API_KEY ?? "").trim();
  if (envValue) return envValue;
  return readTalkApiKeyFromProfile(deps);
}

//#endregion
//#region src/config/defaults.ts
let defaultWarnState = { warned: false };
const DEFAULT_MODEL_ALIASES = {
  opus: "anthropic/claude-opus-4-6",
  sonnet: "anthropic/claude-sonnet-4-5",
  gpt: "openai/gpt-5.2",
  "gpt-mini": "openai/gpt-5-mini",
  gemini: "google/gemini-3-pro-preview",
  "gemini-flash": "google/gemini-3-flash-preview"
};
const DEFAULT_MODEL_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};
const DEFAULT_MODEL_INPUT = ["text"];
const DEFAULT_MODEL_MAX_TOKENS = 8192;
function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function resolveModelCost(raw) {
  return {
    input: typeof raw?.input === "number" ? raw.input : DEFAULT_MODEL_COST.input,
    output: typeof raw?.output === "number" ? raw.output : DEFAULT_MODEL_COST.output,
    cacheRead: typeof raw?.cacheRead === "number" ? raw.cacheRead : DEFAULT_MODEL_COST.cacheRead,
    cacheWrite: typeof raw?.cacheWrite === "number" ? raw.cacheWrite : DEFAULT_MODEL_COST.cacheWrite
  };
}
function resolveAnthropicDefaultAuthMode(cfg) {
  const profiles = cfg.auth?.profiles ?? {};
  const anthropicProfiles = Object.entries(profiles).filter(([, profile]) => profile?.provider === "anthropic");
  const order = cfg.auth?.order?.anthropic ?? [];
  for (const profileId of order) {
    const entry = profiles[profileId];
    if (!entry || entry.provider !== "anthropic") continue;
    if (entry.mode === "api_key") return "api_key";
    if (entry.mode === "oauth" || entry.mode === "token") return "oauth";
  }
  const hasApiKey = anthropicProfiles.some(([, profile]) => profile?.mode === "api_key");
  const hasOauth = anthropicProfiles.some(([, profile]) => profile?.mode === "oauth" || profile?.mode === "token");
  if (hasApiKey && !hasOauth) return "api_key";
  if (hasOauth && !hasApiKey) return "oauth";
  if (process.env.ANTHROPIC_OAUTH_TOKEN?.trim()) return "oauth";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "api_key";
  return null;
}
function resolvePrimaryModelRef(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return DEFAULT_MODEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}
function applyMessageDefaults(cfg) {
  const messages = cfg.messages;
  if (messages?.ackReactionScope !== void 0) return cfg;
  const nextMessages = messages ? { ...messages } : {};
  nextMessages.ackReactionScope = "group-mentions";
  return {
    ...cfg,
    messages: nextMessages
  };
}
function applySessionDefaults(cfg, options = {}) {
  const session = cfg.session;
  if (!session || session.mainKey === void 0) return cfg;
  const trimmed = session.mainKey.trim();
  const warn = options.warn ?? console.warn;
  const warnState = options.warnState ?? defaultWarnState;
  const next = {
    ...cfg,
    session: {
      ...session,
      mainKey: "main"
    }
  };
  if (trimmed && trimmed !== "main" && !warnState.warned) {
    warnState.warned = true;
    warn("session.mainKey is ignored; main session is always \"main\".");
  }
  return next;
}
function applyTalkApiKey(config) {
  const resolved = resolveTalkApiKey();
  if (!resolved) return config;
  if (config.talk?.apiKey?.trim()) return config;
  return {
    ...config,
    talk: {
      ...config.talk,
      apiKey: resolved
    }
  };
}
function applyModelDefaults(cfg) {
  let mutated = false;
  let nextCfg = cfg;
  const providerConfig = nextCfg.models?.providers;
  if (providerConfig) {
    const nextProviders = { ...providerConfig };
    for (const [providerId, provider] of Object.entries(providerConfig)) {
      const models = provider.models;
      if (!Array.isArray(models) || models.length === 0) continue;
      let providerMutated = false;
      const nextModels = models.map((model) => {
        const raw = model;
        let modelMutated = false;
        const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : false;
        if (raw.reasoning !== reasoning) modelMutated = true;
        const input = raw.input ?? [...DEFAULT_MODEL_INPUT];
        if (raw.input === void 0) modelMutated = true;
        const cost = resolveModelCost(raw.cost);
        if (!raw.cost || raw.cost.input !== cost.input || raw.cost.output !== cost.output || raw.cost.cacheRead !== cost.cacheRead || raw.cost.cacheWrite !== cost.cacheWrite) modelMutated = true;
        const contextWindow = isPositiveNumber(raw.contextWindow) ? raw.contextWindow : _modelSelectionCfNkGvWD.z;
        if (raw.contextWindow !== contextWindow) modelMutated = true;
        const defaultMaxTokens = Math.min(DEFAULT_MODEL_MAX_TOKENS, contextWindow);
        const rawMaxTokens = isPositiveNumber(raw.maxTokens) ? raw.maxTokens : defaultMaxTokens;
        const maxTokens = Math.min(rawMaxTokens, contextWindow);
        if (raw.maxTokens !== maxTokens) modelMutated = true;
        if (!modelMutated) return model;
        providerMutated = true;
        return {
          ...raw,
          reasoning,
          input,
          cost,
          contextWindow,
          maxTokens
        };
      });
      if (!providerMutated) continue;
      nextProviders[providerId] = {
        ...provider,
        models: nextModels
      };
      mutated = true;
    }
    if (mutated) nextCfg = {
      ...nextCfg,
      models: {
        ...nextCfg.models,
        providers: nextProviders
      }
    };
  }
  const existingAgent = nextCfg.agents?.defaults;
  if (!existingAgent) return mutated ? nextCfg : cfg;
  const existingModels = existingAgent.models ?? {};
  if (Object.keys(existingModels).length === 0) return mutated ? nextCfg : cfg;
  const nextModels = { ...existingModels };
  for (const [alias, target] of Object.entries(DEFAULT_MODEL_ALIASES)) {
    const entry = nextModels[target];
    if (!entry) continue;
    if (entry.alias !== void 0) continue;
    nextModels[target] = {
      ...entry,
      alias
    };
    mutated = true;
  }
  if (!mutated) return cfg;
  return {
    ...nextCfg,
    agents: {
      ...nextCfg.agents,
      defaults: {
        ...existingAgent,
        models: nextModels
      }
    }
  };
}
function applyAgentDefaults(cfg) {
  const agents = cfg.agents;
  const defaults = agents?.defaults;
  const hasMax = typeof defaults?.maxConcurrent === "number" && Number.isFinite(defaults.maxConcurrent);
  const hasSubMax = typeof defaults?.subagents?.maxConcurrent === "number" && Number.isFinite(defaults.subagents.maxConcurrent);
  if (hasMax && hasSubMax) return cfg;
  let mutated = false;
  const nextDefaults = defaults ? { ...defaults } : {};
  if (!hasMax) {
    nextDefaults.maxConcurrent = DEFAULT_AGENT_MAX_CONCURRENT;
    mutated = true;
  }
  const nextSubagents = defaults?.subagents ? { ...defaults.subagents } : {};
  if (!hasSubMax) {
    nextSubagents.maxConcurrent = DEFAULT_SUBAGENT_MAX_CONCURRENT;
    mutated = true;
  }
  if (!mutated) return cfg;
  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: {
        ...nextDefaults,
        subagents: nextSubagents
      }
    }
  };
}
function applyLoggingDefaults(cfg) {
  const logging = cfg.logging;
  if (!logging) return cfg;
  if (logging.redactSensitive) return cfg;
  return {
    ...cfg,
    logging: {
      ...logging,
      redactSensitive: "tools"
    }
  };
}
function applyContextPruningDefaults(cfg) {
  const defaults = cfg.agents?.defaults;
  if (!defaults) return cfg;
  const authMode = resolveAnthropicDefaultAuthMode(cfg);
  if (!authMode) return cfg;
  let mutated = false;
  const nextDefaults = { ...defaults };
  const contextPruning = defaults.contextPruning ?? {};
  const heartbeat = defaults.heartbeat ?? {};
  if (defaults.contextPruning?.mode === void 0) {
    nextDefaults.contextPruning = {
      ...contextPruning,
      mode: "cache-ttl",
      ttl: defaults.contextPruning?.ttl ?? "1h"
    };
    mutated = true;
  }
  if (defaults.heartbeat?.every === void 0) {
    nextDefaults.heartbeat = {
      ...heartbeat,
      every: authMode === "oauth" ? "1h" : "30m"
    };
    mutated = true;
  }
  if (authMode === "api_key") {
    const nextModels = defaults.models ? { ...defaults.models } : {};
    let modelsMutated = false;
    for (const [key, entry] of Object.entries(nextModels)) {
      const parsed = (0, _modelSelectionCfNkGvWD.c)(key, "anthropic");
      if (!parsed || parsed.provider !== "anthropic") continue;
      const current = entry ?? {};
      const params = current.params ?? {};
      if (typeof params.cacheRetention === "string") continue;
      nextModels[key] = {
        ...current,
        params: {
          ...params,
          cacheRetention: "short"
        }
      };
      modelsMutated = true;
    }
    const primary = resolvePrimaryModelRef(defaults.model?.primary ?? void 0);
    if (primary) {
      const parsedPrimary = (0, _modelSelectionCfNkGvWD.c)(primary, "anthropic");
      if (parsedPrimary?.provider === "anthropic") {
        const key = `${parsedPrimary.provider}/${parsedPrimary.model}`;
        const current = nextModels[key] ?? {};
        const params = current.params ?? {};
        if (typeof params.cacheRetention !== "string") {
          nextModels[key] = {
            ...current,
            params: {
              ...params,
              cacheRetention: "short"
            }
          };
          modelsMutated = true;
        }
      }
    }
    if (modelsMutated) {
      nextDefaults.models = nextModels;
      mutated = true;
    }
  }
  if (!mutated) return cfg;
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: nextDefaults
    }
  };
}
function applyCompactionDefaults(cfg) {
  const defaults = cfg.agents?.defaults;
  if (!defaults) return cfg;
  const compaction = defaults?.compaction;
  if (compaction?.mode) return cfg;
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        compaction: {
          ...compaction,
          mode: "safeguard"
        }
      }
    }
  };
}

//#endregion
//#region src/config/env-preserve.ts
/**
* Preserves `${VAR}` environment variable references during config write-back.
*
* When config is read, `${VAR}` references are resolved to their values.
* When writing back, callers pass the resolved config. This module detects
* values that match what a `${VAR}` reference would resolve to and restores
* the original reference, so env var references survive config round-trips.
*
* A value is restored only if:
* 1. The pre-substitution value contained a `${VAR}` pattern
* 2. Resolving that pattern with current env vars produces the incoming value
*
* If a caller intentionally set a new value (different from what the env var
* resolves to), the new value is kept as-is.
*/
const ENV_VAR_PATTERN = /\$\{[A-Z_][A-Z0-9_]*\}/;
function isPlainObject$1(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}
/**
* Check if a string contains any `${VAR}` env var references.
*/
function hasEnvVarRef(value) {
  return ENV_VAR_PATTERN.test(value);
}
/**
* Resolve `${VAR}` references in a single string using the given env.
* Returns null if any referenced var is missing (instead of throwing).
*
* Mirrors the substitution semantics of `substituteString` in env-substitution.ts:
* - `${VAR}` → env value (returns null if missing)
* - `$${VAR}` → literal `${VAR}` (escape sequence)
*/
function tryResolveString(template, env) {
  const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]*$/;
  const chunks = [];
  for (let i = 0; i < template.length; i++) {
    if (template[i] === "$") {
      if (template[i + 1] === "$" && template[i + 2] === "{") {
        const start = i + 3;
        const end = template.indexOf("}", start);
        if (end !== -1) {
          const name = template.slice(start, end);
          if (ENV_VAR_NAME.test(name)) {
            chunks.push(`\${${name}}`);
            i = end;
            continue;
          }
        }
      }
      if (template[i + 1] === "{") {
        const start = i + 2;
        const end = template.indexOf("}", start);
        if (end !== -1) {
          const name = template.slice(start, end);
          if (ENV_VAR_NAME.test(name)) {
            const val = env[name];
            if (val === void 0 || val === "") return null;
            chunks.push(val);
            i = end;
            continue;
          }
        }
      }
    }
    chunks.push(template[i]);
  }
  return chunks.join("");
}
/**
* Deep-walk the incoming config and restore `${VAR}` references from the
* pre-substitution parsed config wherever the resolved value matches.
*
* @param incoming - The resolved config about to be written
* @param parsed - The pre-substitution parsed config (from the current file on disk)
* @param env - Environment variables for verification
* @returns A new config object with env var references restored where appropriate
*/
function restoreEnvVarRefs(incoming, parsed, env = process.env) {
  if (parsed === null || parsed === void 0) return incoming;
  if (typeof incoming === "string" && typeof parsed === "string") {
    if (hasEnvVarRef(parsed)) {
      if (tryResolveString(parsed, env) === incoming) return parsed;
    }
    return incoming;
  }
  if (Array.isArray(incoming) && Array.isArray(parsed)) return incoming.map((item, i) => i < parsed.length ? restoreEnvVarRefs(item, parsed[i], env) : item);
  if (isPlainObject$1(incoming) && isPlainObject$1(parsed)) {
    const result = {};
    for (const [key, value] of Object.entries(incoming)) if (key in parsed) result[key] = restoreEnvVarRefs(value, parsed[key], env);else
    result[key] = value;
    return result;
  }
  return incoming;
}

//#endregion
//#region src/config/env-substitution.ts
/**
* Environment variable substitution for config values.
*
* Supports `${VAR_NAME}` syntax in string values, substituted at config load time.
* - Only uppercase env vars are matched: `[A-Z_][A-Z0-9_]*`
* - Escape with `$${}` to output literal `${}`
* - Missing env vars throw `MissingEnvVarError` with context
*
* @example
* ```json5
* {
*   models: {
*     providers: {
*       "vercel-gateway": {
*         apiKey: "${VERCEL_GATEWAY_API_KEY}"
*       }
*     }
*   }
* }
* ```
*/
const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
var MissingEnvVarError = class extends Error {
  constructor(varName, configPath) {
    super(`Missing env var "${varName}" referenced at config path: ${configPath}`);
    this.varName = varName;
    this.configPath = configPath;
    this.name = "MissingEnvVarError";
  }
};
function substituteString(value, env, configPath) {
  if (!value.includes("$")) return value;
  const chunks = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== "$") {
      chunks.push(char);
      continue;
    }
    const next = value[i + 1];
    const afterNext = value[i + 2];
    if (next === "$" && afterNext === "{") {
      const start = i + 3;
      const end = value.indexOf("}", start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          chunks.push(`\${${name}}`);
          i = end;
          continue;
        }
      }
    }
    if (next === "{") {
      const start = i + 2;
      const end = value.indexOf("}", start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          const envValue = env[name];
          if (envValue === void 0 || envValue === "") throw new MissingEnvVarError(name, configPath);
          chunks.push(envValue);
          i = end;
          continue;
        }
      }
    }
    chunks.push(char);
  }
  return chunks.join("");
}
function containsEnvVarReference(value) {
  if (!value.includes("$")) return false;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== "$") continue;
    const next = value[i + 1];
    const afterNext = value[i + 2];
    if (next === "$" && afterNext === "{") {
      const start = i + 3;
      const end = value.indexOf("}", start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          i = end;
          continue;
        }
      }
    }
    if (next === "{") {
      const start = i + 2;
      const end = value.indexOf("}", start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) return true;
      }
    }
  }
  return false;
}
function substituteAny(value, env, path) {
  if (typeof value === "string") return substituteString(value, env, path);
  if (Array.isArray(value)) return value.map((item, index) => substituteAny(item, env, `${path}[${index}]`));
  if ((0, _registryDWvId1YW.C)(value)) {
    const result = {};
    for (const [key, val] of Object.entries(value)) result[key] = substituteAny(val, env, path ? `${path}.${key}` : key);
    return result;
  }
  return value;
}
/**
* Resolves `${VAR_NAME}` environment variable references in config values.
*
* @param obj - The parsed config object (after JSON5 parse and $include resolution)
* @param env - Environment variables to use for substitution (defaults to process.env)
* @returns The config object with env vars substituted
* @throws {MissingEnvVarError} If a referenced env var is not set or empty
*/
function resolveConfigEnvVars(obj, env = process.env) {
  return substituteAny(obj, env, "");
}

//#endregion
//#region src/config/env-vars.ts
function collectConfigEnvVars(cfg) {
  const envConfig = cfg?.env;
  if (!envConfig) return {};
  const entries = {};
  if (envConfig.vars) for (const [key, value] of Object.entries(envConfig.vars)) {
    if (!value) continue;
    entries[key] = value;
  }
  for (const [key, value] of Object.entries(envConfig)) {
    if (key === "shellEnv" || key === "vars") continue;
    if (typeof value !== "string" || !value.trim()) continue;
    entries[key] = value;
  }
  return entries;
}
function applyConfigEnvVars(cfg, env = process.env) {
  const entries = collectConfigEnvVars(cfg);
  for (const [key, value] of Object.entries(entries)) {
    if (env[key]?.trim()) continue;
    env[key] = value;
  }
}

//#endregion
//#region src/config/includes.ts
/**
* Config includes: $include directive for modular configs
*
* @example
* ```json5
* {
*   "$include": "./base.json5",           // single file
*   "$include": ["./a.json5", "./b.json5"] // merge multiple
* }
* ```
*/
const INCLUDE_KEY = "$include";
const MAX_INCLUDE_DEPTH = 10;
var ConfigIncludeError = class extends Error {
  constructor(message, includePath, cause) {
    super(message);
    this.includePath = includePath;
    this.cause = cause;
    this.name = "ConfigIncludeError";
  }
};
var CircularIncludeError = class extends ConfigIncludeError {
  constructor(chain) {
    super(`Circular include detected: ${chain.join(" -> ")}`, chain[chain.length - 1]);
    this.chain = chain;
    this.name = "CircularIncludeError";
  }
};
/** Deep merge: arrays concatenate, objects merge recursively, primitives: source wins */
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) return [...target, ...source];
  if ((0, _registryDWvId1YW.C)(target) && (0, _registryDWvId1YW.C)(source)) {
    const result = { ...target };
    for (const key of Object.keys(source)) result[key] = key in result ? deepMerge(result[key], source[key]) : source[key];
    return result;
  }
  return source;
}
var IncludeProcessor = class IncludeProcessor {
  constructor(basePath, resolver) {
    this.basePath = basePath;
    this.resolver = resolver;
    this.visited = /* @__PURE__ */new Set();
    this.depth = 0;
    this.visited.add(_nodePath.default.normalize(basePath));
  }
  process(obj) {
    if (Array.isArray(obj)) return obj.map((item) => this.process(item));
    if (!(0, _registryDWvId1YW.C)(obj)) return obj;
    if (!(INCLUDE_KEY in obj)) return this.processObject(obj);
    return this.processInclude(obj);
  }
  processObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) result[key] = this.process(value);
    return result;
  }
  processInclude(obj) {
    const includeValue = obj[INCLUDE_KEY];
    const otherKeys = Object.keys(obj).filter((k) => k !== INCLUDE_KEY);
    const included = this.resolveInclude(includeValue);
    if (otherKeys.length === 0) return included;
    if (!(0, _registryDWvId1YW.C)(included)) throw new ConfigIncludeError("Sibling keys require included content to be an object", typeof includeValue === "string" ? includeValue : INCLUDE_KEY);
    const rest = {};
    for (const key of otherKeys) rest[key] = this.process(obj[key]);
    return deepMerge(included, rest);
  }
  resolveInclude(value) {
    if (typeof value === "string") return this.loadFile(value);
    if (Array.isArray(value)) return value.reduce((merged, item) => {
      if (typeof item !== "string") throw new ConfigIncludeError(`Invalid $include array item: expected string, got ${typeof item}`, String(item));
      return deepMerge(merged, this.loadFile(item));
    }, {});
    throw new ConfigIncludeError(`Invalid $include value: expected string or array of strings, got ${typeof value}`, String(value));
  }
  loadFile(includePath) {
    const resolvedPath = this.resolvePath(includePath);
    this.checkCircular(resolvedPath);
    this.checkDepth(includePath);
    const raw = this.readFile(includePath, resolvedPath);
    const parsed = this.parseFile(includePath, resolvedPath, raw);
    return this.processNested(resolvedPath, parsed);
  }
  resolvePath(includePath) {
    const resolved = _nodePath.default.isAbsolute(includePath) ? includePath : _nodePath.default.resolve(_nodePath.default.dirname(this.basePath), includePath);
    return _nodePath.default.normalize(resolved);
  }
  checkCircular(resolvedPath) {
    if (this.visited.has(resolvedPath)) throw new CircularIncludeError([...this.visited, resolvedPath]);
  }
  checkDepth(includePath) {
    if (this.depth >= MAX_INCLUDE_DEPTH) throw new ConfigIncludeError(`Maximum include depth (${MAX_INCLUDE_DEPTH}) exceeded at: ${includePath}`, includePath);
  }
  readFile(includePath, resolvedPath) {
    try {
      return this.resolver.readFile(resolvedPath);
    } catch (err) {
      throw new ConfigIncludeError(`Failed to read include file: ${includePath} (resolved: ${resolvedPath})`, includePath, err instanceof Error ? err : void 0);
    }
  }
  parseFile(includePath, resolvedPath, raw) {
    try {
      return this.resolver.parseJson(raw);
    } catch (err) {
      throw new ConfigIncludeError(`Failed to parse include file: ${includePath} (resolved: ${resolvedPath})`, includePath, err instanceof Error ? err : void 0);
    }
  }
  processNested(resolvedPath, parsed) {
    const nested = new IncludeProcessor(resolvedPath, this.resolver);
    nested.visited = new Set([...this.visited, resolvedPath]);
    nested.depth = this.depth + 1;
    return nested.process(parsed);
  }
};
const defaultResolver = {
  readFile: (p) => _nodeFs.default.readFileSync(p, "utf-8"),
  parseJson: (raw) => _json.default.parse(raw)
};
/**
* Resolves all $include directives in a parsed config object.
*/
function resolveConfigIncludes(obj, configPath, resolver = defaultResolver) {
  return new IncludeProcessor(configPath, resolver).process(obj);
}

//#endregion
//#region src/config/legacy.shared.ts
const getRecord = (value) => (0, _registryDWvId1YW.w)(value) ? value : null;
const ensureRecord = (root, key) => {
  const existing = root[key];
  if ((0, _registryDWvId1YW.w)(existing)) return existing;
  const next = {};
  root[key] = next;
  return next;
};
const mergeMissing = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (value === void 0) continue;
    const existing = target[key];
    if (existing === void 0) {
      target[key] = value;
      continue;
    }
    if ((0, _registryDWvId1YW.w)(existing) && (0, _registryDWvId1YW.w)(value)) mergeMissing(existing, value);
  }
};
const mapLegacyAudioTranscription = (value) => {
  const transcriber = getRecord(value);
  const command = Array.isArray(transcriber?.command) ? transcriber?.command : null;
  if (!command || command.length === 0) return null;
  if (typeof command[0] !== "string") return null;
  if (!command.every((part) => typeof part === "string")) return null;
  const rawExecutable = command[0].trim();
  if (!rawExecutable) return null;
  if (!isSafeExecutableValue(rawExecutable)) return null;
  const args = command.slice(1);
  const timeoutSeconds = typeof transcriber?.timeoutSeconds === "number" ? transcriber?.timeoutSeconds : void 0;
  const result = {
    command: rawExecutable,
    type: "cli"
  };
  if (args.length > 0) result.args = args;
  if (timeoutSeconds !== void 0) result.timeoutSeconds = timeoutSeconds;
  return result;
};
const getAgentsList = (agents) => {
  const list = agents?.list;
  return Array.isArray(list) ? list : [];
};
const resolveDefaultAgentIdFromRaw = (raw) => {
  const list = getAgentsList(getRecord(raw.agents));
  const defaultEntry = list.find((entry) => (0, _registryDWvId1YW.w)(entry) && entry.default === true && typeof entry.id === "string" && entry.id.trim() !== "");
  if (defaultEntry) return defaultEntry.id.trim();
  const routing = getRecord(raw.routing);
  const routingDefault = typeof routing?.defaultAgentId === "string" ? routing.defaultAgentId.trim() : "";
  if (routingDefault) return routingDefault;
  const firstEntry = list.find((entry) => (0, _registryDWvId1YW.w)(entry) && typeof entry.id === "string" && entry.id.trim() !== "");
  if (firstEntry) return firstEntry.id.trim();
  return "main";
};
const ensureAgentEntry = (list, id) => {
  const normalized = id.trim();
  const existing = list.find((entry) => (0, _registryDWvId1YW.w)(entry) && typeof entry.id === "string" && entry.id.trim() === normalized);
  if (existing) return existing;
  const created = { id: normalized };
  list.push(created);
  return created;
};

//#endregion
//#region src/config/legacy.migrations.part-1.ts
function migrateBindings(raw, changes, changeNote, mutator) {
  const bindings = Array.isArray(raw.bindings) ? raw.bindings : null;
  if (!bindings) return;
  let touched = false;
  for (const entry of bindings) {
    if (!(0, _registryDWvId1YW.w)(entry)) continue;
    const match = getRecord(entry.match);
    if (!match) continue;
    if (!mutator(match)) continue;
    entry.match = match;
    touched = true;
  }
  if (touched) {
    raw.bindings = bindings;
    changes.push(changeNote);
  }
}
const LEGACY_CONFIG_MIGRATIONS_PART_1 = [
{
  id: "bindings.match.provider->bindings.match.channel",
  describe: "Move bindings[].match.provider to bindings[].match.channel",
  apply: (raw, changes) => {
    migrateBindings(raw, changes, "Moved bindings[].match.provider → bindings[].match.channel.", (match) => {
      if (typeof match.channel === "string" && match.channel.trim()) return false;
      const provider = typeof match.provider === "string" ? match.provider.trim() : "";
      if (!provider) return false;
      match.channel = provider;
      delete match.provider;
      return true;
    });
  }
},
{
  id: "bindings.match.accountID->bindings.match.accountId",
  describe: "Move bindings[].match.accountID to bindings[].match.accountId",
  apply: (raw, changes) => {
    migrateBindings(raw, changes, "Moved bindings[].match.accountID → bindings[].match.accountId.", (match) => {
      if (match.accountId !== void 0) return false;
      const accountID = typeof match.accountID === "string" ? match.accountID.trim() : match.accountID;
      if (!accountID) return false;
      match.accountId = accountID;
      delete match.accountID;
      return true;
    });
  }
},
{
  id: "session.sendPolicy.rules.match.provider->match.channel",
  describe: "Move session.sendPolicy.rules[].match.provider to match.channel",
  apply: (raw, changes) => {
    const session = getRecord(raw.session);
    if (!session) return;
    const sendPolicy = getRecord(session.sendPolicy);
    if (!sendPolicy) return;
    const rules = Array.isArray(sendPolicy.rules) ? sendPolicy.rules : null;
    if (!rules) return;
    let touched = false;
    for (const rule of rules) {
      if (!(0, _registryDWvId1YW.w)(rule)) continue;
      const match = getRecord(rule.match);
      if (!match) continue;
      if (typeof match.channel === "string" && match.channel.trim()) continue;
      const provider = typeof match.provider === "string" ? match.provider.trim() : "";
      if (!provider) continue;
      match.channel = provider;
      delete match.provider;
      rule.match = match;
      touched = true;
    }
    if (touched) {
      sendPolicy.rules = rules;
      session.sendPolicy = sendPolicy;
      raw.session = session;
      changes.push("Moved session.sendPolicy.rules[].match.provider → match.channel.");
    }
  }
},
{
  id: "messages.queue.byProvider->byChannel",
  describe: "Move messages.queue.byProvider to messages.queue.byChannel",
  apply: (raw, changes) => {
    const messages = getRecord(raw.messages);
    if (!messages) return;
    const queue = getRecord(messages.queue);
    if (!queue) return;
    if (queue.byProvider === void 0) return;
    if (queue.byChannel === void 0) {
      queue.byChannel = queue.byProvider;
      changes.push("Moved messages.queue.byProvider → messages.queue.byChannel.");
    } else changes.push("Removed messages.queue.byProvider (messages.queue.byChannel already set).");
    delete queue.byProvider;
    messages.queue = queue;
    raw.messages = messages;
  }
},
{
  id: "providers->channels",
  describe: "Move provider config sections to channels.*",
  apply: (raw, changes) => {
    const legacyEntries = [
    "whatsapp",
    "telegram",
    "discord",
    "slack",
    "signal",
    "imessage",
    "msteams"].
    filter((key) => (0, _registryDWvId1YW.w)(raw[key]));
    if (legacyEntries.length === 0) return;
    const channels = ensureRecord(raw, "channels");
    for (const key of legacyEntries) {
      const legacy = getRecord(raw[key]);
      if (!legacy) continue;
      const channelEntry = ensureRecord(channels, key);
      const hadEntries = Object.keys(channelEntry).length > 0;
      mergeMissing(channelEntry, legacy);
      channels[key] = channelEntry;
      delete raw[key];
      changes.push(hadEntries ? `Merged ${key} → channels.${key}.` : `Moved ${key} → channels.${key}.`);
    }
    raw.channels = channels;
  }
},
{
  id: "routing.allowFrom->channels.whatsapp.allowFrom",
  describe: "Move routing.allowFrom to channels.whatsapp.allowFrom",
  apply: (raw, changes) => {
    const routing = raw.routing;
    if (!routing || typeof routing !== "object") return;
    const allowFrom = routing.allowFrom;
    if (allowFrom === void 0) return;
    const channels = getRecord(raw.channels);
    const whatsapp = channels ? getRecord(channels.whatsapp) : null;
    if (!whatsapp) {
      delete routing.allowFrom;
      if (Object.keys(routing).length === 0) delete raw.routing;
      changes.push("Removed routing.allowFrom (channels.whatsapp not configured).");
      return;
    }
    if (whatsapp.allowFrom === void 0) {
      whatsapp.allowFrom = allowFrom;
      changes.push("Moved routing.allowFrom → channels.whatsapp.allowFrom.");
    } else changes.push("Removed routing.allowFrom (channels.whatsapp.allowFrom already set).");
    delete routing.allowFrom;
    if (Object.keys(routing).length === 0) delete raw.routing;
    channels.whatsapp = whatsapp;
    raw.channels = channels;
  }
},
{
  id: "routing.groupChat.requireMention->groups.*.requireMention",
  describe: "Move routing.groupChat.requireMention to channels.whatsapp/telegram/imessage groups",
  apply: (raw, changes) => {
    const routing = raw.routing;
    if (!routing || typeof routing !== "object") return;
    const groupChat = routing.groupChat && typeof routing.groupChat === "object" ? routing.groupChat : null;
    if (!groupChat) return;
    const requireMention = groupChat.requireMention;
    if (requireMention === void 0) return;
    const channels = ensureRecord(raw, "channels");
    const applyTo = (key, options) => {
      if (options?.requireExisting && !(0, _registryDWvId1YW.w)(channels[key])) return;
      const section = channels[key] && typeof channels[key] === "object" ? channels[key] : {};
      const groups = section.groups && typeof section.groups === "object" ? section.groups : {};
      const defaultKey = "*";
      const entry = groups[defaultKey] && typeof groups[defaultKey] === "object" ? groups[defaultKey] : {};
      if (entry.requireMention === void 0) {
        entry.requireMention = requireMention;
        groups[defaultKey] = entry;
        section.groups = groups;
        channels[key] = section;
        changes.push(`Moved routing.groupChat.requireMention → channels.${key}.groups."*".requireMention.`);
      } else changes.push(`Removed routing.groupChat.requireMention (channels.${key}.groups."*" already set).`);
    };
    applyTo("whatsapp", { requireExisting: true });
    applyTo("telegram");
    applyTo("imessage");
    delete groupChat.requireMention;
    if (Object.keys(groupChat).length === 0) delete routing.groupChat;
    if (Object.keys(routing).length === 0) delete raw.routing;
    raw.channels = channels;
  }
},
{
  id: "gateway.token->gateway.auth.token",
  describe: "Move gateway.token to gateway.auth.token",
  apply: (raw, changes) => {
    const gateway = raw.gateway;
    if (!gateway || typeof gateway !== "object") return;
    const token = gateway.token;
    if (token === void 0) return;
    const gatewayObj = gateway;
    const auth = gatewayObj.auth && typeof gatewayObj.auth === "object" ? gatewayObj.auth : {};
    if (auth.token === void 0) {
      auth.token = token;
      if (!auth.mode) auth.mode = "token";
      changes.push("Moved gateway.token → gateway.auth.token.");
    } else changes.push("Removed gateway.token (gateway.auth.token already set).");
    delete gatewayObj.token;
    if (Object.keys(auth).length > 0) gatewayObj.auth = auth;
    raw.gateway = gatewayObj;
  }
},
{
  id: "telegram.requireMention->channels.telegram.groups.*.requireMention",
  describe: "Move telegram.requireMention to channels.telegram.groups.*.requireMention",
  apply: (raw, changes) => {
    const channels = ensureRecord(raw, "channels");
    const telegram = channels.telegram;
    if (!telegram || typeof telegram !== "object") return;
    const requireMention = telegram.requireMention;
    if (requireMention === void 0) return;
    const groups = telegram.groups && typeof telegram.groups === "object" ? telegram.groups : {};
    const defaultKey = "*";
    const entry = groups[defaultKey] && typeof groups[defaultKey] === "object" ? groups[defaultKey] : {};
    if (entry.requireMention === void 0) {
      entry.requireMention = requireMention;
      groups[defaultKey] = entry;
      telegram.groups = groups;
      changes.push("Moved telegram.requireMention → channels.telegram.groups.\"*\".requireMention.");
    } else changes.push("Removed telegram.requireMention (channels.telegram.groups.\"*\" already set).");
    delete telegram.requireMention;
    channels.telegram = telegram;
    raw.channels = channels;
  }
}];


//#endregion
//#region src/config/legacy.migrations.part-2.ts
const LEGACY_CONFIG_MIGRATIONS_PART_2 = [
{
  id: "agent.model-config-v2",
  describe: "Migrate legacy agent.model/allowedModels/modelAliases/modelFallbacks/imageModelFallbacks to agent.models + model lists",
  apply: (raw, changes) => {
    const agentRoot = getRecord(raw.agent);
    const defaults = getRecord(getRecord(raw.agents)?.defaults);
    const agent = agentRoot ?? defaults;
    if (!agent) return;
    const label = agentRoot ? "agent" : "agents.defaults";
    const legacyModel = typeof agent.model === "string" ? String(agent.model) : void 0;
    const legacyImageModel = typeof agent.imageModel === "string" ? String(agent.imageModel) : void 0;
    const legacyAllowed = Array.isArray(agent.allowedModels) ? agent.allowedModels.map(String) : [];
    const legacyModelFallbacks = Array.isArray(agent.modelFallbacks) ? agent.modelFallbacks.map(String) : [];
    const legacyImageModelFallbacks = Array.isArray(agent.imageModelFallbacks) ? agent.imageModelFallbacks.map(String) : [];
    const legacyAliases = agent.modelAliases && typeof agent.modelAliases === "object" ? agent.modelAliases : {};
    if (!(legacyModel || legacyImageModel || legacyAllowed.length > 0 || legacyModelFallbacks.length > 0 || legacyImageModelFallbacks.length > 0 || Object.keys(legacyAliases).length > 0)) return;
    const models = agent.models && typeof agent.models === "object" ? agent.models : {};
    const ensureModel = (rawKey) => {
      if (typeof rawKey !== "string") return;
      const key = rawKey.trim();
      if (!key) return;
      if (!models[key]) models[key] = {};
    };
    ensureModel(legacyModel);
    ensureModel(legacyImageModel);
    for (const key of legacyAllowed) ensureModel(key);
    for (const key of legacyModelFallbacks) ensureModel(key);
    for (const key of legacyImageModelFallbacks) ensureModel(key);
    for (const target of Object.values(legacyAliases)) {
      if (typeof target !== "string") continue;
      ensureModel(target);
    }
    for (const [alias, targetRaw] of Object.entries(legacyAliases)) {
      if (typeof targetRaw !== "string") continue;
      const target = targetRaw.trim();
      if (!target) continue;
      const entry = models[target] && typeof models[target] === "object" ? models[target] : {};
      if (!("alias" in entry)) {
        entry.alias = alias;
        models[target] = entry;
      }
    }
    const currentModel = agent.model && typeof agent.model === "object" ? agent.model : null;
    if (currentModel) {
      if (!currentModel.primary && legacyModel) currentModel.primary = legacyModel;
      if (legacyModelFallbacks.length > 0 && (!Array.isArray(currentModel.fallbacks) || currentModel.fallbacks.length === 0)) currentModel.fallbacks = legacyModelFallbacks;
      agent.model = currentModel;
    } else if (legacyModel || legacyModelFallbacks.length > 0) agent.model = {
      primary: legacyModel,
      fallbacks: legacyModelFallbacks.length ? legacyModelFallbacks : []
    };
    const currentImageModel = agent.imageModel && typeof agent.imageModel === "object" ? agent.imageModel : null;
    if (currentImageModel) {
      if (!currentImageModel.primary && legacyImageModel) currentImageModel.primary = legacyImageModel;
      if (legacyImageModelFallbacks.length > 0 && (!Array.isArray(currentImageModel.fallbacks) || currentImageModel.fallbacks.length === 0)) currentImageModel.fallbacks = legacyImageModelFallbacks;
      agent.imageModel = currentImageModel;
    } else if (legacyImageModel || legacyImageModelFallbacks.length > 0) agent.imageModel = {
      primary: legacyImageModel,
      fallbacks: legacyImageModelFallbacks.length ? legacyImageModelFallbacks : []
    };
    agent.models = models;
    if (legacyModel !== void 0) changes.push(`Migrated ${label}.model string → ${label}.model.primary.`);
    if (legacyModelFallbacks.length > 0) changes.push(`Migrated ${label}.modelFallbacks → ${label}.model.fallbacks.`);
    if (legacyImageModel !== void 0) changes.push(`Migrated ${label}.imageModel string → ${label}.imageModel.primary.`);
    if (legacyImageModelFallbacks.length > 0) changes.push(`Migrated ${label}.imageModelFallbacks → ${label}.imageModel.fallbacks.`);
    if (legacyAllowed.length > 0) changes.push(`Migrated ${label}.allowedModels → ${label}.models.`);
    if (Object.keys(legacyAliases).length > 0) changes.push(`Migrated ${label}.modelAliases → ${label}.models.*.alias.`);
    delete agent.allowedModels;
    delete agent.modelAliases;
    delete agent.modelFallbacks;
    delete agent.imageModelFallbacks;
  }
},
{
  id: "routing.agents-v2",
  describe: "Move routing.agents/defaultAgentId to agents.list",
  apply: (raw, changes) => {
    const routing = getRecord(raw.routing);
    if (!routing) return;
    const routingAgents = getRecord(routing.agents);
    const agents = ensureRecord(raw, "agents");
    const list = getAgentsList(agents);
    if (routingAgents) {
      for (const [rawId, entryRaw] of Object.entries(routingAgents)) {
        const agentId = String(rawId ?? "").trim();
        const entry = getRecord(entryRaw);
        if (!agentId || !entry) continue;
        const target = ensureAgentEntry(list, agentId);
        const entryCopy = { ...entry };
        if ("mentionPatterns" in entryCopy) {
          const mentionPatterns = entryCopy.mentionPatterns;
          const groupChat = ensureRecord(target, "groupChat");
          if (groupChat.mentionPatterns === void 0) {
            groupChat.mentionPatterns = mentionPatterns;
            changes.push(`Moved routing.agents.${agentId}.mentionPatterns → agents.list (id "${agentId}").groupChat.mentionPatterns.`);
          } else changes.push(`Removed routing.agents.${agentId}.mentionPatterns (agents.list groupChat mentionPatterns already set).`);
          delete entryCopy.mentionPatterns;
        }
        const legacyGroupChat = getRecord(entryCopy.groupChat);
        if (legacyGroupChat) {
          mergeMissing(ensureRecord(target, "groupChat"), legacyGroupChat);
          delete entryCopy.groupChat;
        }
        const legacySandbox = getRecord(entryCopy.sandbox);
        if (legacySandbox) {
          const sandboxTools = getRecord(legacySandbox.tools);
          if (sandboxTools) {
            mergeMissing(ensureRecord(ensureRecord(ensureRecord(target, "tools"), "sandbox"), "tools"), sandboxTools);
            delete legacySandbox.tools;
            changes.push(`Moved routing.agents.${agentId}.sandbox.tools → agents.list (id "${agentId}").tools.sandbox.tools.`);
          }
          entryCopy.sandbox = legacySandbox;
        }
        mergeMissing(target, entryCopy);
      }
      delete routing.agents;
      changes.push("Moved routing.agents → agents.list.");
    }
    const defaultAgentId = typeof routing.defaultAgentId === "string" ? routing.defaultAgentId.trim() : "";
    if (defaultAgentId) {
      if (!list.some((entry) => (0, _registryDWvId1YW.w)(entry) && entry.default === true)) {
        const entry = ensureAgentEntry(list, defaultAgentId);
        entry.default = true;
        changes.push(`Moved routing.defaultAgentId → agents.list (id "${defaultAgentId}").default.`);
      } else changes.push("Removed routing.defaultAgentId (agents.list default already set).");
      delete routing.defaultAgentId;
    }
    if (list.length > 0) agents.list = list;
    if (Object.keys(routing).length === 0) delete raw.routing;
  }
},
{
  id: "routing.config-v2",
  describe: "Move routing bindings/groupChat/queue/agentToAgent/transcribeAudio",
  apply: (raw, changes) => {
    const routing = getRecord(raw.routing);
    if (!routing) return;
    if (routing.bindings !== void 0) {
      if (raw.bindings === void 0) {
        raw.bindings = routing.bindings;
        changes.push("Moved routing.bindings → bindings.");
      } else changes.push("Removed routing.bindings (bindings already set).");
      delete routing.bindings;
    }
    if (routing.agentToAgent !== void 0) {
      const tools = ensureRecord(raw, "tools");
      if (tools.agentToAgent === void 0) {
        tools.agentToAgent = routing.agentToAgent;
        changes.push("Moved routing.agentToAgent → tools.agentToAgent.");
      } else changes.push("Removed routing.agentToAgent (tools.agentToAgent already set).");
      delete routing.agentToAgent;
    }
    if (routing.queue !== void 0) {
      const messages = ensureRecord(raw, "messages");
      if (messages.queue === void 0) {
        messages.queue = routing.queue;
        changes.push("Moved routing.queue → messages.queue.");
      } else changes.push("Removed routing.queue (messages.queue already set).");
      delete routing.queue;
    }
    const groupChat = getRecord(routing.groupChat);
    if (groupChat) {
      const historyLimit = groupChat.historyLimit;
      if (historyLimit !== void 0) {
        const messagesGroup = ensureRecord(ensureRecord(raw, "messages"), "groupChat");
        if (messagesGroup.historyLimit === void 0) {
          messagesGroup.historyLimit = historyLimit;
          changes.push("Moved routing.groupChat.historyLimit → messages.groupChat.historyLimit.");
        } else changes.push("Removed routing.groupChat.historyLimit (messages.groupChat.historyLimit already set).");
        delete groupChat.historyLimit;
      }
      const mentionPatterns = groupChat.mentionPatterns;
      if (mentionPatterns !== void 0) {
        const messagesGroup = ensureRecord(ensureRecord(raw, "messages"), "groupChat");
        if (messagesGroup.mentionPatterns === void 0) {
          messagesGroup.mentionPatterns = mentionPatterns;
          changes.push("Moved routing.groupChat.mentionPatterns → messages.groupChat.mentionPatterns.");
        } else changes.push("Removed routing.groupChat.mentionPatterns (messages.groupChat.mentionPatterns already set).");
        delete groupChat.mentionPatterns;
      }
      if (Object.keys(groupChat).length === 0) delete routing.groupChat;else
      routing.groupChat = groupChat;
    }
    if (routing.transcribeAudio !== void 0) {
      const mapped = mapLegacyAudioTranscription(routing.transcribeAudio);
      if (mapped) {
        const mediaAudio = ensureRecord(ensureRecord(ensureRecord(raw, "tools"), "media"), "audio");
        if ((Array.isArray(mediaAudio.models) ? mediaAudio.models : []).length === 0) {
          mediaAudio.enabled = true;
          mediaAudio.models = [mapped];
          changes.push("Moved routing.transcribeAudio → tools.media.audio.models.");
        } else changes.push("Removed routing.transcribeAudio (tools.media.audio.models already set).");
      } else changes.push("Removed routing.transcribeAudio (invalid or empty command).");
      delete routing.transcribeAudio;
    }
    if (Object.keys(routing).length === 0) delete raw.routing;
  }
},
{
  id: "audio.transcription-v2",
  describe: "Move audio.transcription to tools.media.audio.models",
  apply: (raw, changes) => {
    const audio = getRecord(raw.audio);
    if (audio?.transcription === void 0) return;
    const mapped = mapLegacyAudioTranscription(audio.transcription);
    if (mapped) {
      const mediaAudio = ensureRecord(ensureRecord(ensureRecord(raw, "tools"), "media"), "audio");
      if ((Array.isArray(mediaAudio.models) ? mediaAudio.models : []).length === 0) {
        mediaAudio.enabled = true;
        mediaAudio.models = [mapped];
        changes.push("Moved audio.transcription → tools.media.audio.models.");
      } else changes.push("Removed audio.transcription (tools.media.audio.models already set).");
      delete audio.transcription;
      if (Object.keys(audio).length === 0) delete raw.audio;else
      raw.audio = audio;
    } else {
      delete audio.transcription;
      changes.push("Removed audio.transcription (invalid or empty command).");
      if (Object.keys(audio).length === 0) delete raw.audio;else
      raw.audio = audio;
    }
  }
}];


//#endregion
//#region src/config/legacy.migrations.part-3.ts
const LEGACY_CONFIG_MIGRATIONS_PART_3 = [
{
  id: "memorySearch->agents.defaults.memorySearch",
  describe: "Move top-level memorySearch to agents.defaults.memorySearch",
  apply: (raw, changes) => {
    const legacyMemorySearch = getRecord(raw.memorySearch);
    if (!legacyMemorySearch) return;
    const agents = ensureRecord(raw, "agents");
    const defaults = ensureRecord(agents, "defaults");
    const existing = getRecord(defaults.memorySearch);
    if (!existing) {
      defaults.memorySearch = legacyMemorySearch;
      changes.push("Moved memorySearch → agents.defaults.memorySearch.");
    } else {
      const merged = structuredClone(existing);
      mergeMissing(merged, legacyMemorySearch);
      defaults.memorySearch = merged;
      changes.push("Merged memorySearch → agents.defaults.memorySearch (filled missing fields from legacy; kept explicit agents.defaults values).");
    }
    agents.defaults = defaults;
    raw.agents = agents;
    delete raw.memorySearch;
  }
},
{
  id: "auth.anthropic-claude-cli-mode-oauth",
  describe: "Switch anthropic:claude-cli auth profile mode to oauth",
  apply: (raw, changes) => {
    const profiles = getRecord(getRecord(raw.auth)?.profiles);
    if (!profiles) return;
    const claudeCli = getRecord(profiles["anthropic:claude-cli"]);
    if (!claudeCli) return;
    if (claudeCli.mode !== "token") return;
    claudeCli.mode = "oauth";
    changes.push("Updated auth.profiles[\"anthropic:claude-cli\"].mode → \"oauth\".");
  }
},
{
  id: "tools.bash->tools.exec",
  describe: "Move tools.bash to tools.exec",
  apply: (raw, changes) => {
    const tools = ensureRecord(raw, "tools");
    const bash = getRecord(tools.bash);
    if (!bash) return;
    if (tools.exec === void 0) {
      tools.exec = bash;
      changes.push("Moved tools.bash → tools.exec.");
    } else changes.push("Removed tools.bash (tools.exec already set).");
    delete tools.bash;
  }
},
{
  id: "messages.tts.enabled->auto",
  describe: "Move messages.tts.enabled to messages.tts.auto",
  apply: (raw, changes) => {
    const tts = getRecord(getRecord(raw.messages)?.tts);
    if (!tts) return;
    if (tts.auto !== void 0) {
      if ("enabled" in tts) {
        delete tts.enabled;
        changes.push("Removed messages.tts.enabled (messages.tts.auto already set).");
      }
      return;
    }
    if (typeof tts.enabled !== "boolean") return;
    tts.auto = tts.enabled ? "always" : "off";
    delete tts.enabled;
    changes.push(`Moved messages.tts.enabled → messages.tts.auto (${String(tts.auto)}).`);
  }
},
{
  id: "agent.defaults-v2",
  describe: "Move agent config to agents.defaults and tools",
  apply: (raw, changes) => {
    const agent = getRecord(raw.agent);
    if (!agent) return;
    const agents = ensureRecord(raw, "agents");
    const defaults = getRecord(agents.defaults) ?? {};
    const tools = ensureRecord(raw, "tools");
    const agentTools = getRecord(agent.tools);
    if (agentTools) {
      if (tools.allow === void 0 && agentTools.allow !== void 0) {
        tools.allow = agentTools.allow;
        changes.push("Moved agent.tools.allow → tools.allow.");
      }
      if (tools.deny === void 0 && agentTools.deny !== void 0) {
        tools.deny = agentTools.deny;
        changes.push("Moved agent.tools.deny → tools.deny.");
      }
    }
    const elevated = getRecord(agent.elevated);
    if (elevated) if (tools.elevated === void 0) {
      tools.elevated = elevated;
      changes.push("Moved agent.elevated → tools.elevated.");
    } else changes.push("Removed agent.elevated (tools.elevated already set).");
    const bash = getRecord(agent.bash);
    if (bash) if (tools.exec === void 0) {
      tools.exec = bash;
      changes.push("Moved agent.bash → tools.exec.");
    } else changes.push("Removed agent.bash (tools.exec already set).");
    const sandbox = getRecord(agent.sandbox);
    if (sandbox) {
      const sandboxTools = getRecord(sandbox.tools);
      if (sandboxTools) {
        mergeMissing(ensureRecord(ensureRecord(tools, "sandbox"), "tools"), sandboxTools);
        delete sandbox.tools;
        changes.push("Moved agent.sandbox.tools → tools.sandbox.tools.");
      }
    }
    const subagents = getRecord(agent.subagents);
    if (subagents) {
      const subagentTools = getRecord(subagents.tools);
      if (subagentTools) {
        mergeMissing(ensureRecord(ensureRecord(tools, "subagents"), "tools"), subagentTools);
        delete subagents.tools;
        changes.push("Moved agent.subagents.tools → tools.subagents.tools.");
      }
    }
    const agentCopy = structuredClone(agent);
    delete agentCopy.tools;
    delete agentCopy.elevated;
    delete agentCopy.bash;
    if ((0, _registryDWvId1YW.w)(agentCopy.sandbox)) delete agentCopy.sandbox.tools;
    if ((0, _registryDWvId1YW.w)(agentCopy.subagents)) delete agentCopy.subagents.tools;
    mergeMissing(defaults, agentCopy);
    agents.defaults = defaults;
    raw.agents = agents;
    delete raw.agent;
    changes.push("Moved agent → agents.defaults.");
  }
},
{
  id: "identity->agents.list",
  describe: "Move identity to agents.list[].identity",
  apply: (raw, changes) => {
    const identity = getRecord(raw.identity);
    if (!identity) return;
    const agents = ensureRecord(raw, "agents");
    const list = getAgentsList(agents);
    const defaultId = resolveDefaultAgentIdFromRaw(raw);
    const entry = ensureAgentEntry(list, defaultId);
    if (entry.identity === void 0) {
      entry.identity = identity;
      changes.push(`Moved identity → agents.list (id "${defaultId}").identity.`);
    } else changes.push("Removed identity (agents.list identity already set).");
    agents.list = list;
    raw.agents = agents;
    delete raw.identity;
  }
}];


//#endregion
//#region src/config/legacy.migrations.ts
const LEGACY_CONFIG_MIGRATIONS = [
...LEGACY_CONFIG_MIGRATIONS_PART_1,
...LEGACY_CONFIG_MIGRATIONS_PART_2,
...LEGACY_CONFIG_MIGRATIONS_PART_3];


//#endregion
//#region src/config/legacy.rules.ts
const LEGACY_CONFIG_RULES = [
{
  path: ["whatsapp"],
  message: "whatsapp config moved to channels.whatsapp (auto-migrated on load)."
},
{
  path: ["telegram"],
  message: "telegram config moved to channels.telegram (auto-migrated on load)."
},
{
  path: ["discord"],
  message: "discord config moved to channels.discord (auto-migrated on load)."
},
{
  path: ["slack"],
  message: "slack config moved to channels.slack (auto-migrated on load)."
},
{
  path: ["signal"],
  message: "signal config moved to channels.signal (auto-migrated on load)."
},
{
  path: ["imessage"],
  message: "imessage config moved to channels.imessage (auto-migrated on load)."
},
{
  path: ["msteams"],
  message: "msteams config moved to channels.msteams (auto-migrated on load)."
},
{
  path: ["routing", "allowFrom"],
  message: "routing.allowFrom was removed; use channels.whatsapp.allowFrom instead (auto-migrated on load)."
},
{
  path: ["routing", "bindings"],
  message: "routing.bindings was moved; use top-level bindings instead (auto-migrated on load)."
},
{
  path: ["routing", "agents"],
  message: "routing.agents was moved; use agents.list instead (auto-migrated on load)."
},
{
  path: ["routing", "defaultAgentId"],
  message: "routing.defaultAgentId was moved; use agents.list[].default instead (auto-migrated on load)."
},
{
  path: ["routing", "agentToAgent"],
  message: "routing.agentToAgent was moved; use tools.agentToAgent instead (auto-migrated on load)."
},
{
  path: [
  "routing",
  "groupChat",
  "requireMention"],

  message: "routing.groupChat.requireMention was removed; use channels.whatsapp/telegram/imessage groups defaults (e.g. channels.whatsapp.groups.\"*\".requireMention) instead (auto-migrated on load)."
},
{
  path: [
  "routing",
  "groupChat",
  "mentionPatterns"],

  message: "routing.groupChat.mentionPatterns was moved; use agents.list[].groupChat.mentionPatterns or messages.groupChat.mentionPatterns instead (auto-migrated on load)."
},
{
  path: ["routing", "queue"],
  message: "routing.queue was moved; use messages.queue instead (auto-migrated on load)."
},
{
  path: ["routing", "transcribeAudio"],
  message: "routing.transcribeAudio was moved; use tools.media.audio.models instead (auto-migrated on load)."
},
{
  path: ["telegram", "requireMention"],
  message: "telegram.requireMention was removed; use channels.telegram.groups.\"*\".requireMention instead (auto-migrated on load)."
},
{
  path: ["identity"],
  message: "identity was moved; use agents.list[].identity instead (auto-migrated on load)."
},
{
  path: ["agent"],
  message: "agent.* was moved; use agents.defaults (and tools.* for tool/elevated/exec settings) instead (auto-migrated on load)."
},
{
  path: ["memorySearch"],
  message: "top-level memorySearch was moved; use agents.defaults.memorySearch instead (auto-migrated on load)."
},
{
  path: ["tools", "bash"],
  message: "tools.bash was removed; use tools.exec instead (auto-migrated on load)."
},
{
  path: ["agent", "model"],
  message: "agent.model string was replaced by agents.defaults.model.primary/fallbacks and agents.defaults.models (auto-migrated on load).",
  match: (value) => typeof value === "string"
},
{
  path: ["agent", "imageModel"],
  message: "agent.imageModel string was replaced by agents.defaults.imageModel.primary/fallbacks (auto-migrated on load).",
  match: (value) => typeof value === "string"
},
{
  path: ["agent", "allowedModels"],
  message: "agent.allowedModels was replaced by agents.defaults.models (auto-migrated on load)."
},
{
  path: ["agent", "modelAliases"],
  message: "agent.modelAliases was replaced by agents.defaults.models.*.alias (auto-migrated on load)."
},
{
  path: ["agent", "modelFallbacks"],
  message: "agent.modelFallbacks was replaced by agents.defaults.model.fallbacks (auto-migrated on load)."
},
{
  path: ["agent", "imageModelFallbacks"],
  message: "agent.imageModelFallbacks was replaced by agents.defaults.imageModel.fallbacks (auto-migrated on load)."
},
{
  path: [
  "messages",
  "tts",
  "enabled"],

  message: "messages.tts.enabled was replaced by messages.tts.auto (auto-migrated on load)."
},
{
  path: ["gateway", "token"],
  message: "gateway.token is ignored; use gateway.auth.token instead (auto-migrated on load)."
}];


//#endregion
//#region src/config/legacy.ts
function findLegacyConfigIssues(raw) {
  if (!raw || typeof raw !== "object") return [];
  const root = raw;
  const issues = [];
  for (const rule of LEGACY_CONFIG_RULES) {
    let cursor = root;
    for (const key of rule.path) {
      if (!cursor || typeof cursor !== "object") {
        cursor = void 0;
        break;
      }
      cursor = cursor[key];
    }
    if (cursor !== void 0 && (!rule.match || rule.match(cursor, root))) issues.push({
      path: rule.path.join("."),
      message: rule.message
    });
  }
  return issues;
}

//#endregion
//#region src/config/merge-patch.ts
function isObjectWithStringId(value) {
  if (!(0, _registryDWvId1YW.C)(value)) return false;
  return typeof value.id === "string" && value.id.length > 0;
}
function mergeObjectArraysById(base, patch, options) {
  if (!base.every(isObjectWithStringId) || !patch.every(isObjectWithStringId)) return;
  const merged = [...base];
  const indexById = /* @__PURE__ */new Map();
  for (const [index, entry] of merged.entries()) indexById.set(entry.id, index);
  for (const entry of patch) {
    const existingIndex = indexById.get(entry.id);
    if (existingIndex === void 0) {
      merged.push(structuredClone(entry));
      indexById.set(entry.id, merged.length - 1);
      continue;
    }
    merged[existingIndex] = applyMergePatch(merged[existingIndex], entry, options);
  }
  return merged;
}
function applyMergePatch(base, patch, options = {}) {
  if (!(0, _registryDWvId1YW.C)(patch)) return patch;
  const result = (0, _registryDWvId1YW.C)(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }
    if (options.mergeObjectArraysById && Array.isArray(result[key]) && Array.isArray(value)) {
      const mergedArray = mergeObjectArraysById(result[key], value, options);
      if (mergedArray) {
        result[key] = mergedArray;
        continue;
      }
    }
    if ((0, _registryDWvId1YW.C)(value)) {
      const baseValue = result[key];
      result[key] = applyMergePatch((0, _registryDWvId1YW.C)(baseValue) ? baseValue : {}, value, options);
      continue;
    }
    result[key] = value;
  }
  return result;
}

//#endregion
//#region src/config/normalize-paths.ts
const PATH_VALUE_RE = /^~(?=$|[\\/])/;
const PATH_KEY_RE = /(dir|path|paths|file|root|workspace)$/i;
const PATH_LIST_KEYS = new Set(["paths", "pathPrepend"]);
function normalizeStringValue(key, value) {
  if (!PATH_VALUE_RE.test(value.trim())) return value;
  if (!key) return value;
  if (PATH_KEY_RE.test(key) || PATH_LIST_KEYS.has(key)) return (0, _registryDWvId1YW.j)(value);
  return value;
}
function normalizeAny(key, value) {
  if (typeof value === "string") return normalizeStringValue(key, value);
  if (Array.isArray(value)) {
    const normalizeChildren = Boolean(key && PATH_LIST_KEYS.has(key));
    return value.map((entry) => {
      if (typeof entry === "string") return normalizeChildren ? normalizeStringValue(key, entry) : entry;
      if (Array.isArray(entry)) return normalizeAny(void 0, entry);
      if ((0, _registryDWvId1YW.C)(entry)) return normalizeAny(void 0, entry);
      return entry;
    });
  }
  if (!(0, _registryDWvId1YW.C)(value)) return value;
  for (const [childKey, childValue] of Object.entries(value)) {
    const next = normalizeAny(childKey, childValue);
    if (next !== childValue) value[childKey] = next;
  }
  return value;
}
/**
* Normalize "~" paths in path-ish config fields.
*
* Goal: accept `~/...` consistently across config file + env overrides, while
* keeping the surface area small and predictable.
*/
function normalizeConfigPaths(cfg) {
  if (!cfg || typeof cfg !== "object") return cfg;
  normalizeAny(void 0, cfg);
  return cfg;
}

//#endregion
//#region src/config/config-paths.ts
const BLOCKED_KEYS = new Set([
"__proto__",
"prototype",
"constructor"]
);
function parseConfigPath(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return {
    ok: false,
    error: "Invalid path. Use dot notation (e.g. foo.bar)."
  };
  const parts = trimmed.split(".").map((part) => part.trim());
  if (parts.some((part) => !part)) return {
    ok: false,
    error: "Invalid path. Use dot notation (e.g. foo.bar)."
  };
  if (parts.some((part) => BLOCKED_KEYS.has(part))) return {
    ok: false,
    error: "Invalid path segment."
  };
  return {
    ok: true,
    path: parts
  };
}
function setConfigValueAtPath(root, path, value) {
  let cursor = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!(0, _registryDWvId1YW.C)(next)) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
}
function unsetConfigValueAtPath(root, path) {
  const stack = [];
  let cursor = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!(0, _registryDWvId1YW.C)(next)) return false;
    stack.push({
      node: cursor,
      key
    });
    cursor = next;
  }
  const leafKey = path[path.length - 1];
  if (!(leafKey in cursor)) return false;
  delete cursor[leafKey];
  for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
    const { node, key } = stack[idx];
    const child = node[key];
    if ((0, _registryDWvId1YW.C)(child) && Object.keys(child).length === 0) delete node[key];else
    break;
  }
  return true;
}
function getConfigValueAtPath(root, path) {
  let cursor = root;
  for (const key of path) {
    if (!(0, _registryDWvId1YW.C)(cursor)) return;
    cursor = cursor[key];
  }
  return cursor;
}

//#endregion
//#region src/config/runtime-overrides.ts
let overrides = {};
function mergeOverrides(base, override) {
  if (!(0, _registryDWvId1YW.C)(base) || !(0, _registryDWvId1YW.C)(override)) return override;
  const next = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === void 0) continue;
    next[key] = mergeOverrides(base[key], value);
  }
  return next;
}
function getConfigOverrides() {
  return overrides;
}
function resetConfigOverrides() {
  overrides = {};
}
function setConfigOverride(pathRaw, value) {
  const parsed = parseConfigPath(pathRaw);
  if (!parsed.ok || !parsed.path) return {
    ok: false,
    error: parsed.error ?? "Invalid path."
  };
  setConfigValueAtPath(overrides, parsed.path, value);
  return { ok: true };
}
function unsetConfigOverride(pathRaw) {
  const parsed = parseConfigPath(pathRaw);
  if (!parsed.ok || !parsed.path) return {
    ok: false,
    removed: false,
    error: parsed.error ?? "Invalid path."
  };
  return {
    ok: true,
    removed: unsetConfigValueAtPath(overrides, parsed.path)
  };
}
function applyConfigOverrides(cfg) {
  if (!overrides || Object.keys(overrides).length === 0) return cfg;
  return mergeOverrides(cfg, overrides);
}

//#endregion
//#region src/plugins/schema-validator.ts
const ajv = new _ajv.default({
  allErrors: true,
  strict: false,
  removeAdditional: false
});
const schemaCache = /* @__PURE__ */new Map();
function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) return ["invalid config"];
  return errors.map((error) => {
    return `${error.instancePath?.replace(/^\//, "").replace(/\//g, ".") || "<root>"}: ${error.message ?? "invalid"}`;
  });
}
function validateJsonSchemaValue(params) {
  let cached = schemaCache.get(params.cacheKey);
  if (!cached || cached.schema !== params.schema) {
    cached = {
      validate: ajv.compile(params.schema),
      schema: params.schema
    };
    schemaCache.set(params.cacheKey, cached);
  }
  if (cached.validate(params.value)) return { ok: true };
  return {
    ok: false,
    errors: formatAjvErrors(cached.validate.errors)
  };
}

//#endregion
//#region src/config/zod-schema.agent-defaults.ts
const AgentDefaultsSchema = _zod.z.object({
  model: _zod.z.object({
    primary: _zod.z.string().optional(),
    fallbacks: _zod.z.array(_zod.z.string()).optional()
  }).strict().optional(),
  imageModel: _zod.z.object({
    primary: _zod.z.string().optional(),
    fallbacks: _zod.z.array(_zod.z.string()).optional()
  }).strict().optional(),
  models: _zod.z.record(_zod.z.string(), _zod.z.object({
    alias: _zod.z.string().optional(),
    params: _zod.z.record(_zod.z.string(), _zod.z.unknown()).optional(),
    streaming: _zod.z.boolean().optional()
  }).strict()).optional(),
  workspace: _zod.z.string().optional(),
  repoRoot: _zod.z.string().optional(),
  skipBootstrap: _zod.z.boolean().optional(),
  bootstrapMaxChars: _zod.z.number().int().positive().optional(),
  bootstrapTotalMaxChars: _zod.z.number().int().positive().optional(),
  userTimezone: _zod.z.string().optional(),
  timeFormat: _zod.z.union([
  _zod.z.literal("auto"),
  _zod.z.literal("12"),
  _zod.z.literal("24")]
  ).optional(),
  envelopeTimezone: _zod.z.string().optional(),
  envelopeTimestamp: _zod.z.union([_zod.z.literal("on"), _zod.z.literal("off")]).optional(),
  envelopeElapsed: _zod.z.union([_zod.z.literal("on"), _zod.z.literal("off")]).optional(),
  contextTokens: _zod.z.number().int().positive().optional(),
  cliBackends: _zod.z.record(_zod.z.string(), CliBackendSchema).optional(),
  memorySearch: MemorySearchSchema,
  contextPruning: _zod.z.object({
    mode: _zod.z.union([_zod.z.literal("off"), _zod.z.literal("cache-ttl")]).optional(),
    ttl: _zod.z.string().optional(),
    keepLastAssistants: _zod.z.number().int().nonnegative().optional(),
    softTrimRatio: _zod.z.number().min(0).max(1).optional(),
    hardClearRatio: _zod.z.number().min(0).max(1).optional(),
    minPrunableToolChars: _zod.z.number().int().nonnegative().optional(),
    tools: _zod.z.object({
      allow: _zod.z.array(_zod.z.string()).optional(),
      deny: _zod.z.array(_zod.z.string()).optional()
    }).strict().optional(),
    softTrim: _zod.z.object({
      maxChars: _zod.z.number().int().nonnegative().optional(),
      headChars: _zod.z.number().int().nonnegative().optional(),
      tailChars: _zod.z.number().int().nonnegative().optional()
    }).strict().optional(),
    hardClear: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      placeholder: _zod.z.string().optional()
    }).strict().optional()
  }).strict().optional(),
  compaction: _zod.z.object({
    mode: _zod.z.union([_zod.z.literal("default"), _zod.z.literal("safeguard")]).optional(),
    reserveTokensFloor: _zod.z.number().int().nonnegative().optional(),
    maxHistoryShare: _zod.z.number().min(.1).max(.9).optional(),
    memoryFlush: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      softThresholdTokens: _zod.z.number().int().nonnegative().optional(),
      prompt: _zod.z.string().optional(),
      systemPrompt: _zod.z.string().optional()
    }).strict().optional()
  }).strict().optional(),
  thinkingDefault: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("minimal"),
  _zod.z.literal("low"),
  _zod.z.literal("medium"),
  _zod.z.literal("high"),
  _zod.z.literal("xhigh")]
  ).optional(),
  verboseDefault: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("on"),
  _zod.z.literal("full")]
  ).optional(),
  elevatedDefault: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("on"),
  _zod.z.literal("ask"),
  _zod.z.literal("full")]
  ).optional(),
  blockStreamingDefault: _zod.z.union([_zod.z.literal("off"), _zod.z.literal("on")]).optional(),
  blockStreamingBreak: _zod.z.union([_zod.z.literal("text_end"), _zod.z.literal("message_end")]).optional(),
  blockStreamingChunk: BlockStreamingChunkSchema.optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  humanDelay: HumanDelaySchema.optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  mediaMaxMb: _zod.z.number().positive().optional(),
  typingIntervalSeconds: _zod.z.number().int().positive().optional(),
  typingMode: _zod.z.union([
  _zod.z.literal("never"),
  _zod.z.literal("instant"),
  _zod.z.literal("thinking"),
  _zod.z.literal("message")]
  ).optional(),
  heartbeat: HeartbeatSchema,
  maxConcurrent: _zod.z.number().int().positive().optional(),
  subagents: _zod.z.object({
    maxConcurrent: _zod.z.number().int().positive().optional(),
    maxSpawnDepth: _zod.z.number().int().min(1).max(5).optional().describe("Maximum nesting depth for sub-agent spawning. 1 = no nesting (default), 2 = sub-agents can spawn sub-sub-agents."),
    maxChildrenPerAgent: _zod.z.number().int().min(1).max(20).optional().describe("Maximum number of active children a single agent session can spawn (default: 5)."),
    archiveAfterMinutes: _zod.z.number().int().positive().optional(),
    model: AgentModelSchema.optional(),
    thinking: _zod.z.string().optional()
  }).strict().optional(),
  sandbox: AgentSandboxSchema
}).strict().optional();

//#endregion
//#region src/config/zod-schema.agents.ts
const AgentsSchema = _zod.z.object({
  defaults: _zod.z.lazy(() => AgentDefaultsSchema).optional(),
  list: _zod.z.array(AgentEntrySchema).optional()
}).strict().optional();
const BindingsSchema = _zod.z.array(_zod.z.object({
  agentId: _zod.z.string(),
  match: _zod.z.object({
    channel: _zod.z.string(),
    accountId: _zod.z.string().optional(),
    peer: _zod.z.object({
      kind: _zod.z.union([
      _zod.z.literal("direct"),
      _zod.z.literal("group"),
      _zod.z.literal("channel"),
      _zod.z.literal("dm")]
      ),
      id: _zod.z.string()
    }).strict().optional(),
    guildId: _zod.z.string().optional(),
    teamId: _zod.z.string().optional(),
    roles: _zod.z.array(_zod.z.string()).optional()
  }).strict()
}).strict()).optional();
const BroadcastStrategySchema = _zod.z.enum(["parallel", "sequential"]);
const BroadcastSchema = _zod.z.object({ strategy: BroadcastStrategySchema.optional() }).catchall(_zod.z.array(_zod.z.string())).optional();
const AudioSchema = _zod.z.object({ transcription: TranscribeAudioSchema }).strict().optional();

//#endregion
//#region src/config/zod-schema.approvals.ts
const ExecApprovalForwardTargetSchema = _zod.z.object({
  channel: _zod.z.string().min(1),
  to: _zod.z.string().min(1),
  accountId: _zod.z.string().optional(),
  threadId: _zod.z.union([_zod.z.string(), _zod.z.number()]).optional()
}).strict();
const ExecApprovalForwardingSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  mode: _zod.z.union([
  _zod.z.literal("session"),
  _zod.z.literal("targets"),
  _zod.z.literal("both")]
  ).optional(),
  agentFilter: _zod.z.array(_zod.z.string()).optional(),
  sessionFilter: _zod.z.array(_zod.z.string()).optional(),
  targets: _zod.z.array(ExecApprovalForwardTargetSchema).optional()
}).strict().optional();
const ApprovalsSchema = _zod.z.object({ exec: ExecApprovalForwardingSchema }).strict().optional();

//#endregion
//#region src/config/zod-schema.hooks.ts
function isSafeRelativeModulePath(raw) {
  const value = raw.trim();
  if (!value) return false;
  if (_nodePath.default.isAbsolute(value)) return false;
  if (value.startsWith("~")) return false;
  if (value.includes(":")) return false;
  if (value.split(/[\\/]+/g).some((part) => part === "..")) return false;
  return true;
}
const SafeRelativeModulePathSchema = _zod.z.string().refine(isSafeRelativeModulePath, "module must be a safe relative path (no absolute paths)");
const HookMappingSchema = _zod.z.object({
  id: _zod.z.string().optional(),
  match: _zod.z.object({
    path: _zod.z.string().optional(),
    source: _zod.z.string().optional()
  }).optional(),
  action: _zod.z.union([_zod.z.literal("wake"), _zod.z.literal("agent")]).optional(),
  wakeMode: _zod.z.union([_zod.z.literal("now"), _zod.z.literal("next-heartbeat")]).optional(),
  name: _zod.z.string().optional(),
  agentId: _zod.z.string().optional(),
  sessionKey: _zod.z.string().optional().register(sensitive),
  messageTemplate: _zod.z.string().optional(),
  textTemplate: _zod.z.string().optional(),
  deliver: _zod.z.boolean().optional(),
  allowUnsafeExternalContent: _zod.z.boolean().optional(),
  channel: _zod.z.union([
  _zod.z.literal("last"),
  _zod.z.literal("whatsapp"),
  _zod.z.literal("telegram"),
  _zod.z.literal("discord"),
  _zod.z.literal("irc"),
  _zod.z.literal("slack"),
  _zod.z.literal("signal"),
  _zod.z.literal("imessage"),
  _zod.z.literal("msteams")]
  ).optional(),
  to: _zod.z.string().optional(),
  model: _zod.z.string().optional(),
  thinking: _zod.z.string().optional(),
  timeoutSeconds: _zod.z.number().int().positive().optional(),
  transform: _zod.z.object({
    module: SafeRelativeModulePathSchema,
    export: _zod.z.string().optional()
  }).strict().optional()
}).strict().optional();
const InternalHookHandlerSchema = _zod.z.object({
  event: _zod.z.string(),
  module: SafeRelativeModulePathSchema,
  export: _zod.z.string().optional()
}).strict();
const HookConfigSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  env: _zod.z.record(_zod.z.string(), _zod.z.string()).optional()
}).passthrough();
const HookInstallRecordSchema = _zod.z.object({
  source: _zod.z.union([
  _zod.z.literal("npm"),
  _zod.z.literal("archive"),
  _zod.z.literal("path")]
  ),
  spec: _zod.z.string().optional(),
  sourcePath: _zod.z.string().optional(),
  installPath: _zod.z.string().optional(),
  version: _zod.z.string().optional(),
  installedAt: _zod.z.string().optional(),
  hooks: _zod.z.array(_zod.z.string()).optional()
}).strict();
const InternalHooksSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  handlers: _zod.z.array(InternalHookHandlerSchema).optional(),
  entries: _zod.z.record(_zod.z.string(), HookConfigSchema).optional(),
  load: _zod.z.object({ extraDirs: _zod.z.array(_zod.z.string()).optional() }).strict().optional(),
  installs: _zod.z.record(_zod.z.string(), HookInstallRecordSchema).optional()
}).strict().optional();
const HooksGmailSchema = _zod.z.object({
  account: _zod.z.string().optional(),
  label: _zod.z.string().optional(),
  topic: _zod.z.string().optional(),
  subscription: _zod.z.string().optional(),
  pushToken: _zod.z.string().optional().register(sensitive),
  hookUrl: _zod.z.string().optional(),
  includeBody: _zod.z.boolean().optional(),
  maxBytes: _zod.z.number().int().positive().optional(),
  renewEveryMinutes: _zod.z.number().int().positive().optional(),
  allowUnsafeExternalContent: _zod.z.boolean().optional(),
  serve: _zod.z.object({
    bind: _zod.z.string().optional(),
    port: _zod.z.number().int().positive().optional(),
    path: _zod.z.string().optional()
  }).strict().optional(),
  tailscale: _zod.z.object({
    mode: _zod.z.union([
    _zod.z.literal("off"),
    _zod.z.literal("serve"),
    _zod.z.literal("funnel")]
    ).optional(),
    path: _zod.z.string().optional(),
    target: _zod.z.string().optional()
  }).strict().optional(),
  model: _zod.z.string().optional(),
  thinking: _zod.z.union([
  _zod.z.literal("off"),
  _zod.z.literal("minimal"),
  _zod.z.literal("low"),
  _zod.z.literal("medium"),
  _zod.z.literal("high")]
  ).optional()
}).strict().optional();

//#endregion
//#region src/config/zod-schema.providers.ts
const ChannelsSchema = _zod.z.object({
  defaults: _zod.z.object({
    groupPolicy: GroupPolicySchema.optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema
  }).strict().optional(),
  whatsapp: WhatsAppConfigSchema.optional(),
  telegram: TelegramConfigSchema.optional(),
  discord: DiscordConfigSchema.optional(),
  irc: IrcConfigSchema.optional(),
  googlechat: GoogleChatConfigSchema.optional(),
  slack: SlackConfigSchema.optional(),
  signal: SignalConfigSchema.optional(),
  imessage: IMessageConfigSchema.optional(),
  bluebubbles: BlueBubblesConfigSchema.optional(),
  msteams: MSTeamsConfigSchema.optional()
}).passthrough().optional();

//#endregion
//#region src/cli/parse-bytes.ts
const UNIT_MULTIPLIERS = {
  b: 1,
  kb: 1024,
  k: 1024,
  mb: 1024 ** 2,
  m: 1024 ** 2,
  gb: 1024 ** 3,
  g: 1024 ** 3,
  tb: 1024 ** 4,
  t: 1024 ** 4
};
function parseByteSize(raw, opts) {
  const trimmed = String(raw ?? "").trim().toLowerCase();
  if (!trimmed) throw new Error("invalid byte size (empty)");
  const m = /^(\d+(?:\.\d+)?)([a-z]+)?$/.exec(trimmed);
  if (!m) throw new Error(`invalid byte size: ${raw}`);
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid byte size: ${raw}`);
  const multiplier = UNIT_MULTIPLIERS[(m[2] ?? opts?.defaultUnit ?? "b").toLowerCase()];
  if (!multiplier) throw new Error(`invalid byte size unit: ${raw}`);
  const bytes = Math.round(value * multiplier);
  if (!Number.isFinite(bytes)) throw new Error(`invalid byte size: ${raw}`);
  return bytes;
}

//#endregion
//#region src/config/zod-schema.session.ts
const SessionResetConfigSchema = _zod.z.object({
  mode: _zod.z.union([_zod.z.literal("daily"), _zod.z.literal("idle")]).optional(),
  atHour: _zod.z.number().int().min(0).max(23).optional(),
  idleMinutes: _zod.z.number().int().positive().optional()
}).strict();
const SessionSendPolicySchema = createAllowDenyChannelRulesSchema();
const SessionSchema = _zod.z.object({
  scope: _zod.z.union([_zod.z.literal("per-sender"), _zod.z.literal("global")]).optional(),
  dmScope: _zod.z.union([
  _zod.z.literal("main"),
  _zod.z.literal("per-peer"),
  _zod.z.literal("per-channel-peer"),
  _zod.z.literal("per-account-channel-peer")]
  ).optional(),
  identityLinks: _zod.z.record(_zod.z.string(), _zod.z.array(_zod.z.string())).optional(),
  resetTriggers: _zod.z.array(_zod.z.string()).optional(),
  idleMinutes: _zod.z.number().int().positive().optional(),
  reset: SessionResetConfigSchema.optional(),
  resetByType: _zod.z.object({
    direct: SessionResetConfigSchema.optional(),
    dm: SessionResetConfigSchema.optional(),
    group: SessionResetConfigSchema.optional(),
    thread: SessionResetConfigSchema.optional()
  }).strict().optional(),
  resetByChannel: _zod.z.record(_zod.z.string(), SessionResetConfigSchema).optional(),
  store: _zod.z.string().optional(),
  typingIntervalSeconds: _zod.z.number().int().positive().optional(),
  typingMode: _zod.z.union([
  _zod.z.literal("never"),
  _zod.z.literal("instant"),
  _zod.z.literal("thinking"),
  _zod.z.literal("message")]
  ).optional(),
  mainKey: _zod.z.string().optional(),
  sendPolicy: SessionSendPolicySchema.optional(),
  agentToAgent: _zod.z.object({ maxPingPongTurns: _zod.z.number().int().min(0).max(5).optional() }).strict().optional(),
  maintenance: _zod.z.object({
    mode: _zod.z.enum(["enforce", "warn"]).optional(),
    pruneAfter: _zod.z.union([_zod.z.string(), _zod.z.number()]).optional(),
    pruneDays: _zod.z.number().int().positive().optional(),
    maxEntries: _zod.z.number().int().positive().optional(),
    rotateBytes: _zod.z.union([_zod.z.string(), _zod.z.number()]).optional()
  }).strict().superRefine((val, ctx) => {
    if (val.pruneAfter !== void 0) try {
      parseDurationMs(String(val.pruneAfter).trim(), { defaultUnit: "d" });
    } catch {
      ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: ["pruneAfter"],
        message: "invalid duration (use ms, s, m, h, d)"
      });
    }
    if (val.rotateBytes !== void 0) try {
      parseByteSize(String(val.rotateBytes).trim(), { defaultUnit: "b" });
    } catch {
      ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: ["rotateBytes"],
        message: "invalid size (use b, kb, mb, gb, tb)"
      });
    }
  }).optional()
}).strict().optional();
const MessagesSchema = _zod.z.object({
  messagePrefix: _zod.z.string().optional(),
  responsePrefix: _zod.z.string().optional(),
  groupChat: GroupChatSchema,
  queue: QueueSchema,
  inbound: InboundDebounceSchema,
  ackReaction: _zod.z.string().optional(),
  ackReactionScope: _zod.z.enum([
  "group-mentions",
  "group-all",
  "direct",
  "all"]
  ).optional(),
  removeAckAfterReply: _zod.z.boolean().optional(),
  suppressToolErrors: _zod.z.boolean().optional(),
  tts: TtsConfigSchema
}).strict().optional();
const CommandsSchema = _zod.z.object({
  native: NativeCommandsSettingSchema.optional().default("auto"),
  nativeSkills: NativeCommandsSettingSchema.optional().default("auto"),
  text: _zod.z.boolean().optional(),
  bash: _zod.z.boolean().optional(),
  bashForegroundMs: _zod.z.number().int().min(0).max(3e4).optional(),
  config: _zod.z.boolean().optional(),
  debug: _zod.z.boolean().optional(),
  restart: _zod.z.boolean().optional(),
  useAccessGroups: _zod.z.boolean().optional(),
  ownerAllowFrom: _zod.z.array(_zod.z.union([_zod.z.string(), _zod.z.number()])).optional(),
  allowFrom: ElevatedAllowFromSchema.optional()
}).strict().optional().default({
  native: "auto",
  nativeSkills: "auto"
});

//#endregion
//#region src/config/zod-schema.ts
const BrowserSnapshotDefaultsSchema = _zod.z.object({ mode: _zod.z.literal("efficient").optional() }).strict().optional();
const NodeHostSchema = _zod.z.object({ browserProxy: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allowProfiles: _zod.z.array(_zod.z.string()).optional()
  }).strict().optional() }).strict().optional();
const MemoryQmdPathSchema = _zod.z.object({
  path: _zod.z.string(),
  name: _zod.z.string().optional(),
  pattern: _zod.z.string().optional()
}).strict();
const MemoryQmdSessionSchema = _zod.z.object({
  enabled: _zod.z.boolean().optional(),
  exportDir: _zod.z.string().optional(),
  retentionDays: _zod.z.number().int().nonnegative().optional()
}).strict();
const MemoryQmdUpdateSchema = _zod.z.object({
  interval: _zod.z.string().optional(),
  debounceMs: _zod.z.number().int().nonnegative().optional(),
  onBoot: _zod.z.boolean().optional(),
  waitForBootSync: _zod.z.boolean().optional(),
  embedInterval: _zod.z.string().optional(),
  commandTimeoutMs: _zod.z.number().int().nonnegative().optional(),
  updateTimeoutMs: _zod.z.number().int().nonnegative().optional(),
  embedTimeoutMs: _zod.z.number().int().nonnegative().optional()
}).strict();
const MemoryQmdLimitsSchema = _zod.z.object({
  maxResults: _zod.z.number().int().positive().optional(),
  maxSnippetChars: _zod.z.number().int().positive().optional(),
  maxInjectedChars: _zod.z.number().int().positive().optional(),
  timeoutMs: _zod.z.number().int().nonnegative().optional()
}).strict();
const MemoryQmdSchema = _zod.z.object({
  command: _zod.z.string().optional(),
  searchMode: _zod.z.union([
  _zod.z.literal("query"),
  _zod.z.literal("search"),
  _zod.z.literal("vsearch")]
  ).optional(),
  includeDefaultMemory: _zod.z.boolean().optional(),
  paths: _zod.z.array(MemoryQmdPathSchema).optional(),
  sessions: MemoryQmdSessionSchema.optional(),
  update: MemoryQmdUpdateSchema.optional(),
  limits: MemoryQmdLimitsSchema.optional(),
  scope: SessionSendPolicySchema.optional()
}).strict();
const MemorySchema = _zod.z.object({
  backend: _zod.z.union([_zod.z.literal("builtin"), _zod.z.literal("qmd")]).optional(),
  citations: _zod.z.union([
  _zod.z.literal("auto"),
  _zod.z.literal("on"),
  _zod.z.literal("off")]
  ).optional(),
  qmd: MemoryQmdSchema.optional()
}).strict().optional();
const HttpUrlSchema = _zod.z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Expected http:// or https:// URL");
const OpenClawSchema = _zod.z.object({
  $schema: _zod.z.string().optional(),
  meta: _zod.z.object({
    lastTouchedVersion: _zod.z.string().optional(),
    lastTouchedAt: _zod.z.string().optional()
  }).strict().optional(),
  env: _zod.z.object({
    shellEnv: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      timeoutMs: _zod.z.number().int().nonnegative().optional()
    }).strict().optional(),
    vars: _zod.z.record(_zod.z.string(), _zod.z.string()).optional()
  }).catchall(_zod.z.string()).optional(),
  wizard: _zod.z.object({
    lastRunAt: _zod.z.string().optional(),
    lastRunVersion: _zod.z.string().optional(),
    lastRunCommit: _zod.z.string().optional(),
    lastRunCommand: _zod.z.string().optional(),
    lastRunMode: _zod.z.union([_zod.z.literal("local"), _zod.z.literal("remote")]).optional()
  }).strict().optional(),
  diagnostics: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    flags: _zod.z.array(_zod.z.string()).optional(),
    otel: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      endpoint: _zod.z.string().optional(),
      protocol: _zod.z.union([_zod.z.literal("http/protobuf"), _zod.z.literal("grpc")]).optional(),
      headers: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
      serviceName: _zod.z.string().optional(),
      traces: _zod.z.boolean().optional(),
      metrics: _zod.z.boolean().optional(),
      logs: _zod.z.boolean().optional(),
      sampleRate: _zod.z.number().min(0).max(1).optional(),
      flushIntervalMs: _zod.z.number().int().nonnegative().optional()
    }).strict().optional(),
    cacheTrace: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      filePath: _zod.z.string().optional(),
      includeMessages: _zod.z.boolean().optional(),
      includePrompt: _zod.z.boolean().optional(),
      includeSystem: _zod.z.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  logging: _zod.z.object({
    level: _zod.z.union([
    _zod.z.literal("silent"),
    _zod.z.literal("fatal"),
    _zod.z.literal("error"),
    _zod.z.literal("warn"),
    _zod.z.literal("info"),
    _zod.z.literal("debug"),
    _zod.z.literal("trace")]
    ).optional(),
    file: _zod.z.string().optional(),
    consoleLevel: _zod.z.union([
    _zod.z.literal("silent"),
    _zod.z.literal("fatal"),
    _zod.z.literal("error"),
    _zod.z.literal("warn"),
    _zod.z.literal("info"),
    _zod.z.literal("debug"),
    _zod.z.literal("trace")]
    ).optional(),
    consoleStyle: _zod.z.union([
    _zod.z.literal("pretty"),
    _zod.z.literal("compact"),
    _zod.z.literal("json")]
    ).optional(),
    redactSensitive: _zod.z.union([_zod.z.literal("off"), _zod.z.literal("tools")]).optional(),
    redactPatterns: _zod.z.array(_zod.z.string()).optional()
  }).strict().optional(),
  update: _zod.z.object({
    channel: _zod.z.union([
    _zod.z.literal("stable"),
    _zod.z.literal("beta"),
    _zod.z.literal("dev")]
    ).optional(),
    checkOnStart: _zod.z.boolean().optional()
  }).strict().optional(),
  browser: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    evaluateEnabled: _zod.z.boolean().optional(),
    cdpUrl: _zod.z.string().optional(),
    remoteCdpTimeoutMs: _zod.z.number().int().nonnegative().optional(),
    remoteCdpHandshakeTimeoutMs: _zod.z.number().int().nonnegative().optional(),
    color: _zod.z.string().optional(),
    executablePath: _zod.z.string().optional(),
    headless: _zod.z.boolean().optional(),
    noSandbox: _zod.z.boolean().optional(),
    attachOnly: _zod.z.boolean().optional(),
    defaultProfile: _zod.z.string().optional(),
    snapshotDefaults: BrowserSnapshotDefaultsSchema,
    profiles: _zod.z.record(_zod.z.string().regex(/^[a-z0-9-]+$/, "Profile names must be alphanumeric with hyphens only"), _zod.z.object({
      cdpPort: _zod.z.number().int().min(1).max(65535).optional(),
      cdpUrl: _zod.z.string().optional(),
      driver: _zod.z.union([_zod.z.literal("clawd"), _zod.z.literal("extension")]).optional(),
      color: HexColorSchema
    }).strict().refine((value) => value.cdpPort || value.cdpUrl, { message: "Profile must set cdpPort or cdpUrl" })).optional()
  }).strict().optional(),
  ui: _zod.z.object({
    seamColor: HexColorSchema.optional(),
    assistant: _zod.z.object({
      name: _zod.z.string().max(50).optional(),
      avatar: _zod.z.string().max(200).optional()
    }).strict().optional()
  }).strict().optional(),
  auth: _zod.z.object({
    profiles: _zod.z.record(_zod.z.string(), _zod.z.object({
      provider: _zod.z.string(),
      mode: _zod.z.union([
      _zod.z.literal("api_key"),
      _zod.z.literal("oauth"),
      _zod.z.literal("token")]
      ),
      email: _zod.z.string().optional()
    }).strict()).optional(),
    order: _zod.z.record(_zod.z.string(), _zod.z.array(_zod.z.string())).optional(),
    cooldowns: _zod.z.object({
      billingBackoffHours: _zod.z.number().positive().optional(),
      billingBackoffHoursByProvider: _zod.z.record(_zod.z.string(), _zod.z.number().positive()).optional(),
      billingMaxHours: _zod.z.number().positive().optional(),
      failureWindowHours: _zod.z.number().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  models: ModelsConfigSchema,
  nodeHost: NodeHostSchema,
  agents: AgentsSchema,
  tools: ToolsSchema,
  bindings: BindingsSchema,
  broadcast: BroadcastSchema,
  audio: AudioSchema,
  media: _zod.z.object({ preserveFilenames: _zod.z.boolean().optional() }).strict().optional(),
  messages: MessagesSchema,
  commands: CommandsSchema,
  approvals: ApprovalsSchema,
  session: SessionSchema,
  cron: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    store: _zod.z.string().optional(),
    maxConcurrentRuns: _zod.z.number().int().positive().optional(),
    webhook: HttpUrlSchema.optional(),
    webhookToken: _zod.z.string().optional().register(sensitive),
    sessionRetention: _zod.z.union([_zod.z.string(), _zod.z.literal(false)]).optional()
  }).strict().optional(),
  hooks: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    path: _zod.z.string().optional(),
    token: _zod.z.string().optional().register(sensitive),
    defaultSessionKey: _zod.z.string().optional(),
    allowRequestSessionKey: _zod.z.boolean().optional(),
    allowedSessionKeyPrefixes: _zod.z.array(_zod.z.string()).optional(),
    allowedAgentIds: _zod.z.array(_zod.z.string()).optional(),
    maxBodyBytes: _zod.z.number().int().positive().optional(),
    presets: _zod.z.array(_zod.z.string()).optional(),
    transformsDir: _zod.z.string().optional(),
    mappings: _zod.z.array(HookMappingSchema).optional(),
    gmail: HooksGmailSchema,
    internal: InternalHooksSchema
  }).strict().optional(),
  web: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    heartbeatSeconds: _zod.z.number().int().positive().optional(),
    reconnect: _zod.z.object({
      initialMs: _zod.z.number().positive().optional(),
      maxMs: _zod.z.number().positive().optional(),
      factor: _zod.z.number().positive().optional(),
      jitter: _zod.z.number().min(0).max(1).optional(),
      maxAttempts: _zod.z.number().int().min(0).optional()
    }).strict().optional()
  }).strict().optional(),
  channels: ChannelsSchema,
  discovery: _zod.z.object({
    wideArea: _zod.z.object({ enabled: _zod.z.boolean().optional() }).strict().optional(),
    mdns: _zod.z.object({ mode: _zod.z.enum([
      "off",
      "minimal",
      "full"]
      ).optional() }).strict().optional()
  }).strict().optional(),
  canvasHost: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    root: _zod.z.string().optional(),
    port: _zod.z.number().int().positive().optional(),
    liveReload: _zod.z.boolean().optional()
  }).strict().optional(),
  talk: _zod.z.object({
    voiceId: _zod.z.string().optional(),
    voiceAliases: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
    modelId: _zod.z.string().optional(),
    outputFormat: _zod.z.string().optional(),
    apiKey: _zod.z.string().optional().register(sensitive),
    interruptOnSpeech: _zod.z.boolean().optional()
  }).strict().optional(),
  gateway: _zod.z.object({
    port: _zod.z.number().int().positive().optional(),
    mode: _zod.z.union([_zod.z.literal("local"), _zod.z.literal("remote")]).optional(),
    bind: _zod.z.union([
    _zod.z.literal("auto"),
    _zod.z.literal("lan"),
    _zod.z.literal("loopback"),
    _zod.z.literal("custom"),
    _zod.z.literal("tailnet")]
    ).optional(),
    controlUi: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      basePath: _zod.z.string().optional(),
      root: _zod.z.string().optional(),
      allowedOrigins: _zod.z.array(_zod.z.string()).optional(),
      allowInsecureAuth: _zod.z.boolean().optional(),
      dangerouslyDisableDeviceAuth: _zod.z.boolean().optional()
    }).strict().optional(),
    auth: _zod.z.object({
      mode: _zod.z.union([
      _zod.z.literal("token"),
      _zod.z.literal("password"),
      _zod.z.literal("trusted-proxy")]
      ).optional(),
      token: _zod.z.string().optional().register(sensitive),
      password: _zod.z.string().optional().register(sensitive),
      allowTailscale: _zod.z.boolean().optional(),
      rateLimit: _zod.z.object({
        maxAttempts: _zod.z.number().optional(),
        windowMs: _zod.z.number().optional(),
        lockoutMs: _zod.z.number().optional(),
        exemptLoopback: _zod.z.boolean().optional()
      }).strict().optional(),
      trustedProxy: _zod.z.object({
        userHeader: _zod.z.string().min(1, "userHeader is required for trusted-proxy mode"),
        requiredHeaders: _zod.z.array(_zod.z.string()).optional(),
        allowUsers: _zod.z.array(_zod.z.string()).optional()
      }).strict().optional()
    }).strict().optional(),
    trustedProxies: _zod.z.array(_zod.z.string()).optional(),
    tools: _zod.z.object({
      deny: _zod.z.array(_zod.z.string()).optional(),
      allow: _zod.z.array(_zod.z.string()).optional()
    }).strict().optional(),
    tailscale: _zod.z.object({
      mode: _zod.z.union([
      _zod.z.literal("off"),
      _zod.z.literal("serve"),
      _zod.z.literal("funnel")]
      ).optional(),
      resetOnExit: _zod.z.boolean().optional()
    }).strict().optional(),
    remote: _zod.z.object({
      url: _zod.z.string().optional(),
      transport: _zod.z.union([_zod.z.literal("ssh"), _zod.z.literal("direct")]).optional(),
      token: _zod.z.string().optional().register(sensitive),
      password: _zod.z.string().optional().register(sensitive),
      tlsFingerprint: _zod.z.string().optional(),
      sshTarget: _zod.z.string().optional(),
      sshIdentity: _zod.z.string().optional()
    }).strict().optional(),
    reload: _zod.z.object({
      mode: _zod.z.union([
      _zod.z.literal("off"),
      _zod.z.literal("restart"),
      _zod.z.literal("hot"),
      _zod.z.literal("hybrid")]
      ).optional(),
      debounceMs: _zod.z.number().int().min(0).optional()
    }).strict().optional(),
    tls: _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      autoGenerate: _zod.z.boolean().optional(),
      certPath: _zod.z.string().optional(),
      keyPath: _zod.z.string().optional(),
      caPath: _zod.z.string().optional()
    }).optional(),
    http: _zod.z.object({ endpoints: _zod.z.object({
        chatCompletions: _zod.z.object({ enabled: _zod.z.boolean().optional() }).strict().optional(),
        responses: _zod.z.object({
          enabled: _zod.z.boolean().optional(),
          maxBodyBytes: _zod.z.number().int().positive().optional(),
          maxUrlParts: _zod.z.number().int().nonnegative().optional(),
          files: _zod.z.object({
            allowUrl: _zod.z.boolean().optional(),
            urlAllowlist: _zod.z.array(_zod.z.string()).optional(),
            allowedMimes: _zod.z.array(_zod.z.string()).optional(),
            maxBytes: _zod.z.number().int().positive().optional(),
            maxChars: _zod.z.number().int().positive().optional(),
            maxRedirects: _zod.z.number().int().nonnegative().optional(),
            timeoutMs: _zod.z.number().int().positive().optional(),
            pdf: _zod.z.object({
              maxPages: _zod.z.number().int().positive().optional(),
              maxPixels: _zod.z.number().int().positive().optional(),
              minTextChars: _zod.z.number().int().nonnegative().optional()
            }).strict().optional()
          }).strict().optional(),
          images: _zod.z.object({
            allowUrl: _zod.z.boolean().optional(),
            urlAllowlist: _zod.z.array(_zod.z.string()).optional(),
            allowedMimes: _zod.z.array(_zod.z.string()).optional(),
            maxBytes: _zod.z.number().int().positive().optional(),
            maxRedirects: _zod.z.number().int().nonnegative().optional(),
            timeoutMs: _zod.z.number().int().positive().optional()
          }).strict().optional()
        }).strict().optional()
      }).strict().optional() }).strict().optional(),
    nodes: _zod.z.object({
      browser: _zod.z.object({
        mode: _zod.z.union([
        _zod.z.literal("auto"),
        _zod.z.literal("manual"),
        _zod.z.literal("off")]
        ).optional(),
        node: _zod.z.string().optional()
      }).strict().optional(),
      allowCommands: _zod.z.array(_zod.z.string()).optional(),
      denyCommands: _zod.z.array(_zod.z.string()).optional()
    }).strict().optional()
  }).strict().optional(),
  memory: MemorySchema,
  skills: _zod.z.object({
    allowBundled: _zod.z.array(_zod.z.string()).optional(),
    load: _zod.z.object({
      extraDirs: _zod.z.array(_zod.z.string()).optional(),
      watch: _zod.z.boolean().optional(),
      watchDebounceMs: _zod.z.number().int().min(0).optional()
    }).strict().optional(),
    install: _zod.z.object({
      preferBrew: _zod.z.boolean().optional(),
      nodeManager: _zod.z.union([
      _zod.z.literal("npm"),
      _zod.z.literal("pnpm"),
      _zod.z.literal("yarn"),
      _zod.z.literal("bun")]
      ).optional()
    }).strict().optional(),
    entries: _zod.z.record(_zod.z.string(), _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      apiKey: _zod.z.string().optional().register(sensitive),
      env: _zod.z.record(_zod.z.string(), _zod.z.string()).optional(),
      config: _zod.z.record(_zod.z.string(), _zod.z.unknown()).optional()
    }).strict()).optional()
  }).strict().optional(),
  plugins: _zod.z.object({
    enabled: _zod.z.boolean().optional(),
    allow: _zod.z.array(_zod.z.string()).optional(),
    deny: _zod.z.array(_zod.z.string()).optional(),
    load: _zod.z.object({ paths: _zod.z.array(_zod.z.string()).optional() }).strict().optional(),
    slots: _zod.z.object({ memory: _zod.z.string().optional() }).strict().optional(),
    entries: _zod.z.record(_zod.z.string(), _zod.z.object({
      enabled: _zod.z.boolean().optional(),
      config: _zod.z.record(_zod.z.string(), _zod.z.unknown()).optional()
    }).strict()).optional(),
    installs: _zod.z.record(_zod.z.string(), _zod.z.object({
      source: _zod.z.union([
      _zod.z.literal("npm"),
      _zod.z.literal("archive"),
      _zod.z.literal("path")]
      ),
      spec: _zod.z.string().optional(),
      sourcePath: _zod.z.string().optional(),
      installPath: _zod.z.string().optional(),
      version: _zod.z.string().optional(),
      installedAt: _zod.z.string().optional()
    }).strict()).optional()
  }).strict().optional()
}).strict().superRefine((cfg, ctx) => {
  const agents = cfg.agents?.list ?? [];
  if (agents.length === 0) return;
  const agentIds = new Set(agents.map((agent) => agent.id));
  const broadcast = cfg.broadcast;
  if (!broadcast) return;
  for (const [peerId, ids] of Object.entries(broadcast)) {
    if (peerId === "strategy") continue;
    if (!Array.isArray(ids)) continue;
    for (let idx = 0; idx < ids.length; idx += 1) {
      const agentId = ids[idx];
      if (!agentIds.has(agentId)) ctx.addIssue({
        code: _zod.z.ZodIssueCode.custom,
        path: [
        "broadcast",
        peerId,
        idx],

        message: `Unknown agent id "${agentId}" (not in agents.list).`
      });
    }
  }
});

//#endregion
//#region src/config/validation.ts
const AVATAR_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const WINDOWS_ABS_RE = /^[a-zA-Z]:[\\/]/;
function isWorkspaceAvatarPath(value, workspaceDir) {
  const workspaceRoot = _nodePath.default.resolve(workspaceDir);
  const resolved = _nodePath.default.resolve(workspaceRoot, value);
  const relative = _nodePath.default.relative(workspaceRoot, resolved);
  if (relative === "") return true;
  if (relative.startsWith("..")) return false;
  return !_nodePath.default.isAbsolute(relative);
}
function validateIdentityAvatar(config) {
  const agents = config.agents?.list;
  if (!Array.isArray(agents) || agents.length === 0) return [];
  const issues = [];
  for (const [index, entry] of agents.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const avatarRaw = entry.identity?.avatar;
    if (typeof avatarRaw !== "string") continue;
    const avatar = avatarRaw.trim();
    if (!avatar) continue;
    if (AVATAR_DATA_RE.test(avatar) || AVATAR_HTTP_RE.test(avatar)) continue;
    if (avatar.startsWith("~")) {
      issues.push({
        path: `agents.list.${index}.identity.avatar`,
        message: "identity.avatar must be a workspace-relative path, http(s) URL, or data URI."
      });
      continue;
    }
    if (AVATAR_SCHEME_RE.test(avatar) && !WINDOWS_ABS_RE.test(avatar)) {
      issues.push({
        path: `agents.list.${index}.identity.avatar`,
        message: "identity.avatar must be a workspace-relative path, http(s) URL, or data URI."
      });
      continue;
    }
    if (!isWorkspaceAvatarPath(avatar, (0, _agentScopeBCNbpzc.s)(config, entry.id ?? (0, _agentScopeBCNbpzc.c)(config)))) issues.push({
      path: `agents.list.${index}.identity.avatar`,
      message: "identity.avatar must stay within the agent workspace."
    });
  }
  return issues;
}
/**
* Validates config without applying runtime defaults.
* Use this when you need the raw validated config (e.g., for writing back to file).
*/
function validateConfigObjectRaw(raw) {
  const legacyIssues = findLegacyConfigIssues(raw);
  if (legacyIssues.length > 0) return {
    ok: false,
    issues: legacyIssues.map((iss) => ({
      path: iss.path,
      message: iss.message
    }))
  };
  const validated = OpenClawSchema.safeParse(raw);
  if (!validated.success) return {
    ok: false,
    issues: validated.error.issues.map((iss) => ({
      path: iss.path.join("."),
      message: iss.message
    }))
  };
  const duplicates = findDuplicateAgentDirs(validated.data);
  if (duplicates.length > 0) return {
    ok: false,
    issues: [{
      path: "agents.list",
      message: formatDuplicateAgentDirError(duplicates)
    }]
  };
  const avatarIssues = validateIdentityAvatar(validated.data);
  if (avatarIssues.length > 0) return {
    ok: false,
    issues: avatarIssues
  };
  return {
    ok: true,
    config: validated.data
  };
}
function validateConfigObject(raw) {
  const result = validateConfigObjectRaw(raw);
  if (!result.ok) return result;
  return {
    ok: true,
    config: applyModelDefaults(applyAgentDefaults(applySessionDefaults(result.config)))
  };
}
function validateConfigObjectWithPlugins(raw) {
  return validateConfigObjectWithPluginsBase(raw, { applyDefaults: true });
}
function validateConfigObjectRawWithPlugins(raw) {
  return validateConfigObjectWithPluginsBase(raw, { applyDefaults: false });
}
function validateConfigObjectWithPluginsBase(raw, opts) {
  const base = opts.applyDefaults ? validateConfigObject(raw) : validateConfigObjectRaw(raw);
  if (!base.ok) return {
    ok: false,
    issues: base.issues,
    warnings: []
  };
  const config = base.config;
  const issues = [];
  const warnings = [];
  const hasExplicitPluginsConfig = (0, _registryDWvId1YW.w)(raw) && Object.prototype.hasOwnProperty.call(raw, "plugins");
  let registryInfo = null;
  const ensureRegistry = () => {
    if (registryInfo) return registryInfo;
    const registry = (0, _manifestRegistryCs432sAr.t)({
      config,
      workspaceDir: (0, _agentScopeBCNbpzc.s)(config, (0, _agentScopeBCNbpzc.c)(config)) ?? void 0
    });
    const knownIds = new Set(registry.plugins.map((record) => record.id));
    const normalizedPlugins = (0, _manifestRegistryCs432sAr.o)(config.plugins);
    for (const diag of registry.diagnostics) {
      let path = diag.pluginId ? `plugins.entries.${diag.pluginId}` : "plugins";
      if (!diag.pluginId && diag.message.includes("plugin path not found")) path = "plugins.load.paths";
      const message = `${diag.pluginId ? `plugin ${diag.pluginId}` : "plugin"}: ${diag.message}`;
      if (diag.level === "error") issues.push({
        path,
        message
      });else
      warnings.push({
        path,
        message
      });
    }
    registryInfo = {
      registry,
      knownIds,
      normalizedPlugins
    };
    return registryInfo;
  };
  const allowedChannels = new Set(["defaults", ..._registryDWvId1YW.t]);
  if (config.channels && (0, _registryDWvId1YW.w)(config.channels)) for (const key of Object.keys(config.channels)) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    if (!allowedChannels.has(trimmed)) {
      const { registry } = ensureRegistry();
      for (const record of registry.plugins) for (const channelId of record.channels) allowedChannels.add(channelId);
    }
    if (!allowedChannels.has(trimmed)) issues.push({
      path: `channels.${trimmed}`,
      message: `unknown channel id: ${trimmed}`
    });
  }
  const heartbeatChannelIds = /* @__PURE__ */new Set();
  for (const channelId of _registryDWvId1YW.t) heartbeatChannelIds.add(channelId.toLowerCase());
  const validateHeartbeatTarget = (target, path) => {
    if (typeof target !== "string") return;
    const trimmed = target.trim();
    if (!trimmed) {
      issues.push({
        path,
        message: "heartbeat target must not be empty"
      });
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (normalized === "last" || normalized === "none") return;
    if ((0, _registryDWvId1YW.o)(trimmed)) return;
    if (!heartbeatChannelIds.has(normalized)) {
      const { registry } = ensureRegistry();
      for (const record of registry.plugins) for (const channelId of record.channels) {
        const pluginChannel = channelId.trim();
        if (pluginChannel) heartbeatChannelIds.add(pluginChannel.toLowerCase());
      }
    }
    if (heartbeatChannelIds.has(normalized)) return;
    issues.push({
      path,
      message: `unknown heartbeat target: ${target}`
    });
  };
  validateHeartbeatTarget(config.agents?.defaults?.heartbeat?.target, "agents.defaults.heartbeat.target");
  if (Array.isArray(config.agents?.list)) for (const [index, entry] of config.agents.list.entries()) validateHeartbeatTarget(entry?.heartbeat?.target, `agents.list.${index}.heartbeat.target`);
  if (!hasExplicitPluginsConfig) {
    if (issues.length > 0) return {
      ok: false,
      issues,
      warnings
    };
    return {
      ok: true,
      config,
      warnings
    };
  }
  const { registry, knownIds, normalizedPlugins } = ensureRegistry();
  const pluginsConfig = config.plugins;
  const entries = pluginsConfig?.entries;
  if (entries && (0, _registryDWvId1YW.w)(entries)) {
    for (const pluginId of Object.keys(entries)) if (!knownIds.has(pluginId)) issues.push({
      path: `plugins.entries.${pluginId}`,
      message: `plugin not found: ${pluginId}`
    });
  }
  const allow = pluginsConfig?.allow ?? [];
  for (const pluginId of allow) {
    if (typeof pluginId !== "string" || !pluginId.trim()) continue;
    if (!knownIds.has(pluginId)) issues.push({
      path: "plugins.allow",
      message: `plugin not found: ${pluginId}`
    });
  }
  const deny = pluginsConfig?.deny ?? [];
  for (const pluginId of deny) {
    if (typeof pluginId !== "string" || !pluginId.trim()) continue;
    if (!knownIds.has(pluginId)) issues.push({
      path: "plugins.deny",
      message: `plugin not found: ${pluginId}`
    });
  }
  const memorySlot = normalizedPlugins.slots.memory;
  if (typeof memorySlot === "string" && memorySlot.trim() && !knownIds.has(memorySlot)) issues.push({
    path: "plugins.slots.memory",
    message: `plugin not found: ${memorySlot}`
  });
  let selectedMemoryPluginId = null;
  const seenPlugins = /* @__PURE__ */new Set();
  for (const record of registry.plugins) {
    const pluginId = record.id;
    if (seenPlugins.has(pluginId)) continue;
    seenPlugins.add(pluginId);
    const entry = normalizedPlugins.entries[pluginId];
    const entryHasConfig = Boolean(entry?.config);
    const enableState = (0, _manifestRegistryCs432sAr.s)(pluginId, record.origin, normalizedPlugins);
    let enabled = enableState.enabled;
    let reason = enableState.reason;
    if (enabled) {
      const memoryDecision = (0, _manifestRegistryCs432sAr.c)({
        id: pluginId,
        kind: record.kind,
        slot: memorySlot,
        selectedId: selectedMemoryPluginId
      });
      if (!memoryDecision.enabled) {
        enabled = false;
        reason = memoryDecision.reason;
      }
      if (memoryDecision.selected && record.kind === "memory") selectedMemoryPluginId = pluginId;
    }
    if (enabled || entryHasConfig) if (record.configSchema) {
      const res = validateJsonSchemaValue({
        schema: record.configSchema,
        cacheKey: record.schemaCacheKey ?? record.manifestPath ?? pluginId,
        value: entry?.config ?? {}
      });
      if (!res.ok) for (const error of res.errors) issues.push({
        path: `plugins.entries.${pluginId}.config`,
        message: `invalid config: ${error}`
      });
    } else issues.push({
      path: `plugins.entries.${pluginId}`,
      message: `plugin schema missing for ${pluginId}`
    });
    if (!enabled && entryHasConfig) warnings.push({
      path: `plugins.entries.${pluginId}`,
      message: `plugin disabled (${reason ?? "disabled"}) but config is present`
    });
  }
  if (issues.length > 0) return {
    ok: false,
    issues,
    warnings
  };
  return {
    ok: true,
    config,
    warnings
  };
}

//#endregion
//#region src/config/version.ts
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-(\d+))?/;
function parseOpenClawVersion(raw) {
  if (!raw) return null;
  const match = raw.trim().match(VERSION_RE);
  if (!match) return null;
  const [, major, minor, patch, revision] = match;
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    revision: revision ? Number.parseInt(revision, 10) : 0
  };
}
function compareOpenClawVersions(a, b) {
  const parsedA = parseOpenClawVersion(a);
  const parsedB = parseOpenClawVersion(b);
  if (!parsedA || !parsedB) return null;
  if (parsedA.major !== parsedB.major) return parsedA.major < parsedB.major ? -1 : 1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor < parsedB.minor ? -1 : 1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch < parsedB.patch ? -1 : 1;
  if (parsedA.revision !== parsedB.revision) return parsedA.revision < parsedB.revision ? -1 : 1;
  return 0;
}

//#endregion
//#region src/config/io.ts
const SHELL_ENV_EXPECTED_KEYS = [
"OPENAI_API_KEY",
"ANTHROPIC_API_KEY",
"ANTHROPIC_OAUTH_TOKEN",
"GEMINI_API_KEY",
"ZAI_API_KEY",
"OPENROUTER_API_KEY",
"AI_GATEWAY_API_KEY",
"MINIMAX_API_KEY",
"SYNTHETIC_API_KEY",
"ELEVENLABS_API_KEY",
"TELEGRAM_BOT_TOKEN",
"DISCORD_BOT_TOKEN",
"SLACK_BOT_TOKEN",
"SLACK_APP_TOKEN",
"OPENCLAW_GATEWAY_TOKEN",
"OPENCLAW_GATEWAY_PASSWORD"];

const CONFIG_AUDIT_LOG_FILENAME = "config-audit.jsonl";
const loggedInvalidConfigs = /* @__PURE__ */new Set();
function hashConfigRaw(raw) {
  return _nodeCrypto.default.createHash("sha256").update(raw ?? "").digest("hex");
}
function resolveConfigSnapshotHash(snapshot) {
  if (typeof snapshot.hash === "string") {
    const trimmed = snapshot.hash.trim();
    if (trimmed) return trimmed;
  }
  if (typeof snapshot.raw !== "string") return null;
  return hashConfigRaw(snapshot.raw);
}
function coerceConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasConfigMeta(value) {
  if (!isPlainObject(value)) return false;
  const meta = value.meta;
  return isPlainObject(meta);
}
function resolveGatewayMode(value) {
  if (!isPlainObject(value)) return null;
  const gateway = value.gateway;
  if (!isPlainObject(gateway) || typeof gateway.mode !== "string") return null;
  const trimmed = gateway.mode.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function cloneUnknown(value) {
  return structuredClone(value);
}
function createMergePatch(base, target) {
  if (!isPlainObject(base) || !isPlainObject(target)) return cloneUnknown(target);
  const patch = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  for (const key of keys) {
    const hasBase = key in base;
    if (!(key in target)) {
      patch[key] = null;
      continue;
    }
    const targetValue = target[key];
    if (!hasBase) {
      patch[key] = cloneUnknown(targetValue);
      continue;
    }
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(targetValue)) {
      const childPatch = createMergePatch(baseValue, targetValue);
      if (isPlainObject(childPatch) && Object.keys(childPatch).length === 0) continue;
      patch[key] = childPatch;
      continue;
    }
    if (!(0, _nodeUtil.isDeepStrictEqual)(baseValue, targetValue)) patch[key] = cloneUnknown(targetValue);
  }
  return patch;
}
function collectEnvRefPaths(value, path, output) {
  if (typeof value === "string") {
    if (containsEnvVarReference(value)) output.set(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectEnvRefPaths(item, `${path}[${index}]`, output);
    });
    return;
  }
  if (isPlainObject(value)) for (const [key, child] of Object.entries(value)) collectEnvRefPaths(child, path ? `${path}.${key}` : key, output);
}
function collectChangedPaths(base, target, path, output) {
  if (Array.isArray(base) && Array.isArray(target)) {
    const max = Math.max(base.length, target.length);
    for (let index = 0; index < max; index += 1) {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      if (index >= base.length || index >= target.length) {
        output.add(childPath);
        continue;
      }
      collectChangedPaths(base[index], target[index], childPath, output);
    }
    return;
  }
  if (isPlainObject(base) && isPlainObject(target)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      const hasBase = key in base;
      if (!(key in target) || !hasBase) {
        output.add(childPath);
        continue;
      }
      collectChangedPaths(base[key], target[key], childPath, output);
    }
    return;
  }
  if (!(0, _nodeUtil.isDeepStrictEqual)(base, target)) output.add(path);
}
function parentPath(value) {
  if (!value) return "";
  if (value.endsWith("]")) {
    const index = value.lastIndexOf("[");
    return index > 0 ? value.slice(0, index) : "";
  }
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(0, index) : "";
}
function isPathChanged(path, changedPaths) {
  if (changedPaths.has(path)) return true;
  let current = parentPath(path);
  while (current) {
    if (changedPaths.has(current)) return true;
    current = parentPath(current);
  }
  return changedPaths.has("");
}
function restoreEnvRefsFromMap(value, path, envRefMap, changedPaths) {
  if (typeof value === "string") {
    if (!isPathChanged(path, changedPaths)) {
      const original = envRefMap.get(path);
      if (original !== void 0) return original;
    }
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item, index) => {
      const updated = restoreEnvRefsFromMap(item, `${path}[${index}]`, envRefMap, changedPaths);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : value;
  }
  if (isPlainObject(value)) {
    let changed = false;
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      const updated = restoreEnvRefsFromMap(child, path ? `${path}.${key}` : key, envRefMap, changedPaths);
      if (updated !== child) changed = true;
      next[key] = updated;
    }
    return changed ? next : value;
  }
  return value;
}
function resolveConfigAuditLogPath(env, homedir) {
  return _nodePath.default.join((0, _pathsZQWYGl2V.s)(env, homedir), "logs", CONFIG_AUDIT_LOG_FILENAME);
}
function resolveConfigWriteSuspiciousReasons(params) {
  const reasons = [];
  if (!params.existsBefore) return reasons;
  if (typeof params.previousBytes === "number" && typeof params.nextBytes === "number" && params.previousBytes >= 512 && params.nextBytes < Math.floor(params.previousBytes * .5)) reasons.push(`size-drop:${params.previousBytes}->${params.nextBytes}`);
  if (!params.hasMetaBefore) reasons.push("missing-meta-before-write");
  if (params.gatewayModeBefore && !params.gatewayModeAfter) reasons.push("gateway-mode-removed");
  return reasons;
}
async function appendConfigWriteAuditRecord(deps, record) {
  try {
    const auditPath = resolveConfigAuditLogPath(deps.env, deps.homedir);
    await deps.fs.promises.mkdir(_nodePath.default.dirname(auditPath), {
      recursive: true,
      mode: 448
    });
    await deps.fs.promises.appendFile(auditPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf-8",
      mode: 384
    });
  } catch {}
}
function warnOnConfigMiskeys(raw, logger) {
  if (!raw || typeof raw !== "object") return;
  const gateway = raw.gateway;
  if (!gateway || typeof gateway !== "object") return;
  if ("token" in gateway) logger.warn("Config uses \"gateway.token\". This key is ignored; use \"gateway.auth.token\" instead.");
}
function stampConfigVersion(cfg) {
  const now = (/* @__PURE__ */new Date()).toISOString();
  return {
    ...cfg,
    meta: {
      ...cfg.meta,
      lastTouchedVersion: VERSION,
      lastTouchedAt: now
    }
  };
}
function warnIfConfigFromFuture(cfg, logger) {
  const touched = cfg.meta?.lastTouchedVersion;
  if (!touched) return;
  const cmp = compareOpenClawVersions(VERSION, touched);
  if (cmp === null) return;
  if (cmp < 0) logger.warn(`Config was last written by a newer OpenClaw (${touched}); current version is ${VERSION}.`);
}
function resolveConfigPathForDeps(deps) {
  if (deps.configPath) return deps.configPath;
  return (0, _pathsZQWYGl2V.n)(deps.env, (0, _pathsZQWYGl2V.s)(deps.env, deps.homedir));
}
function normalizeDeps(overrides = {}) {
  return {
    fs: overrides.fs ?? _nodeFs.default,
    json5: overrides.json5 ?? _json.default,
    env: overrides.env ?? process.env,
    homedir: overrides.homedir ?? (() => (0, _pathsZQWYGl2V.u)(overrides.env ?? process.env, _nodeOs.default.homedir)),
    configPath: overrides.configPath ?? "",
    logger: overrides.logger ?? console
  };
}
function maybeLoadDotEnvForConfig(env) {
  if (env !== process.env) return;
  loadDotEnv({ quiet: true });
}
function parseConfigJson5(raw, json5$1 = _json.default) {
  try {
    return {
      ok: true,
      parsed: json5$1.parse(raw)
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err)
    };
  }
}
function resolveConfigIncludesForRead(parsed, configPath, deps) {
  return resolveConfigIncludes(parsed, configPath, {
    readFile: (candidate) => deps.fs.readFileSync(candidate, "utf-8"),
    parseJson: (raw) => deps.json5.parse(raw)
  });
}
function resolveConfigForRead(resolvedIncludes, env) {
  if (resolvedIncludes && typeof resolvedIncludes === "object" && "env" in resolvedIncludes) applyConfigEnvVars(resolvedIncludes, env);
  return {
    resolvedConfigRaw: resolveConfigEnvVars(resolvedIncludes, env),
    envSnapshotForRestore: { ...env }
  };
}
function createConfigIO(overrides = {}) {
  const deps = normalizeDeps(overrides);
  const requestedConfigPath = resolveConfigPathForDeps(deps);
  const configPath = (deps.configPath ? [requestedConfigPath] : (0, _pathsZQWYGl2V.r)(deps.env, deps.homedir)).find((candidate) => deps.fs.existsSync(candidate)) ?? requestedConfigPath;
  function loadConfig() {
    try {
      maybeLoadDotEnvForConfig(deps.env);
      if (!deps.fs.existsSync(configPath)) {
        if ((0, _modelSelectionCfNkGvWD.K)(deps.env) && !(0, _modelSelectionCfNkGvWD.G)(deps.env)) (0, _modelSelectionCfNkGvWD.U)({
          enabled: true,
          env: deps.env,
          expectedKeys: SHELL_ENV_EXPECTED_KEYS,
          logger: deps.logger,
          timeoutMs: (0, _modelSelectionCfNkGvWD.W)(deps.env)
        });
        return {};
      }
      const raw = deps.fs.readFileSync(configPath, "utf-8");
      const { resolvedConfigRaw: resolvedConfig } = resolveConfigForRead(resolveConfigIncludesForRead(deps.json5.parse(raw), configPath, deps), deps.env);
      warnOnConfigMiskeys(resolvedConfig, deps.logger);
      if (typeof resolvedConfig !== "object" || resolvedConfig === null) return {};
      const preValidationDuplicates = findDuplicateAgentDirs(resolvedConfig, {
        env: deps.env,
        homedir: deps.homedir
      });
      if (preValidationDuplicates.length > 0) throw new DuplicateAgentDirError(preValidationDuplicates);
      const validated = validateConfigObjectWithPlugins(resolvedConfig);
      if (!validated.ok) {
        const details = validated.issues.map((iss) => `- ${iss.path || "<root>"}: ${iss.message}`).join("\n");
        if (!loggedInvalidConfigs.has(configPath)) {
          loggedInvalidConfigs.add(configPath);
          deps.logger.error(`Invalid config at ${configPath}:\\n${details}`);
        }
        const error = /* @__PURE__ */new Error("Invalid config");
        error.code = "INVALID_CONFIG";
        error.details = details;
        throw error;
      }
      if (validated.warnings.length > 0) {
        const details = validated.warnings.map((iss) => `- ${iss.path || "<root>"}: ${iss.message}`).join("\n");
        deps.logger.warn(`Config warnings:\\n${details}`);
      }
      warnIfConfigFromFuture(validated.config, deps.logger);
      const cfg = applyModelDefaults(applyCompactionDefaults(applyContextPruningDefaults(applyAgentDefaults(applySessionDefaults(applyLoggingDefaults(applyMessageDefaults(validated.config)))))));
      normalizeConfigPaths(cfg);
      const duplicates = findDuplicateAgentDirs(cfg, {
        env: deps.env,
        homedir: deps.homedir
      });
      if (duplicates.length > 0) throw new DuplicateAgentDirError(duplicates);
      applyConfigEnvVars(cfg, deps.env);
      if (((0, _modelSelectionCfNkGvWD.K)(deps.env) || cfg.env?.shellEnv?.enabled === true) && !(0, _modelSelectionCfNkGvWD.G)(deps.env)) (0, _modelSelectionCfNkGvWD.U)({
        enabled: true,
        env: deps.env,
        expectedKeys: SHELL_ENV_EXPECTED_KEYS,
        logger: deps.logger,
        timeoutMs: cfg.env?.shellEnv?.timeoutMs ?? (0, _modelSelectionCfNkGvWD.W)(deps.env)
      });
      return applyConfigOverrides(cfg);
    } catch (err) {
      if (err instanceof DuplicateAgentDirError) {
        deps.logger.error(err.message);
        throw err;
      }
      if (err?.code === "INVALID_CONFIG") return {};
      deps.logger.error(`Failed to read config at ${configPath}`, err);
      return {};
    }
  }
  async function readConfigFileSnapshotInternal() {
    maybeLoadDotEnvForConfig(deps.env);
    if (!deps.fs.existsSync(configPath)) {
      const hash = hashConfigRaw(null);
      return { snapshot: {
          path: configPath,
          exists: false,
          raw: null,
          parsed: {},
          resolved: {},
          valid: true,
          config: applyTalkApiKey(applyModelDefaults(applyCompactionDefaults(applyContextPruningDefaults(applyAgentDefaults(applySessionDefaults(applyMessageDefaults({}))))))),
          hash,
          issues: [],
          warnings: [],
          legacyIssues: []
        } };
    }
    try {
      const raw = deps.fs.readFileSync(configPath, "utf-8");
      const hash = hashConfigRaw(raw);
      const parsedRes = parseConfigJson5(raw, deps.json5);
      if (!parsedRes.ok) return { snapshot: {
          path: configPath,
          exists: true,
          raw,
          parsed: {},
          resolved: {},
          valid: false,
          config: {},
          hash,
          issues: [{
            path: "",
            message: `JSON5 parse failed: ${parsedRes.error}`
          }],
          warnings: [],
          legacyIssues: []
        } };
      let resolved;
      try {
        resolved = resolveConfigIncludesForRead(parsedRes.parsed, configPath, deps);
      } catch (err) {
        const message = err instanceof ConfigIncludeError ? err.message : `Include resolution failed: ${String(err)}`;
        return { snapshot: {
            path: configPath,
            exists: true,
            raw,
            parsed: parsedRes.parsed,
            resolved: coerceConfig(parsedRes.parsed),
            valid: false,
            config: coerceConfig(parsedRes.parsed),
            hash,
            issues: [{
              path: "",
              message
            }],
            warnings: [],
            legacyIssues: []
          } };
      }
      let readResolution;
      try {
        readResolution = resolveConfigForRead(resolved, deps.env);
      } catch (err) {
        const message = err instanceof MissingEnvVarError ? err.message : `Env var substitution failed: ${String(err)}`;
        return { snapshot: {
            path: configPath,
            exists: true,
            raw,
            parsed: parsedRes.parsed,
            resolved: coerceConfig(resolved),
            valid: false,
            config: coerceConfig(resolved),
            hash,
            issues: [{
              path: "",
              message
            }],
            warnings: [],
            legacyIssues: []
          } };
      }
      const resolvedConfigRaw = readResolution.resolvedConfigRaw;
      const legacyIssues = findLegacyConfigIssues(resolvedConfigRaw);
      const validated = validateConfigObjectWithPlugins(resolvedConfigRaw);
      if (!validated.ok) return { snapshot: {
          path: configPath,
          exists: true,
          raw,
          parsed: parsedRes.parsed,
          resolved: coerceConfig(resolvedConfigRaw),
          valid: false,
          config: coerceConfig(resolvedConfigRaw),
          hash,
          issues: validated.issues,
          warnings: validated.warnings,
          legacyIssues
        } };
      warnIfConfigFromFuture(validated.config, deps.logger);
      return {
        snapshot: {
          path: configPath,
          exists: true,
          raw,
          parsed: parsedRes.parsed,
          resolved: coerceConfig(resolvedConfigRaw),
          valid: true,
          config: normalizeConfigPaths(applyTalkApiKey(applyModelDefaults(applyAgentDefaults(applySessionDefaults(applyLoggingDefaults(applyMessageDefaults(validated.config))))))),
          hash,
          issues: [],
          warnings: validated.warnings,
          legacyIssues
        },
        envSnapshotForRestore: readResolution.envSnapshotForRestore
      };
    } catch (err) {
      return { snapshot: {
          path: configPath,
          exists: true,
          raw: null,
          parsed: {},
          resolved: {},
          valid: false,
          config: {},
          hash: hashConfigRaw(null),
          issues: [{
            path: "",
            message: `read failed: ${String(err)}`
          }],
          warnings: [],
          legacyIssues: []
        } };
    }
  }
  async function readConfigFileSnapshot() {
    return (await readConfigFileSnapshotInternal()).snapshot;
  }
  async function readConfigFileSnapshotForWrite() {
    const result = await readConfigFileSnapshotInternal();
    return {
      snapshot: result.snapshot,
      writeOptions: {
        envSnapshotForRestore: result.envSnapshotForRestore,
        expectedConfigPath: configPath
      }
    };
  }
  async function writeConfigFile(cfg, options = {}) {
    clearConfigCache();
    let persistCandidate = cfg;
    const { snapshot } = await readConfigFileSnapshotInternal();
    let envRefMap = null;
    let changedPaths = null;
    if (snapshot.valid && snapshot.exists) {
      const patch = createMergePatch(snapshot.config, cfg);
      persistCandidate = applyMergePatch(snapshot.resolved, patch);
      try {
        const resolvedIncludes = resolveConfigIncludes(snapshot.parsed, configPath, {
          readFile: (candidate) => deps.fs.readFileSync(candidate, "utf-8"),
          parseJson: (raw) => deps.json5.parse(raw)
        });
        const collected = /* @__PURE__ */new Map();
        collectEnvRefPaths(resolvedIncludes, "", collected);
        if (collected.size > 0) {
          envRefMap = collected;
          changedPaths = /* @__PURE__ */new Set();
          collectChangedPaths(snapshot.config, cfg, "", changedPaths);
        }
      } catch {
        envRefMap = null;
      }
    }
    const validated = validateConfigObjectRawWithPlugins(persistCandidate);
    if (!validated.ok) {
      const issue = validated.issues[0];
      const pathLabel = issue?.path ? issue.path : "<root>";
      throw new Error(`Config validation failed: ${pathLabel}: ${issue?.message ?? "invalid"}`);
    }
    if (validated.warnings.length > 0) {
      const details = validated.warnings.map((warning) => `- ${warning.path}: ${warning.message}`).join("\n");
      deps.logger.warn(`Config warnings:\n${details}`);
    }
    let cfgToWrite = validated.config;
    try {
      if (deps.fs.existsSync(configPath)) {
        const parsedRes = parseConfigJson5(await deps.fs.promises.readFile(configPath, "utf-8"), deps.json5);
        if (parsedRes.ok) {
          const envForRestore = options.envSnapshotForRestore ?? deps.env;
          cfgToWrite = restoreEnvVarRefs(cfgToWrite, parsedRes.parsed, envForRestore);
        }
      }
    } catch {}
    const dir = _nodePath.default.dirname(configPath);
    await deps.fs.promises.mkdir(dir, {
      recursive: true,
      mode: 448
    });
    const stampedOutputConfig = stampConfigVersion(envRefMap && changedPaths ? restoreEnvRefsFromMap(cfgToWrite, "", envRefMap, changedPaths) : cfgToWrite);
    const json = JSON.stringify(stampedOutputConfig, null, 2).trimEnd().concat("\n");
    const nextHash = hashConfigRaw(json);
    const previousHash = resolveConfigSnapshotHash(snapshot);
    const changedPathCount = changedPaths?.size;
    const previousBytes = typeof snapshot.raw === "string" ? Buffer.byteLength(snapshot.raw, "utf-8") : null;
    const nextBytes = Buffer.byteLength(json, "utf-8");
    const hasMetaBefore = hasConfigMeta(snapshot.parsed);
    const hasMetaAfter = hasConfigMeta(stampedOutputConfig);
    const gatewayModeBefore = resolveGatewayMode(snapshot.resolved);
    const gatewayModeAfter = resolveGatewayMode(stampedOutputConfig);
    const suspiciousReasons = resolveConfigWriteSuspiciousReasons({
      existsBefore: snapshot.exists,
      previousBytes,
      nextBytes,
      hasMetaBefore,
      gatewayModeBefore,
      gatewayModeAfter
    });
    const logConfigOverwrite = () => {
      if (!snapshot.exists) return;
      const isVitest = deps.env.VITEST === "true";
      const shouldLogInVitest = deps.env.OPENCLAW_TEST_CONFIG_OVERWRITE_LOG === "1";
      if (isVitest && !shouldLogInVitest) return;
      const changeSummary = typeof changedPathCount === "number" ? `, changedPaths=${changedPathCount}` : "";
      deps.logger.warn(`Config overwrite: ${configPath} (sha256 ${previousHash ?? "unknown"} -> ${nextHash}, backup=${configPath}.bak${changeSummary})`);
    };
    const logConfigWriteAnomalies = () => {
      if (suspiciousReasons.length === 0) return;
      const isVitest = deps.env.VITEST === "true";
      const shouldLogInVitest = deps.env.OPENCLAW_TEST_CONFIG_WRITE_ANOMALY_LOG === "1";
      if (isVitest && !shouldLogInVitest) return;
      deps.logger.warn(`Config write anomaly: ${configPath} (${suspiciousReasons.join(", ")})`);
    };
    const auditRecordBase = {
      ts: (/* @__PURE__ */new Date()).toISOString(),
      source: "config-io",
      event: "config.write",
      configPath,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv.slice(0, 8),
      execArgv: process.execArgv.slice(0, 8),
      watchMode: deps.env.OPENCLAW_WATCH_MODE === "1",
      watchSession: typeof deps.env.OPENCLAW_WATCH_SESSION === "string" && deps.env.OPENCLAW_WATCH_SESSION.trim().length > 0 ? deps.env.OPENCLAW_WATCH_SESSION.trim() : null,
      watchCommand: typeof deps.env.OPENCLAW_WATCH_COMMAND === "string" && deps.env.OPENCLAW_WATCH_COMMAND.trim().length > 0 ? deps.env.OPENCLAW_WATCH_COMMAND.trim() : null,
      existsBefore: snapshot.exists,
      previousHash: previousHash ?? null,
      nextHash,
      previousBytes,
      nextBytes,
      changedPathCount: typeof changedPathCount === "number" ? changedPathCount : null,
      hasMetaBefore,
      hasMetaAfter,
      gatewayModeBefore,
      gatewayModeAfter,
      suspicious: suspiciousReasons
    };
    const appendWriteAudit = async (result, err) => {
      const errorCode = err && typeof err === "object" && "code" in err && typeof err.code === "string" ? err.code : void 0;
      const errorMessage = err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : void 0;
      await appendConfigWriteAuditRecord(deps, {
        ...auditRecordBase,
        result,
        nextHash: result === "failed" ? null : auditRecordBase.nextHash,
        nextBytes: result === "failed" ? null : auditRecordBase.nextBytes,
        errorCode,
        errorMessage
      });
    };
    const tmp = _nodePath.default.join(dir, `${_nodePath.default.basename(configPath)}.${process.pid}.${_nodeCrypto.default.randomUUID()}.tmp`);
    try {
      await deps.fs.promises.writeFile(tmp, json, {
        encoding: "utf-8",
        mode: 384
      });
      if (deps.fs.existsSync(configPath)) {
        await rotateConfigBackups(configPath, deps.fs.promises);
        await deps.fs.promises.copyFile(configPath, `${configPath}.bak`).catch(() => {});
      }
      try {
        await deps.fs.promises.rename(tmp, configPath);
      } catch (err) {
        const code = err.code;
        if (code === "EPERM" || code === "EEXIST") {
          await deps.fs.promises.copyFile(tmp, configPath);
          await deps.fs.promises.chmod(configPath, 384).catch(() => {});
          await deps.fs.promises.unlink(tmp).catch(() => {});
          logConfigOverwrite();
          logConfigWriteAnomalies();
          await appendWriteAudit("copy-fallback");
          return;
        }
        await deps.fs.promises.unlink(tmp).catch(() => {});
        throw err;
      }
      logConfigOverwrite();
      logConfigWriteAnomalies();
      await appendWriteAudit("rename");
    } catch (err) {
      await appendWriteAudit("failed", err);
      throw err;
    }
  }
  return {
    configPath,
    loadConfig,
    readConfigFileSnapshot,
    readConfigFileSnapshotForWrite,
    writeConfigFile
  };
}
const DEFAULT_CONFIG_CACHE_MS = 200;
let configCache = null;
function resolveConfigCacheMs(env) {
  const raw = env.OPENCLAW_CONFIG_CACHE_MS?.trim();
  if (raw === "" || raw === "0") return 0;
  if (!raw) return DEFAULT_CONFIG_CACHE_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CONFIG_CACHE_MS;
  return Math.max(0, parsed);
}
function shouldUseConfigCache(env) {
  if (env.OPENCLAW_DISABLE_CONFIG_CACHE?.trim()) return false;
  return resolveConfigCacheMs(env) > 0;
}
function clearConfigCache() {
  configCache = null;
}
function loadConfig() {
  const io = createConfigIO();
  const configPath = io.configPath;
  const now = Date.now();
  if (shouldUseConfigCache(process.env)) {
    const cached = configCache;
    if (cached && cached.configPath === configPath && cached.expiresAt > now) return cached.config;
  }
  const config = io.loadConfig();
  if (shouldUseConfigCache(process.env)) {
    const cacheMs = resolveConfigCacheMs(process.env);
    if (cacheMs > 0) configCache = {
      configPath,
      expiresAt: now + cacheMs,
      config
    };
  }
  return config;
}
async function readConfigFileSnapshot() {
  return await createConfigIO().readConfigFileSnapshot();
}
async function writeConfigFile(cfg, options = {}) {
  const io = createConfigIO();
  const sameConfigPath = options.expectedConfigPath === void 0 || options.expectedConfigPath === io.configPath;
  await io.writeConfigFile(cfg, { envSnapshotForRestore: sameConfigPath ? options.envSnapshotForRestore : void 0 });
}

//#endregion /* v9-63f9b2f56704b6bf */
