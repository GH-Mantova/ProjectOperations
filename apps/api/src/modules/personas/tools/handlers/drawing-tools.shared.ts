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

// Document categories conventionally used for drawings on
// TenderDocumentLink. The seed and historical uploads have been
// inconsistent (some 'drawing', some 'plan', some 'demolition'),
// so we filter case-insensitively against this set rather than a
// strict equality check.
export const DRAWING_CATEGORIES = new Set([
  "drawing",
  "drawings",
  "plan",
  "plans",
  "demolition",
  "demolition-plan",
  "demolition-plans",
  "architectural"
]);

// MIME types we can render. Anything else returns the
// "unsupported file type" error from read_tender_drawing.
export const RENDERABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

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

  // Load all drawing-category TenderDocumentLink rows for a tender,
  // joined with their SharePointFileLink. Filters out non-drawing
  // categories case-insensitively. Permission check stays at the
  // controller level for HTTP requests; tool handlers re-check via
  // assertActorCanViewTenderDocuments below.
  async listDrawingsForTender(tenderId: string): Promise<DrawingDocumentRow[]> {
    const rows = await this.prisma.tenderDocumentLink.findMany({
      where: { tenderId },
      include: { fileLink: true },
      orderBy: { createdAt: "desc" }
    });
    return rows
      .filter((r) => DRAWING_CATEGORIES.has(r.category.toLowerCase()))
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
  // Mock adapter doesn't have real bytes — handler tests mock this
  // method. Live adapter resolves the SharePoint download URL and
  // streams it into a Buffer.
  async downloadFileBytes(file: {
    siteId: string;
    driveId: string;
    itemId: string;
  }): Promise<Buffer> {
    const url = await this.sharepoint.getDownloadUrl({
      siteId: file.siteId,
      driveId: file.driveId,
      fileId: file.itemId
    });
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`SharePoint download failed: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
