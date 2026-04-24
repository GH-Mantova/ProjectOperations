// Server-side PDF builder using PDFKit primitives only. No headless browser,
// no HTML rendering — intentional for stability. Data source: fetchTenderForExport
// (ScopeOfWorksItem + CuttingSheetItem + TenderTandC/Assumption/Exclusion).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import {
  DISCIPLINE_LABEL,
  DISCIPLINE_ORDER,
  type ExportPayload,
  type ScopeRow
} from "../estimate-export.service";
import { BRAND, COVER_LETTER_TEXT, PRELIMINARY_WORKS } from "./tc-text.const";

type Doc = InstanceType<typeof PDFDocument>;

// Quote overlay — when supplied the builder replaces the cost summary on
// page 1 with the estimator's curated QuoteCostLine rows and uses the
// quote's per-line assumptions / exclusions on page 3. The cover page
// also renders the per-quote quoteRef instead of the tender number.
export type QuoteOverlay = {
  quoteRef: string;
  revision: number;
  assumptionMode: "free" | "linked";
  showProvisional: boolean;
  showCostOptions: boolean;
  clientFacingTotal: number;
  costLines: Array<{ id: string; label: string; description: string; price: number; sortOrder: number }>;
  provisionalLines: Array<{ description: string; price: number; notes: string | null }>;
  costOptions: Array<{ label: string; description: string; price: number; notes: string | null }>;
  assumptions: Array<{ text: string; costLineId: string | null }>;
  exclusions: Array<{ text: string }>;
};

// Resolve the IS teal square logo from the repo root. Fallback to text if
// the file isn't present (keeps local dev working without the asset).
function loadLogoBuffer(): Buffer | null {
  const candidates = [
    join(process.cwd(), "apps/api/assets/teal_sq_logo4x.png"),
    join(process.cwd(), "apps/api/src/modules/estimate-export/pdf/teal_sq_logo4x.png"),
    "/mnt/project/teal_sq_logo4x.png"
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p);
    } catch {
      // ignore
    }
  }
  return null;
}
const LOGO_BUFFER: Buffer | null = loadLogoBuffer();

const PAGE_W = 595.28; // A4 width in points (72dpi)
const PAGE_H = 841.89;
const MARGIN_TOP = 70;
const MARGIN_BOTTOM = 70;
const MARGIN_L = 57;
const MARGIN_R = 57;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const LIGHT_TEAL = "#E8F4F5";

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2
  }).format(value);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function fmtQty(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return "—";
  // Show integers without decimals, otherwise 2dp
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function drawHeaderBand(doc: Doc, quoteRef?: string | null) {
  doc.rect(0, 0, PAGE_W, 50).fill(BRAND.teal);
  if (LOGO_BUFFER) {
    try {
      doc.image(LOGO_BUFFER, MARGIN_L - 4, 3, { fit: [44, 44] });
    } catch {
      // fall through to text fallback below
    }
  }
  const titleX = LOGO_BUFFER ? MARGIN_L + 48 : MARGIN_L;
  doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(14)
    .text("INITIAL SERVICES", titleX, 14, { align: "left" });
  // Licence numbers top-right of the teal band.
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.white)
    .text(
      "Demolition Licence: 2328018 | Class A Asbestos Licence: 2320431",
      MARGIN_L,
      8,
      { align: "right", width: CONTENT_W }
    );
  if (quoteRef) {
    // Quote reference centred horizontally in the teal band.
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.white)
      .text(`Quote No. ${quoteRef}`, 0, 20, { align: "center", width: PAGE_W });
  }
  // Thin orange rule under the band.
  doc.save().strokeColor(BRAND.orange).lineWidth(2).moveTo(0, 51).lineTo(PAGE_W, 51).stroke().restore();
  doc.fillColor(BRAND.black);

  // Electronic-document notice: three stacked lines top-right, below the band.
  doc.font("Helvetica").fontSize(7).fillColor("#777");
  doc.text("Electronic document", MARGIN_L, 55, { align: "right", width: CONTENT_W });
  doc.text("Uncontrolled when printed", MARGIN_L, 62, { align: "right", width: CONTENT_W });
  const printed = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  doc.text(`Printed on: ${printed}`, MARGIN_L, 69, { align: "right", width: CONTENT_W });
  doc.fillColor(BRAND.black);
}

function drawFooter(doc: Doc, pageIndex: number, totalPages: number) {
  const y = PAGE_H - 40;
  doc.font("Helvetica").fontSize(8).fillColor("#666");
  doc.text(
    "10 Grice St, Clontarf Q 4019 | P: (07) 3888 0539 | E: admin@initialservices.net | A.B.N: 75 631 222 556",
    MARGIN_L,
    y,
    { width: CONTENT_W, align: "left" }
  );
  doc.text(`Page ${pageIndex} of ${totalPages}`, MARGIN_L, y + 10, { width: CONTENT_W, align: "right" });
  doc.fillColor(BRAND.black);
}

function drawRule(doc: Doc, colour = BRAND.orange) {
  const y = doc.y + 4;
  doc.save().strokeColor(colour).lineWidth(1.5).moveTo(MARGIN_L, y).lineTo(MARGIN_L + CONTENT_W, y).stroke().restore();
  doc.moveDown(0.4);
}

// ── Page 1 ───────────────────────────────────────────────────────────
function drawCoverPage(doc: Doc, p: ExportPayload, overlay: QuoteOverlay | null) {
  drawHeaderBand(doc, overlay?.quoteRef ?? null);
  doc.y = MARGIN_TOP + 16;

  const primaryClient = p.tender.clients[0] ?? null;
  const estimator = p.tender.estimator;
  const estimatorName = estimator ? `${estimator.firstName} ${estimator.lastName}`.trim() : "—";

  // Two-column client / quote meta block.
  const colTop = doc.y;
  const rightX = MARGIN_L + CONTENT_W / 2;
  const labelFont = () => doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.darkGrey);
  const valueFont = () => doc.font("Helvetica").fontSize(9).fillColor(BRAND.black);

  const leftRow = (label: string, value: string) => {
    labelFont().text(label, MARGIN_L, doc.y, { continued: true, width: 280 });
    valueFont().text(` ${value}`);
    doc.moveDown(0.15);
  };
  leftRow("Company:", primaryClient?.name ?? "—");
  leftRow("Attention:", primaryClient?.contactName ?? "—");
  leftRow("Phone:", primaryClient?.contactPhone ?? "—");
  leftRow("Email:", primaryClient?.contactEmail ?? "—");

  // Right column (absolute-positioned).
  doc.save();
  const rightRows: Array<[string, string]> = [
    ["Quote No:", overlay?.quoteRef ?? p.tender.tenderNumber],
    ["Date:", fmtDate(new Date())],
    ["Project:", p.tender.title],
    ["Estimator:", estimatorName]
  ];
  let ry = colTop;
  for (const [lab, val] of rightRows) {
    labelFont().text(lab, rightX, ry, { continued: true, width: 250 });
    valueFont().text(` ${val}`);
    ry += 14;
  }
  doc.restore();

  // Leave space below whichever column is taller.
  doc.y = Math.max(doc.y, colTop + rightRows.length * 14 + 8);
  doc.moveDown(1);

  // Cover letter paragraph.
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.black)
    .text(COVER_LETTER_TEXT, MARGIN_L, doc.y, { width: CONTENT_W, align: "justify" });
  doc.moveDown(0.8);

  // Cost summary heading.
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal).text("Cost Summary", MARGIN_L, doc.y);
  drawRule(doc, BRAND.orange);

  // When a ClientQuote overlay is supplied, the cost summary uses the
  // estimator's curated cost lines (A, B, C…) rather than discipline
  // totals. The adjustment is baked into clientFacingTotal and never
  // appears as a line — this is a commercial confidentiality rule.
  const nonProv: Array<{ code: string; label: string; amount: number }> = [];
  let overlayTotal = 0;
  if (overlay) {
    for (const line of overlay.costLines) {
      nonProv.push({ code: `${line.label})`, label: line.description, amount: line.price });
    }
    overlayTotal = overlay.clientFacingTotal;
  } else {
    for (const d of DISCIPLINE_ORDER) {
      if (d === "Prv") continue;
      const bucket = p.summary[d];
      if (!bucket || (bucket.itemCount === 0 && bucket.withMarkup === 0)) continue;
      nonProv.push({ code: d, label: DISCIPLINE_LABEL[d], amount: bucket.withMarkup });
    }
    if (p.summary.cutting.itemCount > 0 || p.summary.cutting.subtotal > 0) {
      nonProv.push({ code: "Cutting", label: "Concrete Cutting", amount: p.summary.cutting.subtotal });
    }
  }

  const rowH = 20;
  const scopeColW = 80;
  const descColW = CONTENT_W * 0.55;
  const amountColW = CONTENT_W - scopeColW - descColW;
  const descX = MARGIN_L + scopeColW;
  const amountX = descX + descColW;

  const drawSummaryHeader = () => {
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(BRAND.teal);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(9);
    doc.text("SCOPE", MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
    doc.text("DESCRIPTION", descX + 6, y + 6, { width: descColW - 8 });
    doc.text("AMOUNT (EX GST)", amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
    doc.fillColor(BRAND.black);
    doc.y = y + rowH;
  };
  drawSummaryHeader();

  nonProv.forEach((row, i) => {
    const y = doc.y;
    const bg = i % 2 === 0 ? BRAND.white : BRAND.lightGrey;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
    doc.fillColor(BRAND.black).font("Helvetica").fontSize(9);
    doc.text(row.code, MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
    doc.text(row.label, descX + 6, y + 6, { width: descColW - 8 });
    doc.text(fmtCurrency(row.amount), amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
    doc.y = y + rowH;
  });

  // TOTAL row — teal fill, white bold. With overlay, the total comes from
  // clientFacingTotal (base + invisible adjustment); otherwise it's the
  // visible sum.
  {
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH + 2).fill(BRAND.teal);
    const total = overlay ? overlayTotal : nonProv.reduce((s, r) => s + r.amount, 0);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(10);
    doc.text("TOTAL", MARGIN_L + 6, y + 7, { width: scopeColW - 8 });
    doc.text("", descX + 6, y + 7, { width: descColW - 8 });
    doc.text(fmtCurrency(total), amountX + 6, y + 7, { width: amountColW - 12, align: "right" });
    doc.fillColor(BRAND.black);
    doc.y = y + rowH + 4;
  }

  // Cost options — overlay-driven, optional section above provisional sums.
  if (overlay && overlay.showCostOptions && overlay.costOptions.length > 0) {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal).text("COST OPTIONS", MARGIN_L, doc.y);
    drawRule(doc, BRAND.orange);
    const drawHead = () => {
      const y = doc.y;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(BRAND.lightGrey);
      doc.fillColor(BRAND.darkGrey).font("Helvetica-Bold").fontSize(9);
      doc.text("OPTION", MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
      doc.text("DESCRIPTION", descX + 6, y + 6, { width: descColW - 8 });
      doc.text("PRICE", amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
      doc.fillColor(BRAND.black);
      doc.y = y + rowH;
    };
    drawHead();
    overlay.costOptions.forEach((o, i) => {
      const y = doc.y;
      const bg = i % 2 === 0 ? BRAND.white : BRAND.lightGrey;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
      doc.fillColor(BRAND.black).font("Helvetica").fontSize(9);
      doc.text(`${o.label})`, MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
      doc.text(o.description, descX + 6, y + 6, { width: descColW - 8 });
      doc.text(fmtCurrency(o.price), amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
      doc.y = y + rowH;
    });
  }

  // Provisional sums table. With overlay we prefer the estimator's
  // curated provisional lines; without overlay we fall back to Prv scope
  // items (legacy behaviour).
  const provScopeItems = p.scopeItems.filter((i) => i.discipline === "Prv");
  const useOverlayProv = overlay && overlay.showProvisional && overlay.provisionalLines.length > 0;
  const provItems = useOverlayProv
    ? overlay.provisionalLines.map((l, idx) => ({
        wbsCode: `P${idx + 1}`,
        description: l.description,
        provisionalAmount: l.price.toString()
      }))
    : !overlay
    ? provScopeItems
    : [];
  if (provItems.length > 0) {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal).text("PROVISIONAL SUMS", MARGIN_L, doc.y);
    drawRule(doc, BRAND.orange);

    const drawProvHeader = () => {
      const y = doc.y;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(BRAND.teal);
      doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(9);
      doc.text("ITEM", MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
      doc.text("DESCRIPTION", descX + 6, y + 6, { width: descColW - 8 });
      doc.text("AMOUNT (EX GST)", amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
      doc.fillColor(BRAND.black);
      doc.y = y + rowH;
    };
    drawProvHeader();

    provItems.forEach((item, i) => {
      const y = doc.y;
      const bg = i % 2 === 0 ? BRAND.white : BRAND.lightGrey;
      const amount = item.provisionalAmount ? Number(item.provisionalAmount) : 0;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
      doc.fillColor(BRAND.black).font("Helvetica").fontSize(9);
      doc.text(item.wbsCode, MARGIN_L + 6, y + 6, { width: scopeColW - 8 });
      doc.text(item.description || "—", descX + 6, y + 6, { width: descColW - 8 });
      doc.text(fmtCurrency(amount), amountX + 6, y + 6, { width: amountColW - 12, align: "right" });
      doc.y = y + rowH;
    });

    const provTotal = provItems.reduce(
      (s, i) => s + (i.provisionalAmount ? Number(i.provisionalAmount) : 0),
      0
    );
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH + 2).fill(BRAND.teal);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(10);
    doc.text("TOTAL PROVISIONAL SUM", MARGIN_L + 6, y + 7, { width: scopeColW + descColW - 8 });
    doc.text(fmtCurrency(provTotal), amountX + 6, y + 7, { width: amountColW - 12, align: "right" });
    doc.fillColor(BRAND.black);
    doc.y = y + rowH + 4;
  }

  // Contact person block (centred, italic).
  if (estimator) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(BRAND.black);
    doc.text(
      "If you have any queries regarding this quotation, please do not hesitate to contact:",
      MARGIN_L, doc.y, { width: CONTENT_W, align: "center" }
    );
    const phonePart = estimator.phone ? ` on ${estimator.phone}` : "";
    const emailPart = estimator.email ? ` or ${estimator.email}` : "";
    doc.text(
      `${estimatorName}${phonePart}${emailPart}.`,
      MARGIN_L, doc.y, { width: CONTENT_W, align: "center" }
    );
    doc.fillColor(BRAND.black);
  }

  // Disclaimers.
  doc.moveDown(0.6);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#555");
  doc.text(
    "All prices exclude GST. Add 10% if applicable.",
    MARGIN_L, doc.y, { width: CONTENT_W }
  );
  doc.moveDown(0.15);
  doc.text(
    "This quote is valid for 30 days from the date of issue or the end of the current financial year, whichever is first.",
    MARGIN_L, doc.y, { width: CONTENT_W }
  );
  doc.moveDown(0.15);
  const estEmail = estimator?.email ? ` | ${estimator.email}` : "";
  doc.text(
    `Prepared by: ${estimatorName}${estEmail}`,
    MARGIN_L, doc.y, { width: CONTENT_W }
  );
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
  doc.text("Payment terms: 25 days from date of invoice (BIFA compliant).",
    MARGIN_L, doc.y, { width: CONTENT_W });
}

// ── Page 2 ───────────────────────────────────────────────────────────
type ScopeTableCol = { key: string; label: string; w: number; align?: "left" | "right" };

function drawScopePage(doc: Doc, p: ExportPayload, overlay: QuoteOverlay | null) {
  doc.addPage();
  drawHeaderBand(doc, overlay?.quoteRef ?? null);
  doc.y = MARGIN_TOP + 16;

  // Preliminary works (fixed IS standard text).
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
    .text("Preliminary Works", MARGIN_L, doc.y);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.black);
  for (const bullet of PRELIMINARY_WORKS) {
    doc.text(`• ${bullet}`, MARGIN_L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.5);

  // Referenced Drawings and Documents — only render when the tender has
  // documents attached. Two-column layout when the list exceeds 8 items.
  if (p.documents.length > 0) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.teal)
      .text("Referenced Drawings and Documents", MARGIN_L, doc.y);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
    if (p.documents.length > 8) {
      const half = Math.ceil(p.documents.length / 2);
      const left = p.documents.slice(0, half);
      const right = p.documents.slice(half);
      const colW = (CONTENT_W - 16) / 2;
      const leftX = MARGIN_L;
      const rightX = MARGIN_L + colW + 16;
      const startY = doc.y;
      for (const d of left) {
        doc.text(`- ${d.name}`, leftX, doc.y, { width: colW });
      }
      const endLeftY = doc.y;
      doc.y = startY;
      for (const d of right) {
        doc.text(`- ${d.name}`, rightX, doc.y, { width: colW });
      }
      doc.y = Math.max(endLeftY, doc.y);
    } else {
      for (const d of p.documents) {
        doc.text(`- ${d.name}`, MARGIN_L, doc.y, { width: CONTENT_W });
      }
    }
    doc.moveDown(0.6);
  }

  // Scope heading.
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal).text("Scope of Works", MARGIN_L, doc.y);
  drawRule(doc, BRAND.orange);

  const cols: ScopeTableCol[] = [
    { key: "item", label: "ITEM", w: 50 },
    { key: "desc", label: "SCOPE OF WORKS", w: 250 },
    { key: "qty", label: "QTY", w: 50, align: "right" },
    { key: "unit", label: "UNIT", w: 50 },
    { key: "note", label: "NOTE", w: CONTENT_W - 50 - 250 - 50 - 50 }
  ];
  const colX = (idx: number) => MARGIN_L + cols.slice(0, idx).reduce((s, c) => s + c.w, 0);
  const rowMinH = 20;

  const drawHead = () => {
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowMinH).fill(BRAND.teal);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(9);
    cols.forEach((c, i) => {
      doc.text(c.label, colX(i) + 6, y + 6, { width: c.w - 8, align: c.align ?? "left" });
    });
    doc.fillColor(BRAND.black);
    doc.y = y + rowMinH;
  };

  const ensureRoom = (need: number) => {
    if (doc.y + need > PAGE_H - MARGIN_BOTTOM - 10) {
      doc.addPage();
      drawHeaderBand(doc, overlay?.quoteRef ?? null);
      doc.y = MARGIN_TOP + 16;
      drawHead();
    }
  };

  drawHead();

  // Group scope items by discipline order.
  const scopeByDisc = new Map<string, ScopeRow[]>();
  for (const item of p.scopeItems) {
    const arr = scopeByDisc.get(item.discipline) ?? [];
    arr.push(item);
    scopeByDisc.set(item.discipline, arr);
  }

  let rowIdx = 0;
  for (const disc of DISCIPLINE_ORDER) {
    const rows = scopeByDisc.get(disc) ?? [];
    if (rows.length === 0) continue;
    ensureRoom(24);
    const headY = doc.y;
    doc.rect(MARGIN_L, headY, CONTENT_W, 16).fill(LIGHT_TEAL);
    doc.fillColor(BRAND.teal).font("Helvetica-Bold").fontSize(9);
    doc.text(`${disc} · ${DISCIPLINE_LABEL[disc]}`, MARGIN_L + 6, headY + 4, { width: CONTENT_W - 12 });
    doc.fillColor(BRAND.black);
    doc.y = headY + 16;

    for (const item of rows) {
      const desc = (item.description || "—").slice(0, 500);
      const note = (item.notes ?? "").slice(0, 60) || "As per scope";
      const qty = fmtQty(item.measurementQty);
      const unit = item.measurementUnit ?? "—";

      const descHeight = doc.heightOfString(desc, { width: cols[1].w - 8 });
      const rowH = Math.max(rowMinH, descHeight + 8);
      ensureRoom(rowH);
      const y = doc.y;
      const bg = rowIdx % 2 === 0 ? BRAND.white : BRAND.lightGrey;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
      doc.fillColor(BRAND.black).font("Helvetica").fontSize(8);
      doc.text(item.wbsCode, colX(0) + 6, y + 5, { width: cols[0].w - 8 });
      doc.text(desc, colX(1) + 6, y + 5, { width: cols[1].w - 8 });
      doc.text(qty, colX(2) + 6, y + 5, { width: cols[2].w - 8, align: "right" });
      doc.text(unit, colX(3) + 6, y + 5, { width: cols[3].w - 8 });
      doc.text(note, colX(4) + 6, y + 5, { width: cols[4].w - 8 });
      doc.y = y + rowH;
      rowIdx += 1;
    }
  }

  // Cutting group — saw cuts, core holes, other rates.
  const hasCutting =
    p.cuttingItems.sawCuts.length > 0 ||
    p.cuttingItems.coreHoles.length > 0 ||
    p.cuttingItems.otherRates.length > 0;
  if (hasCutting) {
    ensureRoom(24);
    const headY = doc.y;
    doc.rect(MARGIN_L, headY, CONTENT_W, 16).fill(LIGHT_TEAL);
    doc.fillColor(BRAND.teal).font("Helvetica-Bold").fontSize(9)
      .text("Concrete Cutting", MARGIN_L + 6, headY + 4, { width: CONTENT_W - 12 });
    doc.fillColor(BRAND.black);
    doc.y = headY + 16;

    const drawCuttingRow = (
      item: string,
      desc: string,
      qty: string,
      unit: string,
      note: string,
      altIdx: number
    ) => {
      const descHeight = doc.heightOfString(desc, { width: cols[1].w - 8 });
      const rowH = Math.max(rowMinH, descHeight + 8);
      ensureRoom(rowH);
      const y = doc.y;
      const bg = altIdx % 2 === 0 ? BRAND.white : BRAND.lightGrey;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
      doc.fillColor(BRAND.black).font("Helvetica").fontSize(8);
      doc.text(item, colX(0) + 6, y + 5, { width: cols[0].w - 8 });
      doc.text(desc, colX(1) + 6, y + 5, { width: cols[1].w - 8 });
      doc.text(qty, colX(2) + 6, y + 5, { width: cols[2].w - 8, align: "right" });
      doc.text(unit, colX(3) + 6, y + 5, { width: cols[3].w - 8 });
      doc.text(note, colX(4) + 6, y + 5, { width: cols[4].w - 8 });
      doc.y = y + rowH;
    };

    let ci = 0;
    for (const c of p.cuttingItems.sawCuts) {
      const desc =
        c.description ||
        [c.equipment, c.material, c.depthMm ? `${c.depthMm}mm` : null].filter(Boolean).join(" · ") ||
        "Saw cut";
      drawCuttingRow(
        `${c.wbsRef}-CUT`,
        desc,
        fmtQty(c.quantityLm),
        "Lm",
        c.notes?.slice(0, 60) || "",
        ci++
      );
    }
    for (const c of p.cuttingItems.coreHoles) {
      const desc = c.description || `Ø${c.diameterMm ?? "?"}mm core hole`;
      const qty = c.isPOA ? "POA" : fmtQty(c.quantityEach);
      drawCuttingRow(`${c.wbsRef}-HOLE`, desc, qty, "ea", c.notes?.slice(0, 60) || "", ci++);
    }
    for (const c of p.cuttingItems.otherRates) {
      const desc = c.otherRate?.description || c.description || "Other";
      const unit = c.otherRate?.unit || "ea";
      drawCuttingRow(
        `${c.wbsRef}-OTH`,
        desc,
        fmtQty(c.quantityEach),
        unit,
        c.notes?.slice(0, 60) || "",
        ci++
      );
    }
  }

  if (p.scopeItems.length === 0 && !hasCutting) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555")
      .text("No scope items recorded for this tender.", MARGIN_L, doc.y, { width: CONTENT_W });
    doc.fillColor(BRAND.black);
  }

  // Site details footer.
  if (p.tender.scopeHeader) {
    const sh = p.tender.scopeHeader;
    const hasSite = sh.siteAddress || sh.proposedStartDate || sh.durationWeeks;
    if (hasSite) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.teal)
        .text("Site details", MARGIN_L, doc.y);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(9).fillColor(BRAND.black);
      if (sh.siteAddress) doc.text(`Site Address: ${sh.siteAddress}`, MARGIN_L, doc.y, { width: CONTENT_W });
      if (sh.proposedStartDate)
        doc.text(`Proposed Start: ${fmtDate(sh.proposedStartDate)}`, MARGIN_L, doc.y, { width: CONTENT_W });
      if (sh.durationWeeks) doc.text(`Duration: ${sh.durationWeeks} weeks`, MARGIN_L, doc.y, { width: CONTENT_W });
    }
  }
}

// ── Page 3 ───────────────────────────────────────────────────────────
const ALLOWANCES_BULLETS = [
  "Standard working hours Monday to Friday 6:30am to 4:30pm unless otherwise stated",
  "All consumables, fuel, and waste disposal included in the quoted price",
  "All works to comply with relevant WHS, EPA, and Council regulations",
  "Safety signage, barriers, and exclusion zones as required"
];

function drawAssumptionsPage(doc: Doc, p: ExportPayload, overlay: QuoteOverlay | null) {
  doc.addPage();
  drawHeaderBand(doc, overlay?.quoteRef ?? null);
  doc.y = MARGIN_TOP + 16;

  // Project Specific Allowances (fixed).
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
    .text("PROJECT SPECIFIC ALLOWANCES", MARGIN_L, doc.y);
  drawRule(doc, BRAND.orange);
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.black)
    .text("The following allowances have been included in this quotation:", MARGIN_L, doc.y, { width: CONTENT_W });
  doc.moveDown(0.2);
  for (const line of ALLOWANCES_BULLETS) {
    doc.text(`• ${line}`, MARGIN_L + 6, doc.y, { width: CONTENT_W - 6 });
    doc.moveDown(0.1);
  }
  doc.moveDown(0.5);

  // Project Specific Assumptions — overlay takes priority (per-quote),
  // then per-tender TenderAssumption. Linked mode groups by cost line.
  const quoteAssumptions = overlay?.assumptions ?? [];
  const hasOverlayAssumptions = quoteAssumptions.length > 0;
  const showAssumptions = hasOverlayAssumptions || (!overlay && p.assumptions.length > 0);
  if (showAssumptions) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
      .text("PROJECT SPECIFIC ASSUMPTIONS", MARGIN_L, doc.y);
    drawRule(doc, BRAND.orange);
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
    if (overlay && overlay.assumptionMode === "linked") {
      // Group by cost line; free-form (null) rendered last.
      const byLine = new Map<string | null, string[]>();
      for (const a of quoteAssumptions) {
        const key = a.costLineId ?? null;
        const arr = byLine.get(key) ?? [];
        arr.push(a.text);
        byLine.set(key, arr);
      }
      for (const line of overlay.costLines) {
        const items = byLine.get(line.id);
        if (!items || items.length === 0) continue;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.darkGrey)
          .text(`— Item ${line.label}`, MARGIN_L, doc.y, { width: CONTENT_W });
        doc.moveDown(0.05);
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
        for (const t of items) {
          doc.text(`• ${t}`, MARGIN_L + 12, doc.y, { width: CONTENT_W - 12 });
          doc.moveDown(0.1);
        }
      }
      const freeForm = byLine.get(null);
      if (freeForm && freeForm.length > 0) {
        doc.moveDown(0.2);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.darkGrey)
          .text("— General", MARGIN_L, doc.y, { width: CONTENT_W });
        doc.moveDown(0.05);
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
        for (const t of freeForm) {
          doc.text(`• ${t}`, MARGIN_L + 12, doc.y, { width: CONTENT_W - 12 });
          doc.moveDown(0.1);
        }
      }
    } else {
      const items = hasOverlayAssumptions ? quoteAssumptions.map((a) => a.text) : p.assumptions.map((a) => a.text);
      for (const t of items) {
        doc.text(`• ${t}`, MARGIN_L + 6, doc.y, { width: CONTENT_W - 6 });
        doc.moveDown(0.1);
      }
    }
    doc.moveDown(0.5);
  }

  // Project Specific Exclusions — overlay overrides tender list.
  const exclusions = overlay && overlay.exclusions.length > 0
    ? overlay.exclusions.map((e) => e.text)
    : !overlay
    ? p.exclusions.map((e) => e.text)
    : [];
  if (exclusions.length > 0) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
      .text("PROJECT SPECIFIC EXCLUSIONS", MARGIN_L, doc.y);
    drawRule(doc, BRAND.orange);
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.black);
    for (const t of exclusions) {
      doc.text(`• ${t}`, MARGIN_L + 6, doc.y, { width: CONTENT_W - 6 });
      doc.moveDown(0.1);
    }
    doc.moveDown(0.5);
  }

  // Terms & Conditions — centred heading, two-column clause layout.
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal)
    .text("TERMS AND CONDITIONS", MARGIN_L, doc.y, { width: CONTENT_W, align: "center" });
  drawRule(doc, BRAND.orange);

  const clauses = p.tandc.clauses;
  const colW = (CONTENT_W - 16) / 2;
  const colLeftX = MARGIN_L;
  const colRightX = MARGIN_L + colW + 16;
  const colTop = doc.y;
  const colBottomLimit = PAGE_H - MARGIN_BOTTOM - 10;

  let inRightColumn = false;
  let currentX = colLeftX;
  doc.y = colTop;

  const renderClause = (clause: TcLike, x: number) => {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.darkGrey)
      .text(`${clause.number}. ${clause.heading.toUpperCase()}`, x, doc.y, { width: colW });
    doc.font("Helvetica").fontSize(7).fillColor("#333")
      .text(clause.body, x, doc.y, { width: colW, align: "justify" });
    doc.moveDown(0.35);
  };

  for (const clause of clauses) {
    const headH = doc.heightOfString(`${clause.number}. ${clause.heading.toUpperCase()}`, { width: colW });
    const bodyH = doc.heightOfString(clause.body, { width: colW });
    const needed = headH + bodyH + 6;
    if (doc.y + needed > colBottomLimit) {
      if (!inRightColumn) {
        inRightColumn = true;
        currentX = colRightX;
        doc.y = colTop;
      } else {
        doc.addPage();
        drawHeaderBand(doc, overlay?.quoteRef ?? null);
        doc.y = MARGIN_TOP + 16;
        doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal)
          .text("TERMS AND CONDITIONS (continued)", MARGIN_L, doc.y, { width: CONTENT_W, align: "center" });
        drawRule(doc, BRAND.orange);
        inRightColumn = false;
        currentX = colLeftX;
      }
    }
    renderClause(clause, currentX);
  }
  doc.fillColor(BRAND.black);
}

type TcLike = { number: string; heading: string; body: string };

export async function buildQuotePdf(
  payload: ExportPayload,
  overlay: QuoteOverlay | null = null
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_L, right: MARGIN_R },
      autoFirstPage: true,
      bufferPages: true
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawCoverPage(doc, payload, overlay);
      drawScopePage(doc, payload, overlay);
      drawAssumptionsPage(doc, payload, overlay);

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        drawFooter(doc, i + 1, range.count);
      }
      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
