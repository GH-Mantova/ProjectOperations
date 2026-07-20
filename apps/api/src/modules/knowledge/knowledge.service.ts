import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { KbArticleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type CreateKbArticleInput = {
  title: string;
  body: string;
  category: string;
  tags?: string[];
};

export type UpdateKbArticleInput = {
  title?: string;
  body?: string;
  category?: string;
  tags?: string[];
};

export type ListKbArticlesQuery = {
  q?: string;
  category?: string;
  status?: KbArticleStatus;
  page?: number;
  limit?: number;
};

const ARTICLE_INCLUDE = {
  author: {
    select: { id: true, firstName: true, lastName: true, email: true }
  }
} as const;

/**
 * Service for the internal Knowledge Base / SOP library (case management
 * slice 2). Manages KB articles covering asbestos procedures, safe work
 * methods, common defect fixes, and how-tos.
 *
 * Permissions:
 *   - `knowledge.view`   — read PUBLISHED articles
 *   - `knowledge.manage` — read all (including DRAFT), create, update, publish, delete
 */
@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List / search ─────────────────────────────────────────────────────────

  /**
   * List articles with optional full-text search, category and status filters.
   * Viewers (knowledge.view only) see only PUBLISHED articles; callers with
   * knowledge.manage pass `includeAll: true` to also see DRAFT.
   */
  async list(
    query: ListKbArticlesQuery,
    includeAll: boolean
  ) {
    const { q, category, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * Math.min(limit, 100);
    const take = Math.min(limit, 100);

    // Status filter: non-managers can only see PUBLISHED
    const statusFilter = includeAll
      ? status
        ? { status }
        : undefined
      : { status: KbArticleStatus.PUBLISHED };

    // Text search across title, body
    const searchFilter = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : undefined;

    const categoryFilter = category ? { category } : undefined;

    const where = {
      ...(statusFilter ?? {}),
      ...(searchFilter ?? {}),
      ...(categoryFilter ?? {})
    };

    const [total, items] = await Promise.all([
      this.prisma.kbArticle.count({ where }),
      this.prisma.kbArticle.findMany({
        where,
        include: ARTICLE_INCLUDE,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip,
        take
      })
    ]);

    return { items, total, page, limit: take };
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  /**
   * Fetch a single article. Viewers (knowledge.view only) cannot see DRAFT
   * articles — a 404 is returned to avoid leaking draft existence.
   */
  async get(id: string, includeAll: boolean) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
      include: ARTICLE_INCLUDE
    });

    if (!article) throw new NotFoundException("KB article not found.");

    if (!includeAll && article.status !== KbArticleStatus.PUBLISHED) {
      throw new NotFoundException("KB article not found.");
    }

    return article;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateKbArticleInput, authorId: string) {
    if (!input.title?.trim()) throw new BadRequestException("title is required.");
    if (!input.body?.trim()) throw new BadRequestException("body is required.");
    if (!input.category?.trim()) throw new BadRequestException("category is required.");

    return this.prisma.kbArticle.create({
      data: {
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category.trim(),
        tags: input.tags ?? [],
        status: KbArticleStatus.DRAFT,
        authorId
      },
      include: ARTICLE_INCLUDE
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateKbArticleInput) {
    await this.requireArticle(id);

    return this.prisma.kbArticle.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.body !== undefined && { body: input.body }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.tags !== undefined && { tags: input.tags })
      },
      include: ARTICLE_INCLUDE
    });
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  async publish(id: string) {
    const article = await this.requireArticle(id);
    if (article.status === KbArticleStatus.PUBLISHED) {
      throw new ConflictException("Article is already published.");
    }

    return this.prisma.kbArticle.update({
      where: { id },
      data: { status: KbArticleStatus.PUBLISHED },
      include: ARTICLE_INCLUDE
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    await this.requireArticle(id);
    await this.prisma.kbArticle.delete({ where: { id } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireArticle(id: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException("KB article not found.");
    return article;
  }
}
