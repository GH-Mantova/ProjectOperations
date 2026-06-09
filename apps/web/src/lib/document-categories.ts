// Mirror of apps/api/src/modules/tender-documents/tender-document-categories.ts.
// Duplicated rather than imported so the API source isn't pulled into the
// web bundle. Keep in sync with the API copy.
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

export const DEFAULT_DOCUMENT_CATEGORY: DocumentCategory = "Other";
