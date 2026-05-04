import { Injectable, Logger } from "@nestjs/common";
import * as path from "node:path";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SharePointService } from "../../../platform/sharepoint.service";
import type { ToolHandlerContext } from "../tool-handler.types";

// Resolve pdfjs-dist's bundled standard-fonts directory once at module
// load. pdfjs needs this to decode text for standard PDF fonts
// (Helvetica, Times, Courier — anything pdfkit-style writers don't
// embed). Without it, text-layer extraction silently returns zero
// items and titleblocks read as scanned. Use file:// URL with
// trailing slash per pdfjs API contract.
const PDFJS_PKG_DIR = path.dirname(require.resolve("pdfjs-dist/package.json"));
export const PDFJS_STANDARD_FONT_DATA_URL =
  "file://" + path.join(PDFJS_PKG_DIR, "standard_fonts").replace(/\\/g, "/") + "/";

// Renderable drawing mime-types — what list_tender_drawings considers
// a "drawing" AND what read_tender_drawing can pass through to vision
// (PDF rasterised via pdfjs-dist + sharp; PNG/JPEG normalised through
// sharp). Single source of truth across both handlers.
//
// PR #145 pivoted from filtering by tender_document_links.category to
// filtering by mime-type. PR #142's CHECK 0.3 misread the category
// field semantics: it describes what the document is LINKED TO
// (tender / project / job), not what TYPE of document it is. Real
// uploaded drawings have category="tender" and were silently excluded
// by the old allowlist. Filtering by mime-type aligns the listing tool
// with what read_tender_drawing can actually render and decouples
// from upload-time category tagging.
export const DRAWING_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

// Extension fallback for documents missing a mime_type. Some upload
// paths leave the column null (older browsers, drag-and-drop from
// non-standard sources, paths that don't sniff content-type). Excluding
// these would silently drop legitimate drawings due to upstream data
// hygiene issues. Matched case-insensitively.
export const DRAWING_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

// MIME types read_tender_drawing can render. Same set as
// DRAWING_MIME_TYPES today; kept as a separate export for
// read_tender_drawing's per-handler check (PR #142 contract: "this
// document type cannot be rendered" surfacing the detected mime back
// to the model).
export const RENDERABLE_MIME_TYPES = DRAWING_MIME_TYPES;

export function looksLikeDrawingFile(file: {
  mimeType: string | null;
  name: string;
}): boolean {
  const mime = file.mimeType?.toLowerCase() ?? null;
  if (mime && DRAWING_MIME_TYPES.has(mime)) return true;
  const lowerName = file.name.toLowerCase();
  for (const ext of DRAWING_EXTENSIONS) {
    if (lowerName.endsWith(ext)) return true;
  }
  return false;
}

export type DrawingDocumentRow = {
  id: string;
  tenderId: string;
  category: string;
  title: string;
  fileLink: {
    siteId: string;
    driveId: string;
    itemId: string;
    name: string;
    mimeType: string | null;
    sizeBytes: number | null;
  } | null;
  createdAt: Date;
};

// Minimal cuid validation — Prisma uses cuid2 which is 24 chars [a-z0-9]
// starting with 'c'. Reject obvious garbage early so we don't make a
// pointless DB roundtrip. Real-world id length varies (legacy cuid is
// 25 chars). Accept anything 8-40 chars of [a-z0-9-_].
const ID_RE = /^[a-z0-9_-]{8,40}$/i;

export function isLikelyValidId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

@Injectable()
export class DrawingToolsAccessService {
  private readonly logger = new Logger(DrawingToolsAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sharepoint: SharePointService
  ) {}

  // Load all drawing-mime-type TenderDocumentLink rows for a tender,
  // joined with their SharePointFileLink. Filters by mime-type
  // (PDF/PNG/JPEG) with extension fallback for null-mime cases.
  // Excludes folder-only links (no fileLink) — drawings are always
  // file-backed.
  //
  // PR #145 — see DRAWING_MIME_TYPES doc for why this used to be a
  // category filter and isn't any more.
  async listDrawingsForTender(tenderId: string): Promise<DrawingDocumentRow[]> {
    const rows = await this.prisma.tenderDocumentLink.findMany({
      where: { tenderId, fileLink: { isNot: null } },
      include: { fileLink: true },
      orderBy: { createdAt: "desc" }
    });
    return rows
      .filter(
        (r) =>
          r.fileLink !== null &&
          looksLikeDrawingFile({
            mimeType: r.fileLink.mimeType,
            name: r.fileLink.name
          })
      )
      .map((r) => ({
        id: r.id,
        tenderId: r.tenderId,
        category: r.category,
        title: r.title,
        fileLink: r.fileLink
          ? {
              siteId: r.fileLink.siteId,
              driveId: r.fileLink.driveId,
              itemId: r.fileLink.itemId,
              name: r.fileLink.name,
              mimeType: r.fileLink.mimeType,
              sizeBytes: r.fileLink.sizeBytes
            }
          : null,
        createdAt: r.createdAt
      }));
  }

  async loadDocument(documentId: string): Promise<DrawingDocumentRow | null> {
    const row = await this.prisma.tenderDocumentLink.findUnique({
      where: { id: documentId },
      include: { fileLink: true }
    });
    if (!row) return null;
    return {
      id: row.id,
      tenderId: row.tenderId,
      category: row.category,
      title: row.title,
      fileLink: row.fileLink
        ? {
            siteId: row.fileLink.siteId,
            driveId: row.fileLink.driveId,
            itemId: row.fileLink.itemId,
            name: row.fileLink.name,
            mimeType: row.fileLink.mimeType,
            sizeBytes: row.fileLink.sizeBytes
          }
        : null,
      createdAt: row.createdAt
    };
  }

  // Two-layer permission: persona is gated by ai.persona.tendering at
  // the chat endpoint; data access here is gated by tenderdocuments.view
  // (matches the existing /api/v1/tender-documents endpoints). Super
  // Users bypass.
  hasTenderDocumentsViewPermission(ctx: ToolHandlerContext): boolean {
    const actor = ctx.actor as { permissions?: string[]; isSuperUser?: boolean };
    if (actor.isSuperUser) return true;
    return Array.isArray(actor.permissions) && actor.permissions.includes("tenderdocuments.view");
  }

  // Fetch raw file bytes from SharePoint via the configured adapter.
  // PR #146 — routed through SharePointService.downloadFileBytes
  // (added in #146) instead of the previous getDownloadUrl + fetch
  // round-trip. The previous path failed silently against the mock
  // adapter (which returned a fake unreachable URL) and against any
  // adapter that doesn't pre-sign download URLs. Bubbles
  // SharePointFileNotFoundError up so handlers can produce a
  // specific user-facing message.
  async downloadFileBytes(file: {
    siteId: string;
    driveId: string;
    itemId: string;
  }): Promise<Buffer> {
    return this.sharepoint.downloadFileBytes({
      siteId: file.siteId,
      driveId: file.driveId,
      fileId: file.itemId
    });
  }
}
