import { Injectable, Logger } from "@nestjs/common";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import ExcelJS from "exceljs";
import * as mammoth from "mammoth";
import { SharePointFileNotFoundError } from "../../../platform/sharepoint.adapter";
import {
  DrawingToolsAccessService,
  PDFJS_STANDARD_FONT_DATA_URL,
  isLikelyValidId,
  type DrawingDocumentRow
} from "./drawing-tools.shared";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR G — read_asbestos_register.
//
// Read-only persona tool that auto-detects the asbestos register (or
// hazmat survey) attached to a tender and extracts its content. Used
// for the cross-reference step the system prompt mandates before any
// ASB scope item is proposed.
//
// A PDF register also surfaces in list_tender_drawings (that tool
// filters by MIME, not content). read_asbestos_register still earns
// its place: it (1) auto-detects which document IS the register by
// filename keyword so the model doesn't guess, (2) extracts the
// WHOLE text layer at once — far better than page-by-page vision for
// a tabular ACM schedule, and (3) reads XLSX and DOCX, which the
// drawing tools cannot.

type Input = { tenderId?: unknown; documentId?: unknown };

// Filename keywords (case-insensitive substring match) used to auto-
// detect a register. Matched against BOTH fileLink.name and
// TenderDocumentLink.title — uploads sometimes carry the descriptive
// label only on one side. Exported for unit testing.
export const ASBESTOS_REGISTER_KEYWORDS = [
  "asbestos register",
  "asbestos survey",
  "asbestos report",
  "hazmat",
  "hazardous material",
  "acm survey",
  "acm register",
  "division 6",
  "div 6"
] as const;

export function looksLikeAsbestosRegister(file: {
  name: string;
  title: string;
}): boolean {
  const haystack = `${file.name} ${file.title}`.toLowerCase();
  for (const kw of ASBESTOS_REGISTER_KEYWORDS) {
    if (haystack.includes(kw)) return true;
  }
  return false;
}

// Context-window protection. A 40-page hazmat survey would otherwise
// blow the conversation history. Truncate well before that point and
// tell the model how to ask for more.
const MAX_EXTRACTED_CHARS = 60_000;

// Vision fallback for scanned PDFs (no text layer): render up to the
// first N pages. Same per-page rendering shape as read_tender_drawing,
// kept local to avoid bloating drawing-tools.shared with the full
// render pipeline.
const MAX_SCANNED_PAGES_FALLBACK = 3;
const SCANNED_TEXT_THRESHOLD = 50;

// Render params copied from read-tender-drawing.handler.ts to keep
// scanned-fallback output visually consistent with the drawing tool
// the model already knows.
const MAX_LONGER_SIDE_PX = 1568;
const PDF_RENDER_SCALE = 2;
const JPEG_QUALITY = 85;

// Detection set for the per-format reader. Same MIME/extension fallback
// shape as drawing-tools.shared.looksLikeDrawingFile — null mimeType
// happens on legacy upload paths.
type RegisterFormat = "pdf" | "image" | "xlsx" | "docx" | "unknown";

function detectFormat(file: {
  mimeType: string | null;
  name: string;
}): RegisterFormat {
  const mime = file.mimeType?.toLowerCase() ?? "";
  const name = file.name.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime === "image/png" || mime === "image/jpeg" || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx")
  ) return "xlsx";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) return "docx";
  return "unknown";
}

@Injectable()
export class ReadAsbestosRegisterHandler implements ToolHandler<Input> {
  private readonly logger = new Logger(ReadAsbestosRegisterHandler.name);
  name = "read_asbestos_register";
  description =
    "Auto-detect and read the asbestos register / hazmat survey attached to a tender. Supports PDF (extracts the text layer of all pages; falls back to image rendering of the first few pages for scanned PDFs), single-page image, XLSX (serialises every sheet's rows to a readable table), and DOCX (raw text). Use this BEFORE proposing any ASB scope item to cross-reference ACM entries. If the tool reports no register is attached, raise a clarification (propose_clarifications kind=new_rfi) before proposing ASB items.";
  inputSchema = {
    type: "object" as const,
    properties: {
      tenderId: {
        type: "string",
        description:
          "Tender ID. Optional — defaults to the active tender (the chat's contextKey)."
      },
      documentId: {
        type: "string",
        description:
          "Optional. When the tender has more than one register-like document, pass the chosen document's id (returned by the multi-match list)."
      }
    },
    required: []
  };

  constructor(private readonly access: DrawingToolsAccessService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!this.access.hasTenderDocumentsViewPermission(ctx)) {
      return errorResult("You do not have permission to view documents for this tender.");
    }

    if (input.tenderId !== undefined && !isLikelyValidId(input.tenderId)) {
      return errorResult("Invalid tender ID format.");
    }
    if (input.documentId !== undefined && !isLikelyValidId(input.documentId)) {
      return errorResult("Invalid document ID format.");
    }

    const tenderId =
      typeof input.tenderId === "string" && input.tenderId.length > 0
        ? input.tenderId
        : ctx.contextKey;
    if (!tenderId) {
      // Non-error message, mirroring list_tender_clarifications. The
      // pipeline / register sub-mode has no specific tender to read for.
      return textResult(
        "No tender ID provided and no active tender context — the read_asbestos_register tool can only be used when working on a specific tender."
      );
    }

    // Resolve the target document. Two paths:
    //   (a) caller supplied documentId → load + cross-tender guard.
    //   (b) auto-detect — list the tender's documents and filter via
    //       looksLikeAsbestosRegister. 0 / 1 / 2+ outcomes diverge.
    let doc: DrawingDocumentRow;
    if (typeof input.documentId === "string" && input.documentId.length > 0) {
      const loaded = await this.access.loadDocument(input.documentId);
      if (!loaded || !loaded.fileLink) {
        return errorResult(`Document ${input.documentId} not found.`);
      }
      if (loaded.tenderId !== tenderId) {
        return errorResult(
          "The requested document belongs to a different tender than this conversation. Refusing cross-tender read."
        );
      }
      doc = loaded;
    } else {
      let docs: DrawingDocumentRow[];
      try {
        docs = await this.access.listDocumentsForTender(tenderId);
      } catch {
        return errorResult(
          "Failed to list tender documents while looking for the asbestos register. Please try again or escalate."
        );
      }
      const candidates = docs.filter(
        (d) =>
          d.fileLink !== null &&
          looksLikeAsbestosRegister({ name: d.fileLink.name, title: d.title })
      );
      if (candidates.length === 0) {
        // Valid finding, not a tool failure — mirrors
        // list_tender_drawings' "No drawings found" convention.
        return textResult(
          "No asbestos register / hazmat survey is attached to this tender. Before proposing any ASB scope item, raise a clarification via `propose_clarifications` (kind=new_rfi) asking the consultant for the asbestos register or hazardous-materials survey."
        );
      }
      if (candidates.length > 1) {
        const list = candidates
          .map((c) => {
            const link = c.fileLink!;
            return `- documentId=${c.id}  filename=${JSON.stringify(link.name)}  mimeType=${link.mimeType ?? "unknown"}`;
          })
          .join("\n");
        return textResult(
          `Multiple register-like documents attached to this tender. Call read_asbestos_register again with the chosen documentId:\n${list}`
        );
      }
      doc = candidates[0]!;
    }

    if (!doc.fileLink) {
      // listDocumentsForTender already filters to fileLink != null, but
      // narrow for TypeScript on the documentId path too.
      return errorResult("Selected document has no associated file in storage.");
    }

    const format = detectFormat({
      mimeType: doc.fileLink.mimeType,
      name: doc.fileLink.name
    });
    if (format === "unknown") {
      return errorResult(
        `This document type cannot be read as a register (detected: ${doc.fileLink.mimeType ?? "unknown"}). Supported: PDF, PNG, JPEG, XLSX, DOCX.`
      );
    }

    let bytes: Buffer;
    try {
      bytes = await this.access.downloadFileBytes(doc.fileLink);
    } catch (err) {
      if (err instanceof SharePointFileNotFoundError) {
        return errorResult(
          "Register file is missing from storage. The document record exists but the file content was not found. This may indicate the upload did not complete or the file was removed externally."
        );
      }
      this.logger.error(
        `Register download failed [doc=${doc.id}, tender=${tenderId}]: ${(err as Error).message}`
      );
      return errorResult("Failed to fetch register from storage.");
    }

    const filename = doc.fileLink.name;
    try {
      if (format === "pdf") {
        return await this.readPdf(bytes, filename, doc.id);
      }
      if (format === "image") {
        return await this.readImage(bytes, filename);
      }
      if (format === "xlsx") {
        return await this.readXlsx(bytes, filename);
      }
      // docx
      return await this.readDocx(bytes, filename);
    } catch (err) {
      this.logger.error(
        `Register read failed [doc=${doc.id}, format=${format}, tender=${tenderId}]: ${(err as Error).message}`
      );
      return errorResult(
        `Failed to read the register as ${format.toUpperCase()}. The file may be corrupt or use unsupported features.`
      );
    }
  }

  // PDF reader — text-layer first, vision fallback for scanned.
  private async readPdf(
    bytes: Buffer,
    filename: string,
    documentId: string
  ): Promise<ToolHandlerExecuteResult> {
    let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
    try {
      // isEvalSupported: false — disables eval-based JS execution path
      // in pdfjs-dist 3.x. Mitigates Dependabot alerts #14/#15 (CVE:
      // PDF.js arbitrary JavaScript execution upon opening a malicious
      // PDF). Mozilla's recommended mitigation when the version cannot
      // be upgraded. Phase 6: remove this option once pdfjs-dist is
      // bumped past 4.2.67.
      pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
        useSystemFonts: false,
        standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL
      }).promise;
    } catch {
      return errorResult("Failed to parse the register PDF. The file may be corrupt.");
    }
    const totalPages = pdf.numPages;

    type Item = { str?: unknown };
    const perPageText: string[] = [];
    let aggregateTextLength = 0;
    for (let p = 1; p <= totalPages; p++) {
      const page = await pdf.getPage(p);
      const text = await page.getTextContent();
      const pageItems = (text.items as Item[]).filter((i) => typeof i.str === "string");
      const pageStr = pageItems
        .map((i) => (i.str as string).trim())
        .filter((s) => s.length > 0)
        .join(" ");
      aggregateTextLength += pageStr.replace(/\s+/g, "").length;
      perPageText.push(pageStr);
    }

    // Scanned PDF fallback — render the first up-to-3 pages as JPEGs
    // and tell the model how to read further pages via the existing
    // drawing tool. Threshold mirrors extract-drawing-titleblock's
    // SCANNED_TEXT_THRESHOLD so behaviour is consistent.
    if (aggregateTextLength < SCANNED_TEXT_THRESHOLD) {
      const pagesToRender = Math.min(MAX_SCANNED_PAGES_FALLBACK, totalPages);
      const imageContent: Array<
        | { type: "image"; mediaType: "image/jpeg"; data: string }
        | { type: "text"; text: string }
      > = [];
      imageContent.push({
        type: "text",
        text:
          `Asbestos register: ${filename} (scanned PDF, ${totalPages} page${totalPages === 1 ? "" : "s"}). ` +
          `No text layer detected — falling back to rendered images of the first ${pagesToRender} page${pagesToRender === 1 ? "" : "s"}. ` +
          (totalPages > pagesToRender
            ? `For additional pages, call read_tender_drawing(documentId=${documentId}, pageNumber=N) where N is 1..${totalPages}.`
            : "")
      });
      for (let p = 1; p <= pagesToRender; p++) {
        const jpeg = await renderPdfPageToJpeg(pdf, p);
        imageContent.push({
          type: "image",
          mediaType: "image/jpeg",
          data: jpeg.toString("base64")
        });
        imageContent.push({ type: "text", text: `Register page ${p} of ${totalPages}.` });
      }
      await pdf.destroy();
      return { result: { content: imageContent } };
    }

    await pdf.destroy();

    // Text-layer happy path. Concatenate with page separators so the
    // model can correlate rows across pages.
    const joined = perPageText
      .map((s, i) => `--- Page ${i + 1} ---\n${s}`)
      .join("\n\n");
    const { body, truncated } = truncate(joined);
    const header = `Asbestos register: ${filename} (PDF, ${totalPages} page${totalPages === 1 ? "" : "s"}, text layer)`;
    return textResult(
      `${header}\n\n${body}${truncated ? "\n\n[truncated — showing first " + body.length + " of " + joined.length + " characters; ask for a specific section or page if you need more]" : ""}`
    );
  }

  // Single-page scanned register supplied as an image upload.
  private async readImage(
    bytes: Buffer,
    filename: string
  ): Promise<ToolHandlerExecuteResult> {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({
        width: MAX_LONGER_SIDE_PX,
        height: MAX_LONGER_SIDE_PX,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return {
      result: {
        content: [
          {
            type: "text",
            text: `Asbestos register: ${filename} (single-page image). The full register is in the image below — read each row carefully.`
          },
          {
            type: "image",
            mediaType: "image/jpeg",
            data: jpeg.toString("base64")
          }
        ]
      }
    };
  }

  // XLSX register reader — every sheet, every row, tab-delimited.
  // Empty rows skipped. exceljs.Cell.text gives the displayed string
  // for formatted cells; falls back to value for plain ones.
  private async readXlsx(
    bytes: Buffer,
    filename: string
  ): Promise<ToolHandlerExecuteResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(toArrayBuffer(bytes));
    const sheetBlocks: string[] = [];
    for (const sheet of wb.worksheets) {
      const rowStrings: string[] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const v = cell.text;
          cells.push(typeof v === "string" ? v : String(v ?? ""));
        });
        const joined = cells.join("\t").trim();
        if (joined.length > 0) rowStrings.push(joined);
      });
      if (rowStrings.length > 0) {
        sheetBlocks.push(`### Sheet: ${sheet.name}\n${rowStrings.join("\n")}`);
      }
    }
    if (sheetBlocks.length === 0) {
      return textResult(
        `Asbestos register: ${filename} (XLSX) — workbook opened successfully but every sheet was empty. Tell the user the file appears blank and ask them to re-upload.`
      );
    }
    const joined = sheetBlocks.join("\n\n");
    const { body, truncated } = truncate(joined);
    const header = `Asbestos register: ${filename} (XLSX, ${wb.worksheets.length} sheet${wb.worksheets.length === 1 ? "" : "s"})`;
    return textResult(
      `${header}\n\n${body}${truncated ? "\n\n[truncated — showing first " + body.length + " of " + joined.length + " characters; ask for a specific sheet or row range if you need more]" : ""}`
    );
  }

  private async readDocx(
    bytes: Buffer,
    filename: string
  ): Promise<ToolHandlerExecuteResult> {
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = result.value ?? "";
    if (text.replace(/\s+/g, "").length === 0) {
      return textResult(
        `Asbestos register: ${filename} (DOCX) — document opened successfully but contained no extractable text. Tell the user the file appears blank or image-only and ask them to re-upload.`
      );
    }
    const { body, truncated } = truncate(text);
    const header = `Asbestos register: ${filename} (DOCX)`;
    return textResult(
      `${header}\n\n${body}${truncated ? "\n\n[truncated — showing first " + body.length + " of " + text.length + " characters; ask for a specific section if you need more]" : ""}`
    );
  }
}

// Local copy of the PDF page render used by read_tender_drawing. Keeps
// the scanned-PDF fallback decoupled from that handler's signature; if
// the render pipeline is ever extracted into drawing-tools.shared.ts,
// both call sites can collapse onto the shared helper.
async function renderPdfPageToJpeg(
  pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>,
  pageNumber: number
): Promise<Buffer> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext("2d");
  await page.render({
    canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
    viewport
  }).promise;
  const pngBuffer = await canvas.encode("png");
  return sharp(pngBuffer)
    .resize({
      width: MAX_LONGER_SIDE_PX,
      height: MAX_LONGER_SIDE_PX,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

function truncate(text: string): { body: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) return { body: text, truncated: false };
  return { body: text.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

function toArrayBuffer(b: Buffer): ArrayBuffer {
  // exceljs.xlsx.load wants an ArrayBuffer; Node Buffers are
  // SharedArrayBuffer-backed under some conditions. Copy into a fresh
  // ArrayBuffer to keep the call site stable.
  const ab = new ArrayBuffer(b.byteLength);
  new Uint8Array(ab).set(b);
  return ab;
}

function textResult(text: string): ToolHandlerExecuteResult {
  return { result: { content: [{ type: "text", text }] } };
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return { result: { content: [{ type: "text", text: message }], isError: true } };
}
