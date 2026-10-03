/**
 * LIST_ITEM_RENAME_V1 — rename / empty-label / 403 spec
 *
 * Covers:
 *   1. Admin renames a system-list item: label updated, value unchanged.
 *   2. Whitespace-only label returns 400.
 *   3. Non-admin renaming a seeded item (createdById null) gets 403.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { GlobalListsService } from "../global-lists.service";

// ── Prisma mock ────────────────────────────────────────────────────────────────

const SYSTEM_LIST = {
  id: "list-1",
  slug: "scope-row-types",
  name: "Scope row types",
  type: "STATIC" as const,
  isSystem: true,
  description: null,
  sourceModule: null,
  createdById: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

const SEEDED_ITEM = {
  id: "item-1",
  listId: "list-1",
  value: "enclosure",
  label: "Enclosure",
  metadata: null,
  sortOrder: 0,
  isArchived: false,
  // createdById: null marks this as seeded (platform-created)
  createdById: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date()
};

function makePrisma(itemOverrides: Partial<typeof SEEDED_ITEM> = {}) {
  const item = { ...SEEDED_ITEM, ...itemOverrides };
  return {
    globalList: {
      findUnique: jest.fn().mockResolvedValue(SYSTEM_LIST)
    },
    globalListItem: {
      findUnique: jest.fn().mockResolvedValue(item),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...item, ...data })
      )
    }
  };
}

function makeService(prismaOverrides: Partial<ReturnType<typeof makePrisma>> = {}) {
  const prisma = { ...makePrisma(), ...prismaOverrides } as unknown as Parameters<typeof GlobalListsService.prototype.updateItem>[0] extends never
    ? never
    : never;
  // Cast so we can inject the mock without importing PrismaService
  return new GlobalListsService(prisma as never);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GlobalListsService.updateItem — LIST_ITEM_RENAME_V1", () => {
  const adminActor = { id: "admin-user-id", isAdmin: true };
  const nonAdminActor = { id: "other-user-id", isAdmin: false };

  // ── Test 1: admin renames ──────────────────────────────────────────────────

  describe("test-1: admin renames a system-list item", () => {
    it("updates the label and leaves value unchanged", async () => {
      const prismaMock = makePrisma();
      const svc = new GlobalListsService(prismaMock as never);

      const result = await svc.updateItem("scope-row-types", "item-1", adminActor, {
        label: "Enclosure: labour"
      });

      expect(prismaMock.globalListItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: expect.objectContaining({ label: "Enclosure: labour" })
      });
      // value must NOT appear in the update data
      const callData = (prismaMock.globalListItem.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
      expect(callData).not.toHaveProperty("value");
      // result carries the new label
      expect(result.label).toBe("Enclosure: labour");
    });

    it("trims leading/trailing whitespace from the label", async () => {
      const prismaMock = makePrisma();
      const svc = new GlobalListsService(prismaMock as never);

      const result = await svc.updateItem("scope-row-types", "item-1", adminActor, {
        label: "  Enclosure: labour  "
      });

      expect(result.label).toBe("Enclosure: labour");
    });
  });

  // ── Test 2: whitespace-only label → 400 ───────────────────────────────────

  describe("test-2: whitespace-only label returns 400", () => {
    it("throws BadRequestException for an empty string", async () => {
      const svc = new GlobalListsService(makePrisma() as never);
      await expect(
        svc.updateItem("scope-row-types", "item-1", adminActor, { label: "" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for a whitespace-only string", async () => {
      const svc = new GlobalListsService(makePrisma() as never);
      await expect(
        svc.updateItem("scope-row-types", "item-1", adminActor, { label: "   " })
      ).rejects.toThrow(BadRequestException);
    });

    it("error message is 'Label cannot be empty.'", async () => {
      const svc = new GlobalListsService(makePrisma() as never);
      let caught: unknown;
      try {
        await svc.updateItem("scope-row-types", "item-1", adminActor, { label: "  " });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      const msg = (caught as BadRequestException).message;
      expect(msg).toBe("Label cannot be empty.");
    });
  });

  // ── Test 3: non-admin + seeded item → 403 ─────────────────────────────────

  describe("test-3: non-admin renaming a seeded item gets 403", () => {
    it("throws ForbiddenException when createdById is null and caller is not admin", async () => {
      const svc = new GlobalListsService(makePrisma({ createdById: null }) as never);
      await expect(
        svc.updateItem("scope-row-types", "item-1", nonAdminActor, {
          label: "Enclosure: labour"
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("does NOT throw when the non-admin is the creator", async () => {
      const svc = new GlobalListsService(
        makePrisma({ createdById: nonAdminActor.id }) as never
      );
      await expect(
        svc.updateItem("scope-row-types", "item-1", nonAdminActor, {
          label: "My label"
        })
      ).resolves.toBeDefined();
    });
  });

  // ── Edge: item not found ───────────────────────────────────────────────────

  describe("item not found", () => {
    it("throws NotFoundException when item does not exist", async () => {
      const prismaMock = makePrisma();
      prismaMock.globalListItem.findUnique = jest.fn().mockResolvedValue(null);
      const svc = new GlobalListsService(prismaMock as never);
      await expect(
        svc.updateItem("scope-row-types", "item-999", adminActor, { label: "X" })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
