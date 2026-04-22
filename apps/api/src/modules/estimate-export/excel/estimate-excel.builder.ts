import ExcelJS from "exceljs";
import {
  DISCIPLINE_LABEL,
  DISCIPLINE_ORDER,
  type ExportPayload
} from "../estimate-export.service";

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
  // When a sheet has no columns yet (empty sections), sheet.columns is null.
  // Falling back to an empty array keeps the builder safe for tenders with
  // no cutting lines, no scope items, etc.
  const cols = sheet.columns ?? [];
  cols.forEach((column, i) => {
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

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}

export async function buildEstimateExcel(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Initial Services — Project Operations";
  wb.created = new Date();

  // ── Sheet 1: Summary ──
  const summary = wb.addWorksheet("Summary");
  summary.mergeCells("A1:D1");
  const brandCell = summary.getCell("A1");
  brandCell.value = "INITIAL SERVICES — Estimate summary";
  brandCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_ARGB } };
  brandCell.font = { bold: true, color: { argb: WHITE_ARGB }, size: 14 };
  brandCell.alignment = { vertical: "middle", horizontal: "left" };
  summary.getRow(1).height = 24;

  const primaryClient = payload.tender.clients[0] ?? null;
  const estimator = payload.tender.estimator;
  const metaRows: Array<[string, string]> = [
    ["Quote no", payload.tender.tenderNumber],
    ["Project", payload.tender.title],
    ["Client", primaryClient?.name ?? "—"],
    ["Date", new Date().toLocaleDateString("en-AU")],
    [
      "Estimator",
      estimator ? `${estimator.firstName} ${estimator.lastName} <${estimator.email}>` : "—"
    ],
    [
      "Rates snapshot",
      payload.tender.ratesSnapshotAt
        ? new Date(payload.tender.ratesSnapshotAt).toLocaleDateString("en-AU")
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
  ["Scope", "Description", "Items", "Total (ex-GST)"].forEach((h, i) => {
    header.getCell(i + 1).value = h;
  });
  applyBrandHeader(header);

  let rowIdx = tableStartRow + 1;
  let grandTotal = 0;

  for (const disc of DISCIPLINE_ORDER) {
    if (disc === "Prv") continue;
    const bucket = payload.summary[disc];
    if (!bucket || (bucket.itemCount === 0 && bucket.withMarkup === 0)) continue;
    const r = summary.getRow(rowIdx);
    r.getCell(1).value = disc;
    r.getCell(2).value = DISCIPLINE_LABEL[disc];
    r.getCell(3).value = bucket.itemCount;
    r.getCell(4).value = bucket.withMarkup;
    r.getCell(4).numFmt = CURRENCY_FMT;
    grandTotal += bucket.withMarkup;
    rowIdx += 1;
  }

  if (payload.summary.cutting.itemCount > 0 || payload.summary.cutting.subtotal > 0) {
    const r = summary.getRow(rowIdx);
    r.getCell(1).value = "Cutting";
    r.getCell(2).value = "Concrete Cutting";
    r.getCell(3).value = payload.summary.cutting.itemCount;
    r.getCell(4).value = payload.summary.cutting.subtotal;
    r.getCell(4).numFmt = CURRENCY_FMT;
    grandTotal += payload.summary.cutting.subtotal;
    rowIdx += 1;
  }

  // Provisional row — shown as its own block below the main total.
  const prv = payload.summary.Prv;
  const hasProv = prv && (prv.itemCount > 0 || prv.subtotal > 0);

  const total = summary.getRow(rowIdx);
  total.getCell(1).value = "TOTAL (ex-GST)";
  total.getCell(4).value = grandTotal;
  total.getCell(4).numFmt = CURRENCY_FMT;
  total.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_ARGB } };
    cell.font = { bold: true, color: { argb: WHITE_ARGB } };
  });
  rowIdx += 1;

  if (hasProv) {
    rowIdx += 1;
    const prvRow = summary.getRow(rowIdx);
    prvRow.getCell(1).value = "Prv";
    prvRow.getCell(2).value = "Provisional Sums";
    prvRow.getCell(3).value = prv.itemCount;
    prvRow.getCell(4).value = prv.subtotal;
    prvRow.getCell(4).numFmt = CURRENCY_FMT;
    prvRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_ARGB } };
      cell.font = { italic: true };
    });
  }

  autoFit(summary, [14, 28, 10, 16]);

  // ── Sheet 2: Scope Detail ──
  const scopeSheet = wb.addWorksheet("Scope Detail");
  const sHead = scopeSheet.getRow(1);
  ["WBS", "Discipline", "Description", "Row Type", "Men", "Days", "Shift", "Measurement", "Unit", "Material", "Notes"].forEach((h, i) => {
    sHead.getCell(i + 1).value = h;
  });
  applyBrandHeader(sHead);

  let sRow = 2;
  for (const item of payload.scopeItems) {
    const r = scopeSheet.getRow(sRow);
    r.getCell(1).value = item.wbsCode;
    r.getCell(2).value = item.discipline;
    r.getCell(3).value = item.description;
    r.getCell(4).value = item.rowType;
    r.getCell(5).value = item.men ? Number(item.men) : null;
    r.getCell(6).value = item.days ? Number(item.days) : null;
    r.getCell(7).value = item.shift;
    r.getCell(8).value = item.measurementQty ? Number(item.measurementQty) : null;
    r.getCell(9).value = item.measurementUnit;
    r.getCell(10).value = item.material;
    r.getCell(11).value = item.notes;
    sRow += 1;
  }
  autoFit(scopeSheet, [10, 10, 32, 14, 8, 8, 10, 14, 10, 14, 20]);

  // ── Sheet 3: Cutting Detail ──
  const cuttingSheet = wb.addWorksheet("Cutting Detail");

  const section = (title: string, headers: string[], rowRef: { current: number }) => {
    const titleRow = cuttingSheet.getRow(rowRef.current);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: TEAL_ARGB } };
    rowRef.current += 1;
    const headerRow = cuttingSheet.getRow(rowRef.current);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    applyBrandHeader(headerRow);
    rowRef.current += 1;
  };

  const rowRef = { current: 1 };

  if (payload.cuttingItems.sawCuts.length > 0) {
    section("Saw cuts", ["WBS Ref", "Description", "Equipment", "Elevation", "Material", "Depth mm", "Qty Lm", "Rate $/m", "Method", "Line Total"], rowRef);
    for (const c of payload.cuttingItems.sawCuts) {
      const r = cuttingSheet.getRow(rowRef.current);
      r.getCell(1).value = c.wbsRef;
      r.getCell(2).value = c.description;
      r.getCell(3).value = c.equipment;
      r.getCell(4).value = c.elevation;
      r.getCell(5).value = c.material;
      r.getCell(6).value = c.depthMm;
      r.getCell(7).value = n(c.quantityLm);
      r.getCell(8).value = n(c.ratePerM);
      r.getCell(8).numFmt = CURRENCY_FMT;
      r.getCell(9).value = c.method;
      r.getCell(10).value = n(c.lineTotal);
      r.getCell(10).numFmt = CURRENCY_FMT;
      rowRef.current += 1;
    }
    rowRef.current += 1;
  }

  if (payload.cuttingItems.coreHoles.length > 0) {
    section("Core holes", ["WBS Ref", "Description", "Diameter mm", "Depth mm", "Qty ea", "Rate $/hole", "Method", "POA", "Line Total"], rowRef);
    for (const c of payload.cuttingItems.coreHoles) {
      const r = cuttingSheet.getRow(rowRef.current);
      r.getCell(1).value = c.wbsRef;
      r.getCell(2).value = c.description;
      r.getCell(3).value = c.diameterMm;
      r.getCell(4).value = c.depthMm;
      r.getCell(5).value = c.quantityEach;
      r.getCell(6).value = n(c.ratePerHole);
      r.getCell(6).numFmt = CURRENCY_FMT;
      r.getCell(7).value = c.method;
      r.getCell(8).value = c.isPOA ? "POA" : "—";
      r.getCell(9).value = n(c.lineTotal);
      r.getCell(9).numFmt = CURRENCY_FMT;
      rowRef.current += 1;
    }
    rowRef.current += 1;
  }

  if (payload.cuttingItems.otherRates.length > 0) {
    section("Other rates", ["WBS Ref", "Description", "Unit", "Qty", "Rate", "Line Total"], rowRef);
    for (const c of payload.cuttingItems.otherRates) {
      const r = cuttingSheet.getRow(rowRef.current);
      r.getCell(1).value = c.wbsRef;
      r.getCell(2).value = c.otherRate?.description ?? c.description;
      r.getCell(3).value = c.otherRate?.unit ?? null;
      r.getCell(4).value = c.quantityEach;
      r.getCell(5).value = c.otherRate ? n(c.otherRate.rate) : null;
      r.getCell(5).numFmt = CURRENCY_FMT;
      r.getCell(6).value = n(c.lineTotal);
      r.getCell(6).numFmt = CURRENCY_FMT;
      rowRef.current += 1;
    }
  }

  autoFit(cuttingSheet, [10, 28, 14, 12, 12, 12, 12, 12, 14, 14]);

  const out = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
