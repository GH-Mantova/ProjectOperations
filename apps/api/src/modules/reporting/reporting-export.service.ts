import { Injectable, BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PdfRendererService } from "../pdf-rendering/pdf-renderer.service";
import { resolvePdfCompanyContext } from "../pdf-rendering/company-context.helper";
import type { PdfCompanyContext } from "../pdf-rendering/builders/quote-html.builder";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ReportingService,
  type ReportColumnSpec,
  type ReportRunParams,
  type ReportRunResponse
} from "./reporting.service";

export type ReportExportFormat = "xlsx" | "csv" | "pdf";

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF005B61" }
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function formatCellForDisplay(value: string | number | null | undefined, column: ReportColumnSpec): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.format) {
    case "currency":
      return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(
        Number(value)
      );
    case "percent":
      return `${Number(value)}%`;
    case "number":
      return new Intl.NumberFormat("en-AU").format(Number(value));
    case "date":
      if (typeof value === "string") return value.slice(0, 10);
      return String(value);
    default:
      return String(value);
  }
}

function paramSummary(params: ReportRunParams): string {
  const bits: string[] = [];
  if (params.from) bits.push(`From ${params.from}`);
  if (params.to) bits.push(`To ${params.to}`);
  if (params.projectId) bits.push(`Project ${params.projectId}`);
  if (params.clientId) bits.push(`Client ${params.clientId}`);
  return bits.length === 0 ? "No filters applied" : bits.join(" · ");
}

@Injectable()
export class ReportingExportService {
  constructor(
    private readonly reporting: ReportingService,
    private readonly prisma: PrismaService,
    private readonly pdfRenderer: PdfRendererService
  ) {}

  async export(
    key: string,
    format: ReportExportFormat,
    params: ReportRunParams
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const result = await this.reporting.run(key, params);
    switch (format) {
      case "xlsx":
        return this.buildXlsx(result);
      case "csv":
        return this.buildCsv(result);
      case "pdf":
        return this.buildPdf(result);
      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }
  }

  private async buildXlsx(result: ReportRunResponse): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ProjectOperations";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(result.title.slice(0, 30) || "Report");
    sheet.columns = result.columns.map((column) => ({
      header: column.label,
      key: column.key,
      width: Math.max(14, column.label.length + 4)
    }));
    for (const row of result.rows) {
      sheet.addRow(row);
    }
    if (result.totals) {
      const totalRow: Record<string, string | number> = { [result.columns[0]?.key ?? "total"]: "Total" };
      for (const [k, v] of Object.entries(result.totals)) totalRow[k] = v;
      const added = sheet.addRow(totalRow);
      added.font = { bold: true };
    }
    const header = sheet.getRow(1);
    header.fill = HEADER_FILL;
    header.font = HEADER_FONT;
    header.alignment = { vertical: "middle" };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer as ArrayBuffer),
      filename: `${slugify(result.title)}-${fileStamp()}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
  }

  private buildCsv(result: ReportRunResponse): { buffer: Buffer; filename: string; contentType: string } {
    const header = result.columns.map((c) => csvEscape(c.label)).join(",");
    const body = result.rows
      .map((row) => result.columns.map((c) => csvEscape(row[c.key] as string | number | null | undefined)).join(","))
      .join("\r\n");
    const csv = `${header}\r\n${body}\r\n`;
    return {
      buffer: Buffer.from(csv, "utf8"),
      filename: `${slugify(result.title)}-${fileStamp()}.csv`,
      contentType: "text/csv; charset=utf-8"
    };
  }

  private async buildPdf(result: ReportRunResponse): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const ctx = await resolvePdfCompanyContext(this.prisma);
    const html = buildReportHtml(result, ctx);
    const buffer = await this.pdfRenderer.renderHtmlToPdf(html, {
      landscape: true,
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "15mm", right: "15mm" }
    });
    return {
      buffer,
      filename: `${slugify(result.title)}-${fileStamp()}.pdf`,
      contentType: "application/pdf"
    };
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(result: ReportRunResponse, ctx: PdfCompanyContext): string {
  const companyName = escapeHtml(ctx.tradingName || "ProjectOperations");
  const rowsHtml = result.rows
    .map(
      (row) =>
        `<tr>${result.columns
          .map((column) => {
            const display = escapeHtml(formatCellForDisplay(row[column.key] as string | number | null | undefined, column));
            const align = column.align === "right" ? "right" : "left";
            return `<td style="text-align:${align}">${display}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  const totalsHtml = result.totals
    ? `<tr class="totals">${result.columns
        .map((column, idx) => {
          const raw =
            idx === 0
              ? "Total"
              : result.totals && column.key in result.totals
                ? formatCellForDisplay(result.totals[column.key], column)
                : "";
          const align = column.align === "right" ? "right" : "left";
          return `<td style="text-align:${align}"><strong>${escapeHtml(raw)}</strong></td>`;
        })
        .join("")}</tr>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(result.title)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 0 4mm; }
  .header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #005B61; padding-bottom: 6px; margin-bottom: 12px; }
  .header h1 { font-size: 18pt; margin: 0; color: #005B61; }
  .header .company { color: #6b7280; font-size: 10pt; }
  .meta { color: #6b7280; font-size: 9pt; margin-bottom: 10px; }
  .description { font-size: 10pt; margin: 6px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { background: #005B61; color: #fff; text-align: left; padding: 6px 8px; }
  th.right, td[style*="right"] { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr.totals td { background: #f3f4f6; }
</style></head><body>
  <div class="header">
    <h1>${escapeHtml(result.title)}</h1>
    <div class="company">${companyName}</div>
  </div>
  <div class="description">${escapeHtml(result.description)}</div>
  <div class="meta">${escapeHtml(paramSummary(result.params))} · Generated ${escapeHtml(result.generatedAt)}</div>
  <table>
    <thead><tr>${result.columns
      .map((column) => `<th style="text-align:${column.align === "right" ? "right" : "left"}">${escapeHtml(column.label)}</th>`)
      .join("")}</tr></thead>
    <tbody>${rowsHtml}${totalsHtml}</tbody>
  </table>
</body></html>`;
}
