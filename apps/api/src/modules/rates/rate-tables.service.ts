import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Prisma, RateColumn } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateValidationService } from "./rate-validation.service";
import type { CreateRateTableDto } from "./dto/create-rate-table.dto";
import type { UpdateRateTableDto } from "./dto/update-rate-table.dto";
import type { CreateRateColumnDto, UpdateRateColumnDto } from "./dto/rate-column.dto";
import type { CreateRateRowDto, UpdateRateRowDto } from "./dto/rate-row.dto";

@Injectable()
export class RateTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: RateValidationService
  ) {}

  listTables() {
    return this.prisma.rateTable.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
  }

  async getTable(id: string) {
    const table = await this.prisma.rateTable.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { sortOrder: "asc" } },
        rows: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }
      }
    });
    if (!table) throw new NotFoundException(`Rate table "${id}" not found.`);
    return table;
  }

  async createTable(actorId: string, dto: CreateRateTableDto) {
    const slug = dto.slug.trim().toLowerCase();
    if (!slug) throw new BadRequestException("Slug is required.");
    const clash = await this.prisma.rateTable.findUnique({ where: { slug } });
    if (clash) throw new ConflictException(`Rate table slug "${slug}" already exists.`);
    if (dto.category === "SUBCONTRACTOR" && dto.supplierId) {
      const s = await this.prisma.subcontractorSupplier.findUnique({ where: { id: dto.supplierId } });
      if (!s) throw new BadRequestException(`Supplier "${dto.supplierId}" not found.`);
    }
    return this.prisma.rateTable.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        category: dto.category,
        subcontractorType: dto.subcontractorType?.trim() || null,
        supplierId: dto.supplierId ?? null,
        isSystem: dto.isSystem ?? false,
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  async updateTable(actorId: string, id: string, dto: UpdateRateTableDto) {
    await this.getTable(id);
    return this.prisma.rateTable.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim() ?? undefined,
        subcontractorType: dto.subcontractorType?.trim() ?? undefined,
        supplierId: dto.supplierId ?? undefined,
        isSystem: dto.isSystem,
        updatedById: actorId
      }
    });
  }

  /**
   * Whole-table delete is restricted at the controller (rates.manage plus a
   * hard admin check). Rows cascade — this is a genuine hard delete because
   * R0 has no live consumers of the flexible model yet. Once R1+ routes real
   * pricing through here, switch to soft-delete via the authority seam.
   */
  async deleteTable(id: string) {
    await this.getTable(id);
    await this.prisma.rateTable.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Columns ──────────────────────────────────────────────────────────

  async createColumn(tableId: string, dto: CreateRateColumnDto) {
    const table = await this.getTable(tableId);
    const draft = [
      ...table.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        role: c.role,
        unit: c.unit,
        listSlug: c.listSlug
      })),
      {
        name: dto.name.trim(),
        dataType: dto.dataType,
        role: dto.role,
        unit: dto.unit ?? null,
        listSlug: dto.listSlug ?? null
      }
    ];
    this.validation.assertStructure(draft);
    try {
      return await this.prisma.rateColumn.create({
        data: {
          rateTableId: tableId,
          name: dto.name.trim(),
          dataType: dto.dataType,
          role: dto.role,
          unit: dto.unit ?? null,
          listSlug: dto.listSlug ?? null,
          required: dto.required ?? false,
          min: dto.min as unknown as Prisma.Decimal | undefined,
          max: dto.max as unknown as Prisma.Decimal | undefined,
          sortOrder: dto.sortOrder ?? table.columns.length
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Column "${dto.name}" already exists on this table.`);
      }
      throw err;
    }
  }

  async updateColumn(tableId: string, columnId: string, dto: UpdateRateColumnDto) {
    const existing = await this.prisma.rateColumn.findUnique({ where: { id: columnId } });
    if (!existing || existing.rateTableId !== tableId) {
      throw new NotFoundException(`Column "${columnId}" not on this table.`);
    }
    const table = await this.getTable(tableId);
    const merged = table.columns.map<Pick<RateColumn, "name" | "dataType" | "role" | "unit" | "listSlug">>(
      (c) =>
        c.id === columnId
          ? {
              name: dto.name?.trim() ?? c.name,
              dataType: (dto.dataType ?? c.dataType) as RateColumn["dataType"],
              role: (dto.role ?? c.role) as RateColumn["role"],
              unit: dto.unit ?? c.unit,
              listSlug: dto.listSlug ?? c.listSlug
            }
          : c
    );
    this.validation.assertStructure(merged);
    return this.prisma.rateColumn.update({
      where: { id: columnId },
      data: {
        name: dto.name?.trim(),
        dataType: dto.dataType,
        role: dto.role,
        unit: dto.unit,
        listSlug: dto.listSlug,
        required: dto.required,
        min: dto.min as unknown as Prisma.Decimal | undefined,
        max: dto.max as unknown as Prisma.Decimal | undefined,
        sortOrder: dto.sortOrder
      }
    });
  }

  async deleteColumn(tableId: string, columnId: string) {
    const existing = await this.prisma.rateColumn.findUnique({ where: { id: columnId } });
    if (!existing || existing.rateTableId !== tableId) {
      throw new NotFoundException(`Column "${columnId}" not on this table.`);
    }
    await this.prisma.rateColumn.delete({ where: { id: columnId } });
    return { deleted: true };
  }

  // ── Rows ─────────────────────────────────────────────────────────────

  async createRow(actorId: string, tableId: string, dto: CreateRateRowDto) {
    const table = await this.getTable(tableId);
    await this.validation.validateRow(tableId, table.columns, dto.cells);
    return this.prisma.rateRow.create({
      data: {
        rateTableId: tableId,
        cells: dto.cells as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  async updateRow(actorId: string, tableId: string, rowId: string, dto: UpdateRateRowDto) {
    const row = await this.prisma.rateRow.findUnique({ where: { id: rowId } });
    if (!row || row.rateTableId !== tableId) {
      throw new NotFoundException(`Row "${rowId}" not on this table.`);
    }
    if (dto.cells) {
      const table = await this.getTable(tableId);
      await this.validation.validateRow(tableId, table.columns, dto.cells, {
        rowIdBeingUpdated: rowId
      });
    }
    return this.prisma.rateRow.update({
      where: { id: rowId },
      data: {
        cells: dto.cells ? (dto.cells as Prisma.InputJsonValue) : undefined,
        isActive: dto.isActive,
        effectiveFrom:
          dto.effectiveFrom === undefined ? undefined : dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo:
          dto.effectiveTo === undefined ? undefined : dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        sortOrder: dto.sortOrder,
        updatedById: actorId
      }
    });
  }

  async deleteRow(tableId: string, rowId: string) {
    const row = await this.prisma.rateRow.findUnique({ where: { id: rowId } });
    if (!row || row.rateTableId !== tableId) {
      throw new NotFoundException(`Row "${rowId}" not on this table.`);
    }
    // Rows are soft-deleted so snapshots and audit survive (spec §4).
    return this.prisma.rateRow.update({
      where: { id: rowId },
      data: { isActive: false }
    });
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
