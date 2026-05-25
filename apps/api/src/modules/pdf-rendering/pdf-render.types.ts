export interface PdfRenderOptions {
  format?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerHtml?: string;
  footerHtml?: string;
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
  landscape?: boolean;
  timeoutMs?: number;
}

export const PDF_RENDER_DEFAULTS: Required<
  Pick<PdfRenderOptions, "format" | "margin" | "printBackground" | "landscape" | "timeoutMs" | "displayHeaderFooter">
> = {
  format: "A4",
  margin: { top: "25mm", right: "15mm", bottom: "20mm", left: "15mm" },
  printBackground: true,
  landscape: false,
  displayHeaderFooter: false,
  timeoutMs: 30_000,
};
