import { NotFoundException } from "@nestjs/common";
import { PersonasService } from "../personas.service";

type AnyRecord = Record<string, unknown>;

const TENDERING_ID = "persona-tendering-id";

function buildPrismaMock(overrides: {
  personaRow?: AnyRecord | null;
  companyInstructionRow?: AnyRecord | null;
  userPersonaSettingsRow?: AnyRecord | null;
  globalSettingsRow?: AnyRecord | null;
} = {}) {
  const personaFindUnique = jest.fn(async ({ where }: { where: { slug: string } }) => {
    if (overrides.personaRow === null) return null;
    if (overrides.personaRow) return { id: TENDERING_ID, slug: where.slug, ...overrides.personaRow };
    return { id: TENDERING_ID, slug: where.slug, displayName: "Tendering Assistant", isActive: true };
  });
  const personaFindMany = jest.fn(async () => [
    { id: TENDERING_ID, slug: "tendering", displayName: "Tendering Assistant", isActive: true }
  ]);

  const companyInstructionFindUnique = jest.fn(async () =>
    overrides.companyInstructionRow === null ? null : overrides.companyInstructionRow ?? null
  );
  const companyInstructionCreate = jest.fn(async ({ data }: { data: AnyRecord }) => ({
    id: "ci-1",
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  const companyInstructionUpsert = jest.fn(
    async ({ where, update, create }: { where: AnyRecord; update: AnyRecord; create: AnyRecord }) => ({
      id: "ci-1",
      personaId: (where as { personaId: string }).personaId,
      ...create,
      ...update,
      updatedAt: new Date()
    })
  );

  const userPersonaSettingsFindUnique = jest.fn(async () =>
    overrides.userPersonaSettingsRow === null ? null : overrides.userPersonaSettingsRow ?? null
  );
  const userPersonaSettingsCreate = jest.fn(async ({ data }: { data: AnyRecord }) => ({
    id: "ups-1",
    providerOverride: null,
    instructionOverride: null,
    bringYourOwnKey: null,
    ...data
  }));
  const userPersonaSettingsUpsert = jest.fn(
    async ({ create, update }: { create: AnyRecord; update: AnyRecord }) => ({
      id: "ups-1",
      ...create,
      ...update
    })
  );

  const globalSettingsFindUnique = jest.fn(async () =>
    overrides.globalSettingsRow === null ? null : overrides.globalSettingsRow ?? null
  );
  const globalSettingsCreate = jest.fn(async ({ data }: { data: AnyRecord }) => ({
    id: 1,
    allowUserInstructionOverrides: false,
    enabledProviders: ["anthropic"],
    allowBringYourOwnKey: false,
    ...data
  }));
  const globalSettingsUpdate = jest.fn(async ({ data }: { data: AnyRecord }) => ({
    id: 1,
    allowUserInstructionOverrides: false,
    enabledProviders: ["anthropic"],
    allowBringYourOwnKey: false,
    ...data
  }));

  const prisma = {
    persona: {
      findUnique: personaFindUnique,
      findMany: personaFindMany
    },
    personaCompanyInstruction: {
      findUnique: companyInstructionFindUnique,
      create: companyInstructionCreate,
      upsert: companyInstructionUpsert
    },
    userPersonaSettings: {
      findUnique: userPersonaSettingsFindUnique,
      create: userPersonaSettingsCreate,
      upsert: userPersonaSettingsUpsert
    },
    globalAISettings: {
      findUnique: globalSettingsFindUnique,
      create: globalSettingsCreate,
      update: globalSettingsUpdate
    }
  } as never;

  return {
    prisma,
    mocks: {
      personaFindUnique,
      companyInstructionFindUnique,
      companyInstructionCreate,
      companyInstructionUpsert,
      userPersonaSettingsFindUnique,
      userPersonaSettingsCreate,
      userPersonaSettingsUpsert,
      globalSettingsFindUnique,
      globalSettingsCreate,
      globalSettingsUpdate
    }
  };
}

describe("PersonasService", () => {
  describe("getCompanyInstruction", () => {
    it("creates an empty company instruction row on first call when none exists", async () => {
      const { prisma, mocks } = buildPrismaMock({ companyInstructionRow: null });
      const service = new PersonasService(prisma);
      const result = await service.getCompanyInstruction("tendering");
      expect(mocks.companyInstructionCreate).toHaveBeenCalledWith({
        data: { personaId: TENDERING_ID, instruction: "" }
      });
      expect(result.instruction).toBe("");
    });

    it("returns the existing instruction row when present", async () => {
      const existing = { id: "ci-1", personaId: TENDERING_ID, instruction: "Be helpful." };
      const { prisma, mocks } = buildPrismaMock({ companyInstructionRow: existing });
      const service = new PersonasService(prisma);
      const result = await service.getCompanyInstruction("tendering");
      expect(mocks.companyInstructionCreate).not.toHaveBeenCalled();
      expect(result.instruction).toBe("Be helpful.");
    });

    it("throws NotFound for an unknown slug", async () => {
      const { prisma } = buildPrismaMock({ personaRow: null });
      const service = new PersonasService(prisma);
      await expect(service.getCompanyInstruction("does-not-exist")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateCompanyInstruction", () => {
    it("upserts the instruction and records updatedById", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateCompanyInstruction("tendering", "Use IS terminology.", "user-sean");
      expect(mocks.companyInstructionUpsert).toHaveBeenCalledWith({
        where: { personaId: TENDERING_ID },
        update: { instruction: "Use IS terminology.", updatedById: "user-sean" },
        create: { personaId: TENDERING_ID, instruction: "Use IS terminology.", updatedById: "user-sean" }
      });
    });
  });

  describe("getUserSettings", () => {
    it("creates a default row on first call when none exists", async () => {
      const { prisma, mocks } = buildPrismaMock({ userPersonaSettingsRow: null });
      const service = new PersonasService(prisma);
      const result = await service.getUserSettings("user-1", "tendering");
      expect(mocks.userPersonaSettingsCreate).toHaveBeenCalledWith({
        data: { userId: "user-1", personaId: TENDERING_ID }
      });
      expect(result.providerOverride).toBeNull();
      expect(result.instructionOverride).toBeNull();
    });

    it("returns the existing settings row when present", async () => {
      const existing = {
        id: "ups-1",
        userId: "user-1",
        personaId: TENDERING_ID,
        providerOverride: "openai",
        instructionOverride: null,
        bringYourOwnKey: null
      };
      const { prisma, mocks } = buildPrismaMock({ userPersonaSettingsRow: existing });
      const service = new PersonasService(prisma);
      const result = await service.getUserSettings("user-1", "tendering");
      expect(mocks.userPersonaSettingsCreate).not.toHaveBeenCalled();
      expect(result.providerOverride).toBe("openai");
    });
  });

  describe("updateUserSettings", () => {
    it("upserts using the JWT-supplied userId — body cannot override it", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", {
        providerOverride: "groq",
        instructionOverride: "Be brief."
      });
      expect(mocks.userPersonaSettingsUpsert).toHaveBeenCalledWith({
        where: { userId_personaId: { userId: "user-1", personaId: TENDERING_ID } },
        update: { providerOverride: "groq", instructionOverride: "Be brief." },
        create: {
          userId: "user-1",
          personaId: TENDERING_ID,
          providerOverride: "groq",
          instructionOverride: "Be brief.",
          bringYourOwnKey: null
        }
      });
    });

    it("partial update with only providerOverride leaves other fields untouched", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", { providerOverride: "openai" });
      const call = mocks.userPersonaSettingsUpsert.mock.calls[0]![0] as { update: Record<string, unknown> };
      expect(call.update).toEqual({ providerOverride: "openai" });
      expect("instructionOverride" in call.update).toBe(false);
      expect("bringYourOwnKey" in call.update).toBe(false);
    });

    it("partial update with only instructionOverride leaves other fields untouched", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", { instructionOverride: "Be brief." });
      const call = mocks.userPersonaSettingsUpsert.mock.calls[0]![0] as { update: Record<string, unknown> };
      expect(call.update).toEqual({ instructionOverride: "Be brief." });
      expect("providerOverride" in call.update).toBe(false);
      expect("bringYourOwnKey" in call.update).toBe(false);
    });

    it("explicit null clears the field (distinct from undefined which means 'don't touch')", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", { providerOverride: null });
      const call = mocks.userPersonaSettingsUpsert.mock.calls[0]![0] as { update: Record<string, unknown> };
      expect(call.update).toEqual({ providerOverride: null });
      expect("instructionOverride" in call.update).toBe(false);
      expect("bringYourOwnKey" in call.update).toBe(false);
    });

    it("empty DTO sends an empty update payload (noop) but still upserts a create row", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", {});
      const call = mocks.userPersonaSettingsUpsert.mock.calls[0]![0] as {
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      };
      expect(call.update).toEqual({});
      // Create path always sets all three to null when establishing the row from scratch
      expect(call.create).toEqual({
        userId: "user-1",
        personaId: TENDERING_ID,
        providerOverride: null,
        instructionOverride: null,
        bringYourOwnKey: null
      });
    });

    it("create path (no existing row) populates all fields from DTO with null fallback", async () => {
      const { prisma, mocks } = buildPrismaMock({ userPersonaSettingsRow: null });
      const service = new PersonasService(prisma);
      await service.updateUserSettings("user-1", "tendering", {
        providerOverride: "anthropic",
        bringYourOwnKey: "sk-test"
      });
      const call = mocks.userPersonaSettingsUpsert.mock.calls[0]![0] as { create: Record<string, unknown> };
      expect(call.create).toEqual({
        userId: "user-1",
        personaId: TENDERING_ID,
        providerOverride: "anthropic",
        instructionOverride: null,
        bringYourOwnKey: "sk-test"
      });
    });
  });

  describe("getGlobalSettings", () => {
    it("creates the singleton row on first call when none exists", async () => {
      const { prisma, mocks } = buildPrismaMock({ globalSettingsRow: null });
      const service = new PersonasService(prisma);
      const result = await service.getGlobalSettings();
      expect(mocks.globalSettingsCreate).toHaveBeenCalledWith({ data: { id: 1 } });
      expect(result.id).toBe(1);
      expect(result.enabledProviders).toEqual(["anthropic"]);
    });

    it("returns the existing singleton when present", async () => {
      const existing = {
        id: 1,
        allowUserInstructionOverrides: true,
        enabledProviders: ["anthropic", "openai"],
        allowBringYourOwnKey: true
      };
      const { prisma, mocks } = buildPrismaMock({ globalSettingsRow: existing });
      const service = new PersonasService(prisma);
      const result = await service.getGlobalSettings();
      expect(mocks.globalSettingsCreate).not.toHaveBeenCalled();
      expect(result.allowUserInstructionOverrides).toBe(true);
      expect(result.enabledProviders).toEqual(["anthropic", "openai"]);
    });
  });

  describe("updateGlobalSettings", () => {
    it("only writes the fields supplied in the DTO", async () => {
      const existing = {
        id: 1,
        allowUserInstructionOverrides: false,
        enabledProviders: ["anthropic"],
        allowBringYourOwnKey: false
      };
      const { prisma, mocks } = buildPrismaMock({ globalSettingsRow: existing });
      const service = new PersonasService(prisma);
      await service.updateGlobalSettings({ allowBringYourOwnKey: true });
      expect(mocks.globalSettingsUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { allowBringYourOwnKey: true }
      });
    });
  });

  describe("listPersonas", () => {
    it("merges code-defined personas with their DB rows", async () => {
      const { prisma } = buildPrismaMock();
      const service = new PersonasService(prisma);
      const list = await service.listPersonas();
      expect(list.length).toBeGreaterThanOrEqual(1);
      const tendering = list.find((p) => p.slug === "tendering")!;
      expect(tendering.hasDbRow).toBe(true);
      expect(tendering.displayName).toBe("Tendering Assistant");
      expect(tendering.permissionRequired).toBe("ai.persona.tendering");
      expect(tendering.subModes.length).toBe(7);
    });
  });
});
