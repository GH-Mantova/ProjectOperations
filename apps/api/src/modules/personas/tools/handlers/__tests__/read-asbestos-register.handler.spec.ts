import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {
  ASBESTOS_REGISTER_KEYWORDS,
  ReadAsbestosRegisterHandler,
  looksLikeAsbestosRegister
} from "../read-asbestos-register.handler";
import type { DrawingToolsAccessService } from "../drawing-tools.shared";
import type { ToolHandlerContext } from "../../tool-handler.types";

const VALID_DOC_ID = "cltest123register0000000";
const VALID_OTHER_DOC_ID = "cltest456otherregistr000";

function makeCtx(
  overrides: Partial<{
    permissions: string[];
    isSuperUser: boolean;
    contextKey: string | null;
  }> = {}
): ToolHandlerContext {
  return {
    actor: {
      sub: "u-1",
      permissions: overrides.permissions ?? ["tenderdocuments.view"],
      isSuperUser: overrides.isSuperUser ?? false
    } as never,
    conversationId: "conv-1",
    contextKey: overrides.contextKey === undefined ? "tender-1" : overrides.contextKey,
    toolUseId: "tu-1"
  };
}

type DocRow = {
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

function row(
  id: string,
  title: string,
  fileName: string,
  mimeType: string | null = "application/pdf",
  tenderId = "tender-1"
): DocRow {
  return {
    id,
    tenderId,
    category: "tender",
    title,
    fileLink: {
      siteId: "s",
      driveId: "d",
      itemId: id,
      name: fileName,
      mimeType,
      sizeBytes: 100
    },
    createdAt: new Date()
  };
}

function buildAccess(
  overrides: {
    docs?: DocRow[];
    doc?: DocRow | null;
    bytes?: Buffer | (() => Promise<Buffer> | Buffer);
    hasViewPermission?: boolean;
  } = {}
) {
  const access = {
    listDocumentsForTender: jest.fn(async () => overrides.docs ?? []),
    loadDocument: jest.fn(async (id: string) => {
      if (overrides.doc !== undefined) return overrides.doc;
      const found = (overrides.docs ?? []).find((d) => d.id === id);
      return found ?? null;
    }),
    hasTenderDocumentsViewPermission: jest.fn(
      () => overrides.hasViewPermission ?? true
    ),
    downloadFileBytes: jest.fn(async () => {
      if (typeof overrides.bytes === "function") return overrides.bytes();
      return overrides.bytes ?? Buffer.from("");
    })
  };
  return access as unknown as DrawingToolsAccessService;
}

// Synthetic PDF builder with enough text to clear the
// SCANNED_TEXT_THRESHOLD (50 chars).
function makeTextPdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(11);
    for (const line of lines) doc.text(line);
    doc.end();
  });
}

// Below-threshold PDF — exercises the scanned-PDF fallback.
function makeShortTextPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(8).text(".", 50, 50);
    doc.end();
  });
}

// Multi-page below-threshold PDF — exercises the read_tender_drawing
// hint emitted when totalPages > pagesToRender (MAX_SCANNED_PAGES_FALLBACK).
function makeMultiPageShortTextPdf(pages: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (let i = 0; i < pages; i++) {
      if (i > 0) doc.addPage();
      doc.fontSize(8).text(".", 50, 50);
    }
    doc.end();
  });
}

async function makeXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Register");
  sheet.addRow(["Ref", "Location", "Material", "Class"]);
  sheet.addRow(["ACM-01", "Plant room", "Pipe lagging", "Friable"]);
  sheet.addRow(["ACM-02", "Roof eaves", "Cement sheet", "Non-friable"]);
  // Empty row → should be skipped.
  sheet.addRow([]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

// Minimal valid DOCX. mammoth needs a real OOXML package; build one
// with exceljs-adjacent shape? Simpler: use a known-good minimal DOCX
// via JSZip — but JSZip isn't a dependency. Skip the round-trip and
// inject a Buffer; mammoth will throw on garbage, which is the
// "corrupt file" test path. For the happy-path DOCX test we mock the
// mammoth module.
jest.mock("mammoth", () => {
  const actual = jest.requireActual("mammoth") as Record<string, unknown>;
  return {
    ...actual,
    extractRawText: jest.fn(),
    __esModule: true,
    default: actual
  };
});
import * as mammothModule from "mammoth";
const mammothMock = mammothModule as unknown as { extractRawText: jest.Mock };

describe("looksLikeAsbestosRegister", () => {
  it.each(ASBESTOS_REGISTER_KEYWORDS)(
    "matches the %s keyword case-insensitively in filename",
    (kw) => {
      // Substring + uppercase letters somewhere — should still hit.
      const name = `Tender-${kw.toUpperCase()}-final.pdf`;
      expect(looksLikeAsbestosRegister({ name, title: "" })).toBe(true);
    }
  );

  it("matches against title when filename has no keywords", () => {
    expect(
      looksLikeAsbestosRegister({ name: "doc01.pdf", title: "Asbestos Register" })
    ).toBe(true);
  });

  it("rejects unrelated filenames", () => {
    expect(
      looksLikeAsbestosRegister({ name: "demolition-plan.pdf", title: "Demo plan" })
    ).toBe(false);
  });
});

describe("ReadAsbestosRegisterHandler", () => {
  beforeEach(() => {
    mammothMock.extractRawText.mockReset();
  });

  it("rejects callers without tenderdocuments.view", async () => {
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ hasViewPermission: false })
    );
    const out = await h.execute({}, makeCtx({ permissions: [] }));
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /do not have permission/
    );
  });

  it("super-users bypass the permission check", async () => {
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs: [] }));
    const out = await h.execute(
      {},
      makeCtx({ permissions: [], isSuperUser: true })
    );
    expect(out.result.isError).toBeFalsy();
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /No asbestos register/
    );
  });

  it("returns clean message when no tenderId and no contextKey", async () => {
    const h = new ReadAsbestosRegisterHandler(buildAccess());
    const out = await h.execute({}, makeCtx({ contextKey: null }));
    expect(out.result.isError).toBeFalsy();
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /No tender ID provided/
    );
  });

  it("returns non-error 'no register' message when 0 candidates match", async () => {
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Demo plan L1", "demolition-plan-L1.pdf"),
      row(VALID_OTHER_DOC_ID, "Site photos", "site-photos.zip", "application/zip")
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs }));
    const out = await h.execute({}, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/No asbestos register/);
    expect(text).toMatch(/propose_clarifications/);
  });

  it("auto-reads when exactly 1 candidate matches", async () => {
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat Report", "BGS Asbestos Register.pdf")
    ];
    const pdf = await makeTextPdf([
      "ACM-01 Plant room pipe lagging Friable Amosite Damaged 12 lm",
      "ACM-02 Roof eaves cement sheet Non-friable Chrysotile Stable 110 sqm"
    ]);
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs, bytes: pdf })
    );
    const out = await h.execute({}, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Asbestos register/);
    expect(text).toMatch(/--- Page 1 ---/);
    expect(text).toMatch(/ACM-01/);
    expect(text).toMatch(/ACM-02/);
  });

  it("returns a multi-match candidate list when 2+ candidates match", async () => {
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat Report", "BGS Asbestos Register v1.pdf"),
      row(VALID_OTHER_DOC_ID, "Updated hazmat survey", "asbestos-survey-v2.pdf"),
      row("cltest789unrelated00000a", "Other", "demolition.pdf")
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs }));
    const out = await h.execute({}, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Multiple register-like documents/);
    expect(text).toContain(VALID_DOC_ID);
    expect(text).toContain(VALID_OTHER_DOC_ID);
    // No read happened — third doc id (unrelated) should not be listed.
    expect(text).not.toContain("cltest789unrelated00000a");
  });

  it("rejects an explicit documentId that belongs to a different tender", async () => {
    const cross = row(VALID_DOC_ID, "Asbestos Register", "asbestos-register.pdf");
    cross.tenderId = "tender-OTHER";
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs: [cross], bytes: Buffer.from("not used") })
    );
    const out = await h.execute(
      { tenderId: "tender-1", documentId: VALID_DOC_ID },
      makeCtx({ contextKey: null })
    );
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /different tender/
    );
  });

  it("rejects an explicit documentId that does not exist", async () => {
    const h = new ReadAsbestosRegisterHandler(buildAccess({ doc: null }));
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/not found/);
  });

  it("extracts text + page separator for a born-digital PDF", async () => {
    const pdf = await makeTextPdf([
      "ASBESTOS REGISTER",
      "Ref Location Material Class",
      "ACM-A Plant Lagging Friable"
    ]);
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat Survey", "hazmat-survey.pdf")
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs, bytes: pdf }));
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/--- Page 1 ---/);
    expect(text).toMatch(/ACM-A/);
  });

  it("falls back to image rendering when the PDF has no text layer", async () => {
    const pdf = await makeMultiPageShortTextPdf(5);
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Scanned register", "asbestos-survey-scanned.pdf")
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs, bytes: pdf }));
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const content = out.result.content;
    // First block is the explanatory text ("scanned PDF ... falling back").
    expect(content[0]?.type).toBe("text");
    expect((content[0] as { text: string }).text).toMatch(/scanned PDF/);
    // With 5 total pages and a 3-page fallback, the model needs the hint
    // pointing it at read_tender_drawing for pages 4-5.
    expect((content[0] as { text: string }).text).toMatch(/read_tender_drawing/);
    // At least one image block follows.
    const hasImage = content.some((c) => c.type === "image");
    expect(hasImage).toBe(true);
  }, 60000);

  it("reads a single-page image register and returns one image block", async () => {
    // 1x1 red PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFklEQVR42mP8z8BQz0AEYBxVSF" +
        "+FAOMjBgPdLQGqAAAAAElFTkSuQmCC",
      "base64"
    );
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Asbestos register photo", "register-photo.png", "image/png")
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs, bytes: png }));
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const content = out.result.content;
    const images = content.filter((c) => c.type === "image");
    expect(images).toHaveLength(1);
  });

  it("reads an XLSX register and serialises sheet rows", async () => {
    const xlsx = await makeXlsx();
    const docs: DocRow[] = [
      row(
        VALID_DOC_ID,
        "Asbestos Register",
        "asbestos-register.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    ];
    const h = new ReadAsbestosRegisterHandler(buildAccess({ docs, bytes: xlsx }));
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/XLSX/);
    expect(text).toMatch(/### Sheet: Register/);
    expect(text).toContain("ACM-01");
    expect(text).toContain("Friable");
    expect(text).toContain("ACM-02");
  });

  it("reads a DOCX register via mammoth.extractRawText", async () => {
    mammothMock.extractRawText.mockResolvedValueOnce({
      value:
        "Asbestos Register\nACM-01 Plant room pipe lagging — Friable — Amosite — 12 lm",
      messages: []
    });
    const docs: DocRow[] = [
      row(
        VALID_DOC_ID,
        "Hazmat Survey",
        "hazmat-survey.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ];
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs, bytes: Buffer.from("not-real-docx") })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/DOCX/);
    expect(text).toContain("ACM-01");
    expect(mammothMock.extractRawText).toHaveBeenCalledTimes(1);
  });

  it("returns clean error on corrupt PDF bytes", async () => {
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat", "hazmat.pdf")
    ];
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs, bytes: Buffer.from("this is not a pdf") })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /corrupt/i
    );
  });

  it("returns clean error for an unsupported MIME type", async () => {
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat survey zip", "hazmat-survey.zip", "application/zip")
    ];
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs, bytes: Buffer.from("zipbytes") })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(
      /cannot be read as a register/
    );
  });

  it("truncates oversize extracted text and appends the marker", async () => {
    // Produce text that, when extracted, well exceeds 60k chars.
    const longLine = "ASBESTOS ".repeat(2000);
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) lines.push(longLine);
    const pdf = await makeTextPdf(lines);
    const docs: DocRow[] = [
      row(VALID_DOC_ID, "Hazmat", "hazmat-survey.pdf")
    ];
    const h = new ReadAsbestosRegisterHandler(
      buildAccess({ docs, bytes: pdf })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, makeCtx());
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    expect(text).toMatch(/\[truncated — showing first /);
  });
});
