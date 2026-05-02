import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform/platform-config.service";
import { getPersonaBySlug } from "../personas/persona-registry";
import type { PersonaDefinition, PersonaSubMode } from "../personas/personas.types";
import type {
  ChatRequest,
  ChatStreamChunk,
  ProviderConfig,
  ProviderId
} from "./ai-providers.types";
import { ANTHROPIC_DEFAULT_MODEL, streamAnthropicChat } from "./providers/anthropic.provider";

const SUPPORTED_PROVIDERS: ProviderId[] = ["anthropic"];

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

    if (chosenProvider !== "anthropic") {
      // Defensive: SUPPORTED_PROVIDERS gates this, but make the failure mode
      // explicit if a future enabledProvider value sneaks through.
      throw new ServiceUnavailableException(
        `Provider ${chosenProvider} is not implemented yet. Only Anthropic is supported in §5A.1 PR 6.`
      );
    }

    const apiKey = await this.platformConfig.getAnthropicApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI provider not configured. Contact your administrator."
      );
    }
    const model = (await this.platformConfig.getModel("anthropic")) || ANTHROPIC_DEFAULT_MODEL;
    return { providerId: "anthropic", apiKey, model };
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

  // Dispatches to the correct provider implementation. Today only Anthropic.
  streamChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    if (request.config.providerId === "anthropic") {
      return streamAnthropicChat(request);
    }
    // The type system narrows providerId to "anthropic" only, but keep a
    // runtime guard for future providers added to ProviderId.
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
