/**
 * QUOTE_PDF_FIXES_V1 — quote-pdf-sent-date.spec.ts
 *
 * Verifies that QuotePdfService.generate() passes the quote's sentAt and
 * revision into the QuoteOverlay and the headerTemplate options.
 *
 * All external I/O is mocked; no Puppeteer process is spawned and no
 * database is needed.
 */

// ── Module-level mocks (hoisted by Jest before imports) ────────────────────

jest.mock("../../pdf-rendering/builders/quote-html.builder", () => ({
  buildQuoteHtml: jest.fn().mockReturnValue("<html></html>"),
  headerTemplate: jest.fn().mockReturnValue("<header></header>"),
  footerTemplate: jest.fn().mockReturnValue("<footer></footer>"),
}));

jest.mock("../../pdf-rendering/pdf-renderer.service", () => ({
  PdfRendererService: jest.fn().mockImplementation(() => ({
    renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-MOCK")),
  })),
}));

jest.mock("../client-quotes.service", () => ({
  ClientQuotesService: jest.fn().mockImplementation(() => ({
    summary: jest.fn().mockResolvedValue({ clientFacingTotal: 50000, lineAppropriations: [] }),
  })),
}));

jest.mock("../../estimate-export/estimate-export.service", () => ({
  EstimateExportService: jest.fn().mockImplementation(() => ({
    fetchTenderForExport: jest.fn().mockResolvedValue({
      tender: {
        id: "t-1",
        tenderNumber: "T001",
        title: "Test project",
        status: "SUBMITTED",
        value: "50000",
        dueDate: new Date(),
        createdAt: new Date(),
        ratesSnapshotAt: null,
        rateSet: null,
        estimator: { firstName: "Raj", lastName: "P", email: "r@is.net", phone: null },
        clients: [{ id: "c-1", name: "Acme Corp", contactName: "Jane", contactEmail: null, contactPhone: null }],
        scopeHeader: null,
      },
      scopeItems: [],
      cuttingItems: { sawCuts: [], coreHoles: [], otherRates: [] },
      operationalCosts: [],
      documents: [],
      assumptions: [],
      exclusions: [],
      tandc: { clauses: [{ number: "1", heading: "DEFINITIONS", body: "..." }] },
      summary: { DEM: null, ASB: null, CIV: null, WAT: null, Other: null, cutting: { itemCount: 0, subtotal: 0 }, tenderPrice: 0 },
    }),
    resolvePdfCompanyContext: jest.fn().mockResolvedValue({ tradingName: "INITIAL SERVICES" }),
  })),
  resolveLiveClauses: jest.fn((tandc: { clauses: unknown[] } | null | undefined) => tandc?.clauses ?? []),
  resolvePinnedClauses: jest.fn().mockReturnValue({ clauses: [], usedPinned: false }),
}));

// ── Imports AFTER mocks ────────────────────────────────────────────────────
import { QuotePdfService } from "../quote-pdf.service";
import { PdfRendererService } from "../../pdf-rendering/pdf-renderer.service";
import { ClientQuotesService } from "../client-quotes.service";
import { EstimateExportService } from "../../estimate-export/estimate-export.service";
import { buildQuoteHtml, headerTemplate } from "../../pdf-rendering/builders/quote-html.builder";
import type { QuoteOverlay } from "../../pdf-rendering/builders/quote-html.builder";

// ── Test data helpers ──────────────────────────────────────────────────────

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    tenderId: "t-1",
    clientId: "c-1",
    quoteRef: "IS-2609-0412",
    revision: 2,
    sentAt: new Date("2026-09-10T00:00:00.000Z"),
    status: "SENT",
    assumptionMode: "free",
    showProvisional: false,
    showCostOptions: false,
    showScopeTable: true,
    showAssumptions: true,
    showExclusions: true,
    showReferencedDrawings: true,
    detailLevel: "simple",
    issuedTermsDocumentId: null,
    issuedTerms: null,
    scopeItems: [],
    costLines: [],
    costGroups: [],
    provisionalLines: [],
    costOptions: [],
    assumptions: [],
    exclusions: [],
    ...overrides,
  };
}

function makePrisma(quote: ReturnType<typeof makeQuote>) {
  return {
    clientQuote: {
      findUnique: jest.fn().mockResolvedValue(quote),
    },
    tenderClient: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    estimateExport: {
      create: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  const CQS = ClientQuotesService as unknown as new () => InstanceType<typeof ClientQuotesService>;
  const EES = EstimateExportService as unknown as new () => InstanceType<typeof EstimateExportService>;
  const PRS = PdfRendererService as unknown as new () => InstanceType<typeof PdfRendererService>;
  return new QuotePdfService(prisma as never, new CQS(), new EES(), new PRS());
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("QUOTE_PDF_FIXES_V1 — QuotePdfService passes sentAt and revision (quote-pdf-sent-date)", () => {
  beforeEach(() => {
    (buildQuoteHtml as jest.Mock).mockClear();
    (headerTemplate as jest.Mock).mockClear();
  });

  it("passes sentAt from the quote record into the overlay", async () => {
    const sentAt = new Date("2026-09-10T00:00:00.000Z");
    const svc = makeService(makePrisma(makeQuote({ sentAt, revision: 2 })));

    await svc.generate("t-1", "q-1", "u-1");

    expect(buildQuoteHtml).toHaveBeenCalledTimes(1);
    const overlayArg = (buildQuoteHtml as jest.Mock).mock.calls[0][1] as QuoteOverlay;
    expect(overlayArg.sentAt).toEqual(sentAt);
  });

  it("passes revision from the quote record into the overlay", async () => {
    const svc = makeService(makePrisma(makeQuote({ revision: 3, sentAt: null })));

    await svc.generate("t-1", "q-1", "u-1");

    const overlayArg = (buildQuoteHtml as jest.Mock).mock.calls[0][1] as QuoteOverlay;
    expect(overlayArg.revision).toBe(3);
  });

  it("passes revision into headerTemplate options", async () => {
    const svc = makeService(makePrisma(makeQuote({ revision: 2, sentAt: new Date("2026-09-10T00:00:00.000Z") })));

    await svc.generate("t-1", "q-1", "u-1");

    expect(headerTemplate).toHaveBeenCalledTimes(1);
    const headerOptions = (headerTemplate as jest.Mock).mock.calls[0][2] as { revision?: number };
    expect(headerOptions?.revision).toBe(2);
  });

  it("passes sentAt: null for a draft quote", async () => {
    const svc = makeService(makePrisma(makeQuote({ sentAt: null, revision: 1 })));

    await svc.generate("t-1", "q-1", "u-1");

    const overlayArg = (buildQuoteHtml as jest.Mock).mock.calls[0][1] as QuoteOverlay;
    expect(overlayArg.sentAt).toBeNull();
  });
});
