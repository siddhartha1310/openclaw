"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.clearApiKeyCache = exports.ModelRegistry = void 0;


var _piAi = require("@mariozechner/pi-ai");
var _typebox = require("@sinclair/typebox");
var _ajv = _interopRequireDefault(require("ajv"));
var _fs = require("fs");
var _path = require("path");
var _config = require("../config.js");
var _resolveConfigValue = require("./resolve-config-value.js");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} /**
 * Model registry - manages built-in and custom models, provides API key resolution.
 */const Ajv = _ajv.default.default || _ajv.default; // Schema for OpenRouter routing preferences
const OpenRouterRoutingSchema = _typebox.Type.Object({
  only: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  order: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String()))
});
// Schema for Vercel AI Gateway routing preferences
const VercelGatewayRoutingSchema = _typebox.Type.Object({
  only: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  order: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String()))
});
// Schema for OpenAI compatibility settings
const OpenAICompletionsCompatSchema = _typebox.Type.Object({
  supportsStore: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsDeveloperRole: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsReasoningEffort: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsUsageInStreaming: _typebox.Type.Optional(_typebox.Type.Boolean()),
  maxTokensField: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Literal("max_completion_tokens"), _typebox.Type.Literal("max_tokens")])),
  requiresToolResultName: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresAssistantAfterToolResult: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresThinkingAsText: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresMistralToolIds: _typebox.Type.Optional(_typebox.Type.Boolean()),
  thinkingFormat: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Literal("openai"), _typebox.Type.Literal("zai"), _typebox.Type.Literal("qwen")])),
  openRouterRouting: _typebox.Type.Optional(OpenRouterRoutingSchema),
  vercelGatewayRouting: _typebox.Type.Optional(VercelGatewayRoutingSchema)
});
const OpenAIResponsesCompatSchema = _typebox.Type.Object({});
const OpenAICompatSchema = _typebox.Type.Union([OpenAICompletionsCompatSchema, OpenAIResponsesCompatSchema]);
// Schema for custom model definition
// Most fields are optional with sensible defaults for local models (Ollama, LM Studio, etc.)
const ModelDefinitionSchema = _typebox.Type.Object({
  id: _typebox.Type.String({ minLength: 1 }),
  name: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  api: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  reasoning: _typebox.Type.Optional(_typebox.Type.Boolean()),
  input: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.Union([_typebox.Type.Literal("text"), _typebox.Type.Literal("image")]))),
  cost: _typebox.Type.Optional(_typebox.Type.Object({
    input: _typebox.Type.Number(),
    output: _typebox.Type.Number(),
    cacheRead: _typebox.Type.Number(),
    cacheWrite: _typebox.Type.Number()
  })),
  contextWindow: _typebox.Type.Optional(_typebox.Type.Number()),
  maxTokens: _typebox.Type.Optional(_typebox.Type.Number()),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  compat: _typebox.Type.Optional(OpenAICompatSchema)
});
// Schema for per-model overrides (all fields optional, merged with built-in model)
const ModelOverrideSchema = _typebox.Type.Object({
  name: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  reasoning: _typebox.Type.Optional(_typebox.Type.Boolean()),
  input: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.Union([_typebox.Type.Literal("text"), _typebox.Type.Literal("image")]))),
  cost: _typebox.Type.Optional(_typebox.Type.Object({
    input: _typebox.Type.Optional(_typebox.Type.Number()),
    output: _typebox.Type.Optional(_typebox.Type.Number()),
    cacheRead: _typebox.Type.Optional(_typebox.Type.Number()),
    cacheWrite: _typebox.Type.Optional(_typebox.Type.Number())
  })),
  contextWindow: _typebox.Type.Optional(_typebox.Type.Number()),
  maxTokens: _typebox.Type.Optional(_typebox.Type.Number()),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  compat: _typebox.Type.Optional(OpenAICompatSchema)
});
const ProviderConfigSchema = _typebox.Type.Object({
  baseUrl: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  apiKey: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  api: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  authHeader: _typebox.Type.Optional(_typebox.Type.Boolean()),
  models: _typebox.Type.Optional(_typebox.Type.Array(ModelDefinitionSchema)),
  modelOverrides: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), ModelOverrideSchema))
});
const ModelsConfigSchema = _typebox.Type.Object({
  providers: _typebox.Type.Record(_typebox.Type.String(), ProviderConfigSchema)
});
function emptyCustomModelsResult(error) {
  return { models: [], overrides: new Map(), modelOverrides: new Map(), error };
}
function mergeCompat(baseCompat, overrideCompat) {
  if (!overrideCompat)
  return baseCompat;
  const base = baseCompat;
  const override = overrideCompat;
  const merged = { ...base, ...override };
  const baseCompletions = base;
  const overrideCompletions = override;
  const mergedCompletions = merged;
  if (baseCompletions?.openRouterRouting || overrideCompletions.openRouterRouting) {
    mergedCompletions.openRouterRouting = {
      ...baseCompletions?.openRouterRouting,
      ...overrideCompletions.openRouterRouting
    };
  }
  if (baseCompletions?.vercelGatewayRouting || overrideCompletions.vercelGatewayRouting) {
    mergedCompletions.vercelGatewayRouting = {
      ...baseCompletions?.vercelGatewayRouting,
      ...overrideCompletions.vercelGatewayRouting
    };
  }
  return merged;
}
/**
 * Deep merge a model override into a model.
 * Handles nested objects (cost, compat) by merging rather than replacing.
 */
function applyModelOverride(model, override) {
  const result = { ...model };
  // Simple field overrides
  if (override.name !== undefined)
  result.name = override.name;
  if (override.reasoning !== undefined)
  result.reasoning = override.reasoning;
  if (override.input !== undefined)
  result.input = override.input;
  if (override.contextWindow !== undefined)
  result.contextWindow = override.contextWindow;
  if (override.maxTokens !== undefined)
  result.maxTokens = override.maxTokens;
  // Merge cost (partial override)
  if (override.cost) {
    result.cost = {
      input: override.cost.input ?? model.cost.input,
      output: override.cost.output ?? model.cost.output,
      cacheRead: override.cost.cacheRead ?? model.cost.cacheRead,
      cacheWrite: override.cost.cacheWrite ?? model.cost.cacheWrite
    };
  }
  // Merge headers
  if (override.headers) {
    const resolvedHeaders = (0, _resolveConfigValue.resolveHeaders)(override.headers);
    result.headers = resolvedHeaders ? { ...model.headers, ...resolvedHeaders } : model.headers;
  }
  // Deep merge compat
  result.compat = mergeCompat(model.compat, override.compat);
  return result;
}
/** Clear the config value command cache. Exported for testing. */
const clearApiKeyCache = exports.clearApiKeyCache = _resolveConfigValue.clearConfigValueCache;
/**
 * Model registry - loads and manages models, resolves API keys via AuthStorage.
 */
class ModelRegistry {
  authStorage;
  modelsJsonPath;
  models = [];
  customProviderApiKeys = new Map();
  registeredProviders = new Map();
  loadError = undefined;
  constructor(authStorage, modelsJsonPath = (0, _path.join)((0, _config.getAgentDir)(), "models.json")) {
    this.authStorage = authStorage;
    this.modelsJsonPath = modelsJsonPath;
    // Set up fallback resolver for custom provider API keys
    this.authStorage.setFallbackResolver((provider) => {
      const keyConfig = this.customProviderApiKeys.get(provider);
      if (keyConfig) {
        return (0, _resolveConfigValue.resolveConfigValue)(keyConfig);
      }
      return undefined;
    });
    // Load models
    this.loadModels();
  }
  /**
   * Reload models from disk (built-in + custom from models.json).
   */
  refresh() {
    this.customProviderApiKeys.clear();
    this.loadError = undefined;
    this.loadModels();
    for (const [providerName, config] of this.registeredProviders.entries()) {
      this.applyProviderConfig(providerName, config);
    }
  }
  /**
   * Get any error from loading models.json (undefined if no error).
   */
  getError() {
    return this.loadError;
  }
  loadModels() {
    // Load custom models and overrides from models.json
    const { models: customModels, overrides, modelOverrides, error } = this.modelsJsonPath ? this.loadCustomModels(this.modelsJsonPath) : emptyCustomModelsResult();
    if (error) {
      this.loadError = error;
      // Keep built-in models even if custom models failed to load
    }
    const builtInModels = this.loadBuiltInModels(overrides, modelOverrides);
    let combined = this.mergeCustomModels(builtInModels, customModels);
    // Let OAuth providers modify their models (e.g., update baseUrl)
    for (const oauthProvider of this.authStorage.getOAuthProviders()) {
      const cred = this.authStorage.get(oauthProvider.id);
      if (cred?.type === "oauth" && oauthProvider.modifyModels) {
        combined = oauthProvider.modifyModels(combined, cred);
      }
    }
    this.models = combined;
  }
  /** Load built-in models and apply provider/model overrides */
  loadBuiltInModels(overrides, modelOverrides) {
    return (0, _piAi.getProviders)().flatMap((provider) => {
      const models = (0, _piAi.getModels)(provider);
      const providerOverride = overrides.get(provider);
      const perModelOverrides = modelOverrides.get(provider);
      return models.map((m) => {
        let model = m;
        // Apply provider-level baseUrl/headers override
        if (providerOverride) {
          const resolvedHeaders = (0, _resolveConfigValue.resolveHeaders)(providerOverride.headers);
          model = {
            ...model,
            baseUrl: providerOverride.baseUrl ?? model.baseUrl,
            headers: resolvedHeaders ? { ...model.headers, ...resolvedHeaders } : model.headers
          };
        }
        // Apply per-model override
        const modelOverride = perModelOverrides?.get(m.id);
        if (modelOverride) {
          model = applyModelOverride(model, modelOverride);
        }
        return model;
      });
    });
  }
  /** Merge custom models into built-in list by provider+id (custom wins on conflicts). */
  mergeCustomModels(builtInModels, customModels) {
    const merged = [...builtInModels];
    for (const customModel of customModels) {
      const existingIndex = merged.findIndex((m) => m.provider === customModel.provider && m.id === customModel.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = customModel;
      } else
      {
        merged.push(customModel);
      }
    }
    return merged;
  }
  loadCustomModels(modelsJsonPath) {
    if (!(0, _fs.existsSync)(modelsJsonPath)) {
      return emptyCustomModelsResult();
    }
    try {
      const content = (0, _fs.readFileSync)(modelsJsonPath, "utf-8");
      const config = JSON.parse(content);
      // Validate schema
      const ajv = new Ajv();
      const validate = ajv.compile(ModelsConfigSchema);
      if (!validate(config)) {
        const errors = validate.errors?.map((e) => `  - ${e.instancePath || "root"}: ${e.message}`).join("\n") ||
        "Unknown schema error";
        return emptyCustomModelsResult(`Invalid models.json schema:\n${errors}\n\nFile: ${modelsJsonPath}`);
      }
      // Additional validation
      this.validateConfig(config);
      const overrides = new Map();
      const modelOverrides = new Map();
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        // Apply provider-level baseUrl/headers/apiKey override to built-in models when configured.
        if (providerConfig.baseUrl || providerConfig.headers || providerConfig.apiKey) {
          overrides.set(providerName, {
            baseUrl: providerConfig.baseUrl,
            headers: providerConfig.headers,
            apiKey: providerConfig.apiKey
          });
        }
        // Store API key for fallback resolver.
        if (providerConfig.apiKey) {
          this.customProviderApiKeys.set(providerName, providerConfig.apiKey);
        }
        if (providerConfig.modelOverrides) {
          modelOverrides.set(providerName, new Map(Object.entries(providerConfig.modelOverrides)));
        }
      }
      return { models: this.parseModels(config), overrides, modelOverrides, error: undefined };
    }
    catch (error) {
      if (error instanceof SyntaxError) {
        return emptyCustomModelsResult(`Failed to parse models.json: ${error.message}\n\nFile: ${modelsJsonPath}`);
      }
      return emptyCustomModelsResult(`Failed to load models.json: ${error instanceof Error ? error.message : error}\n\nFile: ${modelsJsonPath}`);
    }
  }
  validateConfig(config) {
    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      const hasProviderApi = !!providerConfig.api;
      const models = providerConfig.models ?? [];
      const hasModelOverrides = providerConfig.modelOverrides && Object.keys(providerConfig.modelOverrides).length > 0;
      if (models.length === 0) {
        // Override-only config: needs baseUrl OR modelOverrides (or both)
        if (!providerConfig.baseUrl && !hasModelOverrides) {
          throw new Error(`Provider ${providerName}: must specify "baseUrl", "modelOverrides", or "models".`);
        }
      } else
      {
        // Custom models are merged into provider models and require endpoint + auth.
        if (!providerConfig.baseUrl) {
          throw new Error(`Provider ${providerName}: "baseUrl" is required when defining custom models.`);
        }
        if (!providerConfig.apiKey) {
          throw new Error(`Provider ${providerName}: "apiKey" is required when defining custom models.`);
        }
      }
      for (const modelDef of models) {
        const hasModelApi = !!modelDef.api;
        if (!hasProviderApi && !hasModelApi) {
          throw new Error(`Provider ${providerName}, model ${modelDef.id}: no "api" specified. Set at provider or model level.`);
        }
        if (!modelDef.id)
        throw new Error(`Provider ${providerName}: model missing "id"`);
        // Validate contextWindow/maxTokens only if provided (they have defaults)
        if (modelDef.contextWindow !== undefined && modelDef.contextWindow <= 0)
        throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid contextWindow`);
        if (modelDef.maxTokens !== undefined && modelDef.maxTokens <= 0)
        throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid maxTokens`);
      }
    }
  }
  parseModels(config) {
    const models = [];
    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      const modelDefs = providerConfig.models ?? [];
      if (modelDefs.length === 0)
      continue; // Override-only, no custom models
      // Store API key config for fallback resolver
      if (providerConfig.apiKey) {
        this.customProviderApiKeys.set(providerName, providerConfig.apiKey);
      }
      for (const modelDef of modelDefs) {
        const api = modelDef.api || providerConfig.api;
        if (!api)
        continue;
        // Merge headers: provider headers are base, model headers override
        // Resolve env vars and shell commands in header values
        const providerHeaders = (0, _resolveConfigValue.resolveHeaders)(providerConfig.headers);
        const modelHeaders = (0, _resolveConfigValue.resolveHeaders)(modelDef.headers);
        let headers = providerHeaders || modelHeaders ? { ...providerHeaders, ...modelHeaders } : undefined;
        // If authHeader is true, add Authorization header with resolved API key
        if (providerConfig.authHeader && providerConfig.apiKey) {
          const resolvedKey = (0, _resolveConfigValue.resolveConfigValue)(providerConfig.apiKey);
          if (resolvedKey) {
            headers = { ...headers, Authorization: `Bearer ${resolvedKey}` };
          }
        }
        // baseUrl is validated to exist for providers with models
        // Apply defaults for optional fields
        const defaultCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        models.push({
          id: modelDef.id,
          name: modelDef.name ?? modelDef.id,
          api: api,
          provider: providerName,
          baseUrl: providerConfig.baseUrl,
          reasoning: modelDef.reasoning ?? false,
          input: modelDef.input ?? ["text"],
          cost: modelDef.cost ?? defaultCost,
          contextWindow: modelDef.contextWindow ?? 128000,
          maxTokens: modelDef.maxTokens ?? 16384,
          headers,
          compat: modelDef.compat
        });
      }
    }
    return models;
  }
  /**
   * Get all models (built-in + custom).
   * If models.json had errors, returns only built-in models.
   */
  getAll() {
    return this.models;
  }
  /**
   * Get only models that have auth configured.
   * This is a fast check that doesn't refresh OAuth tokens.
   */
  getAvailable() {
    return this.models.filter((m) => this.authStorage.hasAuth(m.provider));
  }
  /**
   * Find a model by provider and ID.
   */
  find(provider, modelId) {
    return this.models.find((m) => m.provider === provider && m.id === modelId);
  }
  /**
   * Get API key for a model.
   */
  async getApiKey(model) {
    return this.authStorage.getApiKey(model.provider);
  }
  /**
   * Get API key for a provider.
   */
  async getApiKeyForProvider(provider) {
    return this.authStorage.getApiKey(provider);
  }
  /**
   * Check if a model is using OAuth credentials (subscription).
   */
  isUsingOAuth(model) {
    const cred = this.authStorage.get(model.provider);
    return cred?.type === "oauth";
  }
  /**
   * Register a provider dynamically (from extensions).
   *
   * If provider has models: replaces all existing models for this provider.
   * If provider has only baseUrl/headers: overrides existing models' URLs.
   * If provider has oauth: registers OAuth provider for /login support.
   */
  registerProvider(providerName, config) {
    this.registeredProviders.set(providerName, config);
    this.applyProviderConfig(providerName, config);
  }
  applyProviderConfig(providerName, config) {
    // Register OAuth provider if provided
    if (config.oauth) {
      // Ensure the OAuth provider ID matches the provider name
      const oauthProvider = {
        ...config.oauth,
        id: providerName
      };
      (0, _piAi.registerOAuthProvider)(oauthProvider);
    }
    if (config.streamSimple) {
      if (!config.api) {
        throw new Error(`Provider ${providerName}: "api" is required when registering streamSimple.`);
      }
      const streamSimple = config.streamSimple;
      (0, _piAi.registerApiProvider)({
        api: config.api,
        stream: (model, context, options) => streamSimple(model, context, options),
        streamSimple
      });
    }
    // Store API key for auth resolution
    if (config.apiKey) {
      this.customProviderApiKeys.set(providerName, config.apiKey);
    }
    if (config.models && config.models.length > 0) {
      // Full replacement: remove existing models for this provider
      this.models = this.models.filter((m) => m.provider !== providerName);
      // Validate required fields
      if (!config.baseUrl) {
        throw new Error(`Provider ${providerName}: "baseUrl" is required when defining models.`);
      }
      if (!config.apiKey && !config.oauth) {
        throw new Error(`Provider ${providerName}: "apiKey" or "oauth" is required when defining models.`);
      }
      // Parse and add new models
      for (const modelDef of config.models) {
        const api = modelDef.api || config.api;
        if (!api) {
          throw new Error(`Provider ${providerName}, model ${modelDef.id}: no "api" specified.`);
        }
        // Merge headers
        const providerHeaders = (0, _resolveConfigValue.resolveHeaders)(config.headers);
        const modelHeaders = (0, _resolveConfigValue.resolveHeaders)(modelDef.headers);
        let headers = providerHeaders || modelHeaders ? { ...providerHeaders, ...modelHeaders } : undefined;
        // If authHeader is true, add Authorization header
        if (config.authHeader && config.apiKey) {
          const resolvedKey = (0, _resolveConfigValue.resolveConfigValue)(config.apiKey);
          if (resolvedKey) {
            headers = { ...headers, Authorization: `Bearer ${resolvedKey}` };
          }
        }
        this.models.push({
          id: modelDef.id,
          name: modelDef.name,
          api: api,
          provider: providerName,
          baseUrl: config.baseUrl,
          reasoning: modelDef.reasoning,
          input: modelDef.input,
          cost: modelDef.cost,
          contextWindow: modelDef.contextWindow,
          maxTokens: modelDef.maxTokens,
          headers,
          compat: modelDef.compat
        });
      }
      // Apply OAuth modifyModels if credentials exist (e.g., to update baseUrl)
      if (config.oauth?.modifyModels) {
        const cred = this.authStorage.get(providerName);
        if (cred?.type === "oauth") {
          this.models = config.oauth.modifyModels(this.models, cred);
        }
      }
    } else
    if (config.baseUrl) {
      // Override-only: update baseUrl/headers for existing models
      const resolvedHeaders = (0, _resolveConfigValue.resolveHeaders)(config.headers);
      this.models = this.models.map((m) => {
        if (m.provider !== providerName)
        return m;
        return {
          ...m,
          baseUrl: config.baseUrl ?? m.baseUrl,
          headers: resolvedHeaders ? { ...m.headers, ...resolvedHeaders } : m.headers
        };
      });
    }
  }
}exports.ModelRegistry = ModelRegistry; /* v9-fd97f8661a8cfd73 */
