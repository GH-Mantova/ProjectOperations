import { Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../prisma/prisma.service";

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF005B61" }
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" }
};

/**
 * S5 rate-hub: export a single RateTable as a ready-to-reimport .xlsx buffer.
 *
 * Delivers .xlsx (not .xlsm) — ExcelJS cannot write macro streams, and
 * .xlsx is safe for the round-trip: the stageImport parser accepts both.
 *
 * Sheet layout:
 *   Row 1  — column names (matching RateColumn.name) so stageImport can
 *             match them back without needing hidden ID columns.
 *   Row 2+ — data rows; each cell value comes from RateRow.cells keyed
 *             by column id, resolved via the column name map.
 *
 * See rate-hub-sor-integration-plan.md §Locked Decisions #7.
 */
@Injectable()
export class RateXlsmExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch the RateTable with its columns and active rows, then build an
   * .xlsx workbook buffer.
   *
   * @param tableSlug - the `slug` field of the target RateTable
   * @returns raw .xlsx buffer suitable for streaming as a file download
   * @throws NotFoundException when the table does not exist
   */
  async exportTable(tableSlug: string): Promise<Buffer> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: {
        columns: { orderBy: { sortOrder: "asc" } },
        rows: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }
      }
    });

    if (!table) {
      throw new NotFoundException(
        `Rate table with slug "${tableSlug}" not found.`
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ProjectOperations";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(table.name);

    // ── Header row ────────────────────────────────────────────────────────
    // Use column names (not ids) so the sheet is human-readable and matches
    // what stageImport expects to parse back.
    sheet.columns = table.columns.map((col) => ({
      header: col.name,
      key: col.id, // ExcelJS key — used below when adding data rows
      width: this.columnWidth(col.name)
    }));

    this.styleHeader(sheet);

    // ── Data rows ─────────────────────────────────────────────────────────
    for (const row of table.rows) {
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      const rowData: Record<string, unknown> = {};
      for (const col of table.columns) {
        rowData[col.id] = cells[col.id] ?? null;
      }
      sheet.addRow(rowData);
    }

    // Freeze the header row so users can scroll the data while keeping
    // column names visible.
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private styleHeader(sheet: ExcelJS.Worksheet): void {
    const header = sheet.getRow(1);
    header.font = HEADER_FONT;
    header.fill = HEADER_FILL;
    header.alignment = { vertical: "middle", horizontal: "left" };
  }

  /**
   * Heuristic column width: longer names get a bit more room.
   * ExcelJS default is 10; cap at 40 to avoid absurdly wide columns.
   */
  private columnWidth(name: string): number {
    return Math.min(40, Math.max(14, name.length + 4));
  }
}
