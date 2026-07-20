import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { KbArticleStatus } from "@prisma/client";
import { KnowledgeService } from "../knowledge.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Minimal Prisma mock ───────────────────────────────────────────────────────

const ARTICLE_INCLUDE = {
  author: {
    select: { id: true, firstName: true, lastName: true, email: true }
  }
};

function makeMockArticle(overrides: Partial<{
  id: string;
  status: KbArticleStatus;
}> = {}) {
  return {
    id: overrides.id ?? "article-1",
    title: "Safe Work Method Statement",
    body: "## Steps\n1. Wear PPE.",
    category: "Asbestos",
    tags: ["asbestos", "swms"],
    status: overrides.status ?? KbArticleStatus.PUBLISHED,
    authorId: "user-1",
    author: { id: "user-1", firstName: "Test", lastName: "Author", email: "test@example.com" },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

const mockPrisma = {
  kbArticle: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

describe("KnowledgeService", () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    jest.clearAllMocks();
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("restricts to PUBLISHED when includeAll is false", async () => {
      mockPrisma.kbArticle.count.mockResolvedValue(1);
      mockPrisma.kbArticle.findMany.mockResolvedValue([makeMockArticle()]);

      await service.list({}, false);

      expect(mockPrisma.kbArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: KbArticleStatus.PUBLISHED })
        })
      );
    });

    it("shows all statuses when includeAll is true (no status filter passed)", async () => {
      mockPrisma.kbArticle.count.mockResolvedValue(2);
      mockPrisma.kbArticle.findMany.mockResolvedValue([
        makeMockArticle({ status: KbArticleStatus.DRAFT }),
        makeMockArticle({ status: KbArticleStatus.PUBLISHED })
      ]);

      await service.list({}, true);

      // No `status` key in where (all statuses visible)
      const callArgs = mockPrisma.kbArticle.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(callArgs.where).not.toHaveProperty("status");
    });

    it("respects an explicit status filter when includeAll is true", async () => {
      mockPrisma.kbArticle.count.mockResolvedValue(1);
      mockPrisma.kbArticle.findMany.mockResolvedValue([makeMockArticle({ status: KbArticleStatus.DRAFT })]);

      await service.list({ status: KbArticleStatus.DRAFT }, true);

      expect(mockPrisma.kbArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: KbArticleStatus.DRAFT })
        })
      );
    });
  });

  // ── get ─────────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("returns a PUBLISHED article to a viewer (knowledge.view only)", async () => {
      const article = makeMockArticle({ status: KbArticleStatus.PUBLISHED });
      mockPrisma.kbArticle.findUnique.mockResolvedValue(article);

      const result = await service.get("article-1", false);
      expect(result).toEqual(article);
    });

    it("returns 404 for a DRAFT article when viewer does NOT have knowledge.manage", async () => {
      const draft = makeMockArticle({ status: KbArticleStatus.DRAFT });
      mockPrisma.kbArticle.findUnique.mockResolvedValue(draft);

      await expect(service.get("article-1", false)).rejects.toThrow(NotFoundException);
    });

    it("returns a DRAFT article when caller has knowledge.manage (includeAll=true)", async () => {
      const draft = makeMockArticle({ status: KbArticleStatus.DRAFT });
      mockPrisma.kbArticle.findUnique.mockResolvedValue(draft);

      const result = await service.get("article-1", true);
      expect(result).toEqual(draft);
    });

    it("returns 404 for a missing article regardless of includeAll", async () => {
      mockPrisma.kbArticle.findUnique.mockResolvedValue(null);

      await expect(service.get("missing", true)).rejects.toThrow(NotFoundException);
      await expect(service.get("missing", false)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates an article with status DRAFT", async () => {
      const created = makeMockArticle({ status: KbArticleStatus.DRAFT });
      mockPrisma.kbArticle.create.mockResolvedValue(created);

      const result = await service.create(
        { title: "Safe Work Method Statement", body: "## Steps", category: "Asbestos" },
        "user-1"
      );

      expect(mockPrisma.kbArticle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: KbArticleStatus.DRAFT })
        })
      );
      expect(result.status).toBe(KbArticleStatus.DRAFT);
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────────

  describe("publish", () => {
    it("flips a DRAFT article to PUBLISHED", async () => {
      const draft = makeMockArticle({ status: KbArticleStatus.DRAFT });
      mockPrisma.kbArticle.findUnique.mockResolvedValue(draft);
      const published = { ...draft, status: KbArticleStatus.PUBLISHED };
      mockPrisma.kbArticle.update.mockResolvedValue(published);

      const result = await service.publish("article-1");

      expect(mockPrisma.kbArticle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: KbArticleStatus.PUBLISHED }
        })
      );
      expect(result.status).toBe(KbArticleStatus.PUBLISHED);
    });

    it("throws 409 if article is already PUBLISHED", async () => {
      mockPrisma.kbArticle.findUnique.mockResolvedValue(makeMockArticle({ status: KbArticleStatus.PUBLISHED }));

      await expect(service.publish("article-1")).rejects.toThrow(ConflictException);
    });
  });
});
