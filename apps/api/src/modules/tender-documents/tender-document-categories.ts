// Canonical document categories used as the per-tender folder structure
// in SharePoint. Order matters — it's the display order in the upload
// dropdown and the order subfolders are created in.
//
// Adding a category: append to the array (don't reorder), then run a
// data migration to map any legacy values onto the new entry. Renaming:
// add a migration UPDATE that maps the old value to the new one *and*
// rename the folder in SharePoint (out of scope for ensureFolder, which
// only creates).
export const DOCUMENT_CATEGORIES = [
  "Tender Documents",
  "Drawings",
  "Specifications",
  "Bill of Quantities",
  "Quotes — Subcontractor or Supplier",
  "Submissions",
  "Correspondence",
  "Compliance & WHS",
  "Asbestos",
  "Site Photos",
  "Other"
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

// Maps legacy / free-form values onto the canonical list. Mirrors the
// SQL CASE in the normalise_document_categories migration so the
// runtime path and the one-shot data fix agree.
//
// "tender" is the legacy entity-type discriminator that every real
// upload landed with (see drawing-tools.shared.ts PR #145 note) — it
// gets bucketed into "Tender Documents" since that's the closest
// canonical match for a generic tender upload.
export function normaliseDocumentCategory(value: string | null | undefined): DocumentCategory {
  if (!value) return "Other";
  if (isDocumentCategory(value)) return value;
  const key = value.toLowerCase().trim();
  const aliases: Record<string, DocumentCategory> = {
    tender: "Tender Documents",
    rft: "Tender Documents",
    drawing: "Drawings",
    drawings: "Drawings",
    spec: "Specifications",
    specs: "Specifications",
    specification: "Specifications",
    specifications: "Specifications",
    boq: "Bill of Quantities",
    "bill of quantities": "Bill of Quantities",
    quote: "Quotes — Subcontractor or Supplier",
    quotes: "Quotes — Subcontractor or Supplier",
    submission: "Submissions",
    submissions: "Submissions",
    correspondence: "Correspondence",
    email: "Correspondence",
    emails: "Correspondence",
    award: "Correspondence",
    "award letter": "Correspondence",
    whs: "Compliance & WHS",
    swms: "Compliance & WHS",
    compliance: "Compliance & WHS",
    "compliance and whs": "Compliance & WHS",
    asbestos: "Asbestos",
    hazmat: "Asbestos",
    "asbestos register": "Asbestos",
    "site photos": "Site Photos",
    "site photo": "Site Photos",
    photos: "Site Photos"
  };
  return aliases[key] ?? "Other";
}
