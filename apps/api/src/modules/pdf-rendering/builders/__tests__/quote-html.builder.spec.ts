import { Test } from "@nestjs/testing";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import {
  buildQuoteHtml,
  headerTemplate,
  footerTemplate,
  type QuoteOverlay,
} from "../quote-html.builder";
import { PdfRendererService } from "../../pdf-renderer.service";
import type { ExportPayload } from "../../../estimate-export/estimate-export.service";
import { parseDefaultClauses } from "../../../quote/tc-parser";

function basePayload(
  partial: Partial<ExportPayload> = {},
): ExportPayload {
  return {
    tender: {
      id: "t-1",
      tenderNumber: "IS-T020",
      title: "Demo Demolition Project",
      status: "SUBMITTED",
      value: "50000",
      dueDate: new Date("2026-06-15"),
      createdAt: new Date("2026-05-01"),
      ratesSnapshotAt: null,
      estimator: {
        firstName: "Raj",
        lastName: "Pudasaini",
        email: "raj@initialservices.net",
        phone: "0400 123 456",
      },
      clients: [
        {
          id: "c-1",
          name: "Acme Construction",
          contactName: "Jane Doe",
          contactEmail: "jane@acme.com",
          contactPhone: "07 3000 1234",
        },
      ],
      scopeHeader: {
        siteAddress: "123 Main St, Brisbane QLD 4000",
        siteContactName: "Bob",
        siteContactPhone: "0412 345 678",
        proposedStartDate: new Date("2026-07-01"),
        durationWeeks: 4,
      },
    },
    scopeItems: [
      {
        id: "s-1",
        wbsCode: "DEM1",
        discipline: "DEM",
        rowType: "demolition",
        description: "Strip out level 1 internals",
        men: "4",
        days: "3",
        shift: "Day",
        measurementQty: "200",
        measurementUnit: "m²",
        material: null,
        wasteType: "Mixed C&D",
        wasteFacility: "Nudgee",
        wasteTonnes: "10",
        wasteLoads: 2,
        provisionalAmount: null,
        notes: "Standard strip",
        sortOrder: 0,
      },
    ],
    cuttingItems: { sawCuts: [], coreHoles: [], otherRates: [] },
    documents: [{ id: "d-1", name: "Site Plan Rev A.pdf" }],
    assumptions: [{ text: "Access via loading dock" }],
    exclusions: [{ text: "Asbestos removal" }],
    tandc: { clauses: parseDefaultClauses() },
    summary: {
      DEM: { itemCount: 1, subtotal: 10000, withMarkup: 13000 },
      CIV: { itemCount: 0, subtotal: 0, withMarkup: 0 },
      ASB: { itemCount: 0, subtotal: 0, withMarkup: 0 },
      Other: { itemCount: 0, subtotal: 0, withMarkup: 0 },
      cutting: { itemCount: 0, subtotal: 0 },
      tenderPrice: 13000,
    },
    ...partial,
  };
}

function makeOverlay(
  partial: Partial<QuoteOverlay> = {},
): QuoteOverlay {
  return {
    quoteRef: "IS-Q001",
    revision: 1,
    assumptionMode: "free",
    showProvisional: false,
    showCostOptions: false,
    showScopeTable: true,
    showAssumptions: true,
    showExclusions: true,
    showReferencedDrawings: true,
    clientFacingTotal: 15000,
    detailLevel: "detailed",
    scopeItems: [
      {
        label: "A",
        description: "Demolition works",
        qty: "1",
        unit: "lot",
        notes: null,
      },
    ],
    costLines: [
      {
        id: "cl-1",
        label: "A",
        description: "Demolition",
        price: 13000,
        sortOrder: 0,
      },
      {
        id: "cl-2",
        label: "B",
        description: "Civil restoration",
        price: 2000,
        sortOrder: 1,
      },
    ],
    provisionalLines: [],
    costOptions: [],
    assumptions: [{ text: "Lift access available", costLineId: null }],
    exclusions: [{ text: "Hazmat beyond quoted" }],
    ...partial,
  };
}

describe("Quote HTML builder", () => {
  it("produces valid HTML with key sections", () => {
    const html = buildQuoteHtml(basePayload());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("IS-T020");
    expect(html).toContain("Cost Summary");
    expect(html).toContain("Scope of Works");
    expect(html).toContain("TERMS AND CONDITIONS");
    expect(html).toContain("ACCEPTANCE");
    expect(html).toContain("Acme Construction");
    expect(html).toContain("Raj Pudasaini");
  });

  it("HTML-escapes dynamic values", () => {
    const payload = basePayload();
    payload.tender.title = 'Test <script>alert("xss")</script>';
    const html = buildQuoteHtml(payload);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses overlay quoteRef and cost lines when provided", () => {
    const html = buildQuoteHtml(basePayload(), makeOverlay());
    expect(html).toContain("IS-Q001");
    expect(html).toContain("Demolition");
    expect(html).toContain("Civil restoration");
  });

  it("hides sections when overlay flags are false", () => {
    const overlay = makeOverlay({
      showAssumptions: false,
      showExclusions: false,
      showScopeTable: false,
      showReferencedDrawings: false,
    });
    const html = buildQuoteHtml(basePayload(), overlay);
    expect(html).not.toContain("PROJECT SPECIFIC ASSUMPTIONS");
    expect(html).not.toContain("PROJECT SPECIFIC EXCLUSIONS");
    expect(html).not.toContain("Referenced Drawings");
  });

  it("renders cost options when enabled", () => {
    const overlay = makeOverlay({
      showCostOptions: true,
      costOptions: [
        {
          label: "X",
          description: "Extra demolition",
          price: 5000,
          notes: null,
        },
      ],
    });
    const html = buildQuoteHtml(basePayload(), overlay);
    expect(html).toContain("COST OPTIONS");
    expect(html).toContain("Extra demolition");
  });

  it("renders linked assumptions grouped by cost line", () => {
    const overlay = makeOverlay({
      assumptionMode: "linked",
      assumptions: [
        { text: "Access from north", costLineId: "cl-1" },
        { text: "General note", costLineId: null },
      ],
    });
    const html = buildQuoteHtml(basePayload(), overlay);
    expect(html).toContain("— Item A");
    expect(html).toContain("Access from north");
    expect(html).toContain("— General");
    expect(html).toContain("General note");
  });

  it("renders provisional sums for non-overlay payload", () => {
    const payload = basePayload({
      scopeItems: [
        ...basePayload().scopeItems,
        {
          id: "s-2",
          wbsCode: "OTH1",
          discipline: "Other",
          rowType: "provisional",
          description: "Contingency",
          men: null,
          days: null,
          shift: null,
          measurementQty: null,
          measurementUnit: null,
          material: null,
          wasteType: null,
          wasteFacility: null,
          wasteTonnes: null,
          wasteLoads: null,
          provisionalAmount: "5000",
          notes: null,
          sortOrder: 1,
        },
      ],
    });
    const html = buildQuoteHtml(payload);
    expect(html).toContain("PROVISIONAL SUMS");
    expect(html).toContain("Contingency");
  });

  it("provides a header template with branding and quote ref", () => {
    const header = headerTemplate("IS-T020");
    expect(header).toContain("INITIAL SERVICES");
    expect(header).toContain("Demolition Licence: 2328018");
    expect(header).toContain("Quote No. IS-T020");
    expect(header).toContain("data:image/png;base64,");
  });

  it("provides a footer template with page numbers", () => {
    const footer = footerTemplate();
    expect(footer).toContain("pageNumber");
    expect(footer).toContain("totalPages");
    expect(footer).toContain("admin@initialservices.net");
  });
});

describe("Quote HTML → PDF (integration)", () => {
  let renderer: PdfRendererService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PdfRendererService],
    }).compile();
    renderer = module.get(PdfRendererService);
  });

  afterAll(async () => {
    await renderer.onModuleDestroy();
  });

  it("renders a tender-level quote (no overlay) to a valid multi-page PDF", async () => {
    const html = buildQuoteHtml(basePayload());
    const buf = await renderer.renderHtmlToPdf(html, {
      displayHeaderFooter: true,
      headerHtml: headerTemplate("IS-T020"),
      footerHtml: footerTemplate(),
      margin: { top: "30mm" },
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
    }).promise;
    expect(doc.numPages).toBeGreaterThanOrEqual(3);
    doc.destroy();
  }, 60_000);

  it("renders a per-quote PDF (with overlay) to a valid PDF", async () => {
    const html = buildQuoteHtml(basePayload(), makeOverlay());
    const buf = await renderer.renderHtmlToPdf(html, {
      displayHeaderFooter: true,
      headerHtml: headerTemplate("IS-Q001"),
      footerHtml: footerTemplate(),
      margin: { top: "30mm" },
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
    }).promise;
    expect(doc.numPages).toBeGreaterThanOrEqual(3);
    doc.destroy();
  }, 60_000);
});
