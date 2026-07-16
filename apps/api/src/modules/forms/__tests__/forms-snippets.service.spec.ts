import { ConflictException, NotFoundException } from "@nestjs/common";
import { FormsSnippetsService } from "../forms-snippets.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function snippetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snp-1",
    code: "GUARANTEE_14DAY",
    name: "14-Day Guarantee",
    category: "legal",
    bodyHtml: "<p>Guarantee text</p>",
    version: 1,
    isActive: true,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides
  };
}

function buildPrismaMock() {
  return {
    formContentSnippet: {
      findUnique: jest.fn().mockResolvedValue(snippetRow()),
      findMany: jest.fn().mockResolvedValue([snippetRow()]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(snippetRow()),
      update: jest.fn().mockResolvedValue({ ...snippetRow(), version: 2 }),
      delete: jest.fn().mockResolvedValue(snippetRow())
    },
    formField: {
      count: jest.fn().mockResolvedValue(0)
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      return Promise.all(input as Array<Promise<unknown>>);
    })
  };
}

function buildService() {
  const prisma = buildPrismaMock();
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const service = new FormsSnippetsService(prisma as never, audit as never);
  return { service, prisma, audit };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FormsSnippetsService.listSnippets", () => {
  it("returns paginated snippets filtered to active by default", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findMany.mockResolvedValueOnce([snippetRow()]);
    prisma.formContentSnippet.count.mockResolvedValueOnce(1);

    const result = await service.listSnippets({ page: 1, pageSize: 20 } as never);

    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("FormsSnippetsService.getSnippet", () => {
  it("returns the snippet when it exists", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow({ id: "snp-42" }));

    const result = await service.getSnippet("snp-42");
    expect(result.id).toBe("snp-42");
  });

  it("throws NotFoundException when the snippet does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(null);

    await expect(service.getSnippet("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("FormsSnippetsService.getSnippetByCode", () => {
  it("returns the snippet when code matches", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow());

    const result = await service.getSnippetByCode("GUARANTEE_14DAY");
    expect(result.code).toBe("GUARANTEE_14DAY");
  });

  it("throws NotFoundException for unknown code", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(null);

    await expect(service.getSnippetByCode("UNKNOWN")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("FormsSnippetsService.createSnippet", () => {
  it("throws ConflictException when code already exists", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow());

    await expect(
      service.createSnippet({ code: "GUARANTEE_14DAY", name: "Test", bodyHtml: "<p>x</p>" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates the snippet and writes an audit entry on the happy path", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(null);
    prisma.formContentSnippet.create.mockResolvedValueOnce(snippetRow({ id: "snp-new" }));

    const result = await service.createSnippet(
      { code: "NEW_CODE", name: "New snippet", bodyHtml: "<p>content</p>", category: "legal" },
      "user-1"
    );

    expect(prisma.formContentSnippet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "NEW_CODE", category: "legal", version: 1, isActive: true })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.snippet.create", entityType: "FormContentSnippet" })
    );
    expect(result.id).toBe("snp-new");
  });
});

describe("FormsSnippetsService.updateSnippet", () => {
  it("throws NotFoundException when the snippet does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateSnippet("missing", { name: "x" }, "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("increments version and writes audit on update", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow());
    prisma.formContentSnippet.update.mockResolvedValueOnce({ ...snippetRow(), version: 2, name: "Updated" });

    const result = await service.updateSnippet("snp-1", { name: "Updated" }, "user-1");

    expect(prisma.formContentSnippet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snp-1" },
        data: expect.objectContaining({ version: { increment: 1 }, name: "Updated" })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.snippet.update" })
    );
    expect(result.version).toBe(2);
  });
});

describe("FormsSnippetsService.deleteSnippet", () => {
  it("throws NotFoundException when snippet does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(null);

    await expect(service.deleteSnippet("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when form fields reference the snippet", async () => {
    const { service, prisma } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow());
    prisma.formField.count.mockResolvedValueOnce(3);

    await expect(service.deleteSnippet("snp-1", "user-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("deletes and writes audit when no form fields reference the snippet", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formContentSnippet.findUnique.mockResolvedValueOnce(snippetRow());
    prisma.formField.count.mockResolvedValueOnce(0);
    prisma.formContentSnippet.delete.mockResolvedValueOnce(snippetRow());

    const result = await service.deleteSnippet("snp-1", "user-1");

    expect(prisma.formContentSnippet.delete).toHaveBeenCalledWith({ where: { id: "snp-1" } });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.snippet.delete" })
    );
    expect(result).toMatchObject({ id: "snp-1" });
  });
});
