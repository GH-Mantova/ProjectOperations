import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BRAND } from "../../estimate-export/pdf/tc-text.const";
import { getTemplatesDir } from "../../pdf-rendering/template.helpers";
import type { PdfCompanyContext } from "../../pdf-rendering/builders/quote-html.builder";

// ─── Types ─────────────────────────────────────────────────────────────────
// Shape is the subset of the FormsService `getSubmission` result the builder
// needs. Kept as a local type so the builder stays pure and testable without
// pulling in Prisma-generated types at build time.

export type SubmissionField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
};

export type SubmissionSection = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: SubmissionField[];
};

export type SubmissionValueRow = {
  fieldKey: string;
  valueText?: string | null;
  valueNumber?: { toString(): string } | number | null;
  valueBoolean?: boolean | null;
  valueDateTime?: Date | string | null;
  valueJson?: unknown;
  filePath?: string | null;
};

export type SubmissionAttachmentRow = {
  fieldKey?: string | null;
  fileName: string;
  fileUrl?: string | null;
};

export type SubmissionSignatureRow = {
  fieldKey?: string | null;
  signerName: string;
  signedAt: Date | string;
};

export type SubmissionForPdf = {
  id: string;
  status: string;
  submittedAt: Date | string | null;
  submittedBy?: { firstName: string; lastName: string } | null;
  gpsLat?: { toString(): string } | number | null;
  gpsLng?: { toString(): string } | number | null;
  templateVersion: {
    versionNumber: number;
    template: { name: string; code: string; category?: string | null };
    sections: SubmissionSection[];
  };
  values: SubmissionValueRow[];
  attachments: SubmissionAttachmentRow[];
  signatures: SubmissionSignatureRow[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateTime(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function valueOf(values: SubmissionValueRow[], fieldKey: string): unknown {
  const row = values.find((v) => v.fieldKey === fieldKey);
  if (!row) return undefined;
  if (row.valueText !== null && row.valueText !== undefined) return row.valueText;
  const num = toNum(row.valueNumber ?? null);
  if (num !== null) return num;
  if (row.valueBoolean !== null && row.valueBoolean !== undefined) return row.valueBoolean;
  if (row.valueDateTime) return row.valueDateTime;
  if (row.valueJson !== null && row.valueJson !== undefined) return row.valueJson;
  if (row.filePath) return row.filePath;
  return undefined;
}

function renderScalar(field: SubmissionField, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return `<span class="muted">—</span>`;
  }
  switch (field.fieldType) {
    case "toggle":
      return value ? "Yes" : "No";
    case "rating": {
      const n = Math.max(0, Math.min(5, Number(value) || 0));
      return "★".repeat(n) + "☆".repeat(5 - n);
    }
    case "date":
      return esc(new Date(String(value)).toLocaleDateString("en-AU"));
    case "datetime":
      return esc(fmtDateTime(String(value)));
    case "address":
      if (typeof value === "object" && value !== null) {
        const v = value as Record<string, string>;
        return esc([v.street, v.suburb, v.state, v.postcode].filter(Boolean).join(", "));
      }
      return esc(String(value));
    case "multi_select":
    case "checkbox":
      if (Array.isArray(value)) return esc(value.join(", "));
      return esc(String(value));
    case "terms": {
      if (typeof value === "object" && value !== null) {
        const v = value as { accepted?: boolean; version?: string; acceptedAt?: string };
        if (!v.accepted) return `<span class="muted">Not accepted</span>`;
        return `✓ Accepted (v${esc(v.version ?? "?")}${
          v.acceptedAt ? ` · ${esc(fmtDateTime(v.acceptedAt))}` : ""
        })`;
      }
      return esc(String(value));
    }
    case "table": {
      if (!Array.isArray(value) || value.length === 0) {
        return `<span class="muted">No rows</span>`;
      }
      const rows = value as Array<Record<string, unknown>>;
      const cols = Array.from(
        rows.reduce<Set<string>>((set, row) => {
          Object.keys(row).forEach((k) => set.add(k));
          return set;
        }, new Set())
      );
      let out = `<table class="cell-table"><thead><tr>${cols
        .map((c) => `<th>${esc(c)}</th>`)
        .join("")}</tr></thead><tbody>`;
      for (const row of rows) {
        out += `<tr>${cols
          .map((c) => {
            const cell = row[c];
            const s =
              typeof cell === "boolean"
                ? cell
                  ? "Yes"
                  : "No"
                : cell == null
                  ? "—"
                  : String(cell);
            return `<td>${esc(s)}</td>`;
          })
          .join("")}</tr>`;
      }
      return out + `</tbody></table>`;
    }
    case "signature":
      if (typeof value === "string" && value.startsWith("data:image")) {
        return `<img class="signature-img" src="${esc(value)}" alt="Signature">`;
      }
      return `<span class="muted">(signed)</span>`;
    case "photo":
    case "file":
      if (Array.isArray(value)) {
        return (value as string[])
          .map((src) =>
            src.startsWith("data:image")
              ? `<img class="photo-thumb" src="${esc(src)}" alt="">`
              : esc(src)
          )
          .join(" ");
      }
      return typeof value === "string" && value.startsWith("data:image")
        ? `<img class="photo-thumb" src="${esc(value)}" alt="">`
        : esc(String(value));
    default:
      if (Array.isArray(value)) return esc(value.join(", "));
      if (typeof value === "object") return esc(JSON.stringify(value));
      return esc(String(value));
  }
}

function logoBase64(): string {
  try {
    const logoPath = join(getTemplatesDir(), "assets", "teal_sq_logo4x.png");
    return readFileSync(logoPath).toString("base64");
  } catch {
    return "";
  }
}

function css(): string {
  return `
@page { size: A4; margin: 35mm 15mm 22mm 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  color: ${BRAND.black};
  line-height: 1.45;
}
h1, h2, h3 { color: ${BRAND.teal}; }
.watermark {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.04;
  z-index: -1;
  pointer-events: none;
}
.watermark img { width: 180pt; height: auto; }

.doc-title {
  font-size: 16pt;
  font-weight: 700;
  color: ${BRAND.teal};
  margin: 0 0 2pt 0;
}
.doc-subtitle {
  font-size: 9pt;
  color: ${BRAND.darkGrey};
  margin-bottom: 12pt;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4pt 16pt;
  font-size: 9pt;
  border: 0.5pt solid ${BRAND.lightGrey};
  padding: 8pt 10pt;
  margin-bottom: 12pt;
}
.meta-grid .label {
  color: ${BRAND.darkGrey};
  font-weight: 700;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.3pt;
}

.section-heading {
  font-size: 11pt;
  font-weight: 700;
  color: ${BRAND.teal};
  margin-top: 12pt;
  margin-bottom: 2pt;
  break-after: avoid;
}
.section-rule {
  height: 1.5pt;
  background: ${BRAND.orange};
  margin-bottom: 6pt;
}
.section-desc {
  font-size: 8.5pt;
  color: ${BRAND.darkGrey};
  margin-bottom: 6pt;
}

dl.answers {
  display: grid;
  grid-template-columns: 34% 66%;
  gap: 3pt 10pt;
  margin: 0;
}
dl.answers dt {
  font-weight: 700;
  color: ${BRAND.darkGrey};
  font-size: 8.5pt;
  padding-top: 2pt;
  border-top: 0.5pt solid ${BRAND.lightGrey};
}
dl.answers dd {
  margin: 0;
  padding-top: 2pt;
  border-top: 0.5pt solid ${BRAND.lightGrey};
  font-size: 9pt;
  break-inside: avoid;
}
.muted { color: ${BRAND.darkGrey}; font-style: italic; }

.signature-img {
  max-height: 60pt;
  border: 0.5pt solid ${BRAND.lightGrey};
  border-radius: 3pt;
  background: #fff;
}
.photo-thumb {
  max-width: 120pt;
  max-height: 120pt;
  margin: 2pt 4pt 2pt 0;
  border: 0.5pt solid ${BRAND.lightGrey};
  border-radius: 3pt;
}

.evidence-list {
  list-style: disc;
  padding-left: 16pt;
  font-size: 8.5pt;
}
.evidence-list li { margin-bottom: 1pt; }

.signatures-block {
  margin-top: 6pt;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6pt 12pt;
}
.signatures-block .item {
  border: 0.5pt solid ${BRAND.lightGrey};
  padding: 6pt 8pt;
}
.signatures-block .signer { font-weight: 700; font-size: 9pt; }
.signatures-block .when { font-size: 8pt; color: ${BRAND.darkGrey}; }

.cell-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
}
.cell-table th, .cell-table td {
  border: 0.5pt solid ${BRAND.lightGrey};
  padding: 3pt 5pt;
  text-align: left;
}
.cell-table th {
  background: ${BRAND.lightGrey};
  color: ${BRAND.darkGrey};
  font-weight: 700;
}

.footer-note {
  margin-top: 14pt;
  font-size: 7pt;
  color: ${BRAND.darkGrey};
  font-style: italic;
  line-height: 1.5;
}
`;
}

function headerTemplate(
  templateName: string,
  submissionRef: string,
  ctx: PdfCompanyContext
): string {
  const logo = logoBase64();
  return `<div style="width:100%;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="background:${BRAND.teal};color:#fff;padding:6pt 15mm 10pt 15mm;display:flex;align-items:center;gap:8pt;position:relative">
    <img src="data:image/png;base64,${logo}" style="height:28pt;width:auto">
    <span style="font-weight:700;font-size:12pt;flex:1">${esc(ctx.tradingName.toUpperCase())}</span>
    <span style="font-size:6.5pt;text-align:right;white-space:nowrap">${esc(ctx.headerRightMeta ?? "")}</span>
    <span style="position:absolute;bottom:2pt;left:50%;transform:translateX(-50%);font-weight:700;font-size:8pt">${esc(templateName)} · ${esc(submissionRef)}</span>
  </div>
  <div style="height:2pt;background:${BRAND.orange}"></div>
  <div style="text-align:right;font-size:6pt;color:#777;padding:2pt 15mm 0 15mm;line-height:1.4">Evidentiary record &nbsp;|&nbsp; Uncontrolled when printed &nbsp;|&nbsp; Printed on: <span class="date"></span></div>
</div>`;
}

function footerTemplate(ctx: PdfCompanyContext): string {
  return `<div style="width:100%;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="height:2pt;background:${BRAND.orange}"></div>
  <div style="background:${BRAND.teal};color:#fff;padding:5pt 15mm;display:flex;justify-content:space-between;align-items:center;font-size:7pt">
    <span>${esc(ctx.footerAddressLine ?? "")}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
</div>`;
}

// ─── Body sections ─────────────────────────────────────────────────────────

function metaBlock(submission: SubmissionForPdf): string {
  const submittedBy = submission.submittedBy
    ? `${submission.submittedBy.firstName} ${submission.submittedBy.lastName}`.trim()
    : "—";
  const lat = toNum(submission.gpsLat ?? null);
  const lng = toNum(submission.gpsLng ?? null);
  const gps = lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—";
  const status = submission.status.replace(/_/g, " ");
  const category = submission.templateVersion.template.category ?? "—";

  return `<div class="meta-grid">
    <div><div class="label">Submitted by</div><div>${esc(submittedBy)}</div></div>
    <div><div class="label">Submitted at</div><div>${esc(fmtDateTime(submission.submittedAt))}</div></div>
    <div><div class="label">Status</div><div>${esc(status)}</div></div>
    <div><div class="label">Category</div><div>${esc(category)}</div></div>
    <div><div class="label">Reference</div><div>${esc(submission.id)}</div></div>
    <div><div class="label">GPS</div><div>${esc(gps)}</div></div>
  </div>`;
}

function answersSections(submission: SubmissionForPdf): string {
  const skipTypes = new Set(["section_header", "divider", "instructions"]);
  const sections = [...submission.templateVersion.sections].sort(
    (a, b) => a.sectionOrder - b.sectionOrder
  );

  let html = "";
  for (const section of sections) {
    const fields = [...section.fields]
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .filter((f) => !skipTypes.has(f.fieldType));

    html += `<div class="section-heading">${esc(section.title)}</div>`;
    html += `<div class="section-rule"></div>`;
    if (section.description) {
      html += `<div class="section-desc">${esc(section.description)}</div>`;
    }
    if (fields.length === 0) {
      html += `<div class="muted">No fields.</div>`;
      continue;
    }
    html += `<dl class="answers">`;
    for (const field of fields) {
      const v = valueOf(submission.values, field.fieldKey);
      html += `<dt>${esc(field.label)}</dt><dd>${renderScalar(field, v)}</dd>`;
    }
    html += `</dl>`;
  }
  return html;
}

function evidencePack(submission: SubmissionForPdf): string {
  const attachments = submission.attachments ?? [];
  const signatures = submission.signatures ?? [];
  if (attachments.length === 0 && signatures.length === 0) return "";

  let html = "";
  if (attachments.length > 0) {
    html += `<div class="section-heading">Evidence &amp; attachments</div><div class="section-rule"></div>`;
    html += `<ul class="evidence-list">`;
    for (const a of attachments) {
      const label = a.fieldKey ? `[${esc(a.fieldKey)}] ` : "";
      const link = a.fileUrl ? ` — ${esc(a.fileUrl)}` : "";
      html += `<li>${label}${esc(a.fileName)}${link}</li>`;
    }
    html += `</ul>`;
  }

  if (signatures.length > 0) {
    html += `<div class="section-heading">Signatures</div><div class="section-rule"></div>`;
    html += `<div class="signatures-block">`;
    for (const s of signatures) {
      html += `<div class="item">
        <div class="signer">${esc(s.signerName)}</div>
        <div class="when">Signed ${esc(fmtDateTime(s.signedAt))}${
          s.fieldKey ? ` · ${esc(s.fieldKey)}` : ""
        }</div>
      </div>`;
    }
    html += `</div>`;
  }

  return html;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function buildSubmissionHtml(submission: SubmissionForPdf): string {
  const base = pathToFileURL(join(getTemplatesDir(), "/")).href;
  const templateName = submission.templateVersion.template.name;
  const version = submission.templateVersion.versionNumber;

  const body = `
    <h1 class="doc-title">${esc(templateName)}</h1>
    <div class="doc-subtitle">v${version} · Code ${esc(
      submission.templateVersion.template.code
    )}</div>
    ${metaBlock(submission)}
    ${answersSections(submission)}
    ${evidencePack(submission)}
    <div class="footer-note">
      This document is a system-generated evidentiary record of the above form submission.
      It captures the answers, signatures, evidence, GPS coordinates and timestamp recorded
      at the moment the submission was made. Any amendments made after submission are
      tracked in the underlying audit log and are not reflected in this export.
    </div>
  `;

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

export function submissionHeaderTemplate(
  templateName: string,
  submissionRef: string,
  ctx: PdfCompanyContext
): string {
  return headerTemplate(templateName, submissionRef, ctx);
}

export function submissionFooterTemplate(ctx: PdfCompanyContext): string {
  return footerTemplate(ctx);
}
