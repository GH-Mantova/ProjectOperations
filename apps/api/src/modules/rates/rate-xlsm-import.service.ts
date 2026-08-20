import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// ── Public contract types ────────────────────────────────────────────────────

export type CandidateRow = {
  /** Row number in the source spreadsheet (1-based, skipping header). */
  sourceRowIndex: number;
  /** Column-id-keyed cells extracted from the workbook. */
  cells: Record<string, unknown>;
  /** Human-readable label built from KEY-role columns (used in UI and errors). */
  naturalKey: string;
};

export type ImpactPreview = {
  /** Number of existing active rows that will be soft-deactivated. */
  replaced: number;
  /** Number of new rows that will be inserted. */
  inserted: number;
  /**
   * Rows whose KEY column values differ from any existing active row —
   * these are the true "net new" inserts (inserted - changed = purely new).
   */
  changed: number;
};

export type ImportStageResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview: CandidateRow[];
  impact: ImpactPreview;
  /** Opaque slug — must be echoed back to commitImport unchanged. */
  tableSlug: string;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * S5 rate-hub: staged import pipeline for .xlsm/.xlsx files.
 *
 * Two-phase design:
 *   1. stageImport  — parses and validates; writes NOTHING; returns preview.
 *   2. commitImport — called only when stageImport returned valid=true;
 *                     all-or-nothing Prisma transaction.
 *
 * The target is RateTable rows (hub tables), NOT the legacy Estimate* tables.
 * See rate-hub-sor-integration-plan.md §Locked Decisions #7.
 */
@Injectable()
export class RateXlsmImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // ── Phase 1: Stage ────────────────────────────────────────────────────────

  /**
   * Parse a .xlsm/.xlsx buffer against the RateTable identified by `tableSlug`.
   *
   * Validates:
   * - Table exists.
   * - Workbook has exactly one data sheet whose first row matches the table's
   *   RateColumn names (order-insensitive; extra columns are warned, missing
   *   required columns are errors).
   * - Each data row maps to valid cell values (no further type coercion here —
   *   values are stored as-is in the Json cells field).
   *
   * Writes NOTHING to the database.
   */
  async stageImport(buffer: Buffer, tableSlug: string): Promise<ImportStageResult> {
    // --- 1. Resolve the target table ----------------------------------------
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
    if (!table) {
      throw new NotFoundException(
        `Rate table with slug "${tableSlug}" not found. ` +
          `Create the table before importing into it.`
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // --- 2. Parse the workbook -----------------------------------------------
    const workbook = new ExcelJS.Workbook();
    try {
      // ExcelJS xlsx.load wants ArrayBuffer; Node Buffer backing is not
      // guaranteed to be a plain ArrayBuffer.
      const ab = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(ab).set(buffer);
      await workbook.xlsx.load(ab);
    } catch {
      throw new BadRequestException("Uploaded file is not a valid .xlsx/.xlsm workbook.");
    }

    if (workbook.worksheets.length === 0) {
      throw new BadRequestException("Workbook has no worksheets.");
    }

    // Use the first visible (non-hidden) sheet, or fall back to the first sheet.
    const sheet =
      workbook.worksheets.find((ws) => ws.state !== "hidden") ?? workbook.worksheets[0];

    if (workbook.worksheets.length > 1) {
      const ignored = workbook.worksheets
        .filter((ws) => ws.id !== sheet.id)
        .map((ws) => `"${ws.name}"`)
        .join(", ");
      warnings.push(`Only the first sheet "${sheet.name}" was imported; ignored: ${ignored}.`);
    }

    // --- 3. Resolve header row -----------------------------------------------
    const headerRow = sheet.getRow(1);
    const headerCells: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const val = this.cellToString(cell.value);
      if (val) headerCells.push(val.trim());
    });

    if (headerCells.length === 0) {
      errors.push("Header row (row 1) is empty — no columns found.");
      return this.emptyResult(tableSlug, errors, warnings);
    }

    // Build a name-indexed map of the DB columns.
    const colByName = new Map(table.columns.map((c) => [c.name, c]));

    // Map each header cell to a column id; track unmapped headers.
    const headerToColId: Array<string | null> = headerCells.map((h) => {
      const col = colByName.get(h);
      if (!col) {
        warnings.push(`Sheet column "${h}" does not match any column in table "${table.name}"; it will be ignored.`);
        return null;
      }
      return col.id;
    });

    // Ensure every required column is present.
    for (const col of table.columns) {
      if (col.required && !headerCells.includes(col.name)) {
        errors.push(`Required column "${col.name}" is missing from the sheet header.`);
      }
    }

    if (errors.length > 0) {
      return this.emptyResult(tableSlug, errors, warnings);
    }

    // --- 4. Parse data rows --------------------------------------------------
    const keyColumnIds = table.columns
      .filter((c) => c.role === "KEY")
      .map((c) => c.id);

    const candidateRows: CandidateRow[] = [];
    let sourceRowIndex = 1; // will be incremented on each data row

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      sourceRowIndex = rowNumber;

      const cells: Record<string, unknown> = {};
      let hasAnyValue = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colId = headerToColId[colNumber - 1];
        if (!colId) return; // unmapped / ignored column
        const val = this.extractCellValue(cell.value);
        cells[colId] = val;
        if (val !== null && val !== "") hasAnyValue = true;
      });

      if (!hasAnyValue) return; // fully blank row — skip silently

      // Build a human-readable natural key from KEY-role column values.
      const keyParts = keyColumnIds
        .map((id) => {
          const col = table.columns.find((c) => c.id === id);
          const val = cells[id];
          return col ? `${col.name}=${String(val ?? "")}` : String(val ?? "");
        })
        .filter(Boolean);
      const naturalKey = keyParts.length > 0 ? keyParts.join(" | ") : `row ${rowNumber}`;

      candidateRows.push({ sourceRowIndex, cells, naturalKey });
    });

    // --- 5. Compute impact preview ------------------------------------------
    const activeRows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });

    const existingNaturalKeys = new Set(
      activeRows.map((r) => this.buildNaturalKey(r.cells as Record<string, unknown>, keyColumnIds))
    );

    let changedCount = 0;
    for (const cand of candidateRows) {
      const candKey = this.buildNaturalKey(cand.cells, keyColumnIds);
      if (existingNaturalKeys.has(candKey)) {
        changedCount++;
      }
    }

    const impact: ImpactPreview = {
      replaced: activeRows.length,
      inserted: candidateRows.length,
      changed: changedCount
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      preview: candidateRows,
      impact,
      tableSlug
    };
  }

  // ── Phase 2: Commit ───────────────────────────────────────────────────────

  /**
   * All-or-nothing commit of a previously staged import result.
   *
   * Steps inside a single transaction:
   *   1. Soft-deactivate all currently active rows (isActive = false).
   *   2. Insert each candidate row as a new active row.
   *   3. Write an audit log entry.
   *
   * Throws if `stageResult.valid` is false (caller guard, not expected in
   * normal flow since the controller already checks this).
   */
  async commitImport(
    stageResult: ImportStageResult,
    tableSlug: string,
    actorId: string
  ): Promise<void> {
    if (!stageResult.valid) {
      throw new BadRequestException(
        "Cannot commit an import that did not pass validation. " +
          "Call stageImport first and check valid=true."
      );
    }
    if (stageResult.tableSlug !== tableSlug) {
      throw new BadRequestException(
        `Stage result was for table "${stageResult.tableSlug}" but commit was requested ` +
          `for "${tableSlug}". Slug mismatch — re-stage against the correct table.`
      );
    }

    // Resolve table id (we need it for Prisma writes).
    const table = await this.prisma.rateTable.findUnique({ where: { slug: tableSlug } });
    if (!table) {
      throw new NotFoundException(`Rate table "${tableSlug}" not found at commit time.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Step 1: soft-deactivate all existing active rows.
      await tx.rateRow.updateMany({
        where: { rateTableId: table.id, isActive: true },
        data: { isActive: false, updatedById: actorId }
      });

      // Step 2: insert new rows.
      const now = new Date();
      for (const [index, candidate] of stageResult.preview.entries()) {
        await tx.rateRow.create({
          data: {
            rateTableId: table.id,
            cells: candidate.cells as Prisma.InputJsonValue,
            isActive: true,
            sortOrder: index,
            createdById: actorId,
            updatedById: actorId,
            createdAt: now,
            updatedAt: now
          }
        });
      }

      // Step 3: audit entry (inside the same transaction so it rolls back together).
      await tx.auditLog.create({
        data: {
          actorId,
          action: "rate-hub.xlsm-import.commit",
          entityType: "RateTable",
          entityId: table.id,
          metadata: {
            tableSlug,
            deactivated: stageResult.impact.replaced,
            inserted: stageResult.preview.length
          }
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private emptyResult(
    tableSlug: string,
    errors: string[],
    warnings: string[]
  ): ImportStageResult {
    return {
      valid: false,
      errors,
      warnings,
      preview: [],
      impact: { replaced: 0, inserted: 0, changed: 0 },
      tableSlug
    };
  }

  private buildNaturalKey(cells: Record<string, unknown>, keyColumnIds: string[]): string {
    return keyColumnIds
      .map((id) => String(cells[id] ?? "").trim().toLowerCase())
      .join("||");
  }

  private cellToString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
      return String((value as { text: unknown }).text ?? "");
    }
    return String(value);
  }

  private extractCellValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    // ExcelJS rich-text objects
    if (
      typeof value === "object" &&
      value !== null &&
      "text" in (value as Record<string, unknown>)
    ) {
      return String((value as { text: unknown }).text ?? "");
    }
    // ExcelJS formula result objects
    if (
      typeof value === "object" &&
      value !== null &&
      "result" in (value as Record<string, unknown>)
    ) {
      return (value as { result: unknown }).result;
    }
    return value;
  }
}
