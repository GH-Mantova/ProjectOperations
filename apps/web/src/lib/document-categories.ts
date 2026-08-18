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

// TFM-S4: Hierarchical folder structure for the upload category picker.
// Mirrors apps/api/src/modules/tender-documents/tender-document-categories.ts.
// `Quotes` is a sentinel node — its children are loaded lazily from tenderClients.
export type FolderNode = {
  path: string;
  label?: string;
  children?: FolderNode[];
};

export const TENDER_FOLDER_STRUCTURE: FolderNode[] = [
  {
    path: "1. Plans, Scopes & Specs",
    children: [
      { path: "1. Plans, Scopes & Specs/01. Drawings" },
      { path: "1. Plans, Scopes & Specs/02. Specifications" },
      { path: "1. Plans, Scopes & Specs/03. Registers & BoQ" },
      { path: "1. Plans, Scopes & Specs/04. As Builts" }
    ]
  },
  { path: "2. Photos" },
  {
    path: "3. Estimates & Calcs",
    children: [{ path: "3. Estimates & Calcs/Superseded" }]
  },
  { path: "4. Suppliers" },
  { path: "5. Compliance, WHS & Asbestos" },
  { path: "6. Correspondence" },
  { path: "7. Other" },
  {
    // Sentinel: children populated dynamically from tender.tenderClients.
    path: "Quotes",
    label: "Quotes"
  }
];
