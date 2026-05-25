import { PDF_RENDER_DEFAULTS } from "../pdf-render.types";

describe("PdfRenderOptions defaults", () => {
  it("uses A4 format", () => {
    expect(PDF_RENDER_DEFAULTS.format).toBe("A4");
  });

  it("uses IS PDF spec margins (15mm L/R, 25mm top, 20mm bottom)", () => {
    expect(PDF_RENDER_DEFAULTS.margin).toEqual({
      top: "25mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    });
  });

  it("prints background by default", () => {
    expect(PDF_RENDER_DEFAULTS.printBackground).toBe(true);
  });

  it("defaults to portrait", () => {
    expect(PDF_RENDER_DEFAULTS.landscape).toBe(false);
  });

  it("defaults to no header/footer", () => {
    expect(PDF_RENDER_DEFAULTS.displayHeaderFooter).toBe(false);
  });

  it("has a 30-second render timeout", () => {
    expect(PDF_RENDER_DEFAULTS.timeoutMs).toBe(30_000);
  });
});
