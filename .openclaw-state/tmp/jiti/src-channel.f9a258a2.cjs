"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.whatsappPlugin = void 0;var _pluginSdk = require("openclaw/plugin-sdk");






























var _runtime = require("./runtime.js");

const meta = (0, _pluginSdk.getChatChannelMeta)("whatsapp");

const whatsappPlugin = exports.whatsappPlugin = {
  id: "whatsapp",
  meta: {
    ...meta,
    showConfigured: false,
    quickstartAllowFrom: true,
    forceAccountBinding: true,
    preferSessionLookupForAnnounceTarget: true
  },
  onboarding: _pluginSdk.whatsappOnboardingAdapter,
  agentTools: () => [(0, _runtime.getWhatsAppRuntime)().channel.whatsapp.createLoginTool()],
  pairing: {
    idLabel: "whatsappSenderId"
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    polls: true,
    reactions: true,
    media: true
  },
  reload: { configPrefixes: ["web"], noopPrefixes: ["channels.whatsapp"] },
  gatewayMethods: ["web.login.start", "web.login.wait"],
  configSchema: (0, _pluginSdk.buildChannelConfigSchema)(_pluginSdk.WhatsAppConfigSchema),
  config: {
    listAccountIds: (cfg) => (0, _pluginSdk.listWhatsAppAccountIds)(cfg),
    resolveAccount: (cfg, accountId) => (0, _pluginSdk.resolveWhatsAppAccount)({ cfg, accountId }),
    defaultAccountId: (cfg) => (0, _pluginSdk.resolveDefaultWhatsAppAccountId)(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const accountKey = accountId || _pluginSdk.DEFAULT_ACCOUNT_ID;
      const accounts = { ...cfg.channels?.whatsapp?.accounts };
      const existing = accounts[accountKey] ?? {};
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          whatsapp: {
            ...cfg.channels?.whatsapp,
            accounts: {
              ...accounts,
              [accountKey]: {
                ...existing,
                enabled
              }
            }
          }
        }
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const accountKey = accountId || _pluginSdk.DEFAULT_ACCOUNT_ID;
      const accounts = { ...cfg.channels?.whatsapp?.accounts };
      delete accounts[accountKey];
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          whatsapp: {
            ...cfg.channels?.whatsapp,
            accounts: Object.keys(accounts).length ? accounts : undefined
          }
        }
      };
    },
    isEnabled: (account, cfg) => account.enabled && cfg.web?.enabled !== false,
    disabledReason: () => "disabled",
    isConfigured: async (account) =>
    await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.webAuthExists(account.authDir),
    unconfiguredReason: () => "not linked",
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.authDir),
      linked: Boolean(account.authDir),
      dmPolicy: account.dmPolicy,
      allowFrom: account.allowFrom
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
    (0, _pluginSdk.resolveWhatsAppAccount)({ cfg, accountId }).allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) =>
    allowFrom.
    map((entry) => String(entry).trim()).
    filter((entry) => Boolean(entry)).
    map((entry) => entry === "*" ? entry : (0, _pluginSdk.normalizeWhatsAppTarget)(entry)).
    filter((entry) => Boolean(entry))
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? _pluginSdk.DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.whatsapp?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ?
      `channels.whatsapp.accounts.${resolvedAccountId}.` :
      "channels.whatsapp.";
      return {
        policy: account.dmPolicy ?? "pairing",
        allowFrom: account.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: (0, _pluginSdk.formatPairingApproveHint)("whatsapp"),
        normalizeEntry: (raw) => (0, _pluginSdk.normalizeE164)(raw)
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") {
        return [];
      }
      const groupAllowlistConfigured =
      Boolean(account.groups) && Object.keys(account.groups ?? {}).length > 0;
      if (groupAllowlistConfigured) {
        return [
        `- WhatsApp groups: groupPolicy="open" allows any member in allowed groups to trigger (mention-gated). Set channels.whatsapp.groupPolicy="allowlist" + channels.whatsapp.groupAllowFrom to restrict senders.`];

      }
      return [
      `- WhatsApp groups: groupPolicy="open" with no channels.whatsapp.groups allowlist; any group can add + ping (mention-gated). Set channels.whatsapp.groupPolicy="allowlist" + channels.whatsapp.groupAllowFrom or configure channels.whatsapp.groups.`];

    }
  },
  setup: {
    resolveAccountId: ({ accountId }) => (0, _pluginSdk.normalizeAccountId)(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
    (0, _pluginSdk.applyAccountNameToChannelSection)({
      cfg,
      channelKey: "whatsapp",
      accountId,
      name,
      alwaysUseAccounts: true
    }),
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = (0, _pluginSdk.applyAccountNameToChannelSection)({
        cfg,
        channelKey: "whatsapp",
        accountId,
        name: input.name,
        alwaysUseAccounts: true
      });
      const next = (0, _pluginSdk.migrateBaseNameToDefaultAccount)({
        cfg: namedConfig,
        channelKey: "whatsapp",
        alwaysUseAccounts: true
      });
      const entry = {
        ...next.channels?.whatsapp?.accounts?.[accountId],
        ...(input.authDir ? { authDir: input.authDir } : {}),
        enabled: true
      };
      return {
        ...next,
        channels: {
          ...next.channels,
          whatsapp: {
            ...next.channels?.whatsapp,
            accounts: {
              ...next.channels?.whatsapp?.accounts,
              [accountId]: entry
            }
          }
        }
      };
    }
  },
  groups: {
    resolveRequireMention: _pluginSdk.resolveWhatsAppGroupRequireMention,
    resolveToolPolicy: _pluginSdk.resolveWhatsAppGroupToolPolicy,
    resolveGroupIntroHint: () =>
    "WhatsApp IDs: SenderId is the participant JID (group participant id)."
  },
  mentions: {
    stripPatterns: ({ ctx }) => {
      const selfE164 = (ctx.To ?? "").replace(/^whatsapp:/, "");
      if (!selfE164) {
        return [];
      }
      const escaped = (0, _pluginSdk.escapeRegExp)(selfE164);
      return [escaped, `@${escaped}`];
    }
  },
  commands: {
    enforceOwnerForCommands: true,
    skipWhenConfigEmpty: true
  },
  messaging: {
    normalizeTarget: _pluginSdk.normalizeWhatsAppMessagingTarget,
    targetResolver: {
      looksLikeId: _pluginSdk.looksLikeWhatsAppTargetId,
      hint: "<E.164|group JID>"
    }
  },
  directory: {
    self: async ({ cfg, accountId }) => {
      const account = (0, _pluginSdk.resolveWhatsAppAccount)({ cfg, accountId });
      const { e164, jid } = (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.readWebSelfId(account.authDir);
      const id = e164 ?? jid;
      if (!id) {
        return null;
      }
      return {
        kind: "user",
        id,
        name: account.name,
        raw: { e164, jid }
      };
    },
    listPeers: async (params) => (0, _pluginSdk.listWhatsAppDirectoryPeersFromConfig)(params),
    listGroups: async (params) => (0, _pluginSdk.listWhatsAppDirectoryGroupsFromConfig)(params)
  },
  actions: {
    listActions: ({ cfg }) => {
      if (!cfg.channels?.whatsapp) {
        return [];
      }
      const gate = (0, _pluginSdk.createActionGate)(cfg.channels.whatsapp.actions);
      const actions = new Set();
      if (gate("reactions")) {
        actions.add("react");
      }
      if (gate("polls")) {
        actions.add("poll");
      }
      return Array.from(actions);
    },
    supportsAction: ({ action }) => action === "react",
    handleAction: async ({ action, params, cfg, accountId }) => {
      if (action !== "react") {
        throw new Error(`Action ${action} is not supported for provider ${meta.id}.`);
      }
      const messageId = (0, _pluginSdk.readStringParam)(params, "messageId", {
        required: true
      });
      const emoji = (0, _pluginSdk.readStringParam)(params, "emoji", { allowEmpty: true });
      const remove = typeof params.remove === "boolean" ? params.remove : undefined;
      return await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.handleWhatsAppAction(
        {
          action: "react",
          chatJid:
          (0, _pluginSdk.readStringParam)(params, "chatJid") ?? (0, _pluginSdk.readStringParam)(params, "to", { required: true }),
          messageId,
          emoji,
          remove,
          participant: (0, _pluginSdk.readStringParam)(params, "participant"),
          accountId: accountId ?? undefined,
          fromMe: typeof params.fromMe === "boolean" ? params.fromMe : undefined
        },
        cfg
      );
    }
  },
  outbound: {
    deliveryMode: "gateway",
    chunker: (text, limit) => (0, _runtime.getWhatsAppRuntime)().channel.text.chunkText(text, limit),
    chunkerMode: "text",
    textChunkLimit: 4000,
    pollMaxOptions: 12,
    resolveTarget: ({ to, allowFrom, mode }) =>
    (0, _pluginSdk.resolveWhatsAppOutboundTarget)({ to, allowFrom, mode }),
    sendText: async ({ to, text, accountId, deps, gifPlayback }) => {
      const send = deps?.sendWhatsApp ?? (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.sendMessageWhatsApp;
      const result = await send(to, text, {
        verbose: false,
        accountId: accountId ?? undefined,
        gifPlayback
      });
      return { channel: "whatsapp", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, deps, gifPlayback }) => {
      const send = deps?.sendWhatsApp ?? (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.sendMessageWhatsApp;
      const result = await send(to, text, {
        verbose: false,
        mediaUrl,
        accountId: accountId ?? undefined,
        gifPlayback
      });
      return { channel: "whatsapp", ...result };
    },
    sendPoll: async ({ to, poll, accountId }) =>
    await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.sendPollWhatsApp(to, poll, {
      verbose: (0, _runtime.getWhatsAppRuntime)().logging.shouldLogVerbose(),
      accountId: accountId ?? undefined
    })
  },
  auth: {
    login: async ({ cfg, accountId, runtime, verbose }) => {
      const resolvedAccountId = accountId?.trim() || (0, _pluginSdk.resolveDefaultWhatsAppAccountId)(cfg);
      await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.loginWeb(
        Boolean(verbose),
        undefined,
        runtime,
        resolvedAccountId
      );
    }
  },
  heartbeat: {
    checkReady: async ({ cfg, accountId, deps }) => {
      if (cfg.web?.enabled === false) {
        return { ok: false, reason: "whatsapp-disabled" };
      }
      const account = (0, _pluginSdk.resolveWhatsAppAccount)({ cfg, accountId });
      const authExists = await (
      deps?.webAuthExists ?? (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.webAuthExists)(
        account.authDir);
      if (!authExists) {
        return { ok: false, reason: "whatsapp-not-linked" };
      }
      const listenerActive = deps?.hasActiveWebListener ?
      deps.hasActiveWebListener() :
      Boolean((0, _runtime.getWhatsAppRuntime)().channel.whatsapp.getActiveWebListener());
      if (!listenerActive) {
        return { ok: false, reason: "whatsapp-not-running" };
      }
      return { ok: true, reason: "ok" };
    },
    resolveRecipients: ({ cfg, opts }) => (0, _pluginSdk.resolveWhatsAppHeartbeatRecipients)(cfg, opts)
  },
  status: {
    defaultRuntime: {
      accountId: _pluginSdk.DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastDisconnect: null,
      lastMessageAt: null,
      lastEventAt: null,
      lastError: null
    },
    collectStatusIssues: _pluginSdk.collectWhatsAppStatusIssues,
    buildChannelSummary: async ({ account, snapshot }) => {
      const authDir = account.authDir;
      const linked =
      typeof snapshot.linked === "boolean" ?
      snapshot.linked :
      authDir ?
      await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.webAuthExists(authDir) :
      false;
      const authAgeMs =
      linked && authDir ? (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.getWebAuthAgeMs(authDir) : null;
      const self =
      linked && authDir ?
      (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.readWebSelfId(authDir) :
      { e164: null, jid: null };
      return {
        configured: linked,
        linked,
        authAgeMs,
        self,
        running: snapshot.running ?? false,
        connected: snapshot.connected ?? false,
        lastConnectedAt: snapshot.lastConnectedAt ?? null,
        lastDisconnect: snapshot.lastDisconnect ?? null,
        reconnectAttempts: snapshot.reconnectAttempts,
        lastMessageAt: snapshot.lastMessageAt ?? null,
        lastEventAt: snapshot.lastEventAt ?? null,
        lastError: snapshot.lastError ?? null
      };
    },
    buildAccountSnapshot: async ({ account, runtime }) => {
      const linked = await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.webAuthExists(account.authDir);
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: true,
        linked,
        running: runtime?.running ?? false,
        connected: runtime?.connected ?? false,
        reconnectAttempts: runtime?.reconnectAttempts,
        lastConnectedAt: runtime?.lastConnectedAt ?? null,
        lastDisconnect: runtime?.lastDisconnect ?? null,
        lastMessageAt: runtime?.lastMessageAt ?? null,
        lastEventAt: runtime?.lastEventAt ?? null,
        lastError: runtime?.lastError ?? null,
        dmPolicy: account.dmPolicy,
        allowFrom: account.allowFrom
      };
    },
    resolveAccountState: ({ configured }) => configured ? "linked" : "not linked",
    logSelfId: ({ account, runtime, includeChannelPrefix }) => {
      (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.logWebSelfId(
        account.authDir,
        runtime,
        includeChannelPrefix
      );
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const { e164, jid } = (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.readWebSelfId(account.authDir);
      const identity = e164 ? e164 : jid ? `jid ${jid}` : "unknown";
      ctx.log?.info(`[${account.accountId}] starting provider (${identity})`);
      return (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.monitorWebChannel(
        (0, _runtime.getWhatsAppRuntime)().logging.shouldLogVerbose(),
        undefined,
        true,
        undefined,
        ctx.runtime,
        ctx.abortSignal,
        {
          statusSink: (next) => ctx.setStatus({ accountId: ctx.accountId, ...next }),
          accountId: account.accountId
        }
      );
    },
    loginWithQrStart: async ({ accountId, force, timeoutMs, verbose }) =>
    await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.startWebLoginWithQr({
      accountId,
      force,
      timeoutMs,
      verbose
    }),
    loginWithQrWait: async ({ accountId, timeoutMs }) =>
    await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.waitForWebLogin({ accountId, timeoutMs }),
    logoutAccount: async ({ account, runtime }) => {
      const cleared = await (0, _runtime.getWhatsAppRuntime)().channel.whatsapp.logoutWeb({
        authDir: account.authDir,
        isLegacyAuthDir: account.isLegacyAuthDir,
        runtime
      });
      return { cleared, loggedOut: cleared };
    }
  }
}; /* v9-ed6f8f369eeedbf0 */
