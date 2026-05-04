import { ListTenderDrawingsHandler } from "../list-tender-drawings.handler";
import {
  looksLikeDrawingFile,
  type DrawingDocumentRow,
  type DrawingToolsAccessService
} from "../drawing-tools.shared";
import type { ToolHandlerContext } from "../../tool-handler.types";

const VALID_TENDER_ID = "cltest123tender0000abcdef";

function buildAccess(overrides: Partial<DrawingToolsAccessService> = {}) {
  const base = {
    listDrawingsForTender: jest.fn(async () => []),
    hasTenderDocumentsViewPermission: jest.fn(() => true),
    downloadFileBytes: jest.fn(async () => Buffer.from(""))
  };
  return { ...base, ...overrides } as unknown as DrawingToolsAccessService;
}

const ctx: ToolHandlerContext = {
  actor: { sub: "u-1", permissions: ["tenderdocuments.view"] } as never,
  conversationId: "conv-1",
  contextKey: VALID_TENDER_ID,
  toolUseId: "tu-1"
};

// Helper for handler-level tests that need to assert which rows make
// it through. listDrawingsForTender is the integration point that
// applies the mime-type filter, so we mock it to return whatever rows
// would have passed and let the handler shape the response.
function row(overrides: Partial<DrawingDocumentRow>): DrawingDocumentRow {
  return {
    id: "doc-default",
    tenderId: VALID_TENDER_ID,
    category: "tender",
    title: "Default",
    fileLink: {
      siteId: "s",
      driveId: "d",
      itemId: "i",
      name: "default.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024
    },
    createdAt: new Date("2026-05-04T00:00:00Z"),
    ...overrides
  };
}

describe("ListTenderDrawingsHandler", () => {
  it("rejects malformed tender IDs", async () => {
    const h = new ListTenderDrawingsHandler(buildAccess());
    const out = await h.execute({ tenderId: "abc" }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/Invalid tender ID format/);
  });

  it("rejects when actor lacks tenderdocuments.view permission", async () => {
    const access = buildAccess({
      hasTenderDocumentsViewPermission: jest.fn(() => false) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/permission/i);
  });

  it("returns 'No drawings found' when tender has zero drawings", async () => {
    const h = new ListTenderDrawingsHandler(buildAccess());
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    expect((out.result.content[0] as { text: string }).text).toBe(
      "No drawings found for this tender."
    );
  });

  it("returns surfaced internal error message on listDrawings failure", async () => {
    const access = buildAccess({
      listDrawingsForTender: jest.fn(async () => {
        throw new Error("DB down");
      }) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/internal error/i);
  });

  it("returns drawings with pageCount=null for every entry (PR #145 — page count requires per-listing PDF parse, defeats cheap-listing)", async () => {
    const access = buildAccess({
      listDrawingsForTender: jest.fn(async () => [
        row({ fileLink: { siteId: "s", driveId: "d", itemId: "i", name: "a.pdf", mimeType: "application/pdf", sizeBytes: 200 } }),
        row({ id: "doc-2", fileLink: { siteId: "s", driveId: "d", itemId: "i", name: "b.png", mimeType: "image/png", sizeBytes: 100 } })
      ]) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text) as { drawings: Array<{ pageCount: number | null }> };
    expect(parsed.drawings).toHaveLength(2);
    expect(parsed.drawings.every((d) => d.pageCount === null)).toBe(true);
  });

  // PR #145 — explicit regression for the PR #142 failure mode.
  it("includes a PDF drawing with category='tender' (PR #145 regression)", async () => {
    // PR #142 incorrectly filtered by category against an allowlist
    // [drawing, plan, demolition, ...]. Real-world tender_document_links
    // rows have category='tender' (entity-type, not document-type). This
    // test pins the behaviour: a category="tender" PDF MUST be returned.
    // Asserts at the handler-output level (the access-service mock here
    // mirrors what the real listDrawingsForTender would return after
    // applying the new mime-type filter — the unit-level test for the
    // filter logic itself lives below in "looksLikeDrawingFile").
    const access = buildAccess({
      listDrawingsForTender: jest.fn(async () => [
        row({
          id: "link-1",
          category: "tender", // ← the failure-mode value
          title: "Demo drawing",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "Pages from A1248 - Demo dwg - Marked up.pdf",
            mimeType: "application/pdf",
            sizeBytes: 419552
          }
        })
      ]) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text) as {
      drawings: Array<{ filename: string; mimeType: string }>;
    };
    expect(parsed.drawings).toHaveLength(1);
    expect(parsed.drawings[0]!.filename).toBe("Pages from A1248 - Demo dwg - Marked up.pdf");
    expect(parsed.drawings[0]!.mimeType).toBe("application/pdf");
  });
});

// PR #145 — exhaustive matrix for the mime-type + extension filter
// logic. Tests `looksLikeDrawingFile` directly because that's where
// the include/exclude decision lives. The handler test above
// exercises the integration; this matrix exercises every filter
// branch with no DB / mock plumbing.
describe("looksLikeDrawingFile (PR #145 mime-type filter)", () => {
  it.each([
    // Standard mime-type matches
    { mimeType: "application/pdf", name: "x.pdf", expected: true },
    { mimeType: "image/png", name: "x.png", expected: true },
    { mimeType: "image/jpeg", name: "x.jpg", expected: true },
    { mimeType: "image/jpeg", name: "x.jpeg", expected: true },
    // Case-insensitive mime-type
    { mimeType: "Application/PDF", name: "x.pdf", expected: true },
    // Non-drawing mime types excluded
    {
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "x.docx",
      expected: false
    },
    { mimeType: "application/vnd.ms-excel", name: "x.xlsx", expected: false },
    { mimeType: "text/plain", name: "x.txt", expected: false },
    // Extension fallback when mime-type is null/missing
    { mimeType: null, name: "x.pdf", expected: true },
    { mimeType: null, name: "x.PNG", expected: true }, // case-insensitive
    { mimeType: null, name: "x.jpg", expected: true },
    { mimeType: null, name: "x.docx", expected: false },
    // Both signals missing
    { mimeType: null, name: "x", expected: false },
    // Mime says drawing — that wins even if extension says otherwise
    { mimeType: "application/pdf", name: "noextension", expected: true }
  ])(
    "name=$name mimeType=$mimeType → included=$expected",
    ({ mimeType, name, expected }) => {
      expect(looksLikeDrawingFile({ mimeType, name })).toBe(expected);
    }
  );
});
