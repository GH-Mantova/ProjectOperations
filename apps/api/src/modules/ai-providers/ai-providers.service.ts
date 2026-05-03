import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DEFAULT_MODELS, PlatformConfigService } from "../platform/platform-config.service";
import { getPersonaBySlug } from "../personas/persona-registry";
import type { PersonaDefinition, PersonaSubMode } from "../personas/personas.types";
import { KeyEncryptionService } from "../security/key-encryption.service";
import {
  ToolingNotSupportedError,
  type ChatRequest,
  type ChatStreamChunk,
  type ProviderConfig,
  type ProviderId
} from "./ai-providers.types";
import { ProviderNotConfiguredError } from "./errors";
import { streamAnthropicChat } from "./providers/anthropic.provider";
import { streamOpenAIChat } from "./providers/openai.provider";

const SUPPORTED_PROVIDERS: ProviderId[] = ["anthropic", "openai"];

// Sentinel values the user-persona settings UI may store to mean "use the
// system default" — empty select option round-trips as null today, but
// 'system' / 'default' are accepted defensively in case future UI changes
// pick a string sentinel.
const SYSTEM_DEFAULT_SENTINELS = new Set(["system", "default", ""]);

@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformConfig: PlatformConfigService,
    private readonly encryption: KeyEncryptionService
  ) {}

  // Resolves which provider+key+model to use for a given user+persona.
  //
  // Provider selection — three-tier fallback (fix 2026-05-03, replaces the
  // previous "Anthropic literal default" that produced ProviderNotConfigured
  // errors when "Use system default" was selected and only a company key
  // was saved):
  //
  //   1. Explicit user persona choice — UserPersonaSettings.providerOverride
  //      when it names a supported provider (not null/'system'/'default').
  //   2. PlatformConfig.preferredProvider — admin-set platform default.
  //   3. First provider with a saved company *KeyEncrypted column —
  //      Anthropic → OpenAI → Gemini → Groq, first match wins.
  //
  // Plus a legacy fallback to GlobalAISettings.enabledProviders[0] between
  // tiers 2 and 3 — preserves behaviour for any deployment that set that
  // toggle before preferredProvider existed.
  //
  // Key source order (§5A.1 PR 9, unchanged):
  //   1. Per-user encrypted key on User row (BYOK) — source: "user"
  //   2. Company encrypted key on PlatformConfig — source: "company"
  //   3. Throw ProviderNotConfiguredError(provider) — clearer DX than the
  //      previous generic "AI provider not configured" because the message
  //      names the provider that has no key.
  //
  // No env-var fallback. Keys live in DB only. The `source` field on
  // ProviderConfig is for audit purposes — every chat call logs which key
  // source was used.
  async resolveProviderConfig(userId: string, personaSlug: string): Promise<ProviderConfig> {
    const persona = getPersonaBySlug(personaSlug);
    if (!persona) {
      throw new ServiceUnavailableException(`Unknown persona: ${personaSlug}`);
    }

    const chosenProvider = await this.resolveChosenProvider(userId, personaSlug);

    const userKey = await this.getUserKey(userId, chosenProvider);
    let apiKey: string | null = userKey;
    let source: "user" | "company" = "user";
    if (!apiKey) {
      apiKey = await this.resolveCompanyKey(chosenProvider);
      source = "company";
    }
    if (!apiKey) {
      throw new ProviderNotConfiguredError(chosenProvider);
    }
    const model = await this.resolveModel(chosenProvider);
    return { providerId: chosenProvider, apiKey, model, source };
  }

  // See the three-tier doc-comment above resolveProviderConfig.
  private async resolveChosenProvider(
    userId: string,
    personaSlug: string
  ): Promise<ProviderId> {
    // Tier 1 — explicit user choice from the persona settings UI.
    const personaRow = await this.prisma.persona.findUnique({ where: { slug: personaSlug } });
    if (personaRow) {
      const userSettings = await this.prisma.userPersonaSettings.findUnique({
        where: { userId_personaId: { userId, personaId: personaRow.id } }
      });
      const candidate = userSettings?.providerOverride ?? null;
      if (
        candidate &&
        !SYSTEM_DEFAULT_SENTINELS.has(candidate) &&
        SUPPORTED_PROVIDERS.includes(candidate as ProviderId)
      ) {
        return candidate as ProviderId;
      }
    }

    // Tier 2 — admin-set platform default.
    const preferred = await this.platformConfig.getPreferredProvider();
    if (preferred && SUPPORTED_PROVIDERS.includes(preferred as ProviderId)) {
      return preferred as ProviderId;
    }

    // Legacy compatibility — GlobalAISettings.enabledProviders[0]. Older
    // deployments may have set this toggle before preferredProvider existed.
    const global = await this.prisma.globalAISettings.findUnique({ where: { id: 1 } });
    const firstEnabled = global?.enabledProviders.find((p) =>
      SUPPORTED_PROVIDERS.includes(p as ProviderId)
    );
    if (firstEnabled) return firstEnabled as ProviderId;

    // Tier 3 — first provider with a saved company key. Only useful for
    // the supported providers; if all configured providers are not-yet-
    // implemented (gemini/groq), fall through to the explicit error rather
    // than silently picking one we can't dispatch.
    const firstConfigured = await this.platformConfig.getFirstConfiguredProvider();
    if (firstConfigured && SUPPORTED_PROVIDERS.includes(firstConfigured as ProviderId)) {
      return firstConfigured as ProviderId;
    }

    throw new ProviderNotConfiguredError(null);
  }

  // Per-user BYOK lookup. Returns null when the user has no key for the
  // provider, OR when the encrypted blob fails to decrypt (logged via
  // KeyEncryptionService.tryDecrypt with context, falls through to company
  // key — does NOT throw, so a corrupted user key blob doesn't take down
  // chat for that user).
  private async getUserKey(userId: string, provider: ProviderId): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        anthropicKeyEncrypted: true,
        openaiKeyEncrypted: true
      }
    });
    if (!user) return null;
    const encrypted =
      provider === "anthropic" ? user.anthropicKeyEncrypted : user.openaiKeyEncrypted;
    return this.encryption.tryDecrypt(encrypted, {
      provider,
      scope: "user",
      subjectId: userId
    });
  }

  private async resolveCompanyKey(provider: ProviderId): Promise<string | null> {
    if (provider === "anthropic") return this.platformConfig.getAnthropicApiKey();
    return this.platformConfig.getOpenAiApiKey();
  }

  // Model precedence: env var (deployment override) → PlatformConfig
  // (admin-configured) → hardcoded fallback. Env var wins so a single
  // deployment-time switch flips the model without touching the DB.
  private async resolveModel(provider: ProviderId): Promise<string> {
    const envName = provider === "anthropic" ? "ANTHROPIC_MODEL" : "OPENAI_MODEL";
    const envOverride = process.env[envName]?.trim();
    if (envOverride) return envOverride;
    // PlatformConfigService.getModel already falls back to DEFAULT_MODELS
    // when no DB-saved value exists; the OR here is a belt-and-braces guard
    // for the (impossible-in-practice) empty-string case.
    return (await this.platformConfig.getModel(provider)) || DEFAULT_MODELS[provider];
  }

  // PR #144 — sub-modes that operate on a single specific tender. When
  // the user is in one of these AND a contextKey is present, the system
  // prompt is prefixed with a "Current tender context" block so the
  // model knows the tender's display code (what the user calls it,
  // e.g. "IS-T020") AND its database CUID (what tools require as
  // tenderId). The "register" sub-mode is the list view, not
  // tender-scoped — no injection.
  private static readonly TENDER_SCOPED_SUB_MODES: ReadonlySet<string> = new Set([
    "tender-detail",
    "scope",
    "estimate",
    "quote",
    "clarifications"
  ]);

  // Builds the system prompt sent to the AI. Layers, concatenated with
  // double newlines, in order:
  //   0. Tender context block (PR #144) — prepended only when
  //      personaSlug === "tendering", subMode is tender-scoped, and
  //      contextKey resolves to a real tender.
  //   1. Persona's intrinsic prompt (definition + sub-mode description)
  //   2. Sean's company instruction (PersonaCompanyInstruction.instruction)
  //   3. User's personal instruction (UserPersonaSettings.instructionOverride),
  //      ONLY when GlobalAISettings.allowUserInstructionOverrides is true.
  async resolveSystemPrompt(
    personaSlug: string,
    userId: string,
    activeSubMode?: string | null,
    contextKey?: string | null
  ): Promise<string> {
    const persona = getPersonaBySlug(personaSlug);
    if (!persona) {
      throw new ServiceUnavailableException(`Unknown persona: ${personaSlug}`);
    }

    const subMode = activeSubMode
      ? persona.subModes.find((s) => s.name === activeSubMode) ?? null
      : null;

    const layers: string[] = [intrinsicPrompt(persona, subMode)];

    const personaRow = await this.prisma.persona.findUnique({ where: { slug: personaSlug } });
    if (personaRow) {
      const company = await this.prisma.personaCompanyInstruction.findUnique({
        where: { personaId: personaRow.id }
      });
      if (company?.instruction && company.instruction.trim().length > 0) {
        layers.push(`Company instruction:\n${company.instruction.trim()}`);
      }

      const global = await this.prisma.globalAISettings.findUnique({ where: { id: 1 } });
      if (global?.allowUserInstructionOverrides) {
        const userSettings = await this.prisma.userPersonaSettings.findUnique({
          where: { userId_personaId: { userId, personaId: personaRow.id } }
        });
        const personal = userSettings?.instructionOverride ?? null;
        if (personal && personal.trim().length > 0) {
          layers.push(`User instruction:\n${personal.trim()}`);
        }
      }
    }

    let composed = layers.join("\n\n");

    // Tender context injection — gated on tendering persona +
    // tender-scoped sub-mode + contextKey present. Failed lookups
    // fall through silently (model still gets tools; just no
    // tender context). See class doc comment above for rationale.
    if (
      personaSlug === "tendering" &&
      activeSubMode &&
      AiProvidersService.TENDER_SCOPED_SUB_MODES.has(activeSubMode) &&
      contextKey
    ) {
      const tender = await this.lookupTenderForContext(contextKey);
      if (tender) {
        composed = `${buildTenderContextBlock(tender)}\n\n${composed}`;
      }
    }

    return composed;
  }

  // Single indexed findUnique on the tenders table — sub-millisecond.
  // Runs once per chat message in the tender-scoped flow. No caching
  // today; revisit if profiling shows it as a bottleneck.
  private async lookupTenderForContext(
    contextKey: string
  ): Promise<{ id: string; tenderNumber: string; title: string | null } | null> {
    try {
      return await this.prisma.tender.findUnique({
        where: { id: contextKey },
        select: { id: true, tenderNumber: true, title: true }
      });
    } catch (err) {
      this.logger.warn(
        `Failed to look up tender by contextKey=${contextKey}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null;
    }
  }

  // Dispatches to the correct provider implementation.
  // §5A.1 multi-turn loop: when tools are requested, the provider must
  // support tool calling. Anthropic + OpenAI do; Gemini + Groq don't yet
  // (see PR #138 PHASE 6 deferred entry). Throws ToolingNotSupportedError
  // synchronously rather than returning an error chunk, because the
  // dispatcher's loop entry can map that to a clear user-facing message
  // before the SSE stream opens.
  streamChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const provider = request.config.providerId as string;
    const requestedTools = request.tools && request.tools.length > 0;
    const supportsTools = provider === "anthropic" || provider === "openai";
    if (requestedTools && !supportsTools) {
      throw new ToolingNotSupportedError(provider);
    }
    if (request.config.providerId === "anthropic") {
      return streamAnthropicChat(request);
    }
    if (request.config.providerId === "openai") {
      return streamOpenAIChat(request);
    }
    // Runtime guard for future providers added to ProviderId before their
    // implementation lands.
    return errorStream(`Provider ${request.config.providerId} not implemented.`);
  }
}

// PR #144 — see resolveSystemPrompt's tender context injection.
function buildTenderContextBlock(tender: {
  id: string;
  tenderNumber: string;
  title: string | null;
}): string {
  const titlePart = tender.title ? ` — "${tender.title}"` : "";
  return [
    "## Current tender context",
    "",
    `You are currently working on tender **${tender.tenderNumber}**${titlePart}.`,
    "",
    `The database identifier (CUID) for this tender is: \`${tender.id}\``,
    "",
    "When you use tools that require a `tenderId` parameter (such as",
    `\`list_tender_drawings\`), pass the **CUID** (\`${tender.id}\`), NOT the`,
    `human-readable code (\`${tender.tenderNumber}\`). The user will refer to this`,
    "tender by its code in conversation, but tool parameters must use the",
    "CUID.",
    "",
    "If the user asks about a different tender by code (e.g. another",
    "IS-T### number), explain that you can only see the currently-loaded",
    "tender context. They would need to navigate to the other tender to",
    "discuss it."
  ].join("\n");
}

function intrinsicPrompt(persona: PersonaDefinition, subMode: PersonaSubMode | null): string {
  const lines = [
    `You are the ${persona.displayName} for Initial Services, a South East Queensland construction company.`,
    persona.description
  ];
  if (subMode) {
    lines.push("");
    lines.push(`The user is currently in sub-mode "${subMode.name}": ${subMode.description}`);
  }
  return lines.join("\n");
}

async function* errorStream(message: string): AsyncIterable<ChatStreamChunk> {
  yield { type: "error", error: message };
}
