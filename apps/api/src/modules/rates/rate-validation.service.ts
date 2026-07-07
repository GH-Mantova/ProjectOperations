import { BadRequestException, Injectable } from "@nestjs/common";
import type { RateColumn, RateRow } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Validation service for RateTable structure and RateRow data — spec §4.
 * Kept independent of the controller so tests can drive it directly and the
 * resolver can reuse it without triggering HTTP-layer plumbing.
 */
@Injectable()
export class RateValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Structure check: ≥1 KEY column, ≥1 VALUE column with a unit, and any
   * LIST_REF column must name a live listSlug. Throws BadRequestException on
   * the first offence — the caller is committing structure, not doing bulk
   * import.
   */
  assertStructure(columns: Pick<RateColumn, "name" | "dataType" | "role" | "unit" | "listSlug">[]) {
    if (columns.length === 0) {
      throw new BadRequestException("Rate table must have at least one column.");
    }
    const keys = columns.filter((c) => c.role === "KEY");
    const values = columns.filter((c) => c.role === "VALUE");
    if (keys.length === 0) {
      throw new BadRequestException("Rate table must have at least one KEY column.");
    }
    if (values.length === 0) {
      throw new BadRequestException(
        "Rate table must have at least one VALUE column (a table with no $ column is a List — use GlobalList)."
      );
    }
    for (const v of values) {
      if (!v.unit || !v.unit.trim()) {
        throw new BadRequestException(`VALUE column "${v.name}" requires a unit (e.g. hr, m, tonne).`);
      }
    }
    for (const c of columns) {
      if (c.dataType === "LIST_REF" && (!c.listSlug || !c.listSlug.trim())) {
        throw new BadRequestException(
          `LIST_REF column "${c.name}" requires a listSlug pointing at a GlobalList.`
        );
      }
    }
  }

  /**
   * Data-layer validation on a row's `cells`. Verifies:
   *   - required cells non-empty
   *   - CURRENCY/NUMBER parse; VALUE cells ≥ 0 (plus optional min/max)
   *   - LIST_REF cell equals a live (non-archived) GlobalListItem value
   *   - DATE cells parse
   *   - KEY-tuple uniqueness across ACTIVE rows in the same table
   *
   * Note: uniqueness is a service-layer invariant (keys are dynamic, so no DB
   * unique index can enforce it). Duplicate-key is the highest-value check
   * per the spec — well covered by the test suite.
   */
  async validateRow(
    tableId: string,
    columns: RateColumn[],
    cells: Record<string, unknown>,
    opts: { rowIdBeingUpdated?: string } = {}
  ): Promise<void> {
    for (const c of columns) {
      const cell = cells[c.id];
      if (c.required && (cell === undefined || cell === null || cell === "")) {
        throw new BadRequestException(`Column "${c.name}" is required.`);
      }
      if (cell === undefined || cell === null || cell === "") continue;

      if (c.dataType === "NUMBER" || c.dataType === "CURRENCY") {
        const n = typeof cell === "number" ? cell : Number(cell);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`Column "${c.name}" must be a number.`);
        }
        if (c.role === "VALUE" && n < 0) {
          throw new BadRequestException(`VALUE column "${c.name}" must be ≥ 0.`);
        }
        if (c.min !== null && c.min !== undefined && n < Number(c.min)) {
          throw new BadRequestException(`Column "${c.name}" must be ≥ ${c.min}.`);
        }
        if (c.max !== null && c.max !== undefined && n > Number(c.max)) {
          throw new BadRequestException(`Column "${c.name}" must be ≤ ${c.max}.`);
        }
      }

      if (c.dataType === "DATE") {
        const d = new Date(String(cell));
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException(`Column "${c.name}" is not a valid date.`);
        }
      }

      if (c.dataType === "LIST_REF" && c.listSlug) {
        const list = await this.prisma.globalList.findUnique({ where: { slug: c.listSlug } });
        if (!list) {
          throw new BadRequestException(`Column "${c.name}" references unknown list "${c.listSlug}".`);
        }
        const item = await this.prisma.globalListItem.findFirst({
          where: { listId: list.id, value: String(cell), isArchived: false }
        });
        if (!item) {
          throw new BadRequestException(
            `Column "${c.name}" value "${cell}" is not a live item in list "${c.listSlug}".`
          );
        }
      }
    }

    // KEY-tuple uniqueness across active rows.
    const keyColumns = columns.filter((c) => c.role === "KEY");
    if (keyColumns.length > 0) {
      const activeRows = await this.prisma.rateRow.findMany({
        where: { rateTableId: tableId, isActive: true }
      });
      const rowKey = (r: { id: string; cells: unknown }) =>
        keyColumns
          .map((c) => keyPart(((r.cells as Record<string, unknown> | null) ?? {})[c.id]))
          .join("␟");
      const candidateKey = keyColumns.map((c) => keyPart(cells[c.id])).join("␟");
      for (const r of activeRows as RateRow[]) {
        if (opts.rowIdBeingUpdated && r.id === opts.rowIdBeingUpdated) continue;
        if (rowKey(r as unknown as { id: string; cells: unknown }) === candidateKey) {
          throw new BadRequestException(
            "A row with the same KEY-column values already exists in this table."
          );
        }
      }
    }
  }
}

function keyPart(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().toLowerCase();
}
