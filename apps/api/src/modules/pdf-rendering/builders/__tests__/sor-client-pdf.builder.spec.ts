import {
  buildSorClientPdfHtml,
  type SorClientPdfHeader,
  type SorClientPdfLine,
} from "../sor-client-pdf.builder";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HEADER: SorClientPdfHeader = {
  docRef: "SoR H2-2026",
  clientName: "Acme Construction",
  contactName: "Jane Doe",
  projectTitle: "Level 3 Demolition",
  siteAddress: "123 Main St, Brisbane QLD 4000",
  preparedBy: "Raj Pudasaini",
  preparedByEmail: "raj@initialservices.net",
};

const LABOUR_LINE: SorClientPdfLine = {
  id: "rate-labour-1",
  category: "LABOUR",
  name: "Demolition Labourer",
  class: "Class 3",
  ordinary: "65.00",
  oneAndHalf: "97.50",
  double: "130.00",
  comments: null,
};

const PLANT_LINE: SorClientPdfLine = {
  id: "rate-plant-1",
  category: "PLANT",
  name: "Excavator 5T",
  unit: "hr",
  ordinary: "185.00",
  comments: "Includes operator, fuel, and consumables",
};

const WASTE_LINE: SorClientPdfLine = {
  id: "rate-waste-1",
  category: "WASTE",
  name: "Mixed C&D Waste",
  unit: "tonne",
  ordinary: "220.00",
  comments: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildSorClientPdfHtml", () => {
  it("produces a valid HTML document structure", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  // ── BMI / margin strip assertions ──────────────────────────────────────────

  it("NEVER renders any BMI, internal margin, or cost-plus column headers", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE, PLANT_LINE, WASTE_LINE]);

    // These strings must be absent — the client must never see internal margin info.
    expect(html).not.toMatch(/bmi/i);
    expect(html).not.toMatch(/internal margin/i);
    expect(html).not.toMatch(/cost[- ]plus percentage/i);
    // isReference is an internal flag and must not appear
    expect(html).not.toMatch(/isReference/i);
    // Margin column headers must be absent
    expect(html).not.toMatch(/margin %/i);
    expect(html).not.toMatch(/mark[- ]?up %/i);
  });

  it("does not render oneAndHalf or double OT columns for PLANT or WASTE categories", () => {
    const html = buildSorClientPdfHtml(HEADER, [PLANT_LINE, WASTE_LINE]);

    // OT header text must not appear when there are no labour rows
    expect(html).not.toContain("1.5x ($/hr)");
    expect(html).not.toContain("2x ($/hr)");
  });

  // ── Header / cover section ─────────────────────────────────────────────────

  it("renders the document reference in the header section", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain(HEADER.docRef);
  });

  it("renders the client name in the header section", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("Acme Construction");
  });

  it("renders the contact name in the header section", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("Jane Doe");
  });

  it("renders the project title when provided", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("Level 3 Demolition");
  });

  it("renders the prepared-by name when provided", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("Raj Pudasaini");
  });

  // ── Rate table ─────────────────────────────────────────────────────────────

  it("renders Labour OT columns (Ordinary, 1.5x, 2x) for LABOUR lines", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("1.5x ($/hr)");
    expect(html).toContain("2x ($/hr)");
    expect(html).toContain("Demolition Labourer");
  });

  it("renders unit + rate columns for PLANT lines", () => {
    const html = buildSorClientPdfHtml(HEADER, [PLANT_LINE]);
    expect(html).toContain("Excavator 5T");
    expect(html).toContain("Includes operator, fuel, and consumables");
  });

  it("renders unit + rate columns for WASTE lines", () => {
    const html = buildSorClientPdfHtml(HEADER, [WASTE_LINE]);
    expect(html).toContain("Mixed C&amp;D Waste");
  });

  it("groups lines by category with section headings", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE, PLANT_LINE, WASTE_LINE]);
    expect(html).toContain("Labour");
    expect(html).toContain("Plant &amp; Equipment");
    expect(html).toContain("Waste Disposal");
  });

  it("renders a placeholder when no lines are provided", () => {
    const html = buildSorClientPdfHtml(HEADER, []);
    expect(html).toContain("No applicable lines selected");
  });

  // ── Terms / signature ──────────────────────────────────────────────────────

  it("renders the TERMS AND CONDITIONS section", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("TERMS AND CONDITIONS");
  });

  it("renders the ACKNOWLEDGEMENT / signature block", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("ACKNOWLEDGEMENT");
    // Signature field markers
    expect(html).toContain("Signature");
    expect(html).toContain("Full name");
  });

  it("includes the client name in the signature block", () => {
    const html = buildSorClientPdfHtml(HEADER, [LABOUR_LINE]);
    expect(html).toContain("ACME CONSTRUCTION");
  });

  // ── HTML safety ────────────────────────────────────────────────────────────

  it("HTML-escapes special characters in rate names", () => {
    const lineSafety: SorClientPdfLine = {
      id: "r-safe",
      category: "PLANT",
      name: 'Jack & Hammer <XSS>',
      unit: "hr",
      ordinary: "95",
    };
    const html = buildSorClientPdfHtml(HEADER, [lineSafety]);
    expect(html).not.toContain("<XSS>");
    expect(html).toContain("&lt;XSS&gt;");
    expect(html).toContain("Jack &amp; Hammer");
  });
});
