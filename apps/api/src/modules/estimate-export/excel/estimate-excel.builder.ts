import ExcelJS from "exceljs";
import type { ExportPayload } from "../estimate-export.service";

const CURRENCY_FMT = "\"$\"#,##0.00;[Red]-\"$\"#,##0.00";
const TEAL_ARGB = "FF005B61";
const LIGHT_TEAL_ARGB = "FFD6E6E7";
const ORANGE_ARGB = "FFFEAA6D";
const WHITE_ARGB = "FFFFFFFF";

function applyBrandHeader(row: ExcelJS.Row, fill = TEAL_ARGB, font = WHITE_ARGB) {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.font = { bold: true, color: { argb: font } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

function autoFit(sheet: ExcelJS.Worksheet, minCharsByCol: number[] = []) {
  sheet.columns.forEach((column, i) => {
    if (!column) return;
    let maxLen = minCharsByCol[i] ?? 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const value = cell.value === null || cell.value === undefined ? "" : String(cell.value);
      const len = value.length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(50, Math.max(10, maxLen + 2));
  });
}

export async function buildEstimateExcel(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Initial Services — Project Operations";
  wb.created = new Date();

  // ── Sheet 1: Summary ──
  const summary = wb.addWorksheet("Summary");
  summary.mergeCells("A1:J1");
  const brandCell = summary.getCell("A1");
  brandCell.value = "INITIAL SERVICES — Estimate breakdown";
  brandCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_ARGB } };
  brandCell.font = { bold: true, color: { argb: WHITE_ARGB }, size: 14 };
  brandCell.alignment = { vertical: "middle", horizontal: "left" };
  summary.getRow(1).height = 24;

  const metaRows: Array<[string, string]> = [
    ["Quote no", payload.tender.tenderNumber],
    ["Project", payload.tender.title],
    ["Client", payload.client.company ?? "—"],
    ["Date", new Date().toLocaleDateString("en-AU")],
    [
      "Estimator",
      payload.estimator
        ? `${payload.estimator.firstName} ${payload.estimator.lastName} <${payload.estimator.email}>`
        : "—"
    ]
  ];
  metaRows.forEach((row, idx) => {
    const r = summary.getRow(3 + idx);
    r.getCell(1).value = row[0];
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = row[1];
  });

  const tableStartRow = 3 + metaRows.length + 2;
  const header = summary.getRow(tableStartRow);
  const headers = [
    "Scope Item",
    "Labour",
    "Equip & Sub",
    "Plant",
    "Disposal",
    "Cutting",
    "Subtotal",
    "Markup %",
    "Markup $",
    "Item Price"
  ];
  headers.forEach((h, i) => {
    header.getCell(i + 1).value = h;
  });
  applyBrandHeader(header);

  let rowIdx = tableStartRow + 1;
  for (const group of payload.groups) {
    const groupRow = summary.getRow(rowIdx);
    groupRow.getCell(1).value = `${group.code} · ${group.label}`;
    groupRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_TEAL_ARGB } };
      cell.font = { bold: true, color: { argb: TEAL_ARGB } };
    });
    rowIdx += 1;

    const groupItems = payload.items.filter((i) => i.code === group.code);
    let groupSubtotal = 0;
    let groupMarkup = 0;
    let groupPrice = 0;
    for (const item of groupItems) {
      const r = summary.getRow(rowIdx);
      r.getCell(1).value = `  ${item.code}-${item.itemNumber} · ${item.title}`;
      r.getCell(2).value = item.labour;
      r.getCell(3).value = item.equip;
      r.getCell(4).value = item.plant;
      r.getCell(5).value = item.waste;
      r.getCell(6).value = item.cutting;
      r.getCell(7).value = item.subtotal;
      r.getCell(8).value = item.markupPct / 100;
      r.getCell(9).value = item.markup;
      r.getCell(10).value = item.price;
      [2, 3, 4, 5, 6, 7, 9, 10].forEach((col) => {
        r.getCell(col).numFmt = CURRENCY_FMT;
      });
      r.getCell(8).numFmt = "0.00%";
      groupSubtotal += item.subtotal;
      groupMarkup += item.markup;
      groupPrice += item.price;
      rowIdx += 1;
    }

    // Group total
    const totalRow = summary.getRow(rowIdx);
    totalRow.getCell(1).value = `  ${group.code} subtotal`;
    totalRow.getCell(7).value = groupSubtotal;
    totalRow.getCell(9).value = groupMarkup;
    totalRow.getCell(10).value = groupPrice;
    [7, 9, 10].forEach((col) => {
      totalRow.getCell(col).numFmt = CURRENCY_FMT;
    });
    totalRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_TEAL_ARGB } };
    });
    rowIdx += 2;
  }

  // Grand total
  const grand = summary.getRow(rowIdx);
  grand.getCell(1).value = "GRAND TOTAL (ex-GST)";
  grand.getCell(2).value = payload.totals.labour;
  grand.getCell(3).value = payload.totals.equip;
  grand.getCell(4).value = payload.totals.plant;
  grand.getCell(5).value = payload.totals.waste;
  grand.getCell(6).value = payload.totals.cutting;
  grand.getCell(7).value = payload.totals.subtotal;
  grand.getCell(9).value = payload.totals.markup;
  grand.getCell(10).value = payload.totals.totalExGst;
  [2, 3, 4, 5, 6, 7, 9, 10].forEach((col) => {
    grand.getCell(col).numFmt = CURRENCY_FMT;
  });
  grand.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_ARGB } };
    cell.font = { bold: true, color: { argb: WHITE_ARGB } };
  });

  if (payload.totals.provisionalTotal > 0) {
    rowIdx += 1;
    const provRow = summary.getRow(rowIdx);
    provRow.getCell(1).value = "of which Provisional Sum";
    provRow.getCell(10).value = payload.totals.provisionalTotal;
    provRow.getCell(10).numFmt = CURRENCY_FMT;
    provRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_ARGB } };
      cell.font = { italic: true };
    });
  }

  autoFit(summary, [28, 12, 12, 12, 12, 12, 14, 10, 12, 14]);

  // ── Sheet 2: Labour Detail ──
  const labourSheet = wb.addWorksheet("Labour Detail");
  const lHead = labourSheet.getRow(1);
  ["Item", "Role", "Qty", "Days", "Rate Type", "Rate $", "Line Total"].forEach((h, i) => {
    lHead.getCell(i + 1).value = h;
  });
  applyBrandHeader(lHead);
  let lRow = 2;
  for (const item of payload.items) {
    for (const line of item.labourLines) {
      const r = labourSheet.getRow(lRow);
      r.getCell(1).value = `${item.code}-${item.itemNumber} · ${item.title}`;
      r.getCell(2).value = line.role;
      r.getCell(3).value = line.qty;
      r.getCell(4).value = line.days;
      r.getCell(5).value = line.shift;
      r.getCell(6).value = line.rate;
      r.getCell(6).numFmt = CURRENCY_FMT;
      r.getCell(7).value = line.total;
      r.getCell(7).numFmt = CURRENCY_FMT;
      lRow += 1;
    }
  }
  autoFit(labourSheet, [32, 28, 8, 8, 12, 12, 14]);

  // ── Sheet 3: Plant & Disposal Detail ──
  const pdSheet = wb.addWorksheet("Plant & Disposal Detail");
  const pdHead = pdSheet.getRow(1);
  ["Item", "Description", "Type", "Unit", "Qty", "Rate $", "Line Total"].forEach((h, i) => {
    pdHead.getCell(i + 1).value = h;
  });
  applyBrandHeader(pdHead);
  let pdRow = 2;
  for (const item of payload.items) {
    for (const line of item.plantLines) {
      const r = pdSheet.getRow(pdRow);
      r.getCell(1).value = `${item.code}-${item.itemNumber} · ${item.title}`;
      r.getCell(2).value = line.description;
      r.getCell(3).value = "Plant";
      r.getCell(4).value = "day";
      r.getCell(5).value = line.qty * line.days;
      r.getCell(6).value = line.rate;
      r.getCell(6).numFmt = CURRENCY_FMT;
      r.getCell(7).value = line.total;
      r.getCell(7).numFmt = CURRENCY_FMT;
      pdRow += 1;
    }
    for (const line of item.wasteLines) {
      const r = pdSheet.getRow(pdRow);
      r.getCell(1).value = `${item.code}-${item.itemNumber} · ${item.title}`;
      r.getCell(2).value = line.description;
      r.getCell(3).value = "Disposal";
      r.getCell(4).value = "tonne";
      r.getCell(5).value = line.qty;
      r.getCell(6).value = line.rate;
      r.getCell(6).numFmt = CURRENCY_FMT;
      r.getCell(7).value = line.total;
      r.getCell(7).numFmt = CURRENCY_FMT;
      pdRow += 1;
    }
  }
  autoFit(pdSheet, [32, 32, 10, 8, 10, 12, 14]);

  const out = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
