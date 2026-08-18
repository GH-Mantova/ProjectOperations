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

// TFM-S3/S4: Hierarchical folder structure matching the target SharePoint
// taxonomy. Each node has a `path` (the slash-separated segment path used
// when calling ensureTenderCategoryFolder), an optional `label` for the UI,
// and optional `children` for nested subfolders.
//
// `Quotes/` is a sentinel node — its children are dynamically populated from
// Tender.tenderClients at provisioning time and in the web picker.
//
// DO NOT modify this structure in S4 — S3 owns it.
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
    // Sentinel node — children are per-client and provisioned dynamically.
    path: "Quotes",
    label: "Quotes"
  }
];

// Flat list of all concrete (non-sentinel) folder paths in TENDER_FOLDER_STRUCTURE.
// Used by ensureTenderFolderStructure to walk the tree in order.
export function flattenFolderPaths(nodes: FolderNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.path);
    if (node.children) {
      result.push(...flattenFolderPaths(node.children));
    }
  }
  return result;
}

// Maps a legacy or free-form category value to the best-matching path in
// TENDER_FOLDER_STRUCTURE. Used by TenderDocumentsService when routing an
// upload from a document carrying a legacy category string.
//
// Returns a slash-separated path that ensureTenderCategoryFolder can walk.
// Falls through to "7. Other" for any value that does not match — never blank.
export function resolveUploadPath(category: string | null | undefined): string {
  if (!category) return "7. Other";
  // Already a known nested path?
  const allPaths = flattenFolderPaths(TENDER_FOLDER_STRUCTURE);
  if (allPaths.includes(category)) return category;
  // Quotes/{Client} passthrough — caller handles these separately.
  if (category.startsWith("Quotes/")) return category;
  // Legacy DOCUMENT_CATEGORIES mapping → new paths.
  const legacyMap: Record<string, string> = {
    "Tender Documents": "1. Plans, Scopes & Specs",
    "Drawings": "1. Plans, Scopes & Specs/01. Drawings",
    "Specifications": "1. Plans, Scopes & Specs/02. Specifications",
    "Bill of Quantities": "1. Plans, Scopes & Specs/03. Registers & BoQ",
    "Quotes — Subcontractor or Supplier": "4. Suppliers",
    "Submissions": "3. Estimates & Calcs",
    "Correspondence": "6. Correspondence",
    "Compliance & WHS": "5. Compliance, WHS & Asbestos",
    "Asbestos": "5. Compliance, WHS & Asbestos",
    "Site Photos": "2. Photos",
    "Other": "7. Other"
  };
  const mapped = legacyMap[category];
  if (mapped) return mapped;
  // Also try the normalised alias map (e.g. "drawings" -> "Drawings" -> mapped path)
  const normalised = normaliseDocumentCategory(category);
  return legacyMap[normalised] ?? "7. Other";
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
