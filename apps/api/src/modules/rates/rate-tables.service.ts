import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Prisma, RateColumn } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RateValidationService } from "./rate-validation.service";
import type { CreateRateTableDto } from "./dto/create-rate-table.dto";
import type { UpdateRateTableDto } from "./dto/update-rate-table.dto";
import type { CreateRateColumnDto, UpdateRateColumnDto } from "./dto/rate-column.dto";
import type { CreateRateRowDto, UpdateRateRowDto } from "./dto/rate-row.dto";
import { type ChargeStep } from "./rate-step-evaluator";

@Injectable()
export class RateTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: RateValidationService,
    private readonly auditService: AuditService
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
        isReference: dto.isReference ?? false,
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
        isReference: dto.isReference,
        updatedById: actorId
      }
    });
  }

  /**
   * Whole-table delete is restricted at the controller (rates.manage plus a
   * hard admin check). Refuses if the table still holds rows (they would
   * cascade and vanish silently) or if any TenderRateSet snapshot still
   * references the table (compliance / historical pricing). Every successful
   * delete writes an AuditLog row with the table payload.
   */
  async deleteTable(id: string, actorId?: string) {
    const existing = await this.getTable(id);
    const rowCount = await this.prisma.rateRow.count({ where: { rateTableId: id } });
    if (rowCount > 0) {
      throw new ConflictException(
        `Rate table has ${rowCount} row(s). Deactivate rows (isActive = false) instead — deleting the table would cascade and orphan snapshot references.`
      );
    }
    const snapshotCount = await this.prisma.tenderRateEntry.count({
      where: { rateTableId: id }
    });
    if (snapshotCount > 0) {
      throw new ConflictException(
        `Rate table is referenced by ${snapshotCount} locked tender rate-set entry(ies). Unlock those tenders before deleting the table.`
      );
    }
    await this.prisma.rateTable.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "rateTable.delete",
      entityType: "RateTable",
      entityId: id,
      metadata: {
        name: existing.name,
        slug: existing.slug,
        description: existing.description,
        category: existing.category,
        subcontractorType: existing.subcontractorType,
        supplierId: existing.supplierId,
        isSystem: existing.isSystem,
        isReference: existing.isReference,
        columnCount: existing.columns?.length ?? 0
      }
    });
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

  /**
   * Hard-delete a column. Refuses if the parent table still holds any rows —
   * row cells key on column names, so pulling a column silently orphans data
   * in every existing RateRow.cells JSON. Every successful delete writes an
   * AuditLog row with the column payload.
   */
  async deleteColumn(tableId: string, columnId: string, actorId?: string) {
    const existing = await this.prisma.rateColumn.findUnique({ where: { id: columnId } });
    if (!existing || existing.rateTableId !== tableId) {
      throw new NotFoundException(`Column "${columnId}" not on this table.`);
    }
    const rowCount = await this.prisma.rateRow.count({ where: { rateTableId: tableId } });
    if (rowCount > 0) {
      throw new ConflictException(
        `Cannot delete column while the table has ${rowCount} row(s) — cell keys reference the column and would be orphaned. Deactivate rows first.`
      );
    }
    await this.prisma.rateColumn.delete({ where: { id: columnId } });
    await this.auditService.write({
      actorId,
      action: "rateColumn.delete",
      entityType: "RateColumn",
      entityId: columnId,
      metadata: {
        rateTableId: existing.rateTableId,
        name: existing.name,
        dataType: existing.dataType,
        role: existing.role,
        unit: existing.unit,
        listSlug: existing.listSlug,
        required: existing.required,
        min: existing.min?.toString() ?? null,
        max: existing.max?.toString() ?? null,
        sortOrder: existing.sortOrder
      }
    });
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

  // ── Charge steps ──────────────────────────────────────────────────────

  /**
   * Return the count of open (non-locked) tenders that price against this
   * table, plus the raw chargeSteps JSON stored on the table.
   */
  async getChargeStepsInfo(tableId: string) {
    const table = await this.getTable(tableId);
    const openTenderCount = await this.prisma.tenderRateEntry.count({
      where: { rateTableId: tableId }
    });
    return {
      chargeSteps: table.chargeSteps ?? null,
      openTenderCount
    };
  }

  /**
   * Replace the charge-step list for a rate table.
   *
   * Validation (applied before the write):
   *  - steps must be a non-empty array
   *  - steps[0].op must be "start"
   *  - every step.op must be a recognised operation
   *  - field names used in arithmetic or conditions must exist on the table
   *    (numeric literals are always allowed)
   */
  async patchChargeSteps(actorId: string, tableId: string, steps: unknown[]) {
    const table = await this.getTable(tableId);
    validateChargeSteps(steps, table.columns.map((c) => c.name));

    const updated = await this.prisma.rateTable.update({
      where: { id: tableId },
      data: {
        chargeSteps: steps as unknown as Prisma.InputJsonValue,
        updatedById: actorId
      }
    });
    await this.auditService.write({
      actorId,
      action: "rateTable.patchChargeSteps",
      entityType: "RateTable",
      entityId: tableId,
      metadata: { stepCount: steps.length }
    });
    return updated;
  }
}

// ── Charge-step validation ────────────────────────────────────────────────

const KNOWN_OPS = new Set([
  "start",
  "multiply",
  "divide",
  "add",
  "subtract",
  "round",
  "floor",
  "cap"
]);

/**
 * Validate a raw step list before persisting.  Throws BadRequestException on
 * any structural violation so the controller can surface a 400.
 */
function validateChargeSteps(steps: unknown[], columnNames: string[]): asserts steps is ChargeStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new BadRequestException("steps must be a non-empty array.");
  }

  const columnSet = new Set(columnNames);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (typeof step !== "object" || step === null || !("op" in step)) {
      throw new BadRequestException(`Step ${i}: must be an object with an "op" property.`);
    }

    const op = (step as Record<string, unknown>)["op"];
    if (typeof op !== "string" || !KNOWN_OPS.has(op)) {
      throw new BadRequestException(
        `Step ${i}: unknown op "${String(op)}". Allowed: ${[...KNOWN_OPS].join(", ")}.`
      );
    }

    if (i === 0 && op !== "start") {
      throw new BadRequestException(`Step 0: first step must have op "start" (got "${op}").`);
    }

    const s = step as Record<string, unknown>;

    // Validate field references for ops that use a field operand
    if (["start", "multiply", "divide", "add", "subtract"].includes(op)) {
      const field = s["field"];
      if (field === undefined) {
        throw new BadRequestException(`Step ${i} (op: ${op}): missing "field" property.`);
      }
      if (typeof field === "string" && !columnSet.has(field)) {
        throw new BadRequestException(
          `Step ${i} (op: ${op}): field "${field}" is not a column on this table.`
        );
      }
    }

    // Validate round step
    if (op === "round") {
      const direction = s["direction"];
      if (!["nearest", "up", "down"].includes(String(direction))) {
        throw new BadRequestException(
          `Step ${i} (op: round): direction must be "nearest", "up", or "down".`
        );
      }
      const interval = s["interval"];
      if (typeof interval !== "number" || interval <= 0) {
        throw new BadRequestException(
          `Step ${i} (op: round): interval must be a positive number.`
        );
      }
    }

    // Validate floor/cap value
    if (op === "floor" || op === "cap") {
      const value = s["value"];
      if (typeof value !== "number") {
        throw new BadRequestException(`Step ${i} (op: ${op}): "value" must be a number.`);
      }
    }

    // Validate condition field reference
    const when = s["when"];
    if (when !== undefined && when !== null) {
      if (typeof when !== "object" || !("field" in (when as object))) {
        throw new BadRequestException(`Step ${i}: "when" must be a condition object with a "field" property.`);
      }
      const condField = (when as Record<string, unknown>)["field"];
      if (typeof condField === "string" && !columnSet.has(condField)) {
        throw new BadRequestException(
          `Step ${i}: condition field "${condField}" is not a column on this table.`
        );
      }
      const cmp = (when as Record<string, unknown>)["cmp"];
      const allowedCmps = ["is", "is not", ">", "<", ">=", "<="];
      if (typeof cmp !== "string" || !allowedCmps.includes(cmp)) {
        throw new BadRequestException(
          `Step ${i}: condition cmp must be one of: ${allowedCmps.join(", ")}.`
        );
      }
    }
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
