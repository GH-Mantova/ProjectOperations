import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateListBindingDto,
  ListBindingConsumerTypeDto,
  UpdateListBindingDto
} from "./dto/list-binding.dto";

/**
 * ListBinding CRUD + where-used queries. Powers the "Linked to" tab on a
 * list, safe-merge, and delete-safety (a list with bindings cannot be hard
 * deleted — spec §"List builder").
 */
@Injectable()
export class ListBindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  list(filters: { listId?: string; consumerType?: ListBindingConsumerTypeDto } = {}) {
    return this.prisma.listBinding.findMany({
      where: {
        listId: filters.listId,
        consumerType: filters.consumerType
      },
      orderBy: [{ consumerType: "asc" }, { consumerRef: "asc" }]
    });
  }

  /** Where-used for a list — everything bound to it. Powers the "Linked to" tab. */
  async whereUsed(listId: string) {
    const list = await this.prisma.globalList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException(`List "${listId}" not found.`);
    const bindings = await this.prisma.listBinding.findMany({
      where: { listId },
      orderBy: [{ consumerType: "asc" }, { consumerRef: "asc" }]
    });
    return {
      listId,
      listSlug: list.slug,
      count: bindings.length,
      bindings
    };
  }

  async create(dto: CreateListBindingDto) {
    const list = await this.prisma.globalList.findUnique({ where: { id: dto.listId } });
    if (!list) throw new BadRequestException(`List "${dto.listId}" not found.`);
    try {
      return await this.prisma.listBinding.create({
        data: {
          listId: dto.listId,
          consumerType: dto.consumerType,
          consumerRef: dto.consumerRef.trim(),
          label: dto.label?.trim() || null
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("This binding already exists.");
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateListBindingDto) {
    const existing = await this.prisma.listBinding.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Binding "${id}" not found.`);
    return this.prisma.listBinding.update({
      where: { id },
      data: { label: dto.label?.trim() ?? null }
    });
  }

  /**
   * Hard-delete a binding. Bindings are pure link records — nothing at the DB
   * level depends on them, so there is no in-use guard beyond existence. Every
   * delete writes an AuditLog row so the link can be reconstructed.
   */
  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.listBinding.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Binding "${id}" not found.`);
    await this.prisma.listBinding.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "listBinding.delete",
      entityType: "ListBinding",
      entityId: id,
      metadata: {
        listId: existing.listId,
        consumerType: existing.consumerType,
        consumerRef: existing.consumerRef,
        label: existing.label
      }
    });
    return { deleted: true };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
