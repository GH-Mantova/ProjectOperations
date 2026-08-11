import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BRAND,
} from "../../estimate-export/pdf/tc-text.const";
import { getTemplatesDir } from "../template.helpers";
import {
  headerTemplate,
  footerTemplate,
  type PdfCompanyContext,
} from "./quote-html.builder";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SorClientPdfHeader = {
  /** Human-readable document reference (e.g. "SoR H2-2026") */
  docRef: string;
  /** Prepared-for client company name */
  clientName?: string | null;
  /** Client contact name */
  contactName?: string | null;
  /** Job / project title */
  projectTitle?: string | null;
  /** Optional site address */
  siteAddress?: string | null;
  /** Prepared-by user name */
  preparedBy?: string | null;
  /** Prepared-by email */
  preparedByEmail?: string | null;
};

/**
 * A single applicable SoR rate line to include in the client PDF.
 * The caller pre-filters lines by the user's selection.
 *
 * IMPORTANT: internal margin / BMI / cost-plus columns MUST NOT be passed
 * in this type — they are deliberately absent.
 */
export type SorClientPdfLine = {
  id: string;
  category: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  name: string;
  class?: string | null;
  unit?: string | null;
  /** Ordinary rate (Decimal stringified or number) — client-visible */
  ordinary?: string | number | null;
  /** 1.5x overtime rate — Labour only */
  oneAndHalf?: string | number | null;
  /** 2x overtime rate — Labour only */
  double?: string | number | null;
  comments?: string | null;
};

// ─── Helpers (mirrored from quote-html.builder) ───────────────────────────────

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

function fmtCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function baseUrl(): string {
  return pathToFileURL(join(getTemplatesDir(), "/")).href;
}

function logoBase64(): string {
  try {
    const logoPath = join(getTemplatesDir(), "assets", "teal_sq_logo4x.png");
    return readFileSync(logoPath).toString("base64");
  } catch (err) {
    console.warn(
      "[sor-client-pdf.builder] Header logo missing — rendering without it.",
      err,
    );
    return "";
  }
}

// ─── Category display labels ──────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  LABOUR: "Labour",
  PLANT: "Plant & Equipment",
  WASTE: "Waste Disposal",
  SUBCONTRACTOR: "Subcontractors",
};

// ─── CSS (reuses the same Outfit/Syne design system as quote-html.builder) ────

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
tr.cat-header td {
  background: #E8F4F5;
  color: ${BRAND.teal};
  font-weight: 700;
  font-size: 8.5pt;
  padding: 4pt 6pt;
}

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
.tc-clause p { color: #333; text-align: justify; }

.acceptance-wrapper { break-inside: avoid; page-break-inside: avoid; }
.acceptance-header {
  background: ${BRAND.teal};
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 10pt;
  padding: 6pt 8pt;
  margin-top: 14pt;
}
.acceptance-intro { font-size: 8.5pt; margin: 8pt 0; line-height: 1.5; }
.sign-field-label { font-size: 8pt; font-weight: 700; color: ${BRAND.teal}; margin-bottom: 2pt; }
.sign-field { border-bottom: 0.6pt solid #999; height: 24pt; margin-bottom: 6pt; }
.sign-field-name { font-size: 7pt; color: #666; margin-top: 1pt; }

.disclaimers {
  font-style: italic;
  font-size: 7.5pt;
  color: #555;
  margin-top: 8pt;
  line-height: 1.5;
}
`;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function headerSection(hdr: SorClientPdfHeader): string {
  let html = `<div class="meta-grid">
  <div><span class="label">Client:</span> <span class="value">${esc(hdr.clientName ?? "—")}</span></div>
  <div><span class="label">Reference:</span> <span class="value">${esc(hdr.docRef)}</span></div>
  <div><span class="label">Attention:</span> <span class="value">${esc(hdr.contactName ?? "—")}</span></div>
  <div><span class="label">Date:</span> <span class="value">${fmtDate(new Date())}</span></div>`;

  if (hdr.projectTitle) {
    html += `
  <div><span class="label">Project:</span> <span class="value">${esc(hdr.projectTitle)}</span></div>
  <div></div>`;
  }
  if (hdr.siteAddress) {
    html += `
  <div><span class="label">Site:</span> <span class="value">${esc(hdr.siteAddress)}</span></div>
  <div></div>`;
  }
  if (hdr.preparedBy) {
    html += `
  <div><span class="label">Prepared by:</span> <span class="value">${esc(hdr.preparedBy)}${hdr.preparedByEmail ? ` — ${esc(hdr.preparedByEmail)}` : ""}</span></div>
  <div></div>`;
  }

  html += `</div>`;
  return html;
}

function rateTable(lines: SorClientPdfLine[]): string {
  if (lines.length === 0) {
    return `<p style="font-style:italic;color:#555;font-size:8.5pt;margin-top:6pt">No applicable lines selected.</p>`;
  }

  // Group by category preserving insertion order
  const grouped = new Map<string, SorClientPdfLine[]>();
  for (const line of lines) {
    const bucket = grouped.get(line.category) ?? [];
    bucket.push(line);
    grouped.set(line.category, bucket);
  }

  // Determine whether any Labour line has OT columns so we know whether to show them
  const hasLabour = grouped.has("LABOUR");

  let html = "";

  for (const [cat, catLines] of grouped) {
    const label = CATEGORY_LABEL[cat] ?? cat;
    html += `<div class="section-heading">${esc(label)}</div><div class="section-rule"></div>`;

    if (cat === "LABOUR") {
      html += `<table>
<thead><tr>
  <th style="width:34%">Position</th>
  <th style="width:16%">Class</th>
  <th class="right" style="width:16%">Ordinary ($/hr)</th>
  <th class="right" style="width:16%">1.5x ($/hr)</th>
  <th class="right" style="width:16%">2x ($/hr)</th>
</tr></thead>
<tbody>`;
      catLines.forEach((line, i) => {
        const cls = i % 2 === 1 ? ' class="alt"' : "";
        html += `<tr${cls}>
  <td>${esc(line.name)}</td>
  <td>${esc(line.class ?? "")}</td>
  <td class="right">${fmtCurrency(line.ordinary)}</td>
  <td class="right">${fmtCurrency(line.oneAndHalf)}</td>
  <td class="right">${fmtCurrency(line.double)}</td>
</tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<table>
<thead><tr>
  <th style="width:54%">Description</th>
  <th style="width:14%">Unit</th>
  <th class="right" style="width:18%">Rate</th>
  <th style="width:14%">Notes</th>
</tr></thead>
<tbody>`;
      catLines.forEach((line, i) => {
        const cls = i % 2 === 1 ? ' class="alt"' : "";
        html += `<tr${cls}>
  <td>${esc(line.name)}</td>
  <td>${esc(line.unit ?? "—")}</td>
  <td class="right">${fmtCurrency(line.ordinary)}</td>
  <td>${esc(line.comments ?? "")}</td>
</tr>`;
      });
      html += `</tbody></table>`;
    }
  }

  void hasLabour; // used indirectly via cat === "LABOUR" branch
  return html;
}

const SOR_TC_CLAUSES: Array<{ heading: string; body: string }> = [
  {
    heading: "Schedule of Rates",
    body: "This Schedule of Rates (SoR) sets out the agreed unit rates and time charges applicable to variations (VC) and agreed records / dayworks (AR) for the nominated project. Rates are exclusive of GST.",
  },
  {
    heading: "Applicable Period",
    body: "Rates in this schedule are fixed for the period shown on this document. New works commencing after expiry of this period will be priced from the then-current SoR unless otherwise agreed in writing.",
  },
  {
    heading: "Labour Rates",
    body: "Labour rates are per person per hour. Ordinary time rates apply Monday to Friday 6:30 am – 4:30 pm. 1.5x and 2x rates apply to overtime and weekend / public-holiday work respectively, as per the applicable EBA.",
  },
  {
    heading: "Plant & Equipment",
    body: "Plant and equipment rates are inclusive of operator, fuel, maintenance, and all consumables unless otherwise noted. Minimum charge periods apply as stated.",
  },
  {
    heading: "Waste Disposal",
    body: "Waste disposal rates are per tonne unless the unit column specifies otherwise. Rates cover transport and lawful disposal at a licensed facility.",
  },
  {
    heading: "Subcontractor Rates",
    body: "Subcontractor rates shown are cost-plus references only. Actual subcontractor invoices will be substantiated and may vary. Margin and management fees apply as per the Head Contract.",
  },
  {
    heading: "GST",
    body: "All rates exclude Goods and Services Tax. GST of 10% will be added to invoices unless the client holds a valid GST exemption.",
  },
  {
    heading: "Validity",
    body: "This Schedule of Rates is valid for the period indicated and for the project specified. It is not transferable to other projects without written agreement.",
  },
];

function termsSection(): string {
  let html = `<div class="section-heading" style="margin-top:12pt;text-align:center">TERMS AND CONDITIONS</div><div class="section-rule"></div>`;
  html += `<div class="tc-columns">`;
  for (const clause of SOR_TC_CLAUSES) {
    html += `<div class="tc-clause">
  <h4>${esc(clause.heading.toUpperCase())}</h4>
  <p>${esc(clause.body)}</p>
</div>`;
  }
  html += `</div>`;
  return html;
}

function signatureBlock(hdr: SorClientPdfHeader): string {
  const clientName = hdr.clientName ?? "[CLIENT COMPANY NAME]";
  let html = `<div class="acceptance-wrapper">`;
  html += `<div class="acceptance-header">ACKNOWLEDGEMENT</div>`;
  html += `<div class="acceptance-intro">By signing below, the client acknowledges receipt of this Schedule of Rates and confirms agreement to the terms set out herein for the purpose of pricing variations and agreed records on the nominated project.</div>`;
  html += `<div style="font-weight:700;font-size:9pt;margin-bottom:8pt">FOR AND ON BEHALF OF: ${esc(clientName.toUpperCase())}</div>`;
  html += `<div>`;
  const fields = ["Signature", "Full name", "Date", "Purchase order / Reference number"];
  for (const field of fields) {
    html += `<div class="sign-field"></div><div class="sign-field-name">${esc(field)}</div>`;
  }
  html += `</div>`;
  html += `<div class="disclaimers">`;
  html += `Rates are exclusive of GST. Add 10% if applicable.<br>`;
  html += `This Schedule of Rates supersedes any previously issued schedule for the nominated period and project.`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build client-facing SoR PDF HTML.
 *
 * IMPORTANT: this function MUST NOT receive or render any internal margin,
 * BMI, or cost-plus percentage columns. The caller is responsible for
 * passing only the `SorClientPdfLine` fields defined above, which
 * deliberately exclude those values.
 */
export function buildSorClientPdfHtml(
  header: SorClientPdfHeader,
  lines: SorClientPdfLine[],
): string {
  const base = baseUrl();

  let body = "";
  body += headerSection(header);
  body += `<div class="section-heading" style="margin-top:14pt">Applicable Rates</div><div class="section-rule"></div>`;
  body += rateTable(lines);
  body += `<div class="page-break"></div>`;
  body += termsSection();
  body += signatureBlock(header);

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

export { headerTemplate, footerTemplate, logoBase64, type PdfCompanyContext };
