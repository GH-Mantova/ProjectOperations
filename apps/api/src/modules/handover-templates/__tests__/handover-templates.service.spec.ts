import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  HandoverTemplatesService,
  ensureUniqueKey,
  slugifyKey
} from "../handover-templates.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ─── slugifyKey ──────────────────────────────────────────────────────────────

describe("slugifyKey", () => {
  it.each([
    ["Project details", "project-details"],
    ["Pricing & budget", "pricing-budget"],
    ["  Trim  whitespace  ", "trim-whitespace"],
    ["Multi--dashes--collapse", "multi-dashes-collapse"],
    ["UPPERCASE Only", "uppercase-only"],
    ["!!!", "item"],
    ["", "item"]
  ])("%j → %j", (input, expected) => {
    expect(slugifyKey(input)).toBe(expected);
  });
});

// ─── ensureUniqueKey ─────────────────────────────────────────────────────────

describe("ensureUniqueKey", () => {
  it("returns base when not taken", () => {
    expect(ensureUniqueKey("scope", new Set())).toBe("scope");
  });
  it("appends -2 on first collision", () => {
    expect(ensureUniqueKey("scope", new Set(["scope"]))).toBe("scope-2");
  });
  it("keeps incrementing on further collisions", () => {
    expect(ensureUniqueKey("scope", new Set(["scope", "scope-2", "scope-3"]))).toBe("scope-4");
  });
});

// ─── Test fixtures ───────────────────────────────────────────────────────────

const activeTemplate = {
  id: "tpl-active",
  version: 1,
  isActive: true,
  publishedAt: new Date("2026-01-01"),
  publishedById: "user-seed",
  sections: [
    {
      id: "sec-1",
      templateId: "tpl-active",
      key: "project-details",
      label: "Project details",
      sortOrder: 1,
      fields: [
        {
          id: "fld-1",
          sectionId: "sec-1",
          key: "project-name",
          label: "Project name",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.title",
          listId: null,
          required: true,
          sortOrder: 1,
          retiredAt: null
        }
      ]
    }
  ]
};

const draftTemplate = {
  id: "tpl-draft",
  version: 2,
  isActive: false,
  publishedAt: null,
  publishedById: null,
  sections: [
    {
      id: "draft-sec-1",
      templateId: "tpl-draft",
      key: "project-details",
      label: "Project details",
      sortOrder: 1,
      fields: [
        {
          id: "draft-fld-1",
          sectionId: "draft-sec-1",
          key: "project-name",
          label: "Project name",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.title",
          listId: null,
          required: true,
          sortOrder: 1,
          retiredAt: null
        }
      ]
    }
  ]
};

const makePrisma = (overrides: Record<string, unknown> = {}): PrismaService =>
  ({
    handoverTemplate: {
      findFirst: jest.fn().mockResolvedValue(activeTemplate),
      findUniqueOrThrow: jest.fn().mockResolvedValue(draftTemplate),
      aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
      create: jest.fn().mockResolvedValue(draftTemplate),
      update: jest.fn().mockResolvedValue({ ...draftTemplate, isActive: true, publishedAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    handoverTemplateSection: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...draftTemplate.sections[0], template: draftTemplate }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "new-sec", ...data })
      ),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "draft-sec-1", ...data })
      ),
      delete: jest.fn().mockResolvedValue({ id: "draft-sec-1" })
    },
    handoverTemplateField: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        ...draftTemplate.sections[0].fields[0],
        section: { ...draftTemplate.sections[0], template: draftTemplate }
      }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "new-fld", retiredAt: null, ...data })
      ),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "draft-fld-1", ...data })
      )
    },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => {
      // Callback form: pass the mock itself as the tx client so nested calls
      // route through the same jest mocks configured above.
      return cb(prismaRef.current);
    }),
    ...overrides
  }) as unknown as PrismaService;

// Reference cell so $transaction can call back into the outer mock without a
// TDZ (temporal-dead-zone) reference cycle.
const prismaRef: { current: PrismaService } = { current: null as unknown as PrismaService };

// ─── HandoverTemplatesService ────────────────────────────────────────────────

describe("HandoverTemplatesService", () => {
  let service: HandoverTemplatesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = makePrisma();
    prismaRef.current = prisma;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoverTemplatesService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();
    service = module.get<HandoverTemplatesService>(HandoverTemplatesService);
  });

  // ─── getActive ─────────────────────────────────────────────────────────────

  describe("getActive", () => {
    it("returns the active template with sections + fields", async () => {
      const result = await service.getActive();
      expect(result.id).toBe("tpl-active");
      expect(result.sections).toHaveLength(1);
    });

    it("throws NotFoundException when no active template exists", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getActive()).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createDraftFromActive ─────────────────────────────────────────────────

  describe("createDraftFromActive", () => {
    it("throws ConflictException when a draft already exists", async () => {
      // First findFirst is for "existing draft" check.
      (prisma.handoverTemplate.findFirst as jest.Mock)
        .mockResolvedValueOnce(draftTemplate);
      await expect(service.createDraftFromActive()).rejects.toThrow(ConflictException);
    });

    it("creates a draft with version = max+1 and clones sections/fields", async () => {
      // No existing draft, then active template lookup returns active.
      (prisma.handoverTemplate.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(activeTemplate);
      await service.createDraftFromActive();
      expect(prisma.handoverTemplate.create).toHaveBeenCalledWith({
        data: { version: 2, isActive: false }
      });
      expect(prisma.handoverTemplateSection.create).toHaveBeenCalled();
      expect(prisma.handoverTemplateField.create).toHaveBeenCalled();
    });
  });

  // ─── addSection ────────────────────────────────────────────────────────────

  describe("addSection", () => {
    it("generates a unique key from the label and appends after existing sections", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue(draftTemplate);
      (prisma.handoverTemplateSection.findMany as jest.Mock).mockResolvedValue([
        { key: "project-details", sortOrder: 1 }
      ]);
      await service.addSection({ label: "Project details" });
      const call = (prisma.handoverTemplateSection.create as jest.Mock).mock.calls[0][0];
      expect(call.data.key).toBe("project-details-2");
      expect(call.data.sortOrder).toBe(2);
    });
  });

  // ─── updateSection ─────────────────────────────────────────────────────────

  describe("updateSection", () => {
    it("rejects edits when section belongs to a published template", async () => {
      (prisma.handoverTemplateSection.findUnique as jest.Mock).mockResolvedValue({
        ...activeTemplate.sections[0],
        template: activeTemplate
      });
      await expect(
        service.updateSection("sec-1", { label: "Renamed" })
      ).rejects.toThrow(ForbiddenException);
    });

    it("updates label without changing key", async () => {
      await service.updateSection("draft-sec-1", { label: "Renamed" });
      const call = (prisma.handoverTemplateSection.update as jest.Mock).mock.calls[0][0];
      expect(call.data).toEqual({ label: "Renamed" });
    });
  });

  // ─── addField ──────────────────────────────────────────────────────────────

  describe("addField", () => {
    it("throws BadRequestException for invalid type", async () => {
      await expect(
        service.addField("draft-sec-1", {
          label: "X",
          type: "bogus" as unknown as "text",
          sourceType: "capture"
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("requires autoBinding when sourceType is auto", async () => {
      await expect(
        service.addField("draft-sec-1", {
          label: "Auto field",
          type: "text",
          sourceType: "auto"
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a field with the correct defaults", async () => {
      await service.addField("draft-sec-1", {
        label: "Notes",
        type: "text",
        sourceType: "capture"
      });
      const call = (prisma.handoverTemplateField.create as jest.Mock).mock.calls[0][0];
      expect(call.data.key).toBe("notes");
      expect(call.data.required).toBe(false);
      expect(call.data.sortOrder).toBe(1);
    });
  });

  // ─── updateField ───────────────────────────────────────────────────────────

  describe("updateField", () => {
    it("blocks edits to fields on a published template", async () => {
      (prisma.handoverTemplateField.findUnique as jest.Mock).mockResolvedValue({
        ...activeTemplate.sections[0].fields[0],
        section: { ...activeTemplate.sections[0], template: activeTemplate }
      });
      await expect(
        service.updateField("fld-1", { label: "Renamed" })
      ).rejects.toThrow(ForbiddenException);
    });

    it("changes label without touching key", async () => {
      await service.updateField("draft-fld-1", { label: "Renamed" });
      const call = (prisma.handoverTemplateField.update as jest.Mock).mock.calls[0][0];
      expect(call.data).toEqual({ label: "Renamed" });
    });
  });

  // ─── retireField ───────────────────────────────────────────────────────────

  describe("retireField", () => {
    it("sets retiredAt (never hard-deletes)", async () => {
      await service.retireField("draft-fld-1");
      const call = (prisma.handoverTemplateField.update as jest.Mock).mock.calls[0][0];
      expect(call.data.retiredAt).toBeInstanceOf(Date);
    });

    it("is idempotent — already-retired field returns unchanged", async () => {
      (prisma.handoverTemplateField.findUnique as jest.Mock).mockResolvedValue({
        ...draftTemplate.sections[0].fields[0],
        retiredAt: new Date(),
        section: { ...draftTemplate.sections[0], template: draftTemplate }
      });
      await service.retireField("draft-fld-1");
      expect(prisma.handoverTemplateField.update).not.toHaveBeenCalled();
    });
  });

  // ─── publishDraft ──────────────────────────────────────────────────────────

  describe("publishDraft", () => {
    it("deactivates prior active and activates the draft", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue(draftTemplate);
      await service.publishDraft("user-marco");
      expect(prisma.handoverTemplate.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false }
      });
      const updateCall = (prisma.handoverTemplate.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(true);
      expect(updateCall.data.publishedById).toBe("user-marco");
      expect(updateCall.data.publishedAt).toBeInstanceOf(Date);
    });

    it("throws BadRequestException when draft has no sections", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue({
        ...draftTemplate,
        sections: []
      });
      await expect(service.publishDraft("user-marco")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when no draft exists", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.publishDraft("user-marco")).rejects.toThrow(NotFoundException);
    });
  });
});
