import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DEFAULT_MODELS, PlatformConfigService } from "../platform/platform-config.service";
import { getPersonaBySlug } from "../personas/persona-registry";
import type { PersonaDefinition, PersonaSubMode } from "../personas/personas.types";
import type {
  ChatRequest,
  ChatStreamChunk,
  ProviderConfig,
  ProviderId
} from "./ai-providers.types";
import { streamAnthropicChat } from "./providers/anthropic.provider";
import { streamOpenAIChat } from "./providers/openai.provider";

const SUPPORTED_PROVIDERS: ProviderId[] = ["anthropic", "openai"];

@Injectable()
export class AiProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformConfig: PlatformConfigService
  ) {}

  // Resolves which provider+key+model to use for a given user+persona.
  // Order: UserPersonaSettings.providerOverride → GlobalAISettings.enabledProviders[0]
  // → Anthropic (the only supported provider in this PR). API key comes from
  // PlatformConfig (encrypted DB column) with env var fallback — same logic
  // the legacy AI scope drafting uses, so admins configure the key in one place.
  async resolveProviderConfig(userId: string, personaSlug: string): Promise<ProviderConfig> {
    const persona = getPersonaBySlug(personaSlug);
    if (!persona) {
      throw new ServiceUnavailableException(`Unknown persona: ${personaSlug}`);
    }

    const personaRow = await this.prisma.persona.findUnique({ where: { slug: personaSlug } });
    let chosenProvider: ProviderId = "anthropic";

    if (personaRow) {
      const userSettings = await this.prisma.userPersonaSettings.findUnique({
        where: { userId_personaId: { userId, personaId: personaRow.id } }
      });
      const candidate = userSettings?.providerOverride ?? null;
      if (candidate && SUPPORTED_PROVIDERS.includes(candidate as ProviderId)) {
        chosenProvider = candidate as ProviderId;
      } else {
        const global = await this.prisma.globalAISettings.findUnique({ where: { id: 1 } });
        const firstEnabled = global?.enabledProviders.find((p) =>
          SUPPORTED_PROVIDERS.includes(p as ProviderId)
        );
        if (firstEnabled) chosenProvider = firstEnabled as ProviderId;
      }
    }

    if (!SUPPORTED_PROVIDERS.includes(chosenProvider)) {
      // Defensive: SUPPORTED_PROVIDERS gates this above, but make the failure
      // mode explicit if a future enabledProvider value sneaks through.
      throw new ServiceUnavailableException(
        `Provider ${chosenProvider} is not implemented yet.`
      );
    }

    const apiKey = await this.resolveApiKey(chosenProvider);
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI provider not configured. Contact your administrator."
      );
    }
    const model = await this.resolveModel(chosenProvider);
    return { providerId: chosenProvider, apiKey, model };
  }

  // Per-provider key resolution. PlatformConfigService already handles the
  // encrypted-DB-then-env fallback for both providers — admins configure keys
  // in one place regardless of which provider the persona uses.
  private async resolveApiKey(provider: ProviderId): Promise<string | null> {
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

  // Builds the system prompt sent to the AI. Three layers, concatenated with
  // double newlines, in order:
  //   1. Persona's intrinsic prompt (definition + sub-mode description)
  //   2. Sean's company instruction (PersonaCompanyInstruction.instruction)
  //   3. User's personal instruction (UserPersonaSettings.instructionOverride),
  //      ONLY when GlobalAISettings.allowUserInstructionOverrides is true.
  async resolveSystemPrompt(
    personaSlug: string,
    userId: string,
    activeSubMode?: string | null
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

    return layers.join("\n\n");
  }

  // Dispatches to the correct provider implementation.
  streamChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
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
