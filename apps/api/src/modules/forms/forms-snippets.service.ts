import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateSnippetDto, SnippetsQueryDto, UpdateSnippetDto } from "./dto/forms-snippets.dto";

/**
 * CRUD service for FormContentSnippet — the reusable HTML content block
 * library. Snippets are referenced by code from FormField rows that carry
 * fieldType="content_block". Every write is audited.
 *
 * Authorization (super-user / forms.manage) is enforced in the controller.
 */
@Injectable()
export class FormsSnippetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List snippets with optional free-text + category filters.
   *
   * @returns paginated `{ items, total, page, pageSize }`
   */
  async listSnippets(query: SnippetsQueryDto) {
    const where: Prisma.FormContentSnippetWhereInput = {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { code: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.formContentSnippet.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.formContentSnippet.count({ where })
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Get a single snippet by id.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  async getSnippet(id: string) {
    const snippet = await this.prisma.formContentSnippet.findUnique({ where: { id } });
    if (!snippet) {
      throw new NotFoundException("Content snippet not found.");
    }
    return snippet;
  }

  /**
   * Get a single snippet by its unique code.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  async getSnippetByCode(code: string) {
    const snippet = await this.prisma.formContentSnippet.findUnique({ where: { code } });
    if (!snippet) {
      throw new NotFoundException(`Content snippet '${code}' not found.`);
    }
    return snippet;
  }

  /**
   * Resolve a list of snippet codes into their full rows.
   * Missing codes are returned as null entries; callers decide how to handle gaps.
   */
  async resolveSnippetsByCode(codes: string[]) {
    if (codes.length === 0) return [];
    const snippets = await this.prisma.formContentSnippet.findMany({
      where: { code: { in: codes } }
    });
    const byCode = new Map(snippets.map((s) => [s.code, s]));
    return codes.map((code) => byCode.get(code) ?? null);
  }

  /**
   * Create a new content snippet.
   *
   * @throws ConflictException when a snippet with the same code already exists
   */
  async createSnippet(dto: CreateSnippetDto, actorId?: string) {
    const existing = await this.prisma.formContentSnippet.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`A content snippet with code '${dto.code}' already exists.`);
    }

    const snippet = await this.prisma.formContentSnippet.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category ?? "general",
        bodyHtml: dto.bodyHtml,
        version: 1,
        isActive: true
      }
    });

    await this.auditService.write({
      actorId,
      action: "forms.snippet.create",
      entityType: "FormContentSnippet",
      entityId: snippet.id
    });

    return snippet;
  }

  /**
   * Update an existing content snippet. Increments the version counter
   * so consumers can detect stale cached content.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  async updateSnippet(id: string, dto: UpdateSnippetDto, actorId?: string) {
    await this.requireSnippet(id);

    const data: Prisma.FormContentSnippetUpdateInput = { version: { increment: 1 } };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.bodyHtml !== undefined) data.bodyHtml = dto.bodyHtml;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const snippet = await this.prisma.formContentSnippet.update({ where: { id }, data });

    await this.auditService.write({
      actorId,
      action: "forms.snippet.update",
      entityType: "FormContentSnippet",
      entityId: id
    });

    return snippet;
  }

  /**
   * Hard-delete a snippet. Blocked when any active form field references it
   * by snippetCode to avoid silent rendering gaps.
   *
   * @throws ConflictException when live form fields reference this snippet
   */
  async deleteSnippet(id: string, actorId?: string) {
    const snippet = await this.requireSnippet(id);

    const usageCount = await this.prisma.formField.count({
      where: { snippetCode: snippet.code }
    });
    if (usageCount > 0) {
      throw new ConflictException(
        `Cannot delete snippet '${snippet.code}' — it is referenced by ${usageCount} form field(s). ` +
          "Deactivate it instead to hide it from the designer without breaking existing forms."
      );
    }

    await this.prisma.formContentSnippet.delete({ where: { id } });

    await this.auditService.write({
      actorId,
      action: "forms.snippet.delete",
      entityType: "FormContentSnippet",
      entityId: id
    });

    return { id };
  }

  private async requireSnippet(id: string) {
    const snippet = await this.prisma.formContentSnippet.findUnique({ where: { id } });
    if (!snippet) {
      throw new NotFoundException("Content snippet not found.");
    }
    return snippet;
  }
}
