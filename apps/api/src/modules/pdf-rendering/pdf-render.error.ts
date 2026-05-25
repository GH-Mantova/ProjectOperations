export class PdfRenderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PdfRenderError";
    if (cause) this.cause = cause;
  }
}
