// Server-side PDF builder using PDFKit primitives only. No headless browser,
// no HTML rendering — intentional for stability.

import PDFDocument from "pdfkit";
import type { ExportPayload } from "../estimate-export.service";
import {
  BRAND,
  COVER_LETTER_TEXT,
  PRELIMINARY_WORKS,
  PROJECT_ALLOWANCES_TEXT,
  PROJECT_ASSUMPTIONS_TEXT,
  TC_TEXT
} from "./tc-text.const";

type Doc = InstanceType<typeof PDFDocument>;

const PAGE_W = 595.28; // A4 width in points (72dpi)
const PAGE_H = 841.89;
const MARGIN_TOP = 70; // ~25mm
const MARGIN_BOTTOM = 70;
const MARGIN_L = 57; // ~20mm
const MARGIN_R = 57;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

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

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function drawHeaderBand(doc: Doc) {
  doc.rect(0, 0, PAGE_W, 40).fill(BRAND.teal);
  doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(14)
    .text("INITIAL SERVICES", MARGIN_L, 14, { align: "left" });
  doc.font("Helvetica").fontSize(8)
    .text(
      "Demolition Licence: 2328018 | Class A Asbestos Licence: 2320431",
      MARGIN_L,
      18,
      { align: "right", width: CONTENT_W }
    );
  doc.fillColor(BRAND.black);
}

function drawFooter(doc: Doc, pageIndex: number, totalPages: number) {
  const y = PAGE_H - 40;
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.teal);
  doc.text(
    "10 Grice St, Clontarf Q 4019 | P: (07) 3888 0539 | E: admin@initialservices.net",
    MARGIN_L,
    y,
    { width: CONTENT_W, align: "left" }
  );
  doc.text(`Page ${pageIndex} of ${totalPages}`, MARGIN_L, y, { width: CONTENT_W, align: "right" });
  doc.fillColor(BRAND.black);
}

function addHorizRule(doc: Doc, colour: string = BRAND.orange) {
  const y = doc.y + 4;
  doc.save().strokeColor(colour).lineWidth(1.5).moveTo(MARGIN_L, y).lineTo(MARGIN_L + CONTENT_W, y).stroke();
  doc.restore();
  doc.moveDown(0.4);
}

function drawInfoRow(doc: Doc, label: string, value: string, valueX: number, labelW = 90) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.black);
  const y = doc.y;
  doc.text(label, MARGIN_L, y, { width: labelW });
  doc.font("Helvetica").text(value || "—", MARGIN_L + labelW, y, { width: valueX - (MARGIN_L + labelW) - 4 });
  doc.moveDown(0.35);
}

function drawCoverPage(doc: Doc, p: ExportPayload) {
  drawHeaderBand(doc);
  doc.y = MARGIN_TOP;

  // Client details header
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal).text("Client Details", MARGIN_L, doc.y);
  addHorizRule(doc, BRAND.orange);
  doc.fillColor(BRAND.black);

  const clientCompany = p.client.company ?? "—";
  const clientContact = p.client.contact ?? "—";
  const clientPhone = p.client.phone ?? "—";
  const clientEmail = p.client.email ?? "—";

  // Two-column info layout: left = client, right = quote meta
  const colTop = doc.y;
  const rightX = MARGIN_L + CONTENT_W / 2;

  // Left column
  const leftBlock = (label: string, value: string) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.darkGrey).text(label, MARGIN_L, doc.y, { continued: true, width: 280 });
    doc.font("Helvetica").fillColor(BRAND.black).text(` ${value}`);
    doc.moveDown(0.2);
  };
  leftBlock("Company:", clientCompany);
  leftBlock("Attention:", clientContact);
  leftBlock("P:", clientPhone);
  leftBlock("E:", clientEmail);

  // Right column (absolute-positioned)
  const rightY = colTop;
  doc.save();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.darkGrey)
    .text("Quote:", rightX, rightY, { continued: true, width: 250 });
  doc.font("Helvetica").fillColor(BRAND.black).text(` ${p.tender.tenderNumber}`);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.darkGrey)
    .text("Date:", rightX, rightY + 14, { continued: true, width: 250 });
  doc.font("Helvetica").fillColor(BRAND.black).text(` ${fmtDate(new Date())}`);
  doc.restore();

  doc.moveDown(1);

  // Project heading
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.teal)
    .text(`Project – ${p.tender.title}`, MARGIN_L, doc.y, { width: CONTENT_W });
  doc.moveDown(0.3);
  doc.fillColor(BRAND.black);

  // Cover letter
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.black)
    .text(COVER_LETTER_TEXT, MARGIN_L, doc.y, { width: CONTENT_W, align: "justify" });
  doc.moveDown(0.8);

  // Cost summary
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal).text("Cost Summary", MARGIN_L, doc.y);
  addHorizRule(doc, BRAND.orange);

  // Summary table: group total ex-GST per discipline.
  const nonProvGroups = p.groups.filter((g) => g.code !== "Prv");
  const provGroups = p.groups.filter((g) => g.code === "Prv");

  const rowH = 20;
  const descW = CONTENT_W * 0.65;
  const priceX = MARGIN_L + descW;

  // Header row
  doc.rect(MARGIN_L, doc.y, CONTENT_W, rowH).fill(BRAND.lightGrey);
  doc.fillColor(BRAND.darkGrey).font("Helvetica-Bold").fontSize(9)
    .text("Description", MARGIN_L + 6, doc.y + 6, { width: descW - 12 })
    .text("Price (ex-GST)", priceX + 6, doc.y - (rowH - 6) /* offset */, { width: CONTENT_W - descW - 12, align: "right" });
  doc.y += rowH;
  doc.fillColor(BRAND.black);

  for (const g of nonProvGroups) {
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH).stroke(BRAND.lightGrey);
    doc.font("Helvetica").fontSize(9)
      .text(`${g.code} · ${g.label}`, MARGIN_L + 6, y + 6, { width: descW - 12 });
    doc.text(fmtCurrency(g.total), priceX + 6, y + 6, { width: CONTENT_W - descW - 12, align: "right" });
    doc.y = y + rowH;
  }

  // Total row
  {
    const y = doc.y + 4;
    doc.rect(MARGIN_L, y, CONTENT_W, rowH + 4).fill(BRAND.teal);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(10)
      .text("TOTAL (ex-GST)", MARGIN_L + 6, y + 7, { width: descW - 12 });
    doc.text(
      fmtCurrency(p.totals.totalExGst - p.totals.provisionalTotal),
      priceX + 6,
      y + 7,
      { width: CONTENT_W - descW - 12, align: "right" }
    );
    doc.fillColor(BRAND.black);
    doc.y = y + rowH + 6;
  }

  // Provisional table
  if (provGroups.length > 0) {
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.darkGrey)
      .text("TOTAL PROVISIONAL SUM", MARGIN_L, doc.y);
    doc.moveDown(0.2);
    for (const g of provGroups) {
      const y = doc.y;
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).stroke(BRAND.lightGrey);
      doc.font("Helvetica").fontSize(9).fillColor(BRAND.black)
        .text(`${g.code} · ${g.label}`, MARGIN_L + 6, y + 6, { width: descW - 12 });
      doc.text(fmtCurrency(g.total), priceX + 6, y + 6, { width: CONTENT_W - descW - 12, align: "right" });
      doc.y = y + rowH;
    }
  }

  doc.moveDown(0.6);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(BRAND.darkGrey)
    .text(
      "The above-quoted price does not include GST. Should this quotation be subject to this tax, please add 10% to the above-quoted figure.",
      MARGIN_L,
      doc.y,
      { width: CONTENT_W, align: "left" }
    );
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(8)
    .text(
      "This quote will remain valid for 30 days from the issue date or until the end of the current financial year, whichever happens first.",
      MARGIN_L,
      doc.y,
      { width: CONTENT_W }
    );
  doc.moveDown(0.3);
  const estimator = p.estimator
    ? `${p.estimator.firstName} ${p.estimator.lastName}, ${p.estimator.email}`
    : "the Initial Services estimating team";
  doc.text(
    `If you have any queries regarding this quotation, please do not hesitate to contact: ${estimator}`,
    MARGIN_L,
    doc.y,
    { width: CONTENT_W }
  );
  doc.fillColor(BRAND.black);
}

function drawScopePage(doc: Doc, p: ExportPayload) {
  doc.addPage();
  drawHeaderBand(doc);
  doc.y = MARGIN_TOP;

  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.teal).text("Scope of Works", MARGIN_L, doc.y);
  addHorizRule(doc, BRAND.teal);
  doc.fillColor(BRAND.black);

  // Preliminary Works
  doc.font("Helvetica-Bold").fontSize(10).text("Preliminary Works", MARGIN_L, doc.y);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);
  for (const bullet of PRELIMINARY_WORKS) {
    doc.text(`• ${bullet}`, MARGIN_L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.6);

  // Scope table
  const colItem = 60;
  const colQty = 50;
  const colNote = 80;
  const colDesc = CONTENT_W - colItem - colQty - colNote;
  const rowMinH = 20;

  // Header row (sticky per-page isn't available in PDFKit; we redraw at top of every page)
  const drawHead = () => {
    const y = doc.y;
    doc.rect(MARGIN_L, y, CONTENT_W, rowMinH).fill(BRAND.teal);
    doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(9);
    doc.text("Item", MARGIN_L + 6, y + 6, { width: colItem - 8 });
    doc.text("Scope of Works", MARGIN_L + colItem + 6, y + 6, { width: colDesc - 8 });
    doc.text("Qty", MARGIN_L + colItem + colDesc + 6, y + 6, { width: colQty - 8, align: "right" });
    doc.text("Note", MARGIN_L + colItem + colDesc + colQty + 6, y + 6, { width: colNote - 8 });
    doc.fillColor(BRAND.black);
    doc.y = y + rowMinH;
  };
  drawHead();

  const groupByCode = new Map<string, typeof p.items>();
  for (const item of p.items) {
    const g = groupByCode.get(item.code) ?? [];
    g.push(item);
    groupByCode.set(item.code, g);
  }

  let rowIndex = 0;
  for (const [code, rows] of groupByCode) {
    // Group header
    if (doc.y > PAGE_H - MARGIN_BOTTOM - 60) {
      doc.addPage();
      drawHeaderBand(doc);
      doc.y = MARGIN_TOP;
      drawHead();
    }
    const headY = doc.y;
    doc.rect(MARGIN_L, headY, CONTENT_W, 16).fill(BRAND.lightGrey);
    doc.fillColor(BRAND.darkGrey).font("Helvetica-Bold").fontSize(9)
      .text(`${code} — ${rows[0]?.code === "Prv" ? "Provisional Sums" : code}`, MARGIN_L + 6, headY + 4, { width: CONTENT_W - 12 });
    doc.fillColor(BRAND.black);
    doc.y = headY + 16;

    for (const item of rows) {
      if (doc.y > PAGE_H - MARGIN_BOTTOM - 30) {
        doc.addPage();
        drawHeaderBand(doc);
        doc.y = MARGIN_TOP;
        drawHead();
      }
      const desc = (item.title + (item.description ? `\n${item.description}` : "")).slice(0, 600);
      const wbs = `${item.code}-${item.itemNumber}`;
      const y = doc.y;

      const bg = rowIndex % 2 === 0 ? BRAND.white : BRAND.lightGrey;
      // Estimate row height by measuring desc text height
      const descHeight = doc.heightOfString(desc, { width: colDesc - 8 });
      const rowH = Math.max(rowMinH, descHeight + 8);
      doc.rect(MARGIN_L, y, CONTENT_W, rowH).fill(bg);
      doc.fillColor(BRAND.black).font("Helvetica").fontSize(8);
      doc.text(wbs, MARGIN_L + 6, y + 5, { width: colItem - 8 });
      doc.text(desc, MARGIN_L + colItem + 6, y + 5, { width: colDesc - 8 });
      doc.text("—", MARGIN_L + colItem + colDesc + 6, y + 5, { width: colQty - 8, align: "right" });
      doc.text("As per drawings", MARGIN_L + colItem + colDesc + colQty + 6, y + 5, { width: colNote - 8 });
      doc.y = y + rowH;
      rowIndex += 1;
    }
  }
}

function drawAssumptionsPage(doc: Doc) {
  doc.addPage();
  drawHeaderBand(doc);
  doc.y = MARGIN_TOP;

  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.teal)
    .text("Assumptions, Allowances & Terms", MARGIN_L, doc.y);
  addHorizRule(doc, BRAND.teal);
  doc.fillColor(BRAND.black);

  // Allowances box
  doc.font("Helvetica-Bold").fontSize(10).text("Project Specific Allowances", MARGIN_L, doc.y);
  doc.moveDown(0.3);
  {
    const y = doc.y;
    const boxH = doc.heightOfString(PROJECT_ALLOWANCES_TEXT, { width: CONTENT_W - 16 }) + 12;
    doc.rect(MARGIN_L, y, CONTENT_W, boxH).fill(BRAND.lightGrey);
    doc.fillColor(BRAND.black).font("Helvetica").fontSize(8.5)
      .text(PROJECT_ALLOWANCES_TEXT, MARGIN_L + 8, y + 6, { width: CONTENT_W - 16, align: "justify" });
    doc.y = y + boxH + 6;
  }

  // Assumptions box
  doc.font("Helvetica-Bold").fontSize(10).text("Project Specific Assumptions", MARGIN_L, doc.y);
  doc.moveDown(0.3);
  {
    const y = doc.y;
    const boxH = doc.heightOfString(PROJECT_ASSUMPTIONS_TEXT, { width: CONTENT_W - 16 }) + 12;
    doc.rect(MARGIN_L, y, CONTENT_W, boxH).fill(BRAND.lightGrey);
    doc.fillColor(BRAND.black).font("Helvetica").fontSize(8.5)
      .text(PROJECT_ASSUMPTIONS_TEXT, MARGIN_L + 8, y + 6, { width: CONTENT_W - 16, align: "justify" });
    doc.y = y + boxH + 10;
  }

  // T&Cs heading
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
    .text("Terms & Conditions", MARGIN_L, doc.y);
  addHorizRule(doc, BRAND.teal);
  doc.fillColor(BRAND.black);

  // Two-column layout for T&Cs
  const colW = (CONTENT_W - 16) / 2;
  const colLeftX = MARGIN_L;
  const colRightX = MARGIN_L + colW + 16;
  const colTop = doc.y;
  const colBottomLimit = PAGE_H - MARGIN_BOTTOM - 10;

  doc.font("Helvetica").fontSize(7).fillColor(BRAND.darkGrey);

  // Render into left column, overflowing to right column, overflowing to new page.
  const paragraphs = TC_TEXT.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  let inRightColumn = false;
  let currentX = colLeftX;
  doc.y = colTop;

  for (const para of paragraphs) {
    const h = doc.heightOfString(para, { width: colW });
    if (doc.y + h > colBottomLimit) {
      if (!inRightColumn) {
        inRightColumn = true;
        currentX = colRightX;
        doc.y = colTop;
      } else {
        // New page; reset both columns.
        doc.addPage();
        drawHeaderBand(doc);
        doc.y = MARGIN_TOP;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.teal)
          .text("Terms & Conditions (continued)", MARGIN_L, doc.y);
        addHorizRule(doc, BRAND.teal);
        doc.fillColor(BRAND.black).font("Helvetica").fontSize(7).fillColor(BRAND.darkGrey);
        inRightColumn = false;
        currentX = colLeftX;
      }
    }
    doc.text(para, currentX, doc.y, { width: colW, align: "justify" });
    doc.moveDown(0.3);
  }
  doc.fillColor(BRAND.black);
}

export async function buildQuotePdf(payload: ExportPayload): Promise<Buffer> {
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
      drawCoverPage(doc, payload);
      drawScopePage(doc, payload);
      drawAssumptionsPage(doc);

      // Page numbers — loop using PDFKit's internal page counter.
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
