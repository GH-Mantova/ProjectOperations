import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { PersonaDefinition } from "./personas.types";
import { findPersonaForRoute, getAllPersonas, getPersonaBySlug } from "./persona-registry";

const GLOBAL_SETTINGS_ID = 1;

export type UserPersonaSettingsUpdate = {
  providerOverride?: string | null;
  instructionOverride?: string | null;
  bringYourOwnKey?: string | null;
};

export type GlobalSettingsUpdate = {
  allowUserInstructionOverrides?: boolean;
  enabledProviders?: string[];
  allowBringYourOwnKey?: boolean;
};

@Injectable()
export class PersonasService {
  constructor(private readonly prisma: PrismaService) {}

  getDefinitions(): readonly PersonaDefinition[] {
    return getAllPersonas();
  }

  getDefinitionBySlug(slug: string): PersonaDefinition {
    const definition = getPersonaBySlug(slug);
    if (!definition) {
      throw new NotFoundException(`Persona not found: ${slug}`);
    }
    return definition;
  }

  private async getPersonaRow(slug: string) {
    const row = await this.prisma.persona.findUnique({ where: { slug } });
    if (!row) {
      throw new NotFoundException(`Persona row missing for slug: ${slug}`);
    }
    return row;
  }

  async getCompanyInstruction(slug: string) {
    const persona = await this.getPersonaRow(slug);
    let instruction = await this.prisma.personaCompanyInstruction.findUnique({
      where: { personaId: persona.id }
    });
    if (!instruction) {
      instruction = await this.prisma.personaCompanyInstruction.create({
        data: { personaId: persona.id, instruction: "" }
      });
    }
    return instruction;
  }

  async updateCompanyInstruction(slug: string, instruction: string, updatedById: string) {
    const persona = await this.getPersonaRow(slug);
    return this.prisma.personaCompanyInstruction.upsert({
      where: { personaId: persona.id },
      update: { instruction, updatedById },
      create: { personaId: persona.id, instruction, updatedById }
    });
  }

  async getUserSettings(userId: string, slug: string) {
    const persona = await this.getPersonaRow(slug);
    let settings = await this.prisma.userPersonaSettings.findUnique({
      where: { userId_personaId: { userId, personaId: persona.id } }
    });
    if (!settings) {
      settings = await this.prisma.userPersonaSettings.create({
        data: { userId, personaId: persona.id }
      });
    }
    return settings;
  }

  async updateUserSettings(userId: string, slug: string, dto: UserPersonaSettingsUpdate) {
    const persona = await this.getPersonaRow(slug);

    // Distinguish `undefined` (don't touch) from explicit `null` (clear override).
    // Required for partial updates — DTO marks all fields optional.
    const updateData: {
      providerOverride?: string | null;
      instructionOverride?: string | null;
      bringYourOwnKey?: string | null;
    } = {};
    if (dto.providerOverride !== undefined) {
      updateData.providerOverride = dto.providerOverride;
    }
    if (dto.instructionOverride !== undefined) {
      updateData.instructionOverride = dto.instructionOverride;
    }
    if (dto.bringYourOwnKey !== undefined) {
      updateData.bringYourOwnKey = dto.bringYourOwnKey;
    }

    return this.prisma.userPersonaSettings.upsert({
      where: { userId_personaId: { userId, personaId: persona.id } },
      update: updateData,
      create: {
        userId,
        personaId: persona.id,
        providerOverride: dto.providerOverride ?? null,
        instructionOverride: dto.instructionOverride ?? null,
        bringYourOwnKey: dto.bringYourOwnKey ?? null
      }
    });
  }

  async getGlobalSettings() {
    let settings = await this.prisma.globalAISettings.findUnique({
      where: { id: GLOBAL_SETTINGS_ID }
    });
    if (!settings) {
      settings = await this.prisma.globalAISettings.create({
        data: { id: GLOBAL_SETTINGS_ID }
      });
    }
    return settings;
  }

  async updateGlobalSettings(dto: GlobalSettingsUpdate) {
    await this.getGlobalSettings();
    return this.prisma.globalAISettings.update({
      where: { id: GLOBAL_SETTINGS_ID },
      data: {
        ...(dto.allowUserInstructionOverrides !== undefined
          ? { allowUserInstructionOverrides: dto.allowUserInstructionOverrides }
          : {}),
        ...(dto.enabledProviders !== undefined ? { enabledProviders: dto.enabledProviders } : {}),
        ...(dto.allowBringYourOwnKey !== undefined ? { allowBringYourOwnKey: dto.allowBringYourOwnKey } : {})
      }
    });
  }

  // Returns the persona+subMode active for a URL, filtered by the caller's
  // permissions. Returns null (not 403) when the user lacks access — so the
  // floating window can gracefully decline to render rather than show an
  // error to users on tendering routes who don't have ai.persona.tendering.
  resolveActivePersonaForRoute(
    url: string,
    user: { permissions?: string[]; isSuperUser?: boolean } | undefined
  ) {
    if (!url) return null;
    const match = findPersonaForRoute(url);
    if (!match) return null;

    const granted = new Set(user?.permissions ?? []);
    const allowed = user?.isSuperUser === true || granted.has(match.persona.permissionRequired);
    if (!allowed) return null;

    return {
      persona: {
        slug: match.persona.slug,
        displayName: match.persona.displayName,
        description: match.persona.description
      },
      subMode: {
        name: match.subMode.name,
        description: match.subMode.description
      }
    };
  }

  async listPersonas() {
    const definitions = this.getDefinitions();
    const rows = await this.prisma.persona.findMany();
    const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
    return definitions.map((definition) => {
      const row = rowBySlug.get(definition.slug);
      return {
        slug: definition.slug,
        displayName: row?.displayName ?? definition.displayName,
        description: definition.description,
        rootRoutePattern: definition.rootRoutePattern,
        permissionRequired: definition.permissionRequired,
        subModes: definition.subModes,
        isActive: row?.isActive ?? false,
        hasDbRow: row !== undefined
      };
    });
  }
}
