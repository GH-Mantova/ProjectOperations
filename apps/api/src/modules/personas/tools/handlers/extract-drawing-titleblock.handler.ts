import { Injectable } from "@nestjs/common";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { SharePointFileNotFoundError } from "../../../platform/sharepoint.adapter";
import {
  DrawingToolsAccessService,
  PDFJS_STANDARD_FONT_DATA_URL,
  isLikelyValidId
} from "./drawing-tools.shared";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

type Input = { documentId?: unknown; pageNumber?: unknown };

type TitleblockResult = {
  text_layer_present: boolean;
  drawingNumber: string | null;
  title: string | null;
  scale: string | null;
  revision: string | null;
  date: string | null;
  project: string | null;
  client: string | null;
  note?: string;
};

const SCANNED_TEXT_THRESHOLD = 50;

const SCALE_RE = /\b1\s*:\s*(\d{1,5})\b/i;
const DATE_RE = /\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\b/;
const REVISION_LABEL_RE = /^(REV(ISION)?|REV\.?)$/i;
const DRAWING_NUMBER_LABEL_RE = /^(DRAWING\s*(NO\.?|NUMBER|#)?|DWG\s*(NO\.?|NUMBER|#)?)$/i;
const TITLE_LABEL_RE = /^(TITLE|DRAWING\s*TITLE)$/i;
const PROJECT_LABEL_RE = /^(PROJECT|JOB)$/i;
const CLIENT_LABEL_RE = /^(CLIENT|FOR)$/i;
const SCALE_LABEL_RE = /^SCALE$/i;
const DATE_LABEL_RE = /^DATE$/i;

// extract_drawing_titleblock — text-layer-only metadata extraction. No
// vision tokens. Returns text_layer_present flag the model uses to
// decide whether to fall back to read_tender_drawing for scanned PDFs.
@Injectable()
export class ExtractDrawingTitleblockHandler implements ToolHandler<Input> {
  name = "extract_drawing_titleblock";
  description =
    "Extract titleblock metadata from a drawing PDF (drawing number, title, scale, revision, date, project, client). Cheap text-layer extraction, no vision tokens. Returns text_layer_present flag — if false, the drawing is scanned/visual-only and you must use read_tender_drawing for any content questions including identification.";
  inputSchema = {
    type: "object" as const,
    properties: {
      documentId: {
        type: "string",
        description: "The document ID of the drawing to extract titleblock from."
      },
      pageNumber: {
        type: "integer",
        description:
          "The page number to extract titleblock from. Defaults to 1. Most architectural drawings have the titleblock on every page; use page 1 unless you have reason to believe otherwise."
      }
    },
    required: ["documentId"]
  };

  constructor(private readonly access: DrawingToolsAccessService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!isLikelyValidId(input.documentId)) {
      return errorResult("Invalid document ID format.");
    }
    if (!this.access.hasTenderDocumentsViewPermission(ctx)) {
      return errorResult("You do not have permission to view documents for this tender.");
    }
    const pageNumber = parsePageNumber(input.pageNumber);
    if (pageNumber === null) {
      return errorResult("Invalid pageNumber — must be a positive integer.");
    }

    const doc = await this.access.loadDocument(input.documentId);
    if (!doc || !doc.fileLink) {
      return errorResult("Drawing not found.");
    }
    if (doc.fileLink.mimeType !== "application/pdf") {
      // Titleblock extraction is text-layer-only; skip non-PDFs.
      return ok({
        text_layer_present: false,
        drawingNumber: null,
        title: null,
        scale: null,
        revision: null,
        date: null,
        project: null,
        client: null,
        note: "Document is not a PDF; titleblock extraction not applicable. Use read_tender_drawing to view it."
      });
    }

    let bytes: Buffer;
    try {
      bytes = await this.access.downloadFileBytes(doc.fileLink);
    } catch (err) {
      if (err instanceof SharePointFileNotFoundError) {
        return errorResult(
          "Drawing file is missing from storage. The document record exists " +
            "but the file content was not found. This may indicate the upload " +
            "did not complete or the file was removed externally."
        );
      }
      return errorResult("Failed to fetch drawing from storage.");
    }

    let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
    try {
      pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
        useSystemFonts: false,
        standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL
      }).promise;
    } catch {
      return errorResult("Failed to parse PDF. The file may be corrupt.");
    }

    if (pageNumber > pdf.numPages) {
      const total = pdf.numPages;
      await pdf.destroy();
      return errorResult(`Page ${pageNumber} does not exist in this drawing (drawing has ${total} pages).`);
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    type Item = { str: string; transform: number[] };
    const items = (text.items as Item[]).filter((i) => typeof i.str === "string");

    const totalTextLength = items.reduce((acc, i) => acc + i.str.trim().length, 0);

    if (totalTextLength < SCANNED_TEXT_THRESHOLD) {
      await pdf.destroy();
      return ok({
        text_layer_present: false,
        drawingNumber: null,
        title: null,
        scale: null,
        revision: null,
        date: null,
        project: null,
        client: null,
        note: "This drawing has no extractable text layer. It is likely scanned or image-based. Use read_tender_drawing to view its contents."
      });
    }

    // Spatial filter: titleblocks live in the bottom-right quadrant
    // (right 30% horizontal, bottom 30% vertical of page bounding box).
    // PDF coordinate system: y origin at bottom, increases upward.
    const rightThreshold = viewport.width * 0.7;
    const bottomThreshold = viewport.height * 0.3;
    const titleblockItems = items.filter((i) => {
      const x = i.transform[4] ?? 0;
      const y = i.transform[5] ?? 0;
      return x > rightThreshold && y < bottomThreshold;
    });

    const result = extractFields(titleblockItems, items);
    await pdf.destroy();
    return ok({ text_layer_present: true, ...result });
  }
}

function extractFields(
  items: Array<{ str: string; transform: number[] }>,
  allPageItems: Array<{ str: string; transform: number[] }> = items
): Omit<TitleblockResult, "text_layer_present" | "note"> {
  const cleaned = items
    .map((i) => ({ text: i.str.trim(), x: i.transform[4] ?? 0, y: i.transform[5] ?? 0 }))
    .filter((i) => i.text.length > 0);

  // Label-value pairing: for each labelled item, the value is the
  // closest item to its right or directly below (within ~50 PDF points).
  const findValueAfter = (idx: number): string | null => {
    const label = cleaned[idx]!;
    const candidates = cleaned
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i !== idx && c.text.length > 0)
      .filter(({ c }) => {
        const dx = c.x - label.x;
        const dy = label.y - c.y; // positive = below in PDF coords
        return (Math.abs(dy) < 8 && dx > 0 && dx < 200) || (Math.abs(dx) < 80 && dy > 0 && dy < 30);
      })
      .sort((a, b) => {
        const aDist = Math.hypot(a.c.x - label.x, label.y - a.c.y);
        const bDist = Math.hypot(b.c.x - label.x, label.y - b.c.y);
        return aDist - bDist;
      });
    const v = candidates[0]?.c.text;
    return v && !looksLikeLabel(v) ? v : null;
  };

  let drawingNumber: string | null = null;
  let title: string | null = null;
  let scale: string | null = null;
  let revision: string | null = null;
  let date: string | null = null;
  let project: string | null = null;
  let client: string | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const t = cleaned[i]!.text;
    if (DRAWING_NUMBER_LABEL_RE.test(t) && !drawingNumber) drawingNumber = findValueAfter(i);
    else if (TITLE_LABEL_RE.test(t) && !title) title = findValueAfter(i);
    else if (SCALE_LABEL_RE.test(t) && !scale) {
      const v = findValueAfter(i);
      scale = v ? extractScale(v) : null;
    } else if (REVISION_LABEL_RE.test(t) && !revision) revision = findValueAfter(i);
    else if (DATE_LABEL_RE.test(t) && !date) {
      const v = findValueAfter(i);
      date = v ? extractDate(v) : null;
    } else if (PROJECT_LABEL_RE.test(t) && !project) project = findValueAfter(i);
    else if (CLIENT_LABEL_RE.test(t) && !client) client = findValueAfter(i);
  }

  // Fallback regex passes over the WHOLE PAGE text for fields that
  // didn't pair via labels. Scale annotations especially can appear
  // anywhere on a drawing — a "1:50" callout near a detail isn't
  // necessarily in the titleblock quadrant.
  const fullPageText = allPageItems
    .map((i) => i.str.trim())
    .filter((s) => s.length > 0)
    .join(" ");
  if (!scale) scale = extractScale(fullPageText);
  if (!date) date = extractDate(fullPageText);

  return { drawingNumber, title, scale, revision, date, project, client };
}

function looksLikeLabel(s: string): boolean {
  return (
    DRAWING_NUMBER_LABEL_RE.test(s) ||
    TITLE_LABEL_RE.test(s) ||
    SCALE_LABEL_RE.test(s) ||
    REVISION_LABEL_RE.test(s) ||
    DATE_LABEL_RE.test(s) ||
    PROJECT_LABEL_RE.test(s) ||
    CLIENT_LABEL_RE.test(s)
  );
}

function extractScale(s: string): string | null {
  const m = SCALE_RE.exec(s);
  return m ? `1:${m[1]}` : null;
}

function extractDate(s: string): string | null {
  const m = DATE_RE.exec(s);
  return m ? m[1]! : null;
}

function parsePageNumber(value: unknown): number | null {
  if (value === undefined || value === null) return 1;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function ok(payload: TitleblockResult): ToolHandlerExecuteResult {
  return { result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } };
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return { result: { content: [{ type: "text", text: message }], isError: true } };
}
