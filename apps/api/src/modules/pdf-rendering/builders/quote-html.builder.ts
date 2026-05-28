import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ExportPayload,
  ScopeRow,
} from "../../estimate-export/estimate-export.service";
import {
  DISCIPLINE_ORDER,
  DISCIPLINE_LABEL,
} from "../../estimate-export/estimate-export.service";
import {
  BRAND,
  COVER_LETTER_TEXT,
  PRELIMINARY_WORKS,
} from "../../estimate-export/pdf/tc-text.const";
import { getTemplatesDir } from "../template.helpers";

export type QuoteOverlay = {
  quoteRef: string;
  revision: number;
  assumptionMode: "free" | "linked";
  showProvisional: boolean;
  showCostOptions: boolean;
  showScopeTable?: boolean;
  showAssumptions?: boolean;
  showExclusions?: boolean;
  showReferencedDrawings?: boolean;
  clientFacingTotal: number;
  detailLevel?: "simple" | "detailed";
  scopeItems?: Array<{
    label: string | null;
    description: string;
    qty: string | null;
    unit: string | null;
    notes: string | null;
  }>;
  costLines: Array<{
    id: string;
    label: string;
    description: string;
    price: number;
    sortOrder: number;
  }>;
  provisionalLines: Array<{
    description: string;
    price: number;
    notes: string | null;
  }>;
  costOptions: Array<{
    label: string;
    description: string;
    price: number;
    notes: string | null;
  }>;
  assumptions: Array<{ text: string; costLineId: string | null }>;
  exclusions: Array<{ text: string }>;
};

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function fmtQty(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function displayMaterial(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw === "Concrete unreinforced" || raw === "Concrete reinforced")
    return "Concrete";
  if (raw === "Brick/Block") return "Masonry";
  return raw;
}

function baseUrl(): string {
  return pathToFileURL(join(getTemplatesDir(), "/")).href;
}

const ALLOWANCES_BULLETS = [
  "Standard working hours Monday to Friday 6:30am to 4:30pm unless otherwise stated",
  "All consumables, fuel, and waste disposal included in the quoted price",
  "All works to comply with relevant WHS, EPA, and Council regulations",
  "Safety signage, barriers, and exclusion zones as required",
];

// ── CSS ─────────────────────────────────────────────────────────────
function css(): string {
  return `
@font-face {
  font-family: 'Outfit';
  src: url('./assets/fonts/Outfit-Variable.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Syne';
  src: url('./assets/fonts/Syne-Variable.ttf') format('truetype');
  font-weight: 400 800;
  font-display: swap;
}

@page {
  size: A4;
  margin: 35mm 15mm 22mm 15mm;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: 9pt;
  color: ${BRAND.black};
  line-height: 1.45;
}

h1, h2, h3 {
  font-family: 'Syne', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: ${BRAND.teal};
}

.page-break { page-break-before: always; }

/* Header is rendered via Puppeteer headerTemplate — no in-body header CSS needed */

/* ── Watermark ─────────────────────────────────────── */
.watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.04;
  z-index: -1;
  pointer-events: none;
}
.watermark img { width: 180pt; height: auto; }

/* ── Two-column meta block ────────────────────────── */
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6pt 16pt;
  margin-top: 12pt;
}
.meta-grid .label {
  font-weight: 700;
  font-size: 8.5pt;
  color: ${BRAND.darkGrey};
}
.meta-grid .value { font-size: 8.5pt; }

/* ── Cover letter ──────────────────────────────────── */
.cover-letter {
  margin-top: 10pt;
  font-size: 8.5pt;
  text-align: justify;
  line-height: 1.5;
}

/* ── Section heading ───────────────────────────────── */
.section-heading {
  font-family: 'Syne', sans-serif;
  font-size: 10pt;
  font-weight: 600;
  color: ${BRAND.teal};
  margin-top: 14pt;
  margin-bottom: 2pt;
}
.section-rule {
  height: 1.5pt;
  background: ${BRAND.orange};
  margin-bottom: 6pt;
}

/* ── Tables ────────────────────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-bottom: 4pt;
}
th {
  background: ${BRAND.teal};
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  text-align: left;
  padding: 5pt 6pt;
  font-size: 8pt;
}
th.right { text-align: right; }
td { padding: 5pt 6pt; }
td.right { text-align: right; }
tr.alt td { background: ${BRAND.lightGrey}; }
tr.total td {
  background: ${BRAND.teal};
  color: #fff;
  font-weight: 700;
  font-size: 9pt;
  padding: 6pt;
}
tr.disc-header td {
  background: #E8F4F5;
  color: ${BRAND.teal};
  font-weight: 700;
  font-size: 8.5pt;
  padding: 4pt 6pt;
}
tr.cost-opt-header td {
  background: ${BRAND.lightGrey};
  color: ${BRAND.darkGrey};
  font-weight: 700;
}

/* ── Bullet lists ──────────────────────────────────── */
.bullet-list { list-style: disc; padding-left: 16pt; font-size: 8pt; }
.bullet-list li { margin-bottom: 1pt; }
.bullet-list.indent { padding-left: 24pt; }
.linked-group-label {
  font-weight: 700;
  font-size: 7.5pt;
  color: ${BRAND.darkGrey};
  margin-top: 4pt;
  margin-bottom: 1pt;
}

/* ── T&C two-column ────────────────────────────────── */
.tc-columns {
  column-count: 2;
  column-gap: 14pt;
  font-size: 6pt;
  line-height: 1.55;
}
.tc-clause { break-inside: avoid; margin-bottom: 4pt; }
.tc-clause h4 {
  font-family: 'Syne', sans-serif;
  font-size: 6.5pt;
  font-weight: 700;
  color: ${BRAND.teal};
  margin-bottom: 1pt;
}
.tc-clause p {
  color: #333;
  text-align: justify;
}

/* ── Acceptance block ──────────────────────────────── */
.acceptance-wrapper {
  break-inside: avoid;
  page-break-inside: avoid;
}
.acceptance-header {
  background: ${BRAND.teal};
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 10pt;
  padding: 6pt 8pt;
  margin-top: 14pt;
}
.acceptance-intro {
  font-size: 8.5pt;
  margin: 8pt 0;
  line-height: 1.5;
}
.sign-fields { margin-top: 6pt; }
.sign-field-label {
  font-size: 8pt;
  font-weight: 700;
  color: ${BRAND.teal};
  margin-bottom: 2pt;
}
.sign-field {
  border-bottom: 0.6pt solid #999;
  height: 24pt;
  margin-bottom: 6pt;
}
.sign-field-name { font-size: 7pt; color: #666; margin-top: 1pt; }

/* ── Contact / disclaimer ──────────────────────────── */
.contact-block {
  text-align: center;
  font-style: italic;
  font-size: 8.5pt;
  margin-top: 10pt;
}
.disclaimers {
  font-style: italic;
  font-size: 7.5pt;
  color: #555;
  margin-top: 8pt;
  line-height: 1.5;
}

/* ── Footer (Puppeteer header/footer template) ────── */
.page-footer {
  font-size: 7.5pt;
  color: #666;
}
`;
}

function logoBase64(): string {
  const logoPath = join(getTemplatesDir(), "assets", "teal_sq_logo4x.png");
  return readFileSync(logoPath).toString("base64");
}

// ── Page 1: Cover + Cost Summary ────────────────────────────────────
function coverPage(
  p: ExportPayload,
  overlay: QuoteOverlay | null,
): string {
  const quoteRef = overlay?.quoteRef ?? p.tender.tenderNumber;
  const primaryClient = p.tender.clients[0] ?? null;
  const estimator = p.tender.estimator ?? {
    firstName: "Initial",
    lastName: "Services",
    email: "admin@initialservices.net",
    phone: null,
  };
  const estimatorName =
    `${estimator.firstName} ${estimator.lastName}`.trim();

  let html = "";

  // Two-column meta
  html += `<div class="meta-grid">
  <div><span class="label">Company:</span> <span class="value">${esc(primaryClient?.name ?? "—")}</span></div>
  <div><span class="label">Quote No:</span> <span class="value">${esc(quoteRef)}</span></div>
  <div><span class="label">Attention:</span> <span class="value">${esc(primaryClient?.contactName ?? "—")}</span></div>
  <div><span class="label">Date:</span> <span class="value">${fmtDate(new Date())}</span></div>
  <div><span class="label">Phone:</span> <span class="value">${esc(primaryClient?.contactPhone ?? "—")}</span></div>
  <div><span class="label">Project:</span> <span class="value">${esc(p.tender.title)}</span></div>
  <div><span class="label">Email:</span> <span class="value">${esc(primaryClient?.contactEmail ?? "—")}</span></div>
  <div><span class="label">Estimator:</span> <span class="value">${esc(estimatorName)}</span></div>
</div>`;

  // Cover letter
  html += `<div class="cover-letter">${esc(COVER_LETTER_TEXT)}</div>`;

  // Cost Summary
  html += `<div class="section-heading">Cost Summary</div><div class="section-rule"></div>`;

  const nonProv: Array<{ code: string; label: string; amount: number }> =
    [];
  let total: number;
  if (overlay) {
    for (const line of overlay.costLines) {
      nonProv.push({
        code: line.label,
        label: line.description,
        amount: line.price,
      });
    }
    total = overlay.clientFacingTotal;
  } else {
    for (const d of DISCIPLINE_ORDER) {
      if (d === "Other") continue;
      const bucket = p.summary[d];
      if (!bucket || (bucket.itemCount === 0 && bucket.withMarkup === 0))
        continue;
      nonProv.push({
        code: d,
        label: DISCIPLINE_LABEL[d],
        amount: bucket.withMarkup,
      });
    }
    if (
      p.summary.cutting.itemCount > 0 ||
      p.summary.cutting.subtotal > 0
    ) {
      nonProv.push({
        code: "Cutting",
        label: "Concrete Cutting",
        amount: p.summary.cutting.subtotal,
      });
    }
    total = nonProv.reduce((s, r) => s + r.amount, 0);
  }

  html += `<table>
<thead><tr><th style="width:16%">SCOPE</th><th>DESCRIPTION</th><th class="right" style="width:24%">AMOUNT (EX GST)</th></tr></thead>
<tbody>`;
  nonProv.forEach((row, i) => {
    const cls = i % 2 === 1 ? ' class="alt"' : "";
    html += `<tr${cls}><td>${esc(row.code)}</td><td>${esc(row.label)}</td><td class="right">${esc(fmtCurrency(row.amount))}</td></tr>`;
  });
  html += `<tr class="total"><td>TOTAL</td><td></td><td class="right">${esc(fmtCurrency(total))}</td></tr>`;
  html += `</tbody></table>`;

  // Cost options
  if (
    overlay &&
    overlay.showCostOptions &&
    overlay.costOptions.length > 0
  ) {
    html += `<div class="section-heading" style="font-size:9pt">COST OPTIONS</div><div class="section-rule"></div>`;
    html += `<table>
<thead><tr class="cost-opt-header"><th style="width:16%">OPTION</th><th>DESCRIPTION</th><th class="right" style="width:24%">PRICE</th></tr></thead>
<tbody>`;
    overlay.costOptions.forEach((o, i) => {
      const cls = i % 2 === 1 ? ' class="alt"' : "";
      html += `<tr${cls}><td>${esc(o.label)}</td><td>${esc(o.description)}</td><td class="right">${esc(fmtCurrency(o.price))}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Provisional sums
  const provScopeItems = p.scopeItems.filter(
    (i) => i.discipline === "Other",
  );
  const useOverlayProv =
    overlay &&
    overlay.showProvisional &&
    overlay.provisionalLines.length > 0;
  const provItems = useOverlayProv
    ? overlay.provisionalLines.map((l, idx) => ({
        wbsCode: `P${idx + 1}`,
        description: l.description,
        provisionalAmount: l.price.toString(),
      }))
    : !overlay
      ? provScopeItems
      : [];

  if (provItems.length > 0) {
    html += `<div class="section-heading" style="font-size:9pt">PROVISIONAL SUMS</div><div class="section-rule"></div>`;
    html += `<table>
<thead><tr><th style="width:16%">ITEM</th><th>DESCRIPTION</th><th class="right" style="width:24%">AMOUNT (EX GST)</th></tr></thead>
<tbody>`;
    provItems.forEach((item, i) => {
      const cls = i % 2 === 1 ? ' class="alt"' : "";
      const amount = item.provisionalAmount
        ? Number(item.provisionalAmount)
        : 0;
      html += `<tr${cls}><td>${esc(item.wbsCode)}</td><td>${esc(item.description || "—")}</td><td class="right">${esc(fmtCurrency(amount))}</td></tr>`;
    });
    const provTotal = provItems.reduce(
      (s, i) =>
        s + (i.provisionalAmount ? Number(i.provisionalAmount) : 0),
      0,
    );
    html += `<tr class="total"><td colspan="2">TOTAL PROVISIONAL SUM</td><td class="right">${esc(fmtCurrency(provTotal))}</td></tr>`;
    html += `</tbody></table>`;
  }

  // Contact block
  if (estimator) {
    let contactLine: string;
    if (estimator.phone && estimator.email) {
      contactLine = `${estimatorName} on ${estimator.phone} or ${estimator.email}`;
    } else if (estimator.email) {
      contactLine = `${estimatorName} at ${estimator.email}`;
    } else if (estimator.phone) {
      contactLine = `${estimatorName} on ${estimator.phone}`;
    } else {
      contactLine = estimatorName;
    }
    html += `<div class="contact-block">
  If you have any queries regarding this quotation, please do not hesitate to contact:<br>
  ${esc(contactLine)}
</div>`;
  }

  // Disclaimers
  html += `<div class="disclaimers">
  All prices exclude GST. Add 10% if applicable.<br>
  This quote is valid for 30 days from the date of issue or the end of the current financial year, whichever is first.<br>
  Payment terms: 25 days from date of invoice (BIFA compliant).
</div>`;

  return html;
}

// ── Scope of Works section (flows after cover page — no forced page break) ──
function scopeSection(
  p: ExportPayload,
  overlay: QuoteOverlay | null,
): string {
  let html = "";

  // Preliminary works
  html += `<div class="section-heading">Preliminary Works</div>`;
  html += `<ul class="bullet-list">`;
  for (const bullet of PRELIMINARY_WORKS) {
    html += `<li>${esc(bullet)}</li>`;
  }
  html += `</ul>`;

  // Referenced drawings
  const showRefDrawings =
    !overlay || overlay.showReferencedDrawings !== false;
  if (showRefDrawings && p.documents.length > 0) {
    html += `<div class="section-heading" style="font-size:8.5pt;margin-top:10pt">Referenced Drawings and Documents</div>`;
    html += `<ul class="bullet-list">`;
    for (const d of p.documents) {
      html += `<li>${esc(d.name)}</li>`;
    }
    html += `</ul>`;
  }

  // Scope table visibility
  if (overlay && overlay.showScopeTable === false) return html;
  if (overlay && overlay.detailLevel === "simple") return html;

  // Detailed quote scope items
  if (
    overlay &&
    overlay.detailLevel === "detailed" &&
    overlay.scopeItems &&
    overlay.scopeItems.length > 0
  ) {
    html += `<div class="section-heading">Scope of Works</div><div class="section-rule"></div>`;
    html += `<table>
<thead><tr><th style="width:10%">ITEM</th><th style="width:52%">SCOPE OF WORKS</th><th class="right" style="width:10%">QTY</th><th style="width:9%">UNIT</th><th>NOTES</th></tr></thead>
<tbody>`;
    overlay.scopeItems.forEach((row, i) => {
      const cls = i % 2 === 1 ? ' class="alt"' : "";
      html += `<tr${cls}><td>${esc(row.label ?? "—")}</td><td>${esc(row.description)}</td><td class="right">${esc(row.qty ?? "—")}</td><td>${esc(row.unit ?? "—")}</td><td>${esc(row.notes ?? "")}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }

  // Default: tender-level scope grouped by discipline
  html += `<div class="section-heading">Scope of Works</div><div class="section-rule"></div>`;
  html += `<table>
<thead><tr><th style="width:10%">ITEM</th><th style="width:50%">SCOPE OF WORKS</th><th class="right" style="width:10%">QTY</th><th style="width:10%">UNIT</th><th>NOTE</th></tr></thead>
<tbody>`;

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
    html += `<tr class="disc-header"><td colspan="5">${esc(disc)} · ${esc(DISCIPLINE_LABEL[disc])}</td></tr>`;
    for (const item of rows) {
      const cls = rowIdx % 2 === 1 ? ' class="alt"' : "";
      const desc = (item.description || "—").slice(0, 500);
      const note =
        (item.notes ?? "").slice(0, 60) || "As per scope";
      html += `<tr${cls}><td>${esc(item.wbsCode)}</td><td>${esc(desc)}</td><td class="right">${esc(fmtQty(item.measurementQty))}</td><td>${esc(item.measurementUnit ?? "—")}</td><td>${esc(note)}</td></tr>`;
      rowIdx++;
    }
  }

  // Cutting items
  const hasCutting =
    p.cuttingItems.sawCuts.length > 0 ||
    p.cuttingItems.coreHoles.length > 0 ||
    p.cuttingItems.otherRates.length > 0;
  if (hasCutting) {
    html += `<tr class="disc-header"><td colspan="5">Concrete Cutting</td></tr>`;
    const cutSeq = new Map<string, number>();
    const holeSeq = new Map<string, number>();
    const otherSeq = new Map<string, number>();
    const nextRef = (
      map: Map<string, number>,
      wbs: string,
      prefix: string,
    ): string => {
      const n = (map.get(wbs) ?? 0) + 1;
      map.set(wbs, n);
      return `${wbs}-${prefix}${n}`;
    };

    let ci = 0;
    for (const c of p.cuttingItems.sawCuts) {
      const cls = ci % 2 === 1 ? ' class="alt"' : "";
      const material = displayMaterial(c.material);
      const parts: string[] = [];
      if (c.equipment) parts.push(`${c.equipment} cut`);
      if (material) parts.push(material);
      if (c.depthMm) parts.push(`${c.depthMm}mm`);
      const assembled = parts.join(" — ");
      const desc = c.description?.trim() || assembled || "Saw cut";
      html += `<tr${cls}><td>${esc(nextRef(cutSeq, c.wbsRef, "C"))}</td><td>${esc(desc)}</td><td class="right">${esc(fmtQty(c.quantityLm))}</td><td>Lm</td><td>${esc(c.notes?.slice(0, 60) ?? "")}</td></tr>`;
      ci++;
    }
    for (const c of p.cuttingItems.coreHoles) {
      const cls = ci % 2 === 1 ? ' class="alt"' : "";
      const desc =
        c.description?.trim() ||
        `Ø${c.diameterMm ?? "?"}mm core hole`;
      const qty = c.isPOA ? "POA" : fmtQty(c.quantityEach);
      html += `<tr${cls}><td>${esc(nextRef(holeSeq, c.wbsRef, "H"))}</td><td>${esc(desc)}</td><td class="right">${esc(qty)}</td><td>ea</td><td>${esc(c.notes?.slice(0, 60) ?? "")}</td></tr>`;
      ci++;
    }
    for (const c of p.cuttingItems.otherRates) {
      const cls = ci % 2 === 1 ? ' class="alt"' : "";
      const desc = c.otherRate?.description || c.description || "Other";
      const unit = c.otherRate?.unit || "ea";
      html += `<tr${cls}><td>${esc(nextRef(otherSeq, c.wbsRef, "O"))}</td><td>${esc(desc)}</td><td class="right">${esc(fmtQty(c.quantityEach))}</td><td>${esc(unit)}</td><td>${esc(c.notes?.slice(0, 60) ?? "")}</td></tr>`;
      ci++;
    }
  }

  html += `</tbody></table>`;

  if (p.scopeItems.length === 0 && !hasCutting) {
    html += `<p style="font-style:italic;color:#555;font-size:8.5pt;margin-top:6pt">No scope items recorded for this tender.</p>`;
  }

  // Site details
  if (p.tender.scopeHeader) {
    const sh = p.tender.scopeHeader;
    if (sh.siteAddress || sh.proposedStartDate || sh.durationWeeks) {
      html += `<div class="section-heading" style="font-size:8.5pt;margin-top:10pt">Site details</div>`;
      if (sh.siteAddress)
        html += `<p style="font-size:8.5pt">Site Address: ${esc(sh.siteAddress)}</p>`;
      if (sh.proposedStartDate)
        html += `<p style="font-size:8.5pt">Proposed Start: ${fmtDate(sh.proposedStartDate)}</p>`;
      if (sh.durationWeeks)
        html += `<p style="font-size:8.5pt">Duration: ${sh.durationWeeks} weeks</p>`;
    }
  }

  return html;
}

// ── Page 3: Assumptions + Exclusions + T&C ──────────────────────────
function assumptionsPage(
  p: ExportPayload,
  overlay: QuoteOverlay | null,
): string {
  let html = `<div class="page-break"></div>`;

  // Allowances
  html += `<div class="section-heading">PROJECT SPECIFIC ALLOWANCES</div><div class="section-rule"></div>`;
  html += `<p style="font-size:8pt;margin-bottom:3pt">The following allowances have been included in this quotation:</p>`;
  html += `<ul class="bullet-list">`;
  for (const line of ALLOWANCES_BULLETS) {
    html += `<li>${esc(line)}</li>`;
  }
  html += `</ul>`;

  // Assumptions
  const assumptionsToggleOn =
    !overlay || overlay.showAssumptions !== false;
  const quoteAssumptions = overlay?.assumptions ?? [];
  const hasOverlayAssumptions = quoteAssumptions.length > 0;
  const showAssumptions =
    assumptionsToggleOn &&
    (hasOverlayAssumptions ||
      (!overlay && p.assumptions.length > 0));

  if (showAssumptions) {
    html += `<div class="section-heading" style="margin-top:10pt">PROJECT SPECIFIC ASSUMPTIONS</div><div class="section-rule"></div>`;

    if (overlay && overlay.assumptionMode === "linked") {
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
        html += `<div class="linked-group-label">— Item ${esc(line.label)}</div>`;
        html += `<ul class="bullet-list indent">`;
        for (const t of items) {
          html += `<li>${esc(t)}</li>`;
        }
        html += `</ul>`;
      }
      const freeForm = byLine.get(null);
      if (freeForm && freeForm.length > 0) {
        html += `<div class="linked-group-label">— General</div>`;
        html += `<ul class="bullet-list indent">`;
        for (const t of freeForm) {
          html += `<li>${esc(t)}</li>`;
        }
        html += `</ul>`;
      }
    } else {
      const items = hasOverlayAssumptions
        ? quoteAssumptions.map((a) => a.text)
        : p.assumptions.map((a) => a.text);
      html += `<ul class="bullet-list">`;
      for (const t of items) {
        html += `<li>${esc(t)}</li>`;
      }
      html += `</ul>`;
    }
  }

  // Exclusions
  const exclusionsToggleOn =
    !overlay || overlay.showExclusions !== false;
  const exclusions =
    overlay && overlay.exclusions.length > 0
      ? overlay.exclusions.map((e) => e.text)
      : !overlay
        ? p.exclusions.map((e) => e.text)
        : [];

  if (exclusionsToggleOn && exclusions.length > 0) {
    html += `<div class="section-heading" style="margin-top:10pt">PROJECT SPECIFIC EXCLUSIONS</div><div class="section-rule"></div>`;
    html += `<ul class="bullet-list">`;
    for (const t of exclusions) {
      html += `<li>${esc(t)}</li>`;
    }
    html += `</ul>`;
  }

  // Terms & Conditions
  html += `<div class="section-heading" style="margin-top:12pt;text-align:center">TERMS AND CONDITIONS</div><div class="section-rule"></div>`;
  html += `<div class="tc-columns">`;
  for (const clause of p.tandc.clauses) {
    html += `<div class="tc-clause">
  <h4>${esc(clause.number)}. ${esc(clause.heading.toUpperCase())}</h4>
  <p>${esc(clause.body)}</p>
</div>`;
  }
  html += `</div>`;

  return html;
}

// ── Acceptance block ────────────────────────────────────────────────
function acceptanceBlock(p: ExportPayload): string {
  const clientName =
    p.tender.clients[0]?.name ?? "[CLIENT COMPANY NAME]";
  let html = `<div class="acceptance-wrapper">`;
  html += `<div class="acceptance-header">ACCEPTANCE</div>`;
  html += `<div class="acceptance-intro">By signing below, the client acknowledges they have read, understood and agree to the Terms and Conditions of this quotation.</div>`;
  html += `<div class="sign-field-label">FOR AND ON BEHALF OF:</div>`;
  html += `<div style="font-weight:700;font-size:9pt;margin-bottom:8pt">${esc(clientName.toUpperCase())}</div>`;
  html += `<div class="sign-fields">`;
  const fields = [
    "Signature",
    "Full name",
    "Date",
    "Purchase order / Reference number",
  ];
  for (const f of fields) {
    html += `<div class="sign-field"></div><div class="sign-field-name">${esc(f)}</div>`;
  }
  html += `</div>`;
  html += `</div>`; // close .acceptance-wrapper
  return html;
}

// ── Puppeteer header/footer templates ───────────────────────────────
function headerTemplate(quoteRef: string): string {
  const logo = logoBase64();
  return `<div style="width:100%;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="background:${BRAND.teal};color:#fff;padding:6pt 15mm 10pt 15mm;display:flex;align-items:center;gap:8pt;position:relative">
    <img src="data:image/png;base64,${logo}" style="height:28pt;width:auto">
    <span style="font-weight:700;font-size:12pt;flex:1">INITIAL SERVICES</span>
    <span style="font-size:6.5pt;text-align:right;white-space:nowrap">Demolition Licence: 2328018 | Class A Asbestos Licence: 2320431</span>
    <span style="position:absolute;bottom:2pt;left:50%;transform:translateX(-50%);font-weight:700;font-size:8pt">Quote No. ${esc(quoteRef)}</span>
  </div>
  <div style="height:2pt;background:${BRAND.orange}"></div>
  <div style="text-align:right;font-size:6pt;color:#777;padding:2pt 15mm 0 15mm;line-height:1.4">Electronic document &nbsp;|&nbsp; Uncontrolled when printed &nbsp;|&nbsp; Printed on: <span class="date"></span></div>
</div>`;
}

function footerTemplate(): string {
  return `<div style="width:100%;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="height:2pt;background:${BRAND.orange}"></div>
  <div style="background:${BRAND.teal};color:#fff;padding:5pt 15mm;display:flex;justify-content:space-between;align-items:center;font-size:7pt">
    <span>10 Grice St, Clontarf Q 4019 | P: (07) 3888 0539 | E: admin@initialservices.net | A.B.N: 75 631 222 556</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
</div>`;
}

// ── Main build function ─────────────────────────────────────────────
export function buildQuoteHtml(
  payload: ExportPayload,
  overlay: QuoteOverlay | null = null,
): string {
  const base = baseUrl();
  const quoteRef =
    overlay?.quoteRef ?? payload.tender.tenderNumber;

  let body = "";
  body += coverPage(payload, overlay);
  body += scopeSection(payload, overlay);
  body += assumptionsPage(payload, overlay);
  body += acceptanceBlock(payload);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<base href="${base}">
<style>${css()}</style>
</head>
<body>
<div class="watermark"><img src="./assets/teal_sq_logo4x.png" alt=""></div>
${body}
</body>
</html>`;
}

export { headerTemplate, footerTemplate };
